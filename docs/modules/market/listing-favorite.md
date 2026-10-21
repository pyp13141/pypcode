# PUT / DELETE /api/v1/market/listings/:id/favorite

> 契约同 [API §4](../../API.md#4-集市与交易marketplacem3)。

## 行为

- `PUT` 收藏、`DELETE` 取消，**均幂等**（重复调用不重复计数/不报错）；
- 仅 `PUBLISHED` 列表可收藏（否则 404）；
- 落库复用 `reactions`（user_id, target_type=LISTING, target_id, reaction_type=FAVORITE，四元组 UNIQUE，D-012）。

响应 200：`{ listingId, favorited, favoriteCount }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
