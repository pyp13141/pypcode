# POST /api/v1/market/deals/:id/cancel

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)。

## 请求

参与方。`{ "reasonCode": "BUYER_CHANGED_MIND|SELLER_CHANGED_MIND|SCHEDULE_CONFLICT|ITEM_NOT_AS_DESCRIBED|LISTING_SOLD|NO_RESPONSE|OTHER", "note": "≤500字" }`

## 行为

`CONTACTED/AGREEMENT_PENDING/AGREED → CANCELLED`（写 `cancelled_at` + `cancel_reason_code` + 事件）。
`HANDED_OVER/COMPLETED/DISPUTED` 不可取消（409，已交接请走纠纷）。取消后买家可对同一列表重新发起新交易（旧交易已终结）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
