# POST /api/v1/care/orders/:id/disputes

> 契约同 [API §3](../../API.md#3-互助服务carem2)；纠纷与举报分离（ERD §4）。

## 请求

参与方。`{ "reasonCode": "PET_CONDITION|NO_SHOW|CANNOT_ACCESS|UNREACHABLE|DAMAGE|OTHER", "description": "5-1000字" }`

## 行为（单事务）

1. 已有未决工单（OPEN/EVIDENCE/PENDING_RULING/APPEALING）→ 409 `DISPUTE_ALREADY_OPEN`；
2. 订单状态 ∈ {IN_PROGRESS, COMPLETION_SUBMITTED, CANCEL_REQUESTED}（D-011）→ 否则 409；
3. 创建 `disputes` 工单（case_type=CARE，`care_order_id` 非空，CHECK 恰一目标非空）+ `dispute_events`（SYSTEM，追加式）；
4. 订单 → `DISPUTED`（写订单事件；**不靠改状态代替流程**，裁定/申诉由 M4 后台实现）。

响应 200：`DisputeView { id, caseType, careOrderId, status, reasonCode, description, openedBy, openedByRole, createdAt }`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | reasonCode/description 非法 |
| `RESOURCE_NOT_FOUND` | 404 | 非参与方 |
| `DISPUTE_ALREADY_OPEN` | 409 | 已有未决工单 |
| `ORDER_STATE_INVALID` | 409 | 订单状态不可发起纠纷 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
