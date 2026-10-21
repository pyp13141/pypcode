# POST /api/v1/community/posts/:id/hide

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

「不感兴趣」：写入 `post_hides`（**本地偏好，幂等**），仅影响本人信息流；不影响他人可见性与作者数据。
帖子须对调用者可见（否则 404）。响应 200：`{ hidden: true }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
