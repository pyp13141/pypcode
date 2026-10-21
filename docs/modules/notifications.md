# 模块：notifications（站内通知）

> 二级契约：docs/API.md §5（通知段）。业务侧在关键事件调用 `NotificationsService.push()`。

## 事件类型（MVP）

`ORDER_CREATED/ORDER_AWAITING_CONFIRM/ORDER_CONFIRMED/ORDER_STARTED/ORDER_COMPLETION_SUBMITTED/ORDER_COMPLETED`
`DEAL_CREATED/DEAL_AGREEMENT_UPDATED/DEAL_STATUS_CHANGED` `DISPUTE_OPENED/DISPUTE_RULED`
`REVIEW_RECEIVED` `POST_COMMENTED/COMMENT_REPLIED/NEW_FOLLOWER/NEW_MESSAGE`
`CONTENT_APPROVED/CONTENT_REMOVED/LISTING_APPROVED/LISTING_REMOVED` `REPORT_RESOLVED`

## 实现约束

- 通知写入失败**不影响主流程**（捕获记日志）；
- `payload_json` 只存业务引用（id 等），不存敏感明文；
- 已读幂等；仅本人可读（他人 404）。

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET | /api/v1/notifications | [notifications](notifications/notifications.md) | ✅ |
| POST | /api/v1/notifications/:id/read | [notification-read](notifications/notification-read.md) | ✅ |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M4）；care/market/community 关键事件已接线 |
