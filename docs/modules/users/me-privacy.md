# PATCH /api/v1/me/privacy

> 契约同 [API §1.2](../../API.md#12-我的资料)。

## 说明

更新资料公开范围。手机号任何设置下都不对外展示（该设置不影响手机号，只影响资料页）。

## 请求

`{ "profileVisibility": "PUBLIC" | "FOLLOWERS" | "PRIVATE" }`

## 响应 200

`{ "privacySettings": { "profileVisibility": "..." } }`

## 实现约束

- upsert user_private_profiles.privacy_settings（jsonb）。
- FOLLOWERS 语义在 M4 信息流实现；当前仅存储。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 枚举值之外 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
