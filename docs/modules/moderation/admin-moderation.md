# GET /api/v1/admin/moderation/queue · POST /api/v1/admin/moderation/:id/decision

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。角色：`content_moderator`。

## GET 队列

`?type=POST|LISTING&page=`：待审帖子（moderationStatus=PENDING）与待审商品（status=PENDING_REVIEW，HIGH 风险类目）。
帖子含正文与图片 mediaId；商品含标题/描述/卖家/类目/价格。

## POST 决定

`{ "targetType": "POST|LISTING", "decision": "APPROVE|REMOVE", "reason": "必填" }`

- POST：APPROVED / REJECTED 且 `hidden_at` 置位；LISTING：PUBLISHED / REMOVED（记 `removed_reason`）；
- 写 `moderation_actions`（处置审计）+ `admin_audit_logs`；通知作者（CONTENT_APPROVED/CONTENT_REMOVED/LISTING_*）。

响应 200：`{ id, status }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
