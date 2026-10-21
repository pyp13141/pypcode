# GET / PATCH /api/v1/market/listings/:id

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)。

## GET — 列表详情

可见性：`PUBLISHED` 公开；其余状态仅 owner 可见（其他调用者与不存在 404）。
响应 200：`MarketListingDetailView` = 摘要 + `isOwner` + `safetyTips[]`（线下交接安全提示，产品 5.2/7.3）。

## PATCH — 更新（仅 owner）

可选子集：`title/description/priceMinor/condition/areaCode/handoverWindow/categoryCode/images/status`。

- `SOLD/REMOVED` 后**关键字段（标题/描述/价格/图片）禁改**（403；重新出售请新建列表）；
- 状态流转：`DRAFT→PUBLISHED|PENDING_REVIEW|EXPIRED`、`PUBLISHED→EXPIRED`、`PENDING_REVIEW→EXPIRED`；改为 HIGH 风险类目并上架时仍转 `PENDING_REVIEW`；
- `images` 提供时全量替换（归属校验同 POST）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `RESOURCE_NOT_FOUND` | 404 | 非 owner 或不存在 |
| `RESOURCE_FORBIDDEN` | 403 | `SOLD/REMOVED` 后改关键字段 |
| `LISTING_PRICE_INVALID` `REQUEST_VALIDATION_FAILED` | 400 | 价格/流转/字段非法 |
| `LISTING_CATEGORY_RESTRICTED` | 403 | 分类已停用 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
