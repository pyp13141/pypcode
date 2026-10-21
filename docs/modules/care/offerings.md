# GET / POST /api/v1/care/offerings

> 契约同 [API §3](../../API.md#3-互助服务carem2)。状态机见 [STATE_MACHINES §1](../../STATE_MACHINES.md)。

## GET — 服务公告列表（公开）

请求：无需登录（登录后同）。查询参数：
`?areaCode=&serviceType=FEED|WALK|BOARD|OTHER&dateFrom=&dateTo=&pricingType=FREE|FIXED|NEGOTIABLE|BARTER&mine=true|false&page=&pageSize=`
（`dateFrom/dateTo` 按可用时段重叠过滤；`mine=true` 需登录，返回本人全状态公告）

响应 200：分页信封 `data: OfferingSummary[]`，`meta: { requestId, page, pageSize, total }`。
每条含公共服务者信任摘要 `trust: { phoneVerified, completedOrderCount, reviewCount }`。

## POST — 发布服务公告

请求（`Authorization` 必须）：

```json
{
  "serviceType": "FEED", "title": "5-50字", "description": "≤2000字",
  "areaCode": "区域码", "radiusKm": 0.1-100,
  "pricingType": "FIXED", "priceMinor": 5000,
  "cancelRule": "FREE|MUTUAL",
  "status": "PUBLISHED|DRAFT（默认 PUBLISHED）",
  "availabilities": [{ "startAt": "ISO", "endAt": "ISO", "capacity": 1 }]
}
```

响应 201：`OfferingSummary`。公开响应与列表**不含**任何精确地址/联系方式。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | FIXED 缺价格 / FREE 带价格 / 时段非法 / cancelRule 非法 |
| `PHONE_VERIFICATION_REQUIRED` | 403 | 运营开关 `CARE_REQUIRE_PHONE_VERIFIED=true` 且未验证手机号 |
| `AUTH_REQUIRED` | 401 | `mine=true` 未登录 |

## 实现约束

- 定价一致性（FIXED⇒有价、FREE⇒无价）应用层 + 数据库 CHECK 双重校验（D-011）。
- 发布门槛为运营开关，默认关闭（手机号验证流程未上线，D-011 #7）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
