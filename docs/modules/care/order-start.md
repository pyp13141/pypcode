# POST /api/v1/care/orders/:id/start

> 契约同 [API §3](../../API.md#3-互助服务carem2)。

## 行为

仅服务者；`CONFIRMED → IN_PROGRESS`；校验约定时间窗 ±`CARE_START_WINDOW_HOURS`（默认 24h）。
时间窗取订单 `agreedTerms.timeWindow`。超窗 → 409 `ORDER_START_WINDOW_INVALID`。

响应 200：`OrderView`。

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `ORDER_STATE_INVALID` | 409 | 非服务者 / 订单非 CONFIRMED / 重复开始 |
| `ORDER_START_WINDOW_INVALID` | 409 | 超出 ±24h 时间窗 |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M2） |
