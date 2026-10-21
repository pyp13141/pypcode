# GET / PUT / DELETE /api/v1/me/blocks[/:userId]

> 契约同 [API §1.2](../../API.md#12-我的资料)。

## 说明

屏蔽关系管理（防骚扰）。M4 起信息流/评论按此过滤；当前只维护关系。

## 接口

| 方法 | 路径 | 语义 | 幂等 |
|---|---|---|---|
| GET | /me/blocks | 我的屏蔽列表（≤100，倒序） | — |
| PUT | /me/blocks/:userId | 屏蔽 | ✅ 重复屏蔽返回成功 |
| DELETE | /me/blocks/:userId | 取消屏蔽 | ✅ 未屏蔽也返回成功 |

## 响应

- GET: `[{ id, nickname, avatarUrl, blockedAt }]`
- PUT: `{ "blocked": true }`；DELETE: `{ "blocked": false }`

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `SELF_BLOCK_NOT_ALLOWED` | 400 | userId = 自己 |
| `BLOCK_TARGET_NOT_FOUND` | 404 | PUT 时目标用户不存在/已注销 |

## 实现约束

- 复合 PK (blocker, blocked) + upsert 保证幂等；DB CHECK 禁自屏蔽（应用层先拦）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
