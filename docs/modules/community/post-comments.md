# POST /api/v1/community/posts/:id/comments

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

`{ "content": "1-500字", "parentId": "一级评论 id（可选）" }`

- 两级回复：parentId 必须指向**本帖子的一级评论**（回复二级 → 400）；
- 帖子须对调用者可见（否则 404）；
- 通知：评论 → 帖主；回复 → 被回复人（去重，不通知自己）。

响应 201：`CommentView`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
