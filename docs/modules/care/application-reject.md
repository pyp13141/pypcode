# POST /api/v1/care/applications/:applicationId/reject

> 契约同 [API §3](../../API.md#3-互助服务carem2)。

## 请求

- 仅需求方可调用（其他调用者 404）。
- `{ "reason": "≤200字（可选，写 decision_note）" }`

## 行为

`PENDING → REJECTED`（记 `decided_at`）；已是其他终态 → 409 `APPLICATION_STATE_INVALID`（终态不可再变）。

响应 200：`ApplicationView`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
