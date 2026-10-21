# POST /api/v1/auth/email/login

> 契约同 [API §1.1](../../API.md#11-认证)。决策：**D-014**。

## 请求

`{ "email": "you@example.com", "code": "6 位数字" }`

## 行为

1. 校验验证码（错误/过期/超次 → 400 `AUTH_CODE_INVALID`）；
2. `user_identities(provider=EMAIL, provider_subject=规范化邮箱)` 查找或创建用户；
3. 邮箱写进私密资料：**AES-256-GCM 密文**（`email_encrypted`）+ 掩码（`email_masked`，如 `fr***@example.com`）+ `email_verified_at`；
4. 建立会话（令牌只存哈希），响应同微信登录；
5. 封禁用户 403 `USER_BANNED`（API §1.1）。

响应 200：`{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版（D-014） |
