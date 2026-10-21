# POST /api/v1/auth/wechat/login

> 契约同 [API §1.1](../../API.md#11-认证)；实现细节以本文件为准。

## 说明

微信小程序登录。D-006：未配置 AppID 走开发 Mock（code 派生假 openid），接口形状与真登录完全一致。

## 请求（公开）

`{ "code": string }` — wx.login 凭证，1–128 字符。

## 响应 200

```json
{
  "data": {
    "accessToken": "...", "accessTokenExpiresAt": "ISO",
    "refreshToken": "...", "refreshExpiresAt": "ISO",
    "user": { "id": "uuid", "nickname": "宠邻用户", "avatarUrl": null }
  },
  "meta": { "requestId": "..." }, "error": null
}
```

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `AUTH_WECHAT_NOT_CONFIGURED` | 503 | 生产未配置 AppID 且未显式允许 Mock |
| `USER_BANNED` | 403 | 用户被封禁（登录后创建会话前校验） |

## 实现约束

- code2session 失败不得静默降级；真实请求走 api.weixin.qq.com。
- 新用户自动建档（user + identity + 空私密资料）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
