# GET /api/v1/transit/route

> 契约同 [API §5.5](../../API.md#55-地铁transitm15d-009零地图-api)。本接口是 D-009 的核心：零外部 API 的路径规划。

## 说明

两站间地铁路径规划（公开）。本地 Dijkstra：RIDE 3 分/段 + TRANSFER 换乘惩罚 5 分。

## 请求

| 参数 | 必填 |
|---|---|
| `fromStationId` | ✅ |
| `toStationId` | ✅（须与起点同城） |

## 响应 200

```json
{
  "data": {
    "totalMinutes": 24,
    "transfers": 1,
    "legs": [
      { "lineId": "uuid", "lineName": "地铁 1号线", "fromStation": "罗湖", "toStation": "会展中心", "stops": 5, "minutes": 15 },
      { "lineId": "uuid", "lineName": "地铁 4号线", "fromStation": "会展中心", "toStation": "深大", "stops": 3, "minutes": 9 }
    ]
  },
  "meta": { "requestId": "..." }, "error": null
}
```

`transfers = legs.length - 1`；totalMinutes 含换乘惩罚。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `TRANSIT_SAME_STATION` | 400 | 起终点同站 |
| `TRANSIT_NO_ROUTE` | 404 | 无可达路径 |
| `TRANSIT_DATA_EMPTY` | 503 | 该城市边数据为空（未导入） |
| `RESOURCE_NOT_FOUND` | 400 | 站点 id 不存在 |

## 实现约束

- 算法状态含"到达站+最后乘坐线路"，换乘（换线）经 TRANSFER 边计惩罚。
- 无坐标参与计算——纯图结构；站点坐标仅用于客户端跳转本地地图 App。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1.5） |
