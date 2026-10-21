# GET / POST /api/v1/care/requests

> 契约同 [API §3](../../API.md#3-互助服务carem2)；状态机 [STATE_MACHINES §2](../../STATE_MACHINES.md)。

## GET — 求助需求列表（公开）

`?areaCode=&serviceType=&dateFrom=&dateTo=&pricingType=&mine=true|false&page=&pageSize=`
公开列表只出 `PUBLISHED`；`mine=true` 需登录，返回本人全状态需求。

响应 200：分页 `data: RequestView[]`（含 `pets` 公开摘要：id/name/species/breed 与 `isOwner`）。

## POST — 发布求助需求

请求（`Authorization` 必须）：

```json
{
  "petIds": ["uuid（1-5，须为本人未归档宠物）"],
  "serviceType": "FEED", "title": "5-50字", "description": "≤2000字",
  "areaCode": "区域码", "startAt": "ISO", "endAt": "ISO（必须晚于 startAt 与当前时间）",
  "frequency": "≤100字（如 每天2次）",
  "pricingType": "FIXED", "priceMinor": 8000, "cancelRule": "FREE|MUTUAL",
  "emergencyContact": "≤200字（AES-256-GCM 落库；接受申请时复制进订单私密表）",
  "status": "PUBLISHED|DRAFT（默认 PUBLISHED）"
}
```

响应 201：`RequestView`（**绝不含**精确地址/门禁/紧急联系人明文或密文）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | petIds 非本人宠物/含归档/数量越界；时间窗非法或已过期；定价非法 |
| `PHONE_VERIFICATION_REQUIRED` | 403 | 运营开关开启且未验证手机号 |
| `AUTH_REQUIRED` | 401 | `mine=true` 未登录 |

## 实现约束

- 精确地址不上需求（ERD：地址只活在 care_order_private_details）；公开视图只有 areaCode。
- `petIds` 与 `emergencyContact` 列属 D-011 补口（ERD 原表未列，业务必需）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
