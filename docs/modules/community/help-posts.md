# GET / POST /api/v1/community/help-posts

> 契约同 [API §5.6](../../API.md#56-通用求助帖help_posts--m4d-010契约先行)（D-010 两层模型的轻量层）。

## POST（发布）

`{ "category": "PET_CARE|NEIGHBOR", "title": "5-50字", "content": "≤1000字", "cityId?", "stationId?", "deadlineAt?" }`

- **分类白名单**（跑腿/代办等暂不开放）→ 400 `HELP_CATEGORY_NOT_ALLOWED`；限流 5 篇/天；
- 无订单机制；内容走与帖子相同的机审路由；评论复用帖子评论（`POST /community/posts/:postId/comments`）。

## GET（公开检索）

`?category=&cityId=&stationId=&status=（默认 OPEN）&page=&pageSize=`；响应分页 `HelpPostView[]`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
