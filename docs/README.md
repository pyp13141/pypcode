# 宠邻文档中心（主索引）

> 本文档树是项目的**单一事实来源**。层级：一级（本索引 + 架构/运维）→ 二级（模块文档）→ 三级（接口契约）。
> 修改代码时必须同步对应文档，规则见 [DOC-SYNC](DOC-SYNC.md)；`scripts/check-docs-sync.sh` 与 CI 强制校验。

## 一级文档

| 文档 | 内容 | 读者 |
|---|---|---|
| [MASTER](MASTER.md) | **技术主入口**：里程碑进度总表、审核点、环境、阻塞项 | 所有人（先读这个） |
| [HANDOVER](HANDOVER.md) | **交接文档**：现状快照、环境资产、工程约定、坑清单、M2 开工指引 | 接手者/新 Agent |
| [PRODUCT_DESIGN](PRODUCT_DESIGN.md) | 产品与技术设计总纲（v1.1 原文） | 所有人 |
| [REVIEW-HELLO-PETS](REVIEW-HELLO-PETS.md) | 参考仓库审查报告（授权/耦合/复用决策） | 开发/法务视角 |
| [ARCHITECTURE](ARCHITECTURE.md) | 系统架构：分层、模块边界、数据流、目录规范、环境 | 开发/架构 |
| [DECISIONS](DECISIONS.md) | 技术决策记录（ADR），含部署形态 | 开发/架构 |
| [STATE_MACHINES](STATE_MACHINES.md) | 6 套业务状态机（实现时的权威约束） | 开发 |
| [ERD](ERD.md) | 数据模型分批落库计划与关键不变量 | 开发 |
| [API](API.md) | API 通用约定（信封/分页/幂等/鉴权）与路由总表 | 开发/前端 |
| [ERRORS](ERRORS.md) | 错误码汇总（单一源是 `error-codes.ts`） | 开发/前端/客服 |
| [RUNBOOK](RUNBOOK.md) | 部署、启停、备份、排障、交接 | 运维/交接对象 |
| [DOC-SYNC](DOC-SYNC.md) | 文档同步规则（何时改哪份文档，如何强制） | 开发 |
| [M5-REGRESSION](M5-REGRESSION.md) | 双端回归报告：构建/授权/上传/分享/返回/隐私审查/备份演练 | 交接/上线 |
| [TEST-REPORT](TEST-REPORT.md) | 线上冒烟报告（执行器 `scripts/smoke-all.sh`，当前 51/51） | 运维/上线 |
| [UX-REVIEW-2026-10-11](UX-REVIEW-2026-10-11.md) | **全量 UI 走查与产品评估**：4 个 P0 闭环断裂、功能缺口、竞品对标、执行建议 | 开发/产品决策 |
| [HANDOVER-NEXT](HANDOVER-NEXT.md) | **续交接**：M3-M6 现状、待办、可扩展模块、下一手引导 | 接手者 |

## 二级：模块文档（`docs/modules/`）

| 模块 | 文档 | 状态 | 对应里程碑 |
|---|---|---|---|
| system | [system.md](modules/system.md) | ✅ 已上线 | M0 |
| identity | [identity.md](modules/identity.md) | ✅ 已上线 | M1 |
| users | [users.md](modules/users.md) | ✅ 已上线 | M1 |
| pets | [pets.md](modules/pets.md) | ✅ 已上线 | M1 |
| transit | [transit.md](modules/transit.md) | ✅ 已上线 | M1.5（D-009） |
| care | [care.md](modules/care.md) | ✅ 已上线 | M2 |
| media | [media.md](modules/media.md) | ✅ 已上线 | M3（提前，D-012） |
| market | [market.md](modules/market.md) | ✅ 已上线 | M3 |
| community | [community.md](modules/community.md) | 🚧 代码完成（M4，待部署验收） | M4 |
| messaging | [messaging.md](modules/messaging.md) | 🚧 代码完成（M4） | M4 |
| notifications | [notifications.md](modules/notifications.md) | 🚧 代码完成（M4） | M4 |
| moderation | [moderation.md](modules/moderation.md) | ✅ 已上线 | M4 |
| health | [health.md](modules/health.md) | ✅ 已上线 | M6 |
| health | — | ⏳ 契约已定（API §2 尾段） | M6 |

> 新模块落地时：建 `docs/modules/<name>.md`，在此表加行，并在代码 `apps/api/src/modules/<name>/` 落地。

## 三级：接口契约（`docs/modules/<module>/<endpoint>.md`）

