# GET /api/v1/community/posts/:id

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

可见性：PUBLIC 公开；FOLLOWERS 关注者+作者；PRIVATE/待审/已删仅作者；**不满足与不存在一律 404**。

响应 200：`{ post: PostView, comments: CommentView[]（最近 100 条可见）, helpPostId }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
