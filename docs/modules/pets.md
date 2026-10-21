# 模块：pets（宠物档案）

> 二级契约：docs/API.md §2。设计依据：产品文档 6.2。

## 职责

宠物档案 CRUD、公私字段白名单。健康/情绪日志（M6）将来挂在此模块下。

## 代码位置

```
apps/api/src/modules/pets/
├── pets.module.ts
├── pet-view.ts                  # 字段白名单：OwnerView / PublicView
└── endpoints/
    ├── pets/          # GET/POST /pets
    └── pet-by-id/     # GET/PATCH/DELETE /pets/:petId
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET | /api/v1/pets | [pets](pets/pets.md) | ✅ |
| POST | /api/v1/pets | [pets](pets/pets.md) | ✅ |
| GET | /api/v1/pets/:petId | [pet-by-id](pets/pet-by-id.md) | ✅ |
| PATCH | /api/v1/pets/:petId | [pet-by-id](pets/pet-by-id.md) | ✅ |
| DELETE | /api/v1/pets/:petId | [pet-by-id](pets/pet-by-id.md) | ✅ |
| POST/GET | /pets/:petId/health-logs | API §2（M6） | ⏳ |
| POST/GET | /pets/:petId/mood-logs | API §2（M6） | ⏳ |

## 字段白名单（核心安全规则）

| 视图 | 字段 |
|---|---|
| OwnerView（仅主人） | 全字段：体重/绝育/测量时间等 |
| PublicView（他人，且 visibility=PUBLIC） | id/name/species/breed/sex/birthDate/visibility |
| 不存在 | 体重、绝育状态**任何可见性下**都不进公开视图（产品文档 6.2：健康字段默认私有） |

PRIVATE 档案对他人一律 404（不泄露存在性）。

## 关键规则

- 软删除（archived_at）；订单快照（M2）不受后续修改影响。
- 体重更新自动带 weightMeasured_at（避免过期数据，6.2）。
- 上限 50 只/人；出生日期不超今天。

## 错误码

`PET_LIMIT_REACHED` `RESOURCE_NOT_FOUND`（见 [ERRORS](../ERRORS.md#pets)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M1） |
