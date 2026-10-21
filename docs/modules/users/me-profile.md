# PATCH /api/v1/me/profile

> 契约同 [API §1.2](../../API.md#12-我的资料)。

## 说明

更新本人资料；只动传入字段（部分更新）。

## 请求

`{ nickname?(3-20字), avatarUrl?(≤512), bio?(≤200字), areaCode?(≤32) }`

未传字段保持原值；`null` 不用于清空（清空语义二期定）。

## 响应 200

`{ id, nickname, avatarUrl, bio, areaCode }`

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 字段超长/类型错误（class-validator 白名单拦截未知字段） |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
