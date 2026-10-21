# POST /api/v1/care/orders/:id/reviews

> 契约同 [API §3](../../API.md#3-互助服务carem2)；ERD 不变量 8。

## 请求

参与方。`Idempotency-Key` 必须。
`{ "rating": 1-5, "tags": ["≤10个，每个≤20字"], "content": "≤500字" }`

## 行为

- 仅 `COMPLETED` 订单（否则 409 `REVIEW_NOT_ALLOWED`）；
- reviewer=调用者、reviewee=对方、role 由服务端推导（REQUESTER/PROVIDER）；
- **每方一次**：UNIQUE(target_type, target_id, reviewer_user_id) → 重复 409 `REVIEW_ALREADY_EXISTS`；
- 未决争议期间暂缓公开展示：status=`DISPUTED_HIDDEN`（否则 `VISIBLE`）；
- 幂等键重放返回同一评价。

响应 200：`ReviewView`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | rating 越界 / 缺幂等键 |
| `RESOURCE_NOT_FOUND` | 404 | 非参与方 |
| `REVIEW_NOT_ALLOWED` | 409 | 订单非 COMPLETED |
| `REVIEW_ALREADY_EXISTS` | 409 | 该订单该方已评价 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
