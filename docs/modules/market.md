# 模块：market（集市与交易）

> 二级契约：docs/API.md §4。状态机权威：docs/STATE_MACHINES.md §6（列表态与交易态分离）。
> 产品依据：PRODUCT_DESIGN 5.2 + 6.4 + 7.3 + 11.5；关键决策：D-012（落地细则与提前依赖）。

## 职责

本地闲置集市闭环：发布/检索/收藏 → 发起交易（受限会话）→ 双方约定交接 → 交接确认（**原子关闭物品**）
→ 完成/取消/纠纷 → 双向评价。**不托管资金**；线下交接安全提示由服务端下发（profile 里"平台不验证物品"提示必须展示）。

## 状态机（实现约束）

| 实体 | 状态 | 要点 |
|---|---|---|
| market_listings | DRAFT / PUBLISHED / PENDING_REVIEW / SOLD / REMOVED / EXPIRED | HIGH 风险类目必须人审；SOLD 后关键字段禁改 |
| market_deals | CONTACTED → AGREEMENT_PENDING → AGREED → HANDED_OVER → COMPLETED；CANCELLED/DISPUTED | 双方各自确认；状态只经领域服务 + 追加式事件表 |

**一物一单（D-012）**：CONTACTED 咨询不限量；自 `AGREEMENT_PENDING` 起同一物品跨买家互斥（事务 + listing 行锁）；
`AGREED → HANDED_OVER` 时行锁 listing → `SOLD`，同物品其它未终结交易自动 `CANCELLED(LISTING_SOLD)`——不可能出现两笔成功交接。

## 代码位置

```
apps/api/src/modules/market/
├── market.module.ts          # 9 个端点控制器
├── market-state.ts           # 枚举 + 双状态机 + 价格一致性 + 取消/纠纷原因码
├── market-view.ts            # 视图白名单（图片只出 mediaId；trust 复用 care 模块导出服务）
├── market-deals.service.ts   # 模块级：参与方校验/流转+事件/listing 行锁/竞品终结/收藏计数
└── endpoints/                # 一接口一目录
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET/POST | /api/v1/market/listings | [listings](market/listings.md) | ✅ |
| GET | /api/v1/market/categories | [categories](market/market-categories.md) | ✅ |
| GET/PATCH | /api/v1/market/listings/:id | [listing-by-id](market/listing-by-id.md) | ✅ |
| PUT/DELETE | /api/v1/market/listings/:id/favorite | [listing-favorite](market/listing-favorite.md) | ✅ |
| POST/GET | /api/v1/market/deals | [deals](market/deals.md) | ✅ |
| GET | /api/v1/market/deals/:id | [deal-by-id](market/deal-by-id.md) | ✅ |
| POST | /api/v1/market/deals/:id/agree | [deal-agree](market/deal-agree.md) | ✅ |
| POST | /api/v1/market/deals/:id/complete | [deal-complete](market/deal-complete.md) | ✅ |
| POST | /api/v1/market/deals/:id/cancel | [deal-cancel](market/deal-cancel.md) | ✅ |
| POST | /api/v1/market/deals/:id/disputes | [deal-disputes](market/deal-disputes.md) | ✅ |
| POST | /api/v1/market/deals/:id/reviews | [deal-reviews](market/deal-reviews.md) | ✅ |

## 依赖与边界

- 表：market_categories（种子 10 类，食品/药品 HIGH）、market_listings、market_listing_media、market_deals、market_deal_events（追加式触发器）；
- 提前复用（D-012）：reactions（收藏）、conversations/messages（交易会话）、media 管线（图片）、disputes/reviews（纠纷/评价）；
- 模块边界示范：信任摘要经 `CareModule` 导出的 `CareOrdersService` 调用，不跨模块直查对方表。

## 错误码

`LISTING_PRICE_INVALID` `LISTING_CATEGORY_RESTRICTED` `LISTING_NOT_AVAILABLE` `DEAL_ALREADY_IN_PROGRESS`
`DEAL_STATE_INVALID`（见 [ERRORS](../ERRORS.md#marketm3-集市与交易)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M3）；9 接口 + 16 项集成测试 |
