# /api/v1/admin 配置组（categories / badges / leaderboard-config / risk-rules）

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。

| 接口 | 角色 | 说明 |
|---|---|---|
| GET/PUT `/admin/categories[/:code]` | catalog_operator | 类目风险级（LOW/MEDIUM/HIGH）与启停（HIGH 发布转人工；停用后不可发布） |
| GET/PUT `/admin/badges[/:code]` | catalog_operator | 徽章定义与启停（含发放数） |
| GET/PUT `/admin/leaderboard-config` | 读 catalog_operator；**写 super_admin** | 榜单配置（`app_settings` 键值） |
| GET/PUT `/admin/risk-rules` | 读 super_admin/support_operator；**写 super_admin** | 风控规则；**`messagePerMinute` 已接线**会话限流（D-013） |

所有写操作写 `admin_audit_logs`。响应为写入后的值。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
