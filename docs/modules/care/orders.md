# GET /api/v1/care/orders

> 契约同 [API §3](../../API.md#3-互助服务carem2)。

## 请求

`Authorization` 必须（仅返回本人参与订单）。`?role=REQUESTER|PROVIDER&status=（八态枚举）&page=&pageSize=`

## 响应 200

分页 `data: OrderView[]`；每条含 `role`（当前调用者角色）、`agreedTerms` 快照、
`hasPrivateDetails`（私密信息是否已登记）；**地址/门禁/紧急联系人不在本响应**（见 private-details）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | role/status 非法 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
