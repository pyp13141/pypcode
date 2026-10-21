# 模块：moderation（治理与后台）

> 二级契约：docs/API.md §5（举报段）+ §6（后台）。产品依据：PRODUCT_DESIGN 7.4/11.6；后台权限矩阵见 §11.6。

## 职责

内容举报工单（与交易纠纷分离）与**后台管理端**：用户治理、审核队列、举报处置、纠纷裁定/申诉、
只读订单/交易记录、类目/徽章/榜单/风控配置、聚合指标、操作审计。

## 后台权限（最小权限，AdminGuard + @AdminRoles）

| 角色 | 可访问 |
|---|---|
| `content_moderator` | 用户治理、审核队列与决定、举报处置 |
| `support_operator` | 举报处置、纠纷裁定/证据/申诉、订单/交易只读 |
| `catalog_operator` | 类目、徽章、榜单配置（读） |
| `analyst` | 聚合指标、订单/交易只读 |
| `super_admin` | 全部（含风控规则/榜单配置写入、审计日志）——高危配置改动必须走此角色 |

**硬规则**：所有后台写操作 `admin_audit_logs` 追加式审计（操作人/时间/理由/资源）；私密地址、紧急联系人
**默认不可见**（只读记录接口不含这些字段；按工单临时授权的专用路径待评，D-013）；裁定驱动底层业务终态
但仍写业务事件表（不伪造完成）。

## 后台账号授权

```bash
cd apps/api && node scripts/grant-admin.mjs --list                       # 找 userId
node scripts/grant-admin.mjs <userId|昵称> content_moderator             # 授权
node scripts/grant-admin.mjs <userId> disable                            # 停用
```

## 代码位置

```
apps/api/src/modules/moderation/
├── moderation.module.ts
├── moderation-state.ts        # 举报枚举/角色/裁定结论
├── admin.guard.ts             # 后台守卫（ACTIVE + 角色）
├── admin-roles.decorator.ts / current-admin.decorator.ts
├── admin-audit.service.ts     # 追加式后台审计
└── endpoints/                 # reports / my-reports / admin-*（10 个）
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| POST | /api/v1/reports | [reports](moderation/reports.md) | ✅ |
| GET | /api/v1/me/reports | [my-reports](moderation/my-reports.md) | ✅ |
| GET/POST | /api/v1/admin/users，/:id/status | [admin-users](moderation/admin-users.md) | ✅ |
| GET/POST | /api/v1/admin/moderation/queue，/:id/decision | [admin-moderation](moderation/admin-moderation.md) | ✅ |
| GET/POST | /api/v1/admin/reports，/:id/assign，/:id/resolve | [admin-reports](moderation/admin-reports.md) | ✅ |
| GET/POST | /api/v1/admin/disputes，/:id/evidence，/:id/ruling，/:id/appeal | [admin-disputes](moderation/admin-disputes.md) | ✅ |
| GET | /api/v1/admin/care-orders，/market-deals | [admin-records](moderation/admin-records.md) | ✅ |
| GET/PUT | /api/v1/admin/categories，badges，leaderboard-config，risk-rules | [admin-config](moderation/admin-config.md) | ✅ |
| GET | /api/v1/admin/metrics/overview | [admin-metrics](moderation/admin-metrics.md) | ✅ |
| GET | /api/v1/admin/audit-logs | [admin-audit](moderation/admin-audit.md) | ✅ |

## 错误码

`ADMIN_REQUIRED` `ADMIN_ROLE_REQUIRED` `REPORT_DUPLICATE`（见 [ERRORS](../ERRORS.md)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M4）；举报 + 后台 10 组接口；裁定驱动终态并写业务事件 |
