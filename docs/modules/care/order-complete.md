# POST /api/v1/care/orders/:id/complete

> 契约同 [API §3](../../API.md#3-互助服务carem2)；D-011 #5（双角色语义）。

## 请求

`Idempotency-Key` 必须。按调用者角色分流：

| 调用者 | 前置 | 行为 |
|---|---|---|
| 服务者 | `IN_PROGRESS` | 全部 visit 完成，或 EXCEPTION/MISSED/CANCELLED 已说明 → `COMPLETION_SUBMITTED` |
| 需求方 | `COMPLETION_SUBMITTED` | 确认 → `COMPLETED`（写 `completed_at`）；**存在未决纠纷时拒绝** |

响应 200：`OrderView`（同 key 重放幂等）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 缺幂等键 |
| `ORDER_STATE_INVALID` | 409 | 状态不符 / visit 未完成且无说明 / 纠纷未决 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
