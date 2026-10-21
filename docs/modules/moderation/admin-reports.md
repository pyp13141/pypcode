# GET /api/v1/admin/reports · POST /:id/assign · POST /:id/resolve

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。角色：`content_moderator` / `support_operator`。

- GET `?status=&page=`：工单列表（含举报人与指派对象）；
- POST assign：认领（NEW→PROCESSING，记录 `assigned_admin_id`）；
- POST resolve `{ "decision": "RESOLVED|DISMISSED", "note": "必填" }`：写 `resolution_note/resolved_at`，
  **通知举报人**，写审计。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
