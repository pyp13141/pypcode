# 数据模型完整设计（ERD）

> 逻辑模型权威：设计文档 9.1；本文件是落到 PostgreSQL 的完整规格（字段/类型/约束/索引/落库批次）。
> schema 单一源：`apps/api/prisma/schema.prisma`；两者不一致视为缺陷。
> 通用约定：主键 `uuid`；时间 `timestamptz`（UTC）；金额 `bigint` 整数分；枚举用受约束字符串（`text` + CHECK）或 pg enum（实现时择一，PR 决策）；审计表不做物理删除；所有表隐含 `created_at`/`updated_at`（下列只写特有字段）。

## 落库批次

| 批次 | 里程碑 | 表 |
|---|---|---|
| M1 | 账号与档案 | users, user_identities, user_sessions, user_private_profiles, user_blocks, pets, pet_care_notes ✅已迁移 |
| M2 | 互助履约 | care_offerings, care_offerings_availability, care_requests, care_applications, care_orders, care_order_events, care_order_private_details, care_visits, care_evidence ✅已迁移；**提前落库的支撑表**（D-011）：sensitive_access_logs, idempotency_records, disputes, dispute_events, reviews, media_assets ✅已迁移 |
| M3 | 集市交易 | market_categories, market_listings, market_listing_media, market_deals, market_deal_events ✅已迁移；提前复用（D-012）：reactions、conversations、messages、media 管线扩展 |
| M4 | 社区治理 | posts, post_media, comments, follows, reports, notifications, moderation_actions, admin_users, admin_roles, admin_audit_logs, badges, user_badges（media_assets/sensitive_access_logs/idempotency_records/disputes/dispute_events/reviews 随 M2；reactions/conversations/messages 随 M3 提前落库） |
| M6 | 健康 | pet_health_logs, pet_mood_logs ✅已迁移 |
| M1.5 | 地铁（D-009，提前实现） | transit_cities, transit_lines, transit_line_stations, transit_stations, transit_edges, user_stations ✅随 M1 迁移 |
| M4 | 求助帖（D-010） | posts.post_type 列 + help_posts 表 ✅已迁移（1:1 帖子壳：内容/审核复用 posts） |
| 可选 | 附近搜索启用时 | private_locations（12.1：不启用不建表、不采集坐标） |

## 1. M1 已落库（细节见 schema.prisma）

### users
| 字段 | 类型 | 约束/说明 |
|---|---|---|
| id | uuid PK | 默认 uuid()；**非 openid** |
| nickname | text | 3–20 字 |
| avatar_url | text? | |
| bio | text? | ≤200 |
| area_code | text? | 大致区域；公开位置只用此字段 |
| status | text | CHECK IN ('ACTIVE','BANNED','DELETED') |
| deleted_at | timestamptz? | 软删除 |

### user_identities
| 字段 | 约束 |
|---|---|
| id PK, user_id FK→users ON DELETE CASCADE | |
| provider | CHECK IN ('WECHAT_MINIPROGRAM','H5_PHONE','**EMAIL**'——D-014) |
| provider_subject | openid 或规范化手机号；**UNIQUE(provider, provider_subject)**；不作主键 |

### user_sessions
| 字段 | 约束 |
|---|---|
| id PK, user_id FK→users | |
| access_token_hash / refresh_token_hash | **只存哈希**；各 UNIQUE |
| access_expires_at / refresh_expires_at | |
| revoked_at? | 登出/轮换/盗用检测时置位 |

### user_private_profiles
| 字段 | 约束 |
|---|---|
| user_id PK FK→users | 私密资料独立表，读权限独立 |
| phone_encrypted? | AES-256-GCM；键独立管理（首期暂缓手机号路径） |
| phone_masked? / phone_verified_at? | 展示用掩码 |
| **email_encrypted? / email_masked? / email_verified_at?** | D-014：邮箱验证码登录（密文 + 掩码 + 验证时间）；发布门槛 = 手机号或邮箱任一已验证 |
| privacy_settings | jsonb：{profileVisibility} |

### user_blocks
| 字段 | 约束 |
|---|---|
| (blocker_user_id, blocked_user_id) 复合 PK | CHECK blocker≠blocked（禁屏蔽自己） |

