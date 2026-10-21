# POST /api/v1/community/posts

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

## 请求

`{ "content": "1-2000字", "images": ["POST_IMAGE mediaId（0-9，须本人且已 finalize）"], "topicIds": ["接受但暂不落库（二期）"] }`

## 内容检查（MVP 机审路由）

- 新账号（注册 <24h）或命中风险关键词（加微信/转账/押金/刷单等）→ `moderationStatus=PENDING` 转人工；
- 其余直接 `APPROVED`；发布限流 10 条/小时 → 429；
- 首发帖发放徽章 `COMMUNITY_FIRST`。

响应 201：`PostView`（PENDING 内容不会进入公开流，见 [feed](feed.md)）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
