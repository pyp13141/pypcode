#!/usr/bin/env node
/**
 * OSM 地铁数据导入（D-009）：© OpenStreetMap contributors, ODbL 协议。
 * 幂等：按 osm id upsert；可重复执行；只增不删（线路调整时人工核对）。
 *
 * 用法：
 *   node scripts/import-osm-subway.mjs 深圳        # 导入指定城市
 *   node scripts/import-osm-subway.mjs 深圳 --rebuild-edges  # 重建边（含换乘）
 *
 * 原理：
 * 1. Overpass 查询城市内 route=subway 的线路关系
 * 2. 每条线路按成员顺序取 station 角色的节点（站名+坐标）
 * 3. 站点按 (city, osm_node_id) upsert；线路-站点按 seq 落库
 * 4. 边：同线相邻站=RIDE（默认 3 分/段）；同城跨线同名或 <250m=TRANSFER（默认 5 分）
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const RIDE_MINUTES = 3;
const TRANSFER_MINUTES = 5;
const TRANSFER_MAX_METERS = 250;
const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

const prisma = new PrismaClient();

function envDatabaseUrl() {
  // 与 NestJS 相同来源：apps/api/.env
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  try {
    const m = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* fall through */ }
  return process.env.DATABASE_URL;
}

async function overpass(query) {
  let lastErr = 'unknown';
  for (const instance of OVERPASS_INSTANCES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(instance, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'pet-neighbor-import/0.1 (ODbL: (c) OpenStreetMap contributors)',
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.ok) return res.json();
        lastErr = `${instance} HTTP ${res.status}`;
      } catch (e) {
        lastErr = `${instance} ${e.message}`;
      }
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error(`全部 Overpass 实例失败：${lastErr}`);
}

async function fetchLines(cityName) {
  // 两步轻量查询：先关系（含成员清单），再按 id 批量取站点节点
  const relData = await overpass(
    `[out:json][timeout:60];rel["route"="subway"]["network"~"${cityName}"];out body;`,
  );
  const relations = relData.elements.filter((e) => e.type === 'relation');
  if (relations.length === 0) return [];

  const nodeIds = new Set();
  for (const rel of relations) {
    for (const m of rel.members ?? []) {
      if (m.type === 'node' && (m.role === 'station' || m.role === 'stop')) nodeIds.add(m.ref);
    }
  }
  const ids = [...nodeIds];
  const nodeById = new Map();
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const nodeData = await overpass(
      `[out:json][timeout:60];node(id:${chunk.join(',')});out body;`,
    );
    for (const n of nodeData.elements) nodeById.set(n.id, n);
  }

  const lines = [];
  for (const rel of relations) {
    const stations = [];
    for (const member of rel.members ?? []) {
      if (member.type === 'node' && (member.role === 'station' || member.role === 'stop')) {
        const node = nodeById.get(member.ref);
        if (node && node.lat != null && node.lon != null) {
          stations.push({
            osmNodeId: String(node.id),
            name: node.tags?.name ?? '未知站',
            lat: node.lat,
            lng: node.lon,
          });
        }
      }
    }
    if (stations.length >= 2) {
      lines.push({
        ref: rel.tags?.ref ?? String(rel.id),
        name: rel.tags?.name ?? `线路${rel.tags?.ref ?? rel.id}`,
        origin: stations[0].name,
        terminus: stations[stations.length - 1].name,
        stations,
      });
    }
  }
  return lines;
}

