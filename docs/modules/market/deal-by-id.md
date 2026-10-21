# GET /api/v1/market/deals/:id

> 契约同 [API §4](../../API.md#4-本地集市market--媒体m3)。

## 语义

- **仅参与方**（买家/卖家）；非参与方与不存在一律 **404 `RESOURCE_NOT_FOUND`**（不泄露交易存在性，与 care 订单同语义）。
- 响应即 `MarketDealView`（与 `POST /market/deals`、列表同构），含 `conversationId` 供客户端进入受限会话。
- 2026-10-11 补口：客户端交易详情页自首个版本即调用本路由，此前契约与实现均缺失（UX-REVIEW P0-3：发起交易后详情页 404）。

## 响应 200

`MarketDealView { id, listingId, status, role, buyer, seller, listing{...}, handoverAt, handoverArea, completedAt, cancelledAt, cancelReason, conversationId, createdAt }`

## 错误

| 码 | HTTP | 条件 |
|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | 交易不存在或调用方非参与方 |
| `AUTH_REQUIRED` | 401 | 未登录 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版：补齐客户端已依赖的详情路由（UX-REVIEW P0-3） |
