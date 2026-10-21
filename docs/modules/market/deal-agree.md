# POST /api/v1/market/deals/:id/agree

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)。

## 请求

参与方。`{ "handoverAt": "ISO（可选）", "handoverArea": "≤100字（商圈级，不强制住址）", "note": "≤500字" }`

## 行为（事务 + listing 行锁）

- 单方确认 → `CONTACTED → AGREEMENT_PENDING`；双方都确认 → `AGREED`（写入 `agreement_json` 快照）；
- 本人重复确认 / 已 AGREED 后再调用：**幂等返回当前视图**；
- **一物一单**：同一列表已有另一笔进行中交易（AGREEMENT_PENDING/AGREED/HANDED_OVER）→ 409 `DEAL_ALREADY_IN_PROGRESS`；
- 列表已下架/售出 → 409 `LISTING_NOT_AVAILABLE`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `DEAL_ALREADY_IN_PROGRESS` | 409 | 同一物品已有进行中交易 |
| `LISTING_NOT_AVAILABLE` | 409 | 物品不可交易 |
| `DEAL_STATE_INVALID` | 409 | 交易状态不允许确认 |
| `RESOURCE_NOT_FOUND` | 404 | 非参与方 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
