# POST /api/v1/care/applications/:applicationId/withdraw

> 契约同 [API §3](../../API.md#3-互助服务carem2)。

## 请求

- 仅申请人可调用（其他调用者 404）。
- `{ "reason": "≤200字（可选，写 decision_note）" }`

## 行为

`PENDING → WITHDRAWN`；已是其他终态 → 409 `APPLICATION_STATE_INVALID`。
**撤回后同一需求不可再次申请**（UNIQUE(request_id, applicant_user_id)，ERD）。

响应 200：`ApplicationView`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
