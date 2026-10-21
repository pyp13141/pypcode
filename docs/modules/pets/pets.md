# GET / POST /api/v1/pets

> 契约同 [API §2](../../API.md#2-宠物档案pets)。

## GET — 我的宠物列表

请求：`Authorization: Bearer`。响应 200：`PetOwnerView[]`（全字段，含 archived=false 的全部宠物）。

## POST — 新建宠物

请求（部分字段）：

```json
{
  "name": "1-20字",
  "species": "CAT|DOG|BIRD|SMALL_ANIMAL|OTHER",
  "breed": "可选≤50", "sex": "MALE|FEMALE|UNKNOWN",
  "birthDate": "ISO日期，不超今天",
  "weightValue": 0.01-500, "weightUnit": "kg|g|lb",
  "sterilized": "YES|NO|UNKNOWN",
  "visibility": "PRIVATE|PUBLIC"
}
```

响应 200：`PetOwnerView`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 出生日期超今天；有体重无单位 |
| `PET_LIMIT_REACHED` | 409 | 已达 50 只 |

## 实现约束

- 填体重时服务端自动写 weightMeasured_at=now。
- 未知值用 UNKNOWN/空，不强迫编造（6.2）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
