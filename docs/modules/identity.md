# 模块：identity（身份）

> 二级契约：docs/API.md §1.1。决策依据：D-006（微信 Mock 与生产护栏）。

## 职责

登录（微信小程序 Mock 可切换 + H5 短信码）、会话创建/轮换/撤销、短信验证码。

## 代码位置

```
apps/api/src/modules/identity/
├── identity.module.ts
├── auth-shared.service.ts        # 会话核心：创建/刷新轮换/盗用检测/验证码
└── endpoints/
    ├── wechat-login/   # POST /auth/wechat/login
    ├── sms-code/       # POST /auth/sms/send-code
    ├── h5-login/       # POST /auth/h5/login
    ├── refresh/        # POST /auth/refresh
    └── logout/         # POST /auth/logout
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| POST | /api/v1/auth/wechat/login | [wechat-login](identity/wechat-login.md) | ✅ |
| POST | /api/v1/auth/sms/send-code | [sms-code](identity/sms-code.md) | ✅ |
| POST | /api/v1/auth/email/send-code | [email-code](identity/email-code.md) | ✅（D-014） |
| POST | /api/v1/auth/email/login | [email-login](identity/email-login.md) | ✅（D-014） |
| POST | /api/v1/auth/h5/login | [h5-login](identity/h5-login.md) | ✅ |
| POST | /api/v1/auth/refresh | [refresh](identity/refresh.md) | ✅ |
| POST | /api/v1/auth/logout | [logout](identity/logout.md) | ✅ |
| POST | /api/v1/auth/identity/link | API §1.1（二期） | ⏳ |
| POST | /api/v1/auth/phone/verify | API §1.1（二期） | ⏳ |

## 关键规则

- 令牌只存哈希（ERD user_sessions）；access 2h / refresh 30d。
- 刷新轮换：旧 refresh 撤销；**已撤销 refresh 再次出现 = 盗用信号，撤销该用户全部会话**。
- 微信 Mock：AppID 未配置时 code 派生假 openid；生产未配置且无 `ALLOW_WECHAT_MOCK=true` 则**启动失败**。
- 短信码：内存存储（单实例），60s 重发间隔，5 次错试作废，5 分钟过期，一次性。多实例上线需换 Redis（ARCHITECTURE）。

## 错误码

`AUTH_CODE_INVALID` `AUTH_RATE_LIMITED` `AUTH_REFRESH_INVALID` `AUTH_REFRESH_EXPIRED` `AUTH_WECHAT_NOT_CONFIGURED` `USER_BANNED`（见 [ERRORS](../ERRORS.md#identity)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M1） |
