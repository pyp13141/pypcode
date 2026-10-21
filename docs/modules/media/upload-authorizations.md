# POST /api/v1/media/upload-authorizations

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)（媒体段）。实现先行于 M4：集市列表图片依赖本管线（D-012）。

## 请求

`{ "purpose": "PET_AVATAR|POST_IMAGE|LISTING_IMAGE|EVIDENCE", "count": 1-9 }`

## 行为

- 服务端**按 purpose 下发**类型白名单与大小上限（客户端不得自定）：
  `PET_AVATAR` 1 张 ≤2MB；`POST_IMAGE/LISTING_IMAGE/EVIDENCE` ≤9 张 ≤5MB；类型 jpeg/png/webp；
- 频控：20 次/小时/人 → 429 `RATE_LIMITED`；
- 为每个对象创建 `media_assets` 行（objectKey 不可预测随机串）并签发**短时上传 token**（10 分钟）。

响应 201：`{ uploads: [{ mediaId, uploadPath, uploadUrl, headers, expiresAt }] }`
（`uploadUrl` 为配置了 `PUBLIC_API_ORIGIN` 时的绝对地址，否则同 `uploadPath` 相对路径）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3，D-007 本地盘适配器；上线前换 COS 同形状） |
