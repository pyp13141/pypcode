# POST /api/v1/community/help-posts/:id/cancel

> 契约同 [API §5.6](../../API.md#56-通用求助帖help_posts--m4d-010契约先行)。

仅发帖人（否则 404）；`OPEN → CLOSED`；已 CLOSED 幂等返回，其他终态 404。
响应 200：`{ id, status }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
