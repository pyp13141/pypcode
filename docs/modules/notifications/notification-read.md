# POST /api/v1/notifications/:id/read

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

仅本人（他人/不存在 404）；**幂等**（已读再标记仍 200）。响应 200：`{ read: true }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
