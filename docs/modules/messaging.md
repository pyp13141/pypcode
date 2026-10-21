# 模块：messaging（会话消息）

> 二级契约：docs/API.md §5（会话段）。会话由业务动作创建（如 `POST /market/deals`）；本模块只做消息收发与举报。

## 职责与约束

- 仅会话参与方可读写（非参与方 404，不泄露存在性）；
- 发送限流：默认 **10 条/分钟**，可由运营配置覆盖（`app_settings['risk-rules'].messagePerMinute`，D-013 已接线）；
- **关键词风险提醒**：命中（转账/加微信/押金等）时消息正常发送，但响应下发 `riskTip` 供前端强提示（产品 7.3 反诈）；
- 消息可举报（`targetType=CONVERSATION/MESSAGE`），进入举报工单队列。

## 代码位置

```
apps/api/src/modules/messaging/
├── messaging.module.ts
└── endpoints/
    ├── conversation-messages/  # GET/POST /conversations/:id/messages
    └── conversation-report/    # POST /conversations/:id/report
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET/POST | /api/v1/conversations/:id/messages | [conversation-messages](messaging/conversation-messages.md) | ✅ |
| POST | /api/v1/conversations/:id/report | [conversation-report](messaging/conversation-report.md) | ✅ |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M4） |