### pets
| 字段 | 约束 |
|---|---|
| id PK, owner_user_id FK→users | |
| name / species(CHECK IN 五物种)/breed?/sex? | |
| birth_date? (date) | 不超今天（应用层校验） |
| weight_value?(numeric)/weight_unit?/weight_measured_at? | 必须带测量时间（6.2） |
| sterilized? CHECK IN ('YES','NO','UNKNOWN') | 允许未知 |
| visibility CHECK IN ('PRIVATE','PUBLIC') 默认 PRIVATE | 健康/医疗字段任何可见性下不出公开 DTO |
| archived_at? | 软删除 |
| INDEX (owner_user_id, archived_at) | |

### pet_care_notes
| 字段 | 约束 |
|---|---|
| id PK, pet_id FK→pets | |
| note_type CHECK IN ('DIET','BEHAVIOR','ALLERGY','EMERGENCY','OTHER') | |
| visibility 默认 'OWNER_ONLY'；('ORDER_PARTICIPANTS' M2 生效) | 按订单授权查看 |

## 1.5 M1.5 地铁（D-009，随 M1 迁移）

### transit_cities
name(城市名), pinyin?, status(CHECK ACTIVE/DISABLED)；UNIQUE(name)

### transit_lines
city_id FK, name(如"地铁1号线"), ref(线路编号), origin?, terminus?, sort
UNIQUE(city_id, ref)

### transit_stations
city_id FK, name(站名), lat, lng, osm_node_id?（导入幂等键）；UNIQUE(city_id, osm_node_id)

### transit_line_stations（线路-站点有序关系）
line_id FK, station_id FK, seq；复合 PK(line_id, station_id)；UNIQUE(line_id, seq)
INDEX(station_id)——查询某站经过的线路

### transit_edges（图的边，导入时预计算）
from_station_id, to_station_id, kind CHECK IN ('RIDE','TRANSFER'), minutes(numeric>0)
RIDE：同线相邻站（默认 3 分/段，可配置）；TRANSFER：同城同名或坐标距<250m 的跨线连接（默认惩罚 5 分钟，可配置）
复合 PK(from_station_id, to_station_id, kind)

### user_stations（用户常用地铁站）
user_id FK, city_id FK, station_id FK, label?（如"家附近"）；复合 PK(user_id, station_id)
INDEX(user_id)

## 2. M2 互助履约（已迁移，DDL 另见 schema.prisma 与 20261010121652_m2_care/migration.sql）

> 枚举受约束字符串在迁移中以 CHECK 表达；金额 bigint 整数分（视图层转 number）；
> 事件表（care_order_events/dispute_events）由触发器拒绝 UPDATE/DELETE（追加式）。

### care_offerings（服务公告）
provider_user_id, service_type(CHECK FEED/WALK/BOARD/OTHER), title, description, area_code, radius_km?, pricing_type(CHECK FREE/FIXED/NEGOTIABLE/BARTER), price_minor?(CHECK ≥0，FIXED 时 NOT NULL), cancel_rule, status(CHECK DRAFT/PUBLISHED/PAUSED/ARCHIVED/REMOVED), removed_reason?
INDEX(area_code, service_type, status)

### care_offerings_availability（可用时段）
offering_id FK, start_at, end_at CHECK(end>start), capacity CHECK≥1, status(CHECK OPEN/CLOSED)
UNIQUE(offering_id, start_at)——防重复录入同刻时段

### care_requests（求助需求）
requester_user_id, service_type, title, description, area_code, start_at, end_at, **frequency?**（频次描述）, **pet_ids UUID[]（1-5 只，CHECK cardinality；订单快照来源）**, pricing_type, price_minor?, cancel_rule, **emergency_contact_encrypted?（AES-256-GCM，接受时复制进订单私密表）**, status(CHECK DRAFT/PUBLISHED/MATCHED/CANCELLED/EXPIRED), matched_at?
**无精确地址字段**——地址只活在 care_order_private_details

### care_applications（服务申请）
request_id FK, offering_id?(可空), applicant_user_id, message, proposed_price_minor?, status(CHECK PENDING/ACCEPTED/REJECTED/WITHDRAWN/EXPIRED), decided_at?, care_order_id?(接受后回填，**无 FK**：避免与 care_orders 循环依赖)
UNIQUE(request_id, applicant_user_id)——同一需求同一人仅一份申请
INDEX(request_id, status)

