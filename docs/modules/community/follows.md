# PUT / DELETE /api/v1/community/users/:userId/follow

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)。

- 幂等；**禁自关注** → 400 `SELF_FOLLOW_NOT_ALLOWED`（DB CHECK 兜底）；
- 首次关注给被关注者一次 `NEW_FOLLOWER` 通知（重复关注不重复通知）；
- 屏蔽关系优先：被屏蔽者内容不出现在关注流（见 [feed](feed.md)）。

响应 200：`{ userId, following, followerCount }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
