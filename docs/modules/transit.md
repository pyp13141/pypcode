# 模块：transit（地铁）

> 二级契约：docs/API.md §5.5。决策依据：D-009（零地图 API）。

## 职责

地铁静态数据查询、路径规划（本地 Dijkstra）、用户常驻站。**不接任何地图/定位/地理编码服务。**

## 设计要点（D-009）

| 需求 | 方案 | 为什么 |
|---|---|---|
| "离哪个地铁站最近" | 用户自选常驻站 + 地址文本模糊匹配候选（`match-address` 二期） | "地址→坐标"=地理编码=收费 API；自选更准且隐私更好 |
| "怎么坐地铁去对方" | transit_edges 预计算 + Dijkstra | 纯本地图算法，静态数据，零外部依赖 |
| 最后一公里 | 客户端跳转本地地图 App（amap://、baidumap:// 等深链） | 服务器零成本；不碰地图授权 |
| 数据来源 | OSM Overpass（ODbL，署名 © OpenStreetMap contributors） | 可商用（署名）；导入脚本幂等可重跑 |

## 代码位置

```
apps/api/src/modules/transit/
├── transit.module.ts
├── transit-graph.service.ts      # Dijkstra + 换乘折叠
└── endpoints/
    ├── cities/       # GET /transit/cities
    ├── stations/     # GET /transit/stations（模糊搜索）
    ├── route/        # GET /transit/route（路径规划）
    └── my-stations/  # GET/POST/DELETE /me/stations
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET | /api/v1/transit/cities | [cities](transit/cities.md) | ✅ |
| GET | /api/v1/transit/stations | [stations](transit/stations.md) | ✅ |
| GET | /api/v1/transit/route | [route](transit/route.md) | ✅ |
| GET/POST/DELETE | /api/v1/me/stations[/:stationId] | [my-stations](transit/my-stations.md) | ✅ |
| POST | /api/v1/transit/match-address | API §5.5（二期：地址文本匹配候选） | ⏳ |

## 数据运维

```bash
# 导入/更新城市数据（幂等，按 osm_node_id upsert）
cd apps/api && DATABASE_URL=... node scripts/import-osm-subway.mjs 深圳
```

- 耗时参数：RIDE 3 分/段、TRANSFER 5 分、换乘距离阈值 250m（脚本顶部常量）。
- 已导入：深圳（2026-10-10，42 线路/859 站/2450 边）。新城市按需导入，无地铁城市回退区域码。
- 线路/站点随 OSM 更新变化；重新跑脚本即更新，不删用户常驻站关联（station id 稳定）。

## 错误码

`TRANSIT_SAME_STATION` `TRANSIT_NO_ROUTE` `TRANSIT_DATA_EMPTY`（见 [ERRORS](../ERRORS.md#transit)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M1.5）；深圳数据入库 |

## 已知问题（2026-01-10）

- **OSM 换乘站多节点**：OSM 常把换乘站按线路记为多个同名节点（如"红岭"在 3/9 号线各一个节点），导入后表现为站点搜索出现同名多条目；换乘边已连通它们，路径可算，但 totalMinutes 会含站内换乘步行惩罚（与 legs 分钟数之差）。二期优化方向：导入时按"同城+同名+距离阈值"合并为单站多线。
- 每条线路在 OSM 有正反两个方向关系，导入为同一组站点两条 line 记录（seq 方向不同），站点统计已按 osm 去重。
