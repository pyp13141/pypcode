# POST /api/v1/market/deals/:id/disputes

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)；纠纷与举报分离（ERD §4）。

## 请求

参与方。`{ "reasonCode": "ITEM_NOT_AS_DESCRIBED|NO_SHOW|DAMAGE|FRAUD_SUSPECTED|PROHIBITED_ITEM|OTHER", "description": "5-1000字" }`

## 行为（单事务）

1. 已有未决工单 → 409 `DISPUTE_ALREADY_OPEN`；
2. 交易状态 ∈ {AGREEMENT_PENDING, AGREED, HANDED_OVER}（否则 409）；
3. 创建 `disputes` 工单（case_type=MARKET，`market_deal_id` 非空，CHECK 恰一目标）+ `dispute_events`（SYSTEM，追加式）；
4. 交易 → `DISPUTED`（事件记录原因；裁定/申诉由 M4 后台实现）。

响应 200：`{ id, caseType, marketDealId, status, reasonCode, description, openedBy, openedByRole, createdAt }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
