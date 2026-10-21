# GET /api/v1/notifications

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

本人通知列表；`?unreadOnly=true&page=&pageSize=`（分页信封）。
响应：`{ id, type, payload, readAt, createdAt }[]`；`payload` 只含业务引用，不含敏感明文。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
