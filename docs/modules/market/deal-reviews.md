# POST /api/v1/market/deals/:id/reviews

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)；ERD 不变量 8。

## 请求

参与方。`Idempotency-Key` 必须。`{ "rating": 1-5, "tags": ["≤10个"], "content": "≤500字" }`

## 行为

- 仅 `COMPLETED` 交易（否则 409 `REVIEW_NOT_ALLOWED`）；
- reviewer=调用者、reviewee=对方、role 服务端推导（BUYER/SELLER）；
- 每方一次（UNIQUE(target_type=MARKET_DEAL, target_id, reviewer_user_id)）→ 重复 409 `REVIEW_ALREADY_EXISTS`；
- 未决争议期间 `DISPUTED_HIDDEN`（否则 `VISIBLE`）；幂等键重放返回同一评价。

响应 200：`ReviewView`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
