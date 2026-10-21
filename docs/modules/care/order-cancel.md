# POST /api/v1/care/orders/:id/cancel

> 契约同 [API §3](../../API.md#3-互助服务carem2)；取消规则语义见 DECISIONS D-011 #4。

## 请求

参与方。`{ "reasonCode": "REQUESTER_CHANGED_PLAN|PROVIDER_UNAVAILABLE|SCHEDULE_CONFLICT|NO_RESPONSE|PET_UNWELL|OTHER", "note": "≤500字（可选）" }`

## 规则

| 订单状态 | 行为 |
|---|---|
| `PENDING_CONFIRMATION` | 立即 `CANCELLED`（记录取消方=事件 actor、`cancel_reason_code`） |
| `CONFIRMED` 且 `cancelRule=FREE` 且未到约定开始时间 | 立即 `CANCELLED` |
| `CONFIRMED`（MUTUAL）/ `IN_PROGRESS` / `COMPLETION_SUBMITTED` | 首次 → `CANCEL_REQUESTED`（需对方同意） |
| `CANCEL_REQUESTED` | 对方再次调用 → `CANCELLED`（视为同意）；取消方重复调用 → 409 |
| `COMPLETED` / `CANCELLED` / `DISPUTED` | 409 `ORDER_CANCEL_NOT_ALLOWED` |

响应 200：`OrderView`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
