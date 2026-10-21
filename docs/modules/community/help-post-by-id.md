# GET /api/v1/community/help-posts/:id

> 契约同 [API §5.6](../../API.md#56-通用求助帖help_posts--m4d-010契约先行)。

响应 200：`{ helpPost: HelpPostView（含内容与评论数）, comments: CommentView[] }`；不可见/不存在 404。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
