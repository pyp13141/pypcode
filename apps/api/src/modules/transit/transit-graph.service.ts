import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';

export interface RouteLeg {
  lineId: string;
  lineName: string;
  fromStation: string;
  toStation: string;
  stops: number;
  minutes: number;
}

export interface RoutePlan {
  totalMinutes: number;
  transfers: number;
  legs: RouteLeg[];
}

interface GraphEdge {
  toId: string;
  minutes: number;
  kind: 'RIDE' | 'TRANSFER';
  lineId?: string;
}

/**
 * 地铁路径规划（D-009）：transit_edges 上的 Dijkstra。
 * 无外部依赖；换乘=TRANSFER 边（导入时按同名/近距离站点预计算）。
 */
@Injectable()
export class TransitGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async planRoute(cityId: string, fromId: string, toId: string): Promise<RoutePlan> {
    if (fromId === toId) {
      throw new BadRequestException({ code: ERROR_CODES.TRANSIT_SAME_STATION, message: '起点与终点是同一站' });
    }
    const stations = await this.prisma.transitStation.findMany({
      where: { cityId, id: { in: [fromId, toId] } },
    });
    if (stations.length !== 2) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '站点不存在' });
    }

    const edgesRaw = await this.prisma.transitEdge.findMany({
      where: { fromStation: { cityId } },
      include: { fromStation: { include: { lineStations: { include: { line: true } } } } },
    });
    if (edgesRaw.length === 0) {
      throw new NotFoundException({ code: ERROR_CODES.TRANSIT_DATA_EMPTY, message: '该城市地铁数据未导入' });
    }

    // 建图：邻接表；RIDE 边记录所属线路用于 leg 分组与换乘判定
    const TRANSFER_PENALTY_MIN = 5; // 共站换线的换乘步行惩罚（契约：docs/modules/transit/route.md）
    const graph = new Map<string, GraphEdge[]>();
    const stationLineOf = new Map<string, Map<string, string>>(); // stationId -> lineId -> lineName
    for (const e of edgesRaw) {
      const list = graph.get(e.fromStationId) ?? [];
      let lineId: string | undefined;
      if (e.kind === 'RIDE') {
        lineId = (await this.lineOfEdge(e.fromStationId, e.toStationId)) ?? undefined;
      }
      list.push({ toId: e.toStationId, minutes: Number(e.minutes), kind: e.kind as 'RIDE' | 'TRANSFER', lineId });
      graph.set(e.fromStationId, list);
      for (const ls of e.fromStation.lineStations) {
        const m = stationLineOf.get(e.fromStationId) ?? new Map<string, string>();
        m.set(ls.line.id, ls.line.name);
        stationLineOf.set(e.fromStationId, m);
      }
    }

    // Dijkstra（状态含"到达该站且最后乘坐的线路"，换乘边计惩罚）
    type State = { id: string; lineId: string | null };
    const dist = new Map<string, number>();
    const prev = new Map<string, { state: State; edge: GraphEdge }>();
    const start: State = { id: fromId, lineId: null };
    dist.set(key(start), 0);
    const queue: { state: State; d: number }[] = [{ state: start, d: 0 }];

    while (queue.length > 0) {
      queue.sort((a, b) => a.d - b.d);
      const cur = queue.shift()!;
      if (cur.d > (dist.get(key(cur.state)) ?? Infinity)) continue;
      if (cur.state.id === toId) break;
      for (const edge of graph.get(cur.state.id) ?? []) {
        // TRANSFER 边：边 minutes 即换乘步行耗时；共站换线（RIDE 但线路与当前乘坐线不同）加惩罚
        const changedLine =
          edge.kind === 'RIDE' && edge.lineId != null && cur.state.lineId != null && edge.lineId !== cur.state.lineId;
        const penalty = edge.kind === 'TRANSFER' ? edge.minutes : changedLine ? TRANSFER_PENALTY_MIN : 0;
        const next: State = { id: edge.toId, lineId: edge.kind === 'RIDE' ? (edge.lineId ?? cur.state.lineId) : cur.state.lineId };
        const nd = cur.d + edge.minutes + penalty;
        if (nd < (dist.get(key(next)) ?? Infinity)) {
          dist.set(key(next), nd);
          prev.set(key(next), { state: cur.state, edge });
          queue.push({ state: next, d: nd });
        }
      }
    }

    // 找到 toId 的最优状态（任意线路）
    let bestKey: string | null = null;
    let bestDist = Infinity;
    for (const [k, d] of dist) {
      const st = parseKey(k);
      if (st.id === toId && d < bestDist) {
        bestDist = d;
        bestKey = k;
      }
    }
    if (bestKey === null) {
      throw new NotFoundException({ code: ERROR_CODES.TRANSIT_NO_ROUTE, message: '两站之间无可达路径' });
    }

    // 回溯：每个节点（除起点外）持有"到达它的边"，供 leg 折叠使用
    const path: { state: State; edge: GraphEdge | null }[] = [];
    let cursor = parseKey(bestKey);
    for (;;) {
      const p = prev.get(key(cursor));
      if (!p) {
        path.unshift({ state: cursor, edge: null }); // 起点
        break;
      }
      path.unshift({ state: cursor, edge: p.edge }); // 当前节点 + 到达它的边
      cursor = p.state;
    }

    // 把 RIDE 边折叠成 leg（同线连续段）
    const stationNames = new Map(
      (await this.prisma.transitStation.findMany({ where: { cityId }, select: { id: true, name: true } })).map((s) => [s.id, s.name]),
    );
    const legs: RouteLeg[] = [];
    let curLeg: RouteLeg | null = null;
    for (let i = 1; i < path.length; i++) {
      const edge = path[i]!.edge!;
      if (edge.kind === 'RIDE' && edge.lineId) {
        const line = await this.prisma.transitLine.findUnique({ where: { id: edge.lineId } });
        if (curLeg && curLeg.lineId === edge.lineId && curLeg.toStation === stationNames.get(path[i - 1]!.state.id)) {
          curLeg.stops += 1;
          curLeg.minutes += edge.minutes;
          curLeg.toStation = stationNames.get(edge.toId) ?? curLeg.toStation;
        } else {
          if (curLeg) legs.push(curLeg);
          curLeg = {
            lineId: edge.lineId,
            lineName: line?.name ?? '未知线路',
            fromStation: stationNames.get(path[i - 1]!.state.id) ?? '?',
            toStation: stationNames.get(edge.toId) ?? '?',
            stops: 1,
            minutes: edge.minutes,
          };
        }
      } else {
        // TRANSFER 边：换乘步行，不计入乘坐段
        if (curLeg) {
          legs.push(curLeg);
          curLeg = null;
        }
      }
    }
    if (curLeg) legs.push(curLeg);

    return { totalMinutes: Math.round(bestDist), transfers: Math.max(0, legs.length - 1), legs };
  }

  private readonly edgeLineCache = new Map<string, string | null>();

  /** RIDE 边归属线路：查两端共同出现的 line_stations */
  private async lineOfEdge(fromId: string, toId: string): Promise<string | null> {
    const cacheKey = `${fromId}>${toId}`;
    if (this.edgeLineCache.has(cacheKey)) return this.edgeLineCache.get(cacheKey)!;
    const fromLines = await this.prisma.transitLineStation.findMany({ where: { stationId: fromId }, select: { lineId: true, seq: true } });
    const toLines = await this.prisma.transitLineStation.findMany({ where: { stationId: toId }, select: { lineId: true, seq: true } });
    let result: string | null = null;
    for (const fl of fromLines) {
      for (const tl of toLines) {
        if (fl.lineId === tl.lineId && Math.abs(fl.seq - tl.seq) === 1) {
          result = fl.lineId;
        }
      }
    }
    this.edgeLineCache.set(cacheKey, result);
    return result;
  }
}

function key(s: { id: string; lineId: string | null }): string {
  return `${s.id}|${s.lineId ?? '-'}`;
}
function parseKey(k: string): { id: string; lineId: string | null } {
  const [id, line] = k.split('|');
  return { id: id!, lineId: line === '-' ? null : line };
}
