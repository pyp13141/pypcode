# POST /api/v1/auth/email/send-code

> 契约同 [API §1.1](../../API.md#11-认证)。决策：**D-014（首期用邮箱验证码替代手机号）**。

## 请求

`{ "email": "you@example.com" }`（≤120 字符，服务端规范化：trim + 小写）

## 行为

- **SMTP 已配置**（env：`SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM`）→ nodemailer 真实发送
  （模板标题「宠邻登录验证码」，5 分钟有效文案），**不返回 devCode**；
- **SMTP 未配置** → 邮件供应商 **Mock**（验证码打日志，含 `EMAIL-MOCK` 标注）；
- 限流 **1 次/分钟/邮箱** → 429 `AUTH_RATE_LIMITED`；验证码 **5 分钟**有效、最多 **5 次**尝试（一次性）。

响应 200：`{ expiresInMinutes: 5 }`；
**内测直显模式**：服务器设置 `AUTH_CODE_ECHO=true` 时额外返回 `devCode`（验证码明文），客户端自动填入——
这是"邮件供应商 Mock"阶段的自助登录方案（D-014 补充）；接入真实邮件供应商后**必须关闭**该开关。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版（D-014，替代手机号短信码） |
