# GET /api/v1/me

> 契约同 [API §1.2](../../API.md#12-我的资料)。

## 说明

当前登录用户资料（字段白名单）。

## 请求

`Authorization: Bearer <accessToken>`

## 响应 200

```json
{
  "data": {
    "id": "uuid", "nickname": "string", "avatarUrl": "url|null",
    "bio": "string|null", "areaCode": "string|null",
    "phoneMasked": "138****5678|null", "phoneVerified": false,
    "privacySettings": {}, "createdAt": "ISO"
  },
  "meta": { "requestId": "..." }, "error": null
}
```

## 字段白名单说明

| 绝不返回 | 原因 |
|---|---|
| 明文手机号 | 加密存储于 user_private_profiles；只返回掩码 |
| openid / provider_subject | 身份映射细节不外泄 |
| status / deletedAt | 内部状态机字段 |

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | 未登录/令牌失效 |
| `RESOURCE_NOT_FOUND` | 404 | 用户已注销（软删） |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
