# 模块：community（社区）

> 二级契约：docs/API.md §5（社区段）+ §5.6 求助帖（D-010）。产品依据：PRODUCT_DESIGN 5.3/6.7/12.3 + 7.4。

## 职责

社区信息流（推荐/关注/最新）、图文发布与评论互动、关注关系、个人隐藏偏好、榜单、徽章、通用求助帖（轻量层）。

## 可见性与内容治理（实现约束）

- 可见性三档：`PUBLIC` 公开 / `FOLLOWERS` 仅关注者 / `PRIVATE` 仅自己；**待审/已删/隐藏内容仅作者可见，其余 404（不泄露存在性）**；
- 过滤：屏蔽关系**双向**（我屏蔽的人 + 屏蔽我的人）、作者 BANNED/注销、本人「不感兴趣」隐藏；
- 机审路由（MVP）：新账号（<24h）或命中风险关键词 → `PENDING` 转人工（不做自动判定）；发布 10 条/小时限流；
- 两级评论：`parentId` 必须指向一级评论（禁止三级）；删除为软删（审计保留）。

## 代码位置

```
apps/api/src/modules/community/
├── community.module.ts
├── community-state.ts          # 枚举 + 风险关键词 + 频率上限 + 榜单规则文案
├── community-view.ts           # 视图白名单
├── community-shared.service.ts # 可见性 where 组装 / 互动计数 / 徽章发放
└── endpoints/                  # 一接口一目录（14 个）
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET | /api/v1/community/feed | [feed](community/feed.md) | ✅ |
| POST | /api/v1/community/posts | [posts](community/posts.md) | ✅ |
| GET | /api/v1/community/posts/:id | [post-by-id](community/post-by-id.md) | ✅ |
| POST | /api/v1/community/posts/:id/comments | [post-comments](community/post-comments.md) | ✅ |
| PATCH/DELETE | /api/v1/community/comments/:id | [comment-by-id](community/comment-by-id.md) | ✅ |
| POST/DELETE | /api/v1/community/reactions | [reactions](community/reactions.md) | ✅ |
| PUT/DELETE | /api/v1/community/users/:userId/follow | [follows](community/follows.md) | ✅ |
| POST | /api/v1/community/posts/:id/hide | [post-hide](community/post-hide.md) | ✅ |
| GET | /api/v1/community/leaderboards | [leaderboards](community/leaderboards.md) | ✅ |
| GET | /api/v1/badges | [badges](community/badges.md) | ✅ |
| GET/POST | /api/v1/community/help-posts | [help-posts](community/help-posts.md) | ✅ |
| GET | /api/v1/community/help-posts/:id | [help-post-by-id](community/help-post-by-id.md) | ✅ |
| POST | /api/v1/community/help-posts/:id/resolve | [help-post-resolve](community/help-post-resolve.md) | ✅ |
| POST | /api/v1/community/help-posts/:id/cancel | [help-post-cancel](community/help-post-cancel.md) | ✅ |

## 已知项（记录不猜测）

- **话题标签**：`POST /community/posts` 接受 `topicIds` 但暂不落库（话题体系二期，D-013）；
- **growth 榜单为空榜**：依赖 M6 健康日志（规则文案已下发）；
- **图片可见性**：`POST_IMAGE` 当前 owner-only 读取（帖子可见性接入媒体 `url` 授权随 M5 联调复核，D-013）。

## 错误码

`SELF_FOLLOW_NOT_ALLOWED` `HELP_CATEGORY_NOT_ALLOWED` `REPORT_DUPLICATE` `RATE_LIMITED`（见 [ERRORS](../ERRORS.md)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M4）；14 接口 + 社区/消息/后台 25 项集成测试 |