| 接口 | 契约 |
|---|---|
| GET /api/v1/health | [health.md](modules/system/health.md) |
| GET /api/v1/meta | [meta.md](modules/system/meta.md) |
| POST /api/v1/auth/wechat/login | [wechat-login.md](modules/identity/wechat-login.md) |
| POST /api/v1/auth/sms/send-code | [sms-code.md](modules/identity/sms-code.md) |
| POST /api/v1/auth/email/send-code | [email-code.md](modules/identity/email-code.md) |
| POST /api/v1/auth/email/login | [email-login.md](modules/identity/email-login.md) |
| POST /api/v1/auth/h5/login | [h5-login.md](modules/identity/h5-login.md) |
| POST /api/v1/auth/refresh | [refresh.md](modules/identity/refresh.md) |
| POST /api/v1/auth/logout | [logout.md](modules/identity/logout.md) |
| GET /api/v1/me | [me.md](modules/users/me.md) |
| PATCH /api/v1/me/profile | [me-profile.md](modules/users/me-profile.md) |
| PATCH /api/v1/me/privacy | [me-privacy.md](modules/users/me-privacy.md) |
| GET/PUT/DELETE /api/v1/me/blocks | [me-blocks.md](modules/users/me-blocks.md) |
| GET/POST /api/v1/pets | [pets.md](modules/pets/pets.md) |
| GET/PATCH/DELETE /api/v1/pets/:petId | [pet-by-id.md](modules/pets/pet-by-id.md) |
| GET /api/v1/transit/cities | [cities.md](modules/transit/cities.md) |
| GET /api/v1/transit/stations | [stations.md](modules/transit/stations.md) |
| GET /api/v1/transit/route | [route.md](modules/transit/route.md) |
| GET/POST/DELETE /api/v1/me/stations | [my-stations.md](modules/transit/my-stations.md) |
| GET/POST /api/v1/care/offerings | [offerings.md](modules/care/offerings.md) |
| GET/PATCH /api/v1/care/offerings/:id | [offering-by-id.md](modules/care/offering-by-id.md) |
| GET/POST /api/v1/care/requests | [requests.md](modules/care/requests.md) |
| GET /api/v1/care/requests/:id | [request-by-id.md](modules/care/request-by-id.md) |
| GET/POST /api/v1/care/requests/:id/applications | [request-applications.md](modules/care/request-applications.md) |
| POST /api/v1/care/applications/:applicationId/accept ⭐ | [application-accept.md](modules/care/application-accept.md) |
| POST /api/v1/care/applications/:applicationId/reject | [application-reject.md](modules/care/application-reject.md) |
| POST /api/v1/care/applications/:applicationId/withdraw | [application-withdraw.md](modules/care/application-withdraw.md) |
| GET /api/v1/care/orders | [orders.md](modules/care/orders.md) |
| GET /api/v1/care/orders/:id | [order-by-id.md](modules/care/order-by-id.md) |
| POST /api/v1/care/orders/:id/confirm | [order-confirm.md](modules/care/order-confirm.md) |
| POST /api/v1/care/orders/:id/start | [order-start.md](modules/care/order-start.md) |
| POST /api/v1/care/orders/:id/visits | [order-visits.md](modules/care/order-visits.md) |
| PATCH /api/v1/care/orders/:id/visits/:visitId | [order-visit-by-id.md](modules/care/order-visit-by-id.md) |
| POST /api/v1/care/orders/:id/complete | [order-complete.md](modules/care/order-complete.md) |
| POST /api/v1/care/orders/:id/cancel | [order-cancel.md](modules/care/order-cancel.md) |
| GET/PUT /api/v1/care/orders/:id/private-details ⭐ | [order-private-details.md](modules/care/order-private-details.md) |
| POST /api/v1/care/orders/:id/disputes | [order-disputes.md](modules/care/order-disputes.md) |
| POST /api/v1/care/orders/:id/reviews | [order-reviews.md](modules/care/order-reviews.md) |
| GET/POST /api/v1/market/listings | [listings.md](modules/market/listings.md) |
| GET /api/v1/market/categories | [categories.md](modules/market/market-categories.md) |
| GET/PATCH /api/v1/market/listings/:id | [listing-by-id.md](modules/market/listing-by-id.md) |
| PUT/DELETE /api/v1/market/listings/:id/favorite | [listing-favorite.md](modules/market/listing-favorite.md) |
| POST/GET /api/v1/market/deals | [deals.md](modules/market/deals.md) |
| GET /api/v1/market/deals/:id | [deal-by-id.md](modules/market/deal-by-id.md) |
| POST /api/v1/market/deals/:id/agree | [deal-agree.md](modules/market/deal-agree.md) |
| POST /api/v1/market/deals/:id/complete | [deal-complete.md](modules/market/deal-complete.md) |
| POST /api/v1/market/deals/:id/cancel | [deal-cancel.md](modules/market/deal-cancel.md) |
| POST /api/v1/market/deals/:id/disputes | [deal-disputes.md](modules/market/deal-disputes.md) |
| POST /api/v1/market/deals/:id/reviews | [deal-reviews.md](modules/market/deal-reviews.md) |
| POST /api/v1/media/upload-authorizations | [upload-authorizations.md](modules/media/upload-authorizations.md) |
| PUT/GET /api/v1/media/:mediaId/upload · /file | [media-blob.md](modules/media/media-blob.md) |
| POST /api/v1/media/:mediaId/finalize | [media-finalize.md](modules/media/media-finalize.md) |
| GET /api/v1/media/:mediaId/url | [media-url.md](modules/media/media-url.md) |
| GET /api/v1/community/feed | [feed.md](modules/community/feed.md) |
| POST /api/v1/community/posts | [posts.md](modules/community/posts.md) |
| GET /api/v1/community/posts/:id | [post-by-id.md](modules/community/post-by-id.md) |
| POST /api/v1/community/posts/:id/comments | [post-comments.md](modules/community/post-comments.md) |
| PATCH/DELETE /api/v1/community/comments/:id | [comment-by-id.md](modules/community/comment-by-id.md) |
| POST/DELETE /api/v1/community/reactions | [reactions.md](modules/community/reactions.md) |
| PUT/DELETE /api/v1/community/users/:userId/follow | [follows.md](modules/community/follows.md) |
| POST /api/v1/community/posts/:id/hide | [post-hide.md](modules/community/post-hide.md) |
| GET /api/v1/community/leaderboards | [leaderboards.md](modules/community/leaderboards.md) |
| GET /api/v1/badges | [badges.md](modules/community/badges.md) |
| GET/POST /api/v1/community/help-posts | [help-posts.md](modules/community/help-posts.md) |
| GET /api/v1/community/help-posts/:id | [help-post-by-id.md](modules/community/help-post-by-id.md) |
| POST /api/v1/community/help-posts/:id/resolve | [help-post-resolve.md](modules/community/help-post-resolve.md) |
| POST /api/v1/community/help-posts/:id/cancel | [help-post-cancel.md](modules/community/help-post-cancel.md) |
| GET/POST /api/v1/conversations/:id/messages | [conversation-messages.md](modules/messaging/conversation-messages.md) |
| POST /api/v1/conversations/:id/report | [conversation-report.md](modules/messaging/conversation-report.md) |
| GET /api/v1/notifications | [notifications.md](modules/notifications/notifications.md) |
| POST /api/v1/notifications/:id/read | [notification-read.md](modules/notifications/notification-read.md) |
| POST /api/v1/reports | [reports.md](modules/moderation/reports.md) |
| GET /api/v1/me/reports | [my-reports.md](modules/moderation/my-reports.md) |
| GET/POST /api/v1/admin/users | [admin-users.md](modules/moderation/admin-users.md) |
| GET/POST /api/v1/admin/moderation/queue · :id/decision | [admin-moderation.md](modules/moderation/admin-moderation.md) |
| GET/POST /api/v1/admin/reports · :id/assign · :id/resolve | [admin-reports.md](modules/moderation/admin-reports.md) |
| GET/POST /api/v1/admin/disputes · :id/evidence · :id/ruling · :id/appeal | [admin-disputes.md](modules/moderation/admin-disputes.md) |
| GET /api/v1/admin/care-orders · /market-deals | [admin-records.md](modules/moderation/admin-records.md) |
| GET/PUT /api/v1/admin/categories · badges · leaderboard-config · risk-rules | [admin-config.md](modules/moderation/admin-config.md) |
| GET /api/v1/admin/metrics/overview | [admin-metrics.md](modules/moderation/admin-metrics.md) |
| GET /api/v1/admin/audit-logs | [admin-audit.md](modules/moderation/admin-audit.md) |
| POST/GET /api/v1/pets/:petId/health-logs | [pet-health-logs.md](modules/health/pet-health-logs.md) |
| POST/GET /api/v1/pets/:petId/mood-logs | [pet-mood-logs.md](modules/health/pet-mood-logs.md) |

> 每个接口一份契约文档，与 `apps/api/src/modules/<module>/endpoints/<endpoint>/` 目录一一对应。

## 客户端文档

| 文档 | 内容 |
|---|---|
| [client/README](../apps/client/README.md) | Taro 双端结构、平台适配层、构建与自测 |

## 阅读路径建议

- **新开发接手**：[MASTER](MASTER.md)（现状与进度）→ PRODUCT_DESIGN（0/5/11 章）→ ARCHITECTURE → RUNBOOK → 所属模块的二级文档。
- **审核契约**：MASTER §5 审核点 → [API](API.md)（全量路由）→ [ERD](ERD.md)（全量表）→ [STATE_MACHINES](STATE_MACHINES.md)。
- **加一个新接口**：[DOC-SYNC](DOC-SYNC.md) → 模块二级文档 → 三级契约 → 代码。
- **排障**：RUNBOOK 排障表 → ERRORS → 对应接口契约。
