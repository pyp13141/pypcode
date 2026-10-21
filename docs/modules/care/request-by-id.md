# GET /api/v1/care/requests/:id

> 契约同 [API §3](../../API.md#3-互助服务carem2)；状态机 [STATE_MACHINES §2](../../STATE_MACHINES.md)。

## 语义

- 公开可见：仅 `PUBLISHED`；**本人**可见全状态（DRAFT/MATCHED 等）；其余一律 **404 `RESOURCE_NOT_FOUND`**（不泄露存在性）。
- 响应 `RequestView`（与列表同构）：含 `pets` 公开摘要与 `isOwner`；**绝不含**精确地址/门禁/紧急联系人明文或密文。
- 2026-10-11 补口：客户端需求详情页依赖（UX-REVIEW P0-2：需求列表/详情/申请闭环）。

## 错误

| 码 | HTTP | 条件 |
|---|---:|---|
| `RESOURCE_NOT_FOUND` | 404 | 不存在、非 PUBLISHED 且非本人 |
| `AUTH_REQUIRED` | 401 | 仅当带无效令牌访问 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版：补齐需求详情路由（UX-REVIEW P0-2） |
