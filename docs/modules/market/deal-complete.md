# POST /api/v1/market/deals/:id/complete

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)。

## 行为（双方各自确认已交接）

| 现状 | 行为 |
|---|---|
| `AGREED` | **首方确认 → `HANDED_OVER`**：事务内行锁 listing → `SOLD`（原子关闭物品），同一物品其它未终结交易自动 `CANCELLED`（reason=LISTING_SOLD） |
| `HANDED_OVER` | 另一方确认 → `COMPLETED`（写 `completed_at`） |
| 同一方重复确认 | 409 `RESOURCE_CONFLICT`（等待对方） |

**线下交接确认不代表平台验证物品真实情况**（产品 5.2，前端需强提示）。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `LISTING_NOT_AVAILABLE` | 409 | 物品已售出/下架 |
| `DEAL_STATE_INVALID` | 409 | 状态不允许（如 CONTACTED 直接完成） |
| `RESOURCE_CONFLICT` | 409 | 已确认，等待对方 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
