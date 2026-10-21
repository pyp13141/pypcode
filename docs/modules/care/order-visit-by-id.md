# PATCH /api/v1/care/orders/:id/visits/:visitId

> 契约同 [API §3](../../API.md#3-互助服务carem2)；状态机 [STATE_MACHINES §5](../../STATE_MACHINES.md)。

## 请求

仅服务者。`{ "action": "START|COMPLETE|EXCEPTION|MISSED|CANCEL", "notes": "≤1000字", "evidence": [{ "evidenceType": "NOTE", "note": "≤1000字" }] }`

流转（VISIT_TRANSITIONS）：`SCHEDULED → IN_PROGRESS|COMPLETED|MISSED|CANCELLED|EXCEPTION`；
`IN_PROGRESS → COMPLETED|EXCEPTION|MISSED`。`EXCEPTION/MISSED/CANCEL` **必填说明**（否则 400）。

- `COMPLETE` 置 `completed_at`；`START` 置 `started_at`；完成后作为订单整体完成的必要条件；
- `evidence` 仅支持 NOTE 文本（写入 `care_evidence`；写 `sensitive_access_logs` 的 EVIDENCE 组）；
  **PHOTO 依赖媒体上传管线（M4），当前返回 400**（D-011 #9）；
- 订单必须 `IN_PROGRESS`。

响应 200：`VisitView`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 缺说明 / PHOTO 凭证 / action 非法 |
| `RESOURCE_NOT_FOUND` | 404 | visit 不属于该订单 / 非参与方 |
| `VISIT_STATE_INVALID` | 409 | 非服务者 / visit 非法流转 |
| `ORDER_STATE_INVALID` | 409 | 订单非 IN_PROGRESS |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
