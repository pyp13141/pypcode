# 状态机（实现时以本文件 + 产品设计文档 11 节为准）

> 摘自 `docs/PRODUCT_DESIGN.md` 第 11 节。M0 只落库骨架，M2 起逐个实现校验逻辑。

## 1. 服务公告 care_offerings.status

`DRAFT → PUBLISHED ↔ PAUSED → ARCHIVED`，审核删除 `→ REMOVED`。

公告描述服务者提供什么，不代表接受订单。

## 2. 求助需求 care_requests.status

`DRAFT → PUBLISHED → MATCHED`；可 `CANCELLED` / `EXPIRED`。

`MATCHED` = 停止接收新申请，≠ 履约完成。MVP 一个需求只匹配一个订单。

## 3. 服务申请 care_applications.status

| 当前 | 操作 | 下一状态 |
|---|---|---|
| PENDING | 申请者撤回 | WITHDRAWN |
| PENDING | 需求方接受 | ACCEPTED（事务内创建订单） |
| PENDING | 需求方拒绝 | REJECTED |
| PENDING | 关闭/超时 | EXPIRED |

每个申请只有一个终态；接受失败不得留下"已接受但无订单"状态。

## 4. 服务订单 care_orders.status

`PENDING_CONFIRMATION → CONFIRMED → IN_PROGRESS → COMPLETION_SUBMITTED → COMPLETED`

旁支：`CANCEL_REQUESTED / CANCELLED`、`DISPUTED`。

| 当前 | 操作 | 下一状态 | 规则 |
|---|---|---|---|
| PENDING_CONFIRMATION | 双方确认条款 | CONFIRMED | 参与方 + 条款版本一致 |
| PENDING_CONFIRMATION | 取消/超时 | CANCELLED | 记录取消方、原因 |
| CONFIRMED | 服务开始 | IN_PROGRESS | 仅服务者 |
| CONFIRMED | 取消申请 | CANCEL_REQUESTED/CANCELLED | 按预先同意的取消规则 |
| IN_PROGRESS | 提交履约证据 | COMPLETION_SUBMITTED | 多次上门需全部 visit 完成 |
| IN_PROGRESS | 异常/投诉 | DISPUTED | |
| COMPLETION_SUBMITTED | 需求方确认 | COMPLETED | 仅参与方 |
| COMPLETION_SUBMITTED | 有争议 | DISPUTED | |

终态：`COMPLETED`、`CANCELLED`。订单纠纷必须开 `disputes` 工单，不靠改状态代替流程。

## 5. 单次上门 care_visits.status

`SCHEDULED / IN_PROGRESS / COMPLETION_SUBMITTED / COMPLETED / MISSED / CANCELLED / EXCEPTION`

## 6. 集市列表 market_listings.status 与交易 market_deals.status（分开）

- 列表：`DRAFT / PUBLISHED / CONTACTED / AGREEMENT_PENDING / AGREED / HANDED_OVER / COMPLETED / CANCELLED / DISPUTED / REMOVED`
- 交易：`CONTACTED → AGREEMENT_PENDING → AGREED → HANDED_OVER → COMPLETED`，可 `CANCELLED / DISPUTED`
- 同一物品售出/赠出后原子关闭，不允许并发两笔成功交接。

## 7. 内容举报 reports.status

`新建 → 处理中 → 已处理 / 驳回`，可 `申诉中 → 已关闭`。

## 实现约束（文档 9.2 / 10.8）

- 状态只能由领域服务在数据库事务中变更，并写 `*_events` 历史表；禁止前端直写状态。
- 管理员介入必须记录操作者、时间、理由，不能伪造完成。
