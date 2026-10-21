# GET /api/v1/transit/cities

> 契约同 [API §5.5](../../API.md#55-地铁transitm15d-009零地图-api)。

## 说明

已导入地铁数据的城市列表（公开）。

## 请求

无参数。

## 响应 200

```json
{
  "data": [
    { "id": "uuid", "name": "深圳", "lineCount": 42, "stationCount": 859 }
  ],
  "meta": { "requestId": "..." }, "error": null
}
```

仅返回 `status=ACTIVE` 的城市；按名称排序。

## 错误码

无专项。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1.5） |
