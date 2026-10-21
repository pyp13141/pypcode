# PATCH / DELETE /api/v1/community/comments/:id

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

仅作者本人（否则 404）；`PATCH { content(1-500) }`；`DELETE` 为**软删**（status=DELETED + deleted_at，审计保留，详情不再返回）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
