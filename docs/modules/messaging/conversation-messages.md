# GET / POST /api/v1/conversations/:id/messages

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。会话由业务动作创建（`POST /market/deals`；care 订单会话二期接入）。

## GET

仅参与方（否则 404）；分页（默认 20/页，时间升序）。

## POST

`{ "content": "1-500字" }`

- 仅参与方；会话须 ACTIVE；
- **限流 10 条/分钟**，可由运营配置覆盖（`admin PUT /admin/risk-rules` 的 `messagePerMinute`，D-013 已接线）；
- **关键词风险提醒**：命中风险词时消息正常发送，响应携带 `riskTip`（前端强提示，不阻断沟通）；
- 通知其他参与方 `NEW_MESSAGE`。

响应：`MessageView { id, conversationId, sender, content, isMine, riskTip, createdAt }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
