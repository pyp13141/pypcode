# GET / PUT /api/v1/care/orders/:id/private-details ⭐敏感

> 契约同 [API §3](../../API.md#3-互助服务carem2)；PUT 为 D-011 契约补口（原契约缺写入路径）。

## 读取（GET）

- 权限：**参与方 且 订单状态 ∈ {CONFIRMED, IN_PROGRESS, COMPLETION_SUBMITTED}**；不满足 → 403 `PRIVATE_DETAIL_NOT_AVAILABLE`（状态未到或非参与方，API §3）。
- 响应 200：`{ address, entryInstructions, emergencyContact, accessPolicy, updatedAt }`（AES-256-GCM 解密）。
- **每次读取写 `sensitive_access_logs`**（field_group 按实际返回字段组：ADDRESS / EMERGENCY_CONTACT；purpose=ORDER_PRIVATE_DETAILS_READ；含 requestId）。

## 写入（PUT）

- 权限：仅需求方；订单 ∈ {PENDING_CONFIRMATION, CONFIRMED}（非需求方 403；状态不符 409）。
- 请求：`{ "address": "1-300字（必填）", "entryInstructions": "≤500字", "emergencyContact": "≤200字" }`；
  未提供的 entry/emergency 保留原值。
- 落库前 AES-256-GCM 加密；**每次写入写审计**（purpose=ORDER_PRIVATE_DETAILS_WRITE）。
- 接受申请时需求携带的紧急联系人密文会在下单时自动复制进本表（D-011 #3）。

## 硬约束

- 密文**绝不**进入通用订单查询/列表/日志；本接口是唯一读写路径（ERD 不变量 6）。
- 审计写入失败即请求失败（不静默降级）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `PRIVATE_DETAIL_NOT_AVAILABLE` | 403 | 读：非参与方/状态未到；写：非需求方 |
| `REQUEST_VALIDATION_FAILED` | 400 | 字段长度非法 |
| `ORDER_STATE_INVALID` | 409 | 写：订单状态不在可写集合 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2）；PUT 为契约补口（D-011） |
