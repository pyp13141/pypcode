# GET /api/v1/admin/audit-logs

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。角色：`super_admin`。

只读分页：`{ id, admin, action, resourceType, resourceId, requestId, reason, detail, createdAt }`。
表为**追加式**（触发器拒绝 UPDATE/DELETE，D-013 集成测试覆盖）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
