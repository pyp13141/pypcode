# POST / DELETE /api/v1/community/reactions

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)；DELETE 为 D-013 补口（取消点赞/收藏，原契约缺）。

`{ "targetType": "POST|COMMENT", "targetId": "uuid", "reactionType": "LIKE|FAVORITE" }`

- (user, targetType, targetId, reactionType) **四元组唯一，POST/DELETE 均幂等**；
- 目标存在且对调用者可见由服务端校验（否则 404）。

响应 200/201：`{ targetType, targetId, reactionType, reacted, count }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4）；DELETE 补口 |
