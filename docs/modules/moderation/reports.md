# POST /api/v1/reports

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)（举报段）。

`{ "targetType": "USER|POST|COMMENT|LISTING|OFFERING|REQUEST|DEAL|CONVERSATION|MESSAGE", "targetId", "reason": "SCAM|…|OTHER（九类）", "details?": "≤1000字", "images?": ["mediaId"] }`

- 目标存在性/会话参与关系由服务端校验（不存在 404）；
- 同一用户对同一目标的未决工单重复提交 → **409 `REPORT_DUPLICATE`**（幂等合并，产品 7.4）；
- 创建即 `NEW`，进入后台队列。

响应 201：`ReportView`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
