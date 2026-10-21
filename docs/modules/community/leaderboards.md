# GET /api/v1/community/leaderboards

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)；产品 12.3（规则须可解释，不售卖排名、无付费加权）。

`?type=contribution|content|growth`（默认 contribution）

| 榜 | 口径（MVP） |
|---|---|
| contribution | 已确认完成的互助订单数（同分看评价样本量） |
| content | 有效互动加权：收藏×3 + 点赞×2 + 评论×2（已删/隐藏/待审不计） |
| growth | 依赖 M6 健康日志，**当前为空榜**（规则文案仍下发） |

响应 200：`{ type, rule, entries: [{ rank, score, user?, postId?, excerpt?, completedOrderCount?, reviewCount? }] }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
