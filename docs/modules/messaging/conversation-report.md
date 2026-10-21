# POST /api/v1/conversations/:id/report

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

参与方举报会话或单条消息：`{ "reason": "九类枚举", "details?": "≤1000字", "messageId?": "uuid" }`
→ 创建举报工单（targetType=CONVERSATION 或 MESSAGE）；同一目标未决重复举报 → 409 `REPORT_DUPLICATE`。

响应 200：`ReportView`。处理入口在后台（见 [admin-reports](../moderation/admin-reports.md)）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
