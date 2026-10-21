# GET /api/v1/transit/stations

> 契约同 [API §5.5](../../API.md#55-地铁transitm15d-009零地图-api)。

## 说明

城市内站点模糊搜索（公开）。用于用户选常驻站、选规划起终点。

## 请求

| 参数 | 必填 | 说明 |
|---|---|---|
| `cityId` | ✅ | 城市 id |
| `q` | ❌ | 站名模糊（大小写不敏感 contains）；空则列出前 20 个 |

## 响应 200

```json
{
  "data": [
    {
      "id": "uuid", "name": "深大",
      "lines": [ { "id": "uuid", "ref": "1", "name": "地铁 1号线" } ]
    }
  ],
  "meta": { "requestId": "..." }, "error": null
}
```

上限 20 条；每站附经过线路（换乘站由此可见）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_INVALID` | 400 | 缺 cityId |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1.5） |
