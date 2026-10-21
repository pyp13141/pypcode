# GET /api/v1/care/orders/:id

> 契约同 [API §3](../../API.md#3-互助服务carem2)。

## 权限

仅参与方（需求方/服务者）；**非参与方与不存在一律 404**（不泄露存在性）。

## 响应 200：OrderView

- 公共字段：id/orderNo/status/role/pricingType/priceMinor/termsVersion/agreedTerms/双方 user brief/各确认与完成时间/hasPrivateDetails/createdAt；
- `visits[]`（seq 升序，含 `evidence[]`：NOTE 文本；PHOTO 随 M4）；
- **绝不含** address/entryInstructions/emergencyContact（唯一读取路径 `/private-details`，写审计）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `RESOURCE_NOT_FOUND` | 404 | 非参与方或订单不存在 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