### care_orders（服务订单）
order_no(业务公开编号，非自增，UNIQUE), offering_id?, request_id?, application_id?, requester_user_id, provider_user_id, status(CHECK 见 STATE_MACHINES 11.3 八态), pricing_type + price_minor(冗余列，快照不依赖 JOIN), agreed_terms_json(jsonb 快照：价格/取消规则/责任/地址访问规则/条款版本/宠物快照), terms_version, confirmed_by_requester_at?, confirmed_by_provider_at?, completed_at?, cancelled_at?, cancel_reason_code?
CHECK(provider_user_id ≠ requester_user_id)
CHECK 金额一致性：pricing_type='FIXED' ⇒ price_minor NOT NULL

### care_order_events（状态历史）
care_order_id FK, from_status?, to_status, actor_user_id, actor_role(CHECK REQUESTER/PROVIDER/ADMIN), reason_code?, note?
**追加式，UPDATE/DELETE 被触发器拒绝**（from_status 为 NULL 表示订单创建事件）

### care_order_private_details（私密履约信息）⭐
care_order_id PK FK, address_encrypted, entry_instructions_encrypted?, emergency_contact_encrypted?, access_policy(jsonb：允许读取的状态集合), updated_at
**不在任何通用订单查询的 JOIN 中**；读取路径唯一：参与方+状态联合校验→解密→写 sensitive_access_logs

### care_visits（单次上门）
care_order_id FK, seq, scheduled_at, started_at?, completed_at?, status(CHECK SCHEDULED/IN_PROGRESS/COMPLETION_SUBMITTED/COMPLETED/MISSED/CANCELLED/EXCEPTION), notes?
UNIQUE(care_order_id, seq)

### care_evidence（履约凭证）
care_visit_id FK, media_asset_id?(FK，PHOTO 型必填), evidence_type(CHECK PHOTO/NOTE), **note?（NOTE 型凭证文本，CHECK：PHOTO 必带媒体 / NOTE 必带文本）**, created_by
访问限订单参与方；对象 key 不可预测；读取写敏感审计（M2 先支持 NOTE；PHOTO 上传管线随 M4 媒体端点，D-011）

## 3. M3 集市（已迁移，DDL 见 20261010143355_m3_market/migration.sql）

### market_categories ✅已迁移
parent_id?(自引用), code(唯一), name, risk_level(CHECK LOW/MEDIUM/HIGH——HIGH 必须人审), status(CHECK ACTIVE/DISABLED), sort
种子数据（10 类）：喂养/清洁/出行/玩具/笼舍/服饰/书籍/其他；**宠物食品（PET_FOOD）与宠物药品（PET_MEDICINE）HIGH**

### market_listings ✅已迁移
seller_user_id, listing_type(CHECK GIFT/SWAP/SALE/WANTED), category_id FK, title, description, price_minor?（GIFT ⇒ NULL 或 0，SALE ⇒ >0，CHECK 与 listing_type 组合）, condition(CHECK NEW/LIKE_NEW/GOOD/FAIR), area_code, handover_window?, status(CHECK DRAFT/PUBLISHED/PENDING_REVIEW/SOLD/REMOVED/EXPIRED), removed_reason?
CHECK 价格与 listing_type 组合一致；INDEX(category_id, area_code, status)
keyword 检索当前用 ILIKE 包含匹配（pg_trgm GIN 索引待启用，见 market.md 已知项）

### market_listing_media ✅已迁移（D-012 补口）
listing_id FK, media_asset_id FK, sort_order；复合 PK(listing_id, media_asset_id)

### market_deals（交易记录）✅已迁移
listing_id FK, buyer_user_id, seller_user_id, status(CHECK 七态), handover_at?, handover_area?(商圈级), agreement_json?(交接约定快照), completed_at?, cancelled_at?, cancel_reason_code?
CHECK(buyer≠seller)；**无任何资金字段**（首期）
一物一单（D-012）：**事务 + listing 行锁**实现（AGREEMENT_PENDING 起跨买家互斥；HANDED_OVER 时原子 SOLD + 竞品终结）——
不用 partial unique index，避免 Prisma 迁移引擎把人工索引判为漂移；集成测试覆盖并发与竞品自动终结

