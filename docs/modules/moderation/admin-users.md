# GET /api/v1/admin/users · POST /api/v1/admin/users/:id/status

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。角色：`content_moderator`。

## GET 检索

`?query=（昵称包含）&status=&page=`；含风险标签（MVP：被举报次数 `reportCountAgainst`、被屏蔽次数 `blockedByCount`）。
不返回手机号/精确地址等敏感字段。

## POST 封禁/解封

`{ "status": "ACTIVE|BANNED", "reason": "必填（2-200字）" }`

- **封禁即撤销该用户全部会话**；封禁用户新登录被拒 403 `USER_BANNED`（API §1.1）；
- 写 `admin_audit_logs`（操作人/理由/前后状态）。

响应 200：`{ userId, status }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
