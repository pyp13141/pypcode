# POST /api/v1/auth/logout

> 契约同 [API §1.1](../../API.md#11-认证)。

## 说明

登出并撤销当前 access token 对应会话。

## 请求

`Authorization: Bearer <accessToken>`，无请求体。

## 响应 200

`{ "loggedOut": true }` — 幂等：重复登出/令牌已失效同样返回成功。

## 错误码

无（登出永不失败）。

## 实现约束

- 撤销 = 置 `revoked_at`；令牌哈希保留（审计），不做物理删除。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