### market_deal_events ✅已迁移
market_deal_id, from_status?, to_status, actor_user_id, actor_role(CHECK BUYER/SELLER/ADMIN/SYSTEM), reason_code?, note?
**追加式：触发器拒绝 UPDATE/DELETE**

## 4. M4 社区与治理（✅已全部迁移，见 2026101015*_m4_community/migration.sql；部分随 M2/M3 提前落库，见 D-011/D-012）

### media_assets ✅已迁移（M2 落表；M3 启用管线，D-011/D-012）
owner_user_id, object_key(不可预测随机串，UNIQUE), purpose(CHECK PET_AVATAR/POST_IMAGE/LISTING_IMAGE/EVIDENCE),
mime_type?(finalize 回填), size_bytes?(finalize 回填，非空则>0), upload_expires_at?(授权窗口), finalized_at?, moderation_status(CHECK PENDING/APPROVED/REJECTED), moderation_note?
读取=短时签名 URL+归属/业务授权校验（GET /media/:id/url）；对象 key 不出现在 URL

### posts / post_media ✅已迁移
posts: author_user_id, **post_type(CHECK NORMAL/HELP，D-010)**, content(≤2000), visibility(CHECK PUBLIC/FOLLOWERS/PRIVATE),
moderation_status(CHECK PENDING/APPROVED/REJECTED，默认 APPROVED；新号/风险关键词转 PENDING), hidden_at?, deleted_at?
post_media: post_id, media_asset_id, sort_order；复合 PK(post_id, media_asset_id)

### post_hides ✅已迁移（D-013 补口）
(user_id, post_id) 复合 PK——「不感兴趣」本地偏好，仅影响本人信息流

### comments ✅已迁移
post_id, author_user_id, parent_id?(**限两级：父评论 parent_id 必须为空，服务层校验**), content(≤500), status(CHECK VISIBLE/DELETED), deleted_at?

