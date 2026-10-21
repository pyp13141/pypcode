# POST /api/v1/care/orders/:id/visits

> 契约同 [API §3](../../API.md#3-互助服务carem2)；状态机 [STATE_MACHINES §5](../../STATE_MACHINES.md)。

## 请求

- 参与方均可创建（约定上门计划）；`Idempotency-Key` 必须。
- `{ "scheduledAt": "ISO", "notes": "≤500字（可选）" }`

## 行为

订单必须 `IN_PROGRESS`；`seq` 按订单自动递增（UNIQUE(care_order_id, seq)）；创建即 `SCHEDULED`。

响应 201：`VisitView`（同 key 重放返回同一 visit）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 缺幂等键 / 时间格式非法 |
| `RESOURCE_NOT_FOUND` | 404 | 非参与方 / 订单不存在 |
| `ORDER_STATE_INVALID` | 409 | 订单非 IN_PROGRESS |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
