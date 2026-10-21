# GET /api/v1/community/feed

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

## 请求

`?tab=recommended|following|latest&page=&pageSize=`（默认 recommended）

- `latest` 按时间倒序；`recommended` 取近期池按**可解释加权**排序（收藏×3 + 点赞×2 + 评论×2，同分看新近；产品 12.2：不用纯评分）；
- `following` 仅出已关注作者内容，**需登录**（401）；
- 公开可浏览（未登录仅 PUBLIC+APPROVED）；被屏蔽（双向）、本人隐藏、已删/隐藏、作者封禁均不出现在任何人的流。

响应 200：分页 `data: PostView[]`（含 `likeCount/favoriteCount/commentCount/isLiked/isFavorited/isOwner`）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