### reactions ✅已迁移（M3 提前，D-012）
user_id, target_type(CHECK POST/COMMENT/**LISTING**), target_id, reaction_type(CHECK LIKE/FAVORITE)
**UNIQUE(user_id, target_type, target_id, reaction_type)**——防重复点赞/收藏（9.2）；LISTING 用于集市收藏
多态目标存在性由服务端校验（不设 FK）

### follows ✅已迁移
follower_user_id, followed_user_id；复合 PK；CHECK(follower≠followed)；INDEX(followed_user_id)

### reviews ✅已迁移（M2 提前，D-011）
reviewer_user_id, reviewee_user_id, target_type(CHECK CARE_ORDER/MARKET_DEAL), target_id, role(CHECK BUYER/SELLER/REQUESTER/PROVIDER——谁评谁), rating(1-5), tags(text[]), content?, status(CHECK VISIBLE/HIDDEN/DISPUTED_HIDDEN/DELETED)
**UNIQUE(target_type, target_id, reviewer_user_id)**——每个订单每方最多一次（9.2）
CHECK(reviewee≠reviewer)；目标必须 COMPLETED（服务层校验+CHECK 无法表达则测试覆盖）

### conversations / messages ✅已迁移（M3 提前，D-012；消息端点随 M4）
conversations: conversation_type(CHECK CARE_ORDER/MARKET_DEAL), related_order_id?/related_deal_id?（**各 UNIQUE + 恰一非空 CHECK**）, status(CHECK ACTIVE/CLOSED)
conversation_participants: (conversation_id, user_id) 复合 PK
messages: conversation_id, sender_user_id, content, status(CHECK SENT/DELETED), deleted_at?；限流在应用层

### reports（内容举报）✅已迁移
reporter_user_id, target_type(CHECK 9 类), target_id, reason(CHECK 9 类), details?, images(uuid[])?, status(CHECK 六态), assigned_admin_id?, resolution_note?, resolved_at?
重复举报合并（NEW/PROCESSING 内同人同目标）用**应用层检查**实现（D-013：不用 partial unique index，避免 Prisma 漂移，与 D-012 同理）

### disputes（交易/服务纠纷）⭐与 reports 分离 ✅已迁移（M2 提前，D-011）
case_type(CHECK CARE/MARKET), care_order_id?, market_deal_id?, opened_by, reason_code, description, status(CHECK OPEN/EVIDENCE/PENDING_RULING/RULED/APPEALING/CLOSED), resolution_code?, resolved_by?, resolved_at?
**CHECK(care_order_id IS NOT NULL)::int + (market_deal_id IS NOT NULL)::int = 1**——恰一非空（9.2）

### dispute_events ✅已迁移（M2 提前，D-011）
dispute_id, actor_user_id, actor_role(CHECK REQUESTER/PROVIDER/ADMIN/SYSTEM), event_type(CHECK EVIDENCE_ADD/COMMENT/RULING/APPEAL/SYSTEM), note?（**追加式，触发器拒绝 UPDATE/DELETE**）

### notifications ✅已迁移
user_id, type, payload_json(只存业务引用), read_at?；INDEX(user_id, read_at, created_at)

### moderation_actions / sensitive_access_logs / admin_* 
moderation_actions ✅已迁移: target_type, target_id, action, reason, admin_id（处置审计）
sensitive_access_logs ✅已迁移（M2 提前，D-011）: actor_user_id, resource_type(CHECK CARE_ORDER/MEDIA/PROFILE), resource_id, field_group(CHECK ADDRESS/PHONE/EVIDENCE/EMERGENCY_CONTACT), purpose, request_id（**每次敏感读取必写**）
admin_roles ✅已迁移: code(CHECK 11.6 五角色，种子), name, permissions_json
admin_users ✅已迁移: user_id PK, role_id, status(CHECK ACTIVE/DISABLED)——授权走 scripts/grant-admin.mjs
admin_audit_logs ✅已迁移: admin_user_id, action, resource_type, resource_id, request_id, reason?, detail_json（**追加式触发器**）

### app_settings ✅已迁移（D-013）
key PK, value_json, updated_by?——运营配置（leaderboard-config / risk-rules；messagePerMinute 已接线会话限流）

### idempotency_records ✅已迁移（M2 提前，D-011）
user_id, idempotency_key, request_hash(同 key 不同体→冲突), response_status(占位行 null=处理中), response_ref(结果引用：orderId/visitId/reviewId，重放时按引用重读), expires_at
UNIQUE(user_id, idempotency_key)；定期清理

### badges / user_badges ✅已迁移
badges: code 唯一, name, rule_json, is_active（种子 4 枚）
user_badges: (user_id, badge_id) 复合 PK, earned_at, metadata_json——发放幂等（skipDuplicates）

## 5. M6 健康（✅已迁移，见 20261011*_m6_health/migration.sql）

### pet_health_logs ✅已迁移
pet_id FK, log_type(CHECK 五类), value_num?(CHECK>0), unit?, recorded_at（≤当前时间，应用层校验）, source(CHECK MANUAL/DEVICE/VET，默认 MANUAL), notes?
INDEX(pet_id, log_type, recorded_at)——趋势图查询

### pet_mood_logs ✅已迁移
pet_id, mood_tags(text[]：六标签白名单，应用层校验 1-5 个), severity?(CHECK 1-5), observed_at（≤当前时间）, notes?
**注释约定：主观观察，非诊断结论**（产品文档 6.5）；growth 榜单口径=近 30 天记录数

## 6. 不变量与约束汇总（实现检查单）

1. `user_identities(provider, provider_subject)` 唯一；openid 不作主键。
2. `follows` 唯一+禁自关注；`user_blocks` 禁自屏蔽（CHECK）。
3. `reactions` 四元组唯一；多态目标服务端校验存在+可见。
4. 接受申请=单事务：锁 request→EXPIRE 其余申请→ACCEPTED→建 order→MATCHED；失败全回滚。
5. `disputes` 两外键恰一非空（CHECK）。
6. `care_order_private_details`/`private_locations` 不入通用查询；读取必写审计。
7. `*_events` 表追加式（无 UPDATE/DELETE）。
8. `reviews` 每目标每评价者一次（UNIQUE）+ 仅 COMPLETED 目标。
9. 金额整数分；`pricing_type` 与 `price_minor` 组合一致性 CHECK。
10. 软删除字段统一 `*_at timestamptz?`；公开查询默认过滤。

## 7. 删除与保留（9.3）

- 内容类：软删/状态隐藏，保留举报处理上下文。
- 账号注销：匿名化公开资料（nickname→"已注销用户", avatar 清除），保留交易/审计行并断开公开主页关联；保留期限产品/法务定。
- 后台导出：权限+审计+脱敏，不提供手机号/地址/健康日志原始导出。
