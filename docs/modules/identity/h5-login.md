# POST /api/v1/auth/h5/login

> 契约同 [API §1.1](../../API.md#11-认证)。

## 说明

H5 手机号+验证码登录。身份映射 `provider=H5_PHONE, subject=手机号`。

## 请求（公开）

`{ "phone": string, "code": "6位数字" }`

## 响应 200

同 [wechat-login](wechat-login.md) 的响应结构。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `AUTH_CODE_INVALID` | 400 | 验证码错误/过期/错试超 5 次 |
| `USER_BANNED` | 403 | 封禁用户 |

## 实现约束

- 校验通过后**立即销毁验证码**（一次性）。
- 同一手机号在微信与 H5 登录映射到同一内部 user（若 identity 已存在）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
