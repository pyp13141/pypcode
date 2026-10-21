# GET /api/v1/badges

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

公开返回徽章定义（种子：CARE_FIRST/CARE_VETERAN/COMMUNITY_FIRST/REVIEW_FIRST）；登录后附带本人已获徽章。

响应 200：`{ definitions: [{ code, name, rule }], earned: [{ code, earnedAt, metadata }] }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
| 2026-10-11 | 修正：当前实际发放点=首发帖/求助帖（COMMUNITY_FIRST）；CARE_FIRST/CARE_VETERAN/REVIEW_FIRST 的发放钩子随 M6 接线（曾在此处超前描述，特此更正） |
