# GET / PATCH / DELETE /api/v1/pets/:petId

> 契约同 [API §2](../../API.md#2-宠物档案pets)。本接口是字段白名单与越权防护的核心验收点。

## GET — 按权限返回（公开路由，但按身份过滤）

| 访问者 | visibility | 结果 |
|---|---|---|
| 主人（Bearer） | 任意 | PetOwnerView（全字段） |
| 他人/未登录 | PUBLIC | PetPublicView（白名单子集） |
| 他人/未登录 | PRIVATE | 404（不泄露存在性） |

**绝不返回**：weightValue/weightUnit/weightMeasuredAt/sterilized/createdAt——即使 PUBLIC 也不返回（健康字段私有）。

## PATCH — 仅主人

请求：POST 建档字段的可选子集。响应：PetOwnerView。
体重变更自动更新 weightMeasured_at。非法字段被 class-validator 拒绝（400）。

## DELETE — 仅主人（软删除）

响应：`{ "archived": true }`。已归档档案从列表消失，但历史订单快照（M2）不受影响。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `RESOURCE_NOT_FOUND` | 404 | 不存在/已归档/非主人 PATCH·DELETE/PRIVATE 对他人 |
| `AUTH_REQUIRED` | 401 | PATCH/DELETE 未登录 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1） |
