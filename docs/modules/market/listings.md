# GET / POST /api/v1/market/listings

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)。列表态与交易态分离（STATE_MACHINES §6）。

## GET — 集市列表（公开）

`?listingType=GIFT|SWAP|SALE|WANTED&categoryCode=&areaCode=&priceMin=&priceMax=&keyword=&mine=true|false&page=&pageSize=`
公开检索仅 `PUBLISHED`；`keyword` 匹配标题+描述（ILIKE，pg_trgm 索引待启用）；`mine=true` 需登录。

响应 200：分页 `data: MarketListingSummaryView[]`：
`{ id, listingType, category{code,name,riskLevel}, title, description, priceMinor, condition, areaCode, handoverWindow, status, seller, sellerTrust, imageMediaIds[], favoriteCount, isFavorited, createdAt }`
（图片只出 mediaId，URL 经 `/media/:id/url` 短时签名获取）

## POST — 发布闲置

```json
{ "listingType": "SALE", "categoryCode": "FEEDING", "title": "5-50字", "description": "≤2000字",
  "priceMinor": 12800, "condition": "LIKE_NEW", "areaCode": "440305",
  "handoverWindow": "周末下午（≤100字）", "images": ["mediaId（1-9，须本人 LISTING_IMAGE 且已 finalize）"] }
```

- 价格与交易类型一致：`SALE` 必填 >0；`GIFT` 必须为空/0；`SWAP/WANTED` 可空（**LISTING_PRICE_INVALID** 400）；
- **HIGH 风险类目（宠物食品/药品）发布即进 `PENDING_REVIEW` 人工审核**（产品 6.4），其余 `PUBLISHED`；
- 图片归属与类型服务端校验（盗用他人 media → 400）。

响应 201：`MarketListingSummaryView`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `LISTING_PRICE_INVALID` | 400 | 价格与交易类型不一致 |
| `LISTING_CATEGORY_RESTRICTED` | 403 | 分类已停用 |
| `REQUEST_VALIDATION_FAILED` | 400 | 图片不合法/分类不存在/字段越界 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
