# POST /api/v1/care/applications/:applicationId/accept ⭐

> 契约同 [API §3](../../API.md#3-互助服务carem2)；ERD 不变量 4；**全项目最关键事务**。

## 请求

- `Authorization` 必须，且调用者 = 需求方（非需求方 404，不泄露申请存在性）。
- `Idempotency-Key` 必须（8-128 字符）。

## 事务（单事务，失败整体回滚）

1. `SELECT ... FROM care_requests WHERE id=$1 FOR UPDATE` — **行锁需求，并发 accept 在此串行化**；
2. 锁内校验 `request.status=PUBLISHED`（否则：已有订单 → `CARE_ORDER_EXISTS`；其他 → `REQUEST_NOT_OPEN`）；
3. 锁内重读申请：必须 `PENDING`（否则 `APPLICATION_STATE_INVALID`）；
4. 其余 `PENDING` 申请全部置 `EXPIRED`（每个申请只有一个终态）；
5. 本申请置 `ACCEPTED`；
6. 创建订单：`PENDING_CONFIRMATION`，`order_no`（PN+yyMMdd+随机）、条款快照
   （价格=申请报价 ?? 需求标价；取消规则；时间窗；宠物+`ORDER_PARTICIPANTS` 照料注意事项；地址访问规则；条款版本 v1）；
7. 回填 `care_applications.care_order_id`；需求置 `MATCHED`（`matched_at`）；
8. 需求带紧急联系人（密文）时复制进 `care_order_private_details`；
9. 写 `care_order_events`（from=null → to=PENDING_CONFIRMATION，actor=需求方）。

**绝不留下"已接受但无订单"；并发只成一单。**

## 响应 200

`{ "applicationId": "...", "orderId": "..." }`（同 key 重放返回同一 `orderId`）

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | 缺 Idempotency-Key |
| `RESOURCE_NOT_FOUND` | 404 | 申请不存在或非需求方 |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 同 key 用于不同请求（含其他申请） |
| `CARE_ORDER_EXISTS` | 409 | 需求已有订单（并发失败方） |
| `REQUEST_NOT_OPEN` | 409 | 需求非 PUBLISHED |
| `APPLICATION_STATE_INVALID` | 409 | 申请非 PENDING（含已撤回后接受） |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2）；并发/幂等/回滚由集成测试覆盖 |
