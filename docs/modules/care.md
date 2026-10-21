# 模块：care（互助服务）

> 二级契约：docs/API.md §3。状态机权威：docs/STATE_MACHINES.md（公告/需求/申请/订单/Visit 五套）。
> 产品依据：PRODUCT_DESIGN 5.1 + 7.2；关键决策：D-008（加密）、D-011（落地细则与契约补口）。

## 职责

互助服务全闭环：服务公告与求助需求的发布/检索 → 服务申请 → **接受申请的关键事务**（行锁需求 →
过期其余申请 → 建订单 → MATCHED）→ 订单条款确认 → 服务开始 → 单次上门与履约凭证 →
完成提交/确认 → 双向评价；以及订单私密地址（加密+审计）与纠纷工单。

**不算入本模块**：支付/资金托管（首期不做）；履约照片上传管线（媒体端点 M4，M2 支持 NOTE 文本凭证）；
纠纷裁定/申诉（M4 后台）。

## 状态机（实现约束）

| 实体 | 状态 | 要点 |
|---|---|---|
| care_offerings | DRAFT → PUBLISHED ↔ PAUSED → ARCHIVED；REMOVED(审核) | 公告≠接单 |
| care_requests | DRAFT → PUBLISHED → MATCHED；CANCELLED/EXPIRED | MATCHED=停止申请，≠履约完成 |
| care_applications | PENDING → ACCEPTED/REJECTED/WITHDRAWN/EXPIRED | 每申请单一终态；接受=事务 |
| care_orders | PENDING_CONFIRMATION → CONFIRMED → IN_PROGRESS → COMPLETION_SUBMITTED → COMPLETED；CANCEL_REQUESTED/CANCELLED/DISPUTED | 状态只能经领域服务（applyTransition）变更，事件表追加式 |
| care_visits | SCHEDULED/IN_PROGRESS/COMPLETED/MISSED/CANCELLED/EXCEPTION（COMPLETION_SUBMITTED 预留） | 多次上门全部完成/已说明才能提交整体完成 |

## 代码位置

```
apps/api/src/modules/care/
├── care.module.ts            # 18 个端点控制器
├── care-state.ts             # 枚举 + 状态机转换表 + 校验/开关（CARE_REQUIRE_PHONE_VERIFIED 等）
├── care-view.ts              # 响应视图白名单（bigint→number；公开视图无敏感字段）
├── care-orders.service.ts    # 模块级领域服务：参与方校验/状态流转+事件/订单号/条款快照/信任摘要
└── endpoints/                # 一接口一目录（controller+service）
```

公共设施（全模块复用）：`common/idempotency/`（幂等键执行器）、`common/audit/`（敏感访问审计）、
`common/pagination.ts`（分页信封）。

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| GET/POST | /api/v1/care/offerings | [offerings](care/offerings.md) | ✅ |
| GET/PATCH | /api/v1/care/offerings/:id | [offering-by-id](care/offering-by-id.md) | ✅ |
| GET/POST | /api/v1/care/requests | [requests](care/requests.md) | ✅ |
| GET | /api/v1/care/requests/:id | [request-by-id](care/request-by-id.md) | ✅ |
| GET/POST | /api/v1/care/requests/:id/applications | [request-applications](care/request-applications.md) | ✅ |
| POST | /api/v1/care/applications/:applicationId/accept | [application-accept](care/application-accept.md) | ✅ ⭐ |
| POST | /api/v1/care/applications/:applicationId/reject | [application-reject](care/application-reject.md) | ✅ |
| POST | /api/v1/care/applications/:applicationId/withdraw | [application-withdraw](care/application-withdraw.md) | ✅ |
| GET | /api/v1/care/orders | [orders](care/orders.md) | ✅ |
| GET | /api/v1/care/orders/:id | [order-by-id](care/order-by-id.md) | ✅ |
| POST | /api/v1/care/orders/:id/confirm | [order-confirm](care/order-confirm.md) | ✅ |
| POST | /api/v1/care/orders/:id/start | [order-start](care/order-start.md) | ✅ |
| POST | /api/v1/care/orders/:id/visits | [order-visits](care/order-visits.md) | ✅ |
| PATCH | /api/v1/care/orders/:id/visits/:visitId | [order-visit-by-id](care/order-visit-by-id.md) | ✅ |
| POST | /api/v1/care/orders/:id/complete | [order-complete](care/order-complete.md) | ✅ |
| POST | /api/v1/care/orders/:id/cancel | [order-cancel](care/order-cancel.md) | ✅ |
| GET/PUT | /api/v1/care/orders/:id/private-details | [order-private-details](care/order-private-details.md) | ✅ ⭐敏感 |
| POST | /api/v1/care/orders/:id/disputes | [order-disputes](care/order-disputes.md) | ✅ |
| POST | /api/v1/care/orders/:id/reviews | [order-reviews](care/order-reviews.md) | ✅ |
| POST | /api/v1/care/offerings/:id/applications（公告预约申请） | API §3（预约流二期，offerings/:id/applications 未开放） | ⏳ |
| POST | /api/v1/care/orders（系统内部创建路径） | API §3（客户端禁止绕过 accept；M2 未开放） | ⏳ |

## 依赖与边界

- 表：care 九表 + 支撑表（sensitive_access_logs / idempotency_records / disputes / dispute_events /
  reviews / media_assets），见 [ERD §2](../ERD.md)。
- 上游：identity（登录）、pets（宠物档案，需求快照来源）。
- 下游：M4 社区/后台复用 disputes/reviews/media/sensitive_access_logs；M4 实现纠纷裁定与申诉、
  媒体上传（履约照片）。

## 环境开关

| 变量 | 默认 | 说明 |
|---|---|---|
| `CARE_REQUIRE_PHONE_VERIFIED` | false | 发布公告/需求要求手机号已验证（运营开关；手机号验证流程上线后置 true，D-011 #7） |
| `CARE_START_WINDOW_HOURS` | 24 | 开始服务时间窗 ±N 小时 |

## 错误码

`PHONE_VERIFICATION_REQUIRED` `APPLICATION_STATE_INVALID` `REQUEST_NOT_OPEN` `CARE_ORDER_EXISTS`
`ORDER_STATE_INVALID` `ORDER_START_WINDOW_INVALID` `ORDER_PRIVATE_DETAILS_REQUIRED` `PRIVATE_DETAIL_NOT_AVAILABLE`
`VISIT_STATE_INVALID` `ORDER_CANCEL_NOT_ALLOWED` `REVIEW_NOT_ALLOWED` `REVIEW_ALREADY_EXISTS`
`DISPUTE_ALREADY_OPEN`（见 [ERRORS](../ERRORS.md#carem2-互助服务)）

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M2）；care 九表 + 支撑表落库；18 接口 + 22 项集成测试 |
