# PUT /api/v1/media/:mediaId/upload · GET /api/v1/media/:mediaId/file

> 直传与读取端点（短时签名 token 认证，非 Bearer）；契约见 [upload-authorizations](upload-authorizations.md)。

## PUT — 直传字节

- `?expires=<ms>&token=<HMAC>`；token 由授权端点签发（scope=media, id, action=upload）；
- 篡改/过期 token → 403；类型白名单外 → 400；超过大小上限 → 413；重复上传（已 finalize）→ 409；
- 服务端实测 size/mime 回填 `media_assets`（不信任客户端声明）。

## GET — 读取字节

- `?expires=&token=`（action=read）；token 由 [`GET /media/:id/url`](media-url.md) 在业务授权校验后签发（5 分钟）；
- 未 finalize / 已 REJECTED → 404；响应带 `Content-Type` 与 `nosniff`；
- 对象 key 不出现在 URL 中（不可预测 + 服务端映射）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
