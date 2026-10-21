# /api/v1/admin/disputes（列表/证据/裁定/申诉）

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。角色：`support_operator`。

## GET 列表

`?status=&caseType=CARE|MARKET&page=`；含业务对象摘要（订单号/交易物品标题），**不含私密地址/紧急联系人**。

## POST :id/evidence `{ note }`

追加 `dispute_events(EVIDENCE_ADD)`，状态置 `EVIDENCE`（追加式历史，不可改删）。

## POST :id/ruling `{ resolutionCode, reason }`

`resolutionCode ∈ COMPLETED | CANCELLED | NO_FAULT`：

| 结论 | 行为 |
|---|---|
| COMPLETED | 订单/交易 → COMPLETED（写业务事件 actorRole=ADMIN）+ 工单 `RULED` |
| CANCELLED | 订单/交易 → CANCELLED（写 `cancelled_at` 与 `ADMIN_RULING` 原因）+ 工单 `RULED` |
| NO_FAULT | 无法判定：工单退回 `PENDING_RULING`（继续举证），**不动业务状态**（不伪造完成） |

通知双方 `DISPUTE_RULED`；写审计（操作者/时间/理由/结论）。仅未决状态可裁定（否则 409）。

## POST :id/appeal `{ reason }`

仅 `RULED` 可申诉 → `APPEALING`（追加 `APPEAL` 事件，写审计）；再审裁定由 support 再次调用 ruling。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4）；裁定驱动终态并保留业务事件链 |
