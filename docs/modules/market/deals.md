# GET / POST /api/v1/market/deals

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)；状态机 [STATE_MACHINES §6](../../STATE_MACHINES.md)。

## POST — 发起交易

`{ "listingId": "uuid", "message": "≤500字（可选，作为会话首条消息）" }`

- 列表必须 `PUBLISHED`（否则 409 `LISTING_NOT_AVAILABLE`）；买家≠卖家（400）；
- **不托管资金**；创建 `deal(CONTACTED)` + 受限会话（conversation_type=MARKET_DEAL，双方参与）+ 首条留言；
- 同一买家对同一列表已有未终结交易 → 409 `DEAL_ALREADY_IN_PROGRESS`；
- 多个买家可同时咨询（CONTACTED 不限），一物一单在 agree/complete 阶段强制。

响应 201：`MarketDealView`。

## GET — 我的交易列表（仅交易双方）

`?role=BUYER|SELLER&status=（七态）&page=&pageSize=`；响应分页 `data: MarketDealView[]`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `LISTING_NOT_AVAILABLE` | 409 | 列表不可交易 |
| `DEAL_ALREADY_IN_PROGRESS` | 409 | 该买家已有未终结交易 |
| `REQUEST_VALIDATION_FAILED` | 400 | 与自己交易/参数非法 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3）；会话创建随交易（消息端点 M4） |