function haversineMeters(a, b, c, d) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(c - a);
  const dLng = toRad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function rebuildEdges(cityId) {
  // 清掉该城旧边重建（幂等）
  await prisma.transitEdge.deleteMany({ where: { fromStation: { cityId } } });

  const stations = await prisma.transitStation.findMany({ where: { cityId } });
  const lineStations = await prisma.transitLineStation.findMany({
    where: { line: { cityId } },
    include: { station: true, line: true },
  });

  // RIDE 边：同线相邻 seq
  const edges = [];
  const byLine = new Map();
  for (const ls of lineStations) {
    const arr = byLine.get(ls.lineId) ?? [];
    arr.push(ls);
    byLine.set(ls.lineId, arr);
  }
  for (const arr of byLine.values()) {
    arr.sort((x, y) => x.seq - y.seq);
    for (let i = 1; i < arr.length; i++) {
      edges.push({
        fromStationId: arr[i - 1].stationId,
        toStationId: arr[i].stationId,
        kind: 'RIDE',
        minutes: RIDE_MINUTES,
      });
      edges.push({
        fromStationId: arr[i].stationId,
        toStationId: arr[i - 1].stationId,
        kind: 'RIDE',
        minutes: RIDE_MINUTES,
      });
    }
  }

  // TRANSFER 边：同城跨线，同名或 <250m
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const a = stations[i];
      const b = stations[j];
      const sameName = a.name === b.name;
      const close = haversineMeters(a.lat, a.lng, b.lat, b.lng) <= TRANSFER_MAX_METERS;
      if (sameName || close) {
        edges.push({ fromStationId: a.id, toStationId: b.id, kind: 'TRANSFER', minutes: TRANSFER_MINUTES });
        edges.push({ fromStationId: b.id, toStationId: a.id, kind: 'TRANSFER', minutes: TRANSFER_MINUTES });
      }
    }
  }

  for (const e of edges) {
    await prisma.transitEdge.upsert({
      where: { fromStationId_toStationId_kind: { fromStationId: e.fromStationId, toStationId: e.toStationId, kind: e.kind } },
      create: e,
      update: { minutes: e.minutes },
    });
  }
  return edges.length;
}

async function main() {
  const cityName = process.argv[2];
  const rebuild = process.argv.includes('--rebuild-edges');
  if (!cityName) {
    console.error('用法: node scripts/import-osm-subway.mjs <城市名> [--rebuild-edges]');
    process.exit(1);
  }
  console.log(`导入 ${cityName} 地铁数据（数据源 © OpenStreetMap contributors, ODbL）...`);
  const lines = await fetchLines(cityName);
  if (lines.length === 0) {
    console.error(`未查到 ${cityName} 的地铁线路，检查城市名是否与 OSM network 标签一致`);
    process.exit(1);
  }
  console.log(`查到 ${lines.length} 条线路`);

  const city = await prisma.transitCity.upsert({
    where: { name: cityName },
    create: { name: cityName },
    update: {},
  });

  let stationCount = 0;
  for (const line of lines) {
    const row = await prisma.transitLine.upsert({
      where: { cityId_ref: { cityId: city.id, ref: line.ref } },
      create: { cityId: city.id, name: line.name, ref: line.ref, origin: line.origin, terminus: line.terminus },
      update: { name: line.name, origin: line.origin, terminus: line.terminus },
    });
    // 幂等重跑：先清掉该线旧的站点关联，避免上次半截导入的残留 seq 冲突
    await prisma.transitLineStation.deleteMany({ where: { lineId: row.id } });

    let seq = 0;
    const seenOsm = new Set();
    for (const st of line.stations) {
      if (seenOsm.has(st.osmNodeId)) continue; // 环线/重复成员：同线同站只取首次出现
      seenOsm.add(st.osmNodeId);
      seq += 1;
      const station = await prisma.transitStation.upsert({
        where: { cityId_osmNodeId: { cityId: city.id, osmNodeId: st.osmNodeId } },
        create: { cityId: city.id, name: st.name, lat: st.lat, lng: st.lng, osmNodeId: st.osmNodeId },
        update: { name: st.name, lat: st.lat, lng: st.lng },
      });
      stationCount += 1;
      await prisma.transitLineStation.upsert({
        where: { lineId_stationId: { lineId: row.id, stationId: station.id } },
        create: { lineId: row.id, stationId: station.id, seq },
        update: { seq },
      });
    }
    console.log(`  ${line.name}：${line.stations.length} 站`);
  }

  const edgeCount = await rebuildEdges(city.id);
  const uniqStations = await prisma.transitStation.count({ where: { cityId: city.id } });
  console.log(`完成：${city.name} ${lines.length} 线路，${uniqStations} 站（站点记录 ${stationCount} 条），${edgeCount} 条边`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
