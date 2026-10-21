# GET / POST /api/v1/care/requests/:id/applications

> 契约同 [API §3](../../API.md#3-互助服务carem2)；状态机 [STATE_MACHINES §3](../../STATE_MACHINES.md)。

## POST — 提交服务申请（不创建订单）

请求：`{ "message": "≤500字", "proposedPriceMinor": 8000 }`（报价可选，≥0 整数分）。

响应 201：`ApplicationView`（`status=PENDING`）。

约束：申请人 ≠ 需求方；需求须 `PUBLISHED`；**同一 request+applicant 唯一**（DB 约束）——
重复提交 409；撤回/被拒后**不可重复申请**（每个申请只有一个终态，ERD 不变量）。

## GET — 查看本需求的申请列表（仅需求方）

响应 200：`ApplicationView[]`（全部状态，按创建时间升序）。非需求方（含申请人本人）→ 404。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 申请自己的需求 / 报价非法 |
| `REQUEST_NOT_OPEN` | 409 | 需求已 MATCHED/关闭 |
| `RESOURCE_CONFLICT` | 409 | 该需求已提交过申请（UNIQUE 约束） |
| `RESOURCE_NOT_FOUND` | 404 | 需求不存在 / 查看列表非需求方 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
