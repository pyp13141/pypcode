# POST /api/v1/care/orders/:id/confirm

> 契约同 [API §3](../../API.md#3-互助服务carem2)；状态机 [STATE_MACHINES §4](../../STATE_MACHINES.md)。

## 行为

参与方双方**各自**确认条款：写 `confirmed_by_requester_at` / `confirmed_by_provider_at`；
双方都确认 → `PENDING_CONFIRMATION → CONFIRMED`（写订单事件）。

- 同一方重复调用：幂等（返回当前视图，不报错）；
- 确认前置：需求方必须先经 `PUT /private-details` 登记服务地址，否则 409 `ORDER_PRIVATE_DETAILS_REQUIRED`（D-011：不能让服务者在无地址的情况下确认订单）；
- 条款版本：当前实现单版本（v1）；版本不一致时的保护在条款变更功能引入时以 `terms_version` 校验落地。

响应 200：`OrderView`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `ORDER_STATE_INVALID` | 409 | 订单非 PENDING_CONFIRMATION（且本人尚未确认） |
| `ORDER_PRIVATE_DETAILS_REQUIRED` | 409 | 地址未登记 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
