# GET / PATCH /api/v1/care/offerings/:id

> 契约同 [API §3](../../API.md#3-互助服务carem2)。

## GET — 公告详情（公开）

响应 200：`OfferingDetailView` = 列表字段 + `availabilities[]` + `isOwner` + `safetyTips[]`（产品 7.2 上门安全提示文案由服务端统一下发）。

可见性：`PUBLISHED` 公开；`DRAFT/PAUSED/ARCHIVED/REMOVED` 仅 owner 可见，其他调用者与不存在一律 404。

## PATCH — 更新公告（仅 owner）

请求（可选子集）：`title/description/areaCode/radiusKm/pricingType/priceMinor/cancelRule/availabilities/status`。

状态流转（服务端校验）：`DRAFT→PUBLISHED|ARCHIVED`、`PUBLISHED↔PAUSED`、`PAUSED→ARCHIVED`；`REMOVED` 不可修改（审核路径）；不可回退到 `DRAFT`。

`availabilities` 提供时**全量替换**；价格变更只影响后续新订单（存量订单条款是快照，不受影响）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `RESOURCE_NOT_FOUND` | 404 | 非 owner 或公告不存在 |
| `RESOURCE_FORBIDDEN` | 403 | `REMOVED` 公告不可修改 |
| `REQUEST_VALIDATION_FAILED` | 400 | 合并后定价不一致 / 非法状态流转 / 时段非法 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
