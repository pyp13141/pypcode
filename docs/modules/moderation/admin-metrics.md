# GET /api/v1/admin/metrics/overview

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。角色：`analyst`。

聚合指标（只出数字，无私人内容）：用户数；互助（需求数/匹配率、订单数、完成率/取消率/纠纷率）；
集市（交易数/完成率）；治理（举报总数/待处理/均值处理时长、未决纠纷数）；内容（帖子/列表数）。

响应 200：`{ users, care, market, moderation, content }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
