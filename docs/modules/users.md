# 模块：users（用户）

> 二级契约：docs/API.md §1.2。

## 职责

本人资料读写、隐私设置、屏蔽关系。不含认证（见 identity）。

## 代码位置

```
apps/api/src/modules/users/
├── users.module.ts
└── endpoints/
    ├── me/          # GET /me
    ├── me-profile/  # PATCH /me/profile
    ├── me-privacy/  # PATCH /me/privacy
    └── me-blocks/   # GET/PUT/DELETE /me/blocks[/:userId]
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET | /api/v1/me | [me](users/me.md) | ✅ |
| PATCH | /api/v1/me/profile | [me-profile](users/me-profile.md) | ✅ |
| PATCH | /api/v1/me/privacy | [me-privacy](users/me-privacy.md) | ✅ |
| GET/PUT/DELETE | /api/v1/me/blocks[/:userId] | [me-blocks](users/me-blocks.md) | ✅ |
| POST | /api/v1/me/deletion-request | API §1.2（M2） | ⏳ |

## 关键规则

- 所有响应走字段白名单；明文手机号、openid 永不出现。
- 屏蔽：幂等 PUT/DELETE；禁自屏蔽；M4 起信息流按屏蔽关系过滤。

## 错误码

`SELF_BLOCK_NOT_ALLOWED` `BLOCK_TARGET_NOT_FOUND`（见 [ERRORS](../ERRORS.md#users)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M1） |
