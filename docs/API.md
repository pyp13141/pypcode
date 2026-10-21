# API 完整契约（权威文档）

> 覆盖设计文档 10.2–10.7 全部路由。**本文件是前后端唯一契约**：与代码不一致视为缺陷。
> 已实现路由同时有三级契约文档（docs/modules/）；本文件保留全量视图用于审核与排期。
> 错误码分两类：`[已实现]` 同步登记在 [ERRORS](ERRORS.md)；`[契约]` 为未实现路由的约定码，实现该路由时必须同步进 ERRORS.md（见 [DOC-SYNC](DOC-SYNC.md)）。

## 0. 通用约定

| 项 | 约定 |
|---|---|
| 前缀 | `/api/v1` |
| 响应信封 | `{ data, meta: { requestId }, error: null }`；错误 `{ data: null, meta, error: { code, message } }` |
| 鉴权 | `Authorization: Bearer <accessToken>`；标注「公开」的路由无需登录 |
| 分页 | `?page=1&pageSize=20`，pageSize 上限 50；响应 `data: [...], meta: { page, pageSize, total }` |
| 幂等 | 标注「幂等键」的路由要求 `Idempotency-Key` 头；同 key 不同请求体 → `IDEMPOTENCY_KEY_CONFLICT` |
| 所有权 | 每个写路由标注检查规则；前端传的 userId/status/price 一律不可信 |
| 状态前置 | 依赖状态机的路由标注前置状态（权威定义见 [STATE_MACHINES](STATE_MACHINES.md)） |
| 金额 | 整数分；`pricingType` 区分 FREE/FIXED/NEGOTIABLE/BARTER |

## 1. 身份与用户（identity + users）

### 1.1 认证

#### POST /auth/wechat/login `[已实现-Mock]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 请求 | `{ code: string }`（wx.login 获取的凭证；AppID 未配置时走开发 Mock，见 DECISIONS D-006） |
| 响应 data | `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user: PublicUser }` |
| 逻辑 | code2session 换 openid → `user_identities(provider=WECHAT_MINIPROGRAM)` 查找/创建 user → 创建 session（令牌只存哈希） |
| 错误码 | `AUTH_CODE_INVALID`(400,契约) `AUTH_WECHAT_NOT_CONFIGURED`(503,契约) `USER_BANNED`(403,契约) |

#### POST /auth/h5/login `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 请求 | `{ phone: string, code: string }` |
| 响应 data | 同 wechat/login |
| 逻辑 | 校验短信验证码（限流 1 次/分钟/号）→ identity(provider=H5_PHONE) 查找/创建 → session |
| 错误码 | `AUTH_CODE_INVALID`(400) `AUTH_RATE_LIMITED`(429) `USER_BANNED`(403) |

#### POST /auth/phone/verify `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 请求 | `{ phone: string, code: string }`（已登录用户补验证时携带 Bearer） |
| 响应 data | `{ verified: true }` |
| 逻辑 | 校验码；已登录则写 `user_private_profiles.phone_encrypted`(AES-256-GCM)+`phone_verified_at`，并记敏感访问审计 |
| 错误码 | `AUTH_CODE_INVALID`(400) `AUTH_RATE_LIMITED`(429) |

#### POST /auth/identity/link `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 + 二次认证（重新提交当前身份凭证或短信码） |
| 请求 | `{ provider: "WECHAT_MINIPROGRAM"|"H5_PHONE", credential: string }` |
| 响应 data | `{ linked: true }` |
| 逻辑 | 目标 provider_subject 未被占用→绑定到当前 user；占用→409（防抢绑） |
| 错误码 | `IDENTITY_ALREADY_LINKED`(409) `IDENTITY_TAKEN`(409) `AUTH_SECOND_FACTOR_FAILED`(401)（均契约） |

#### POST /auth/email/send-code `[已实现]`（D-014：首期替代手机号）
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 请求 | `{ email: string }`（规范化小写；Mock 邮件供应商打日志） |
| 响应 data | `{ expiresInMinutes: 5 }`；`AUTH_CODE_ECHO=true`（内测）时附 `devCode` 直显 |
| 错误码 | `REQUEST_VALIDATION_FAILED`(400) `AUTH_RATE_LIMITED`(429，1 次/分钟/邮箱) |

#### POST /auth/email/login `[已实现]`（D-014）
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 请求 | `{ email: string, code: string }` |
| 响应 data | 同 wechat/login；同时把邮箱（密文+掩码+验证时间）写入私密资料 |
| 错误码 | `AUTH_CODE_INVALID`(400) `USER_BANNED`(403) |

> 说明：`POST /auth/h5/login` 与 `POST /auth/phone/verify` 保留契约，**当前暂缓**（无短信供应商；D-014 以邮箱验证码替代）。

#### POST /auth/logout `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 响应 data | `{ loggedOut: true }` |
| 逻辑 | 撤销当前 session（revoked_at），令牌哈希失效 |

#### POST /auth/refresh `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开（持 refreshToken） |
| 请求 | `{ refreshToken: string }` |
| 响应 data | 同 login（新令牌对；旧 refreshToken 轮换撤销） |
| 错误码 | `AUTH_REFRESH_INVALID`(401) `AUTH_REFRESH_EXPIRED`(401)（均契约）；复用已撤销 refresh → 全部会话撤销（盗用检测） |

### 1.2 我的资料

#### GET /me `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 响应 data | `{ id, nickname, avatarUrl, bio, areaCode, phoneMasked?, phoneVerified, privacySettings, createdAt }`（白名单字段，绝不含明文手机号/openid） |

#### PATCH /me/profile `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ nickname?(3-20字), avatarUrl?, bio?(≤200), areaCode? }`（class-validator 白名单） |
| 响应 data | PublicUser |

#### PATCH /me/privacy `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ profileVisibility: "PUBLIC"\|"FOLLOWERS"\|"PRIVATE" }` |
| 响应 data | `{ privacySettings }` |

#### POST /me/deletion-request `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 + 二次确认 |
| 请求 | `{ confirmText: "注销" }` |
| 响应 data | `{ deletionRequestedAt }` |
| 逻辑 | 进入冷静期（建议 15 天，产品定）；期间可撤销；到期匿名化公开资料，保留交易/审计数据（9.3） |

## 2. 宠物档案（pets）

#### GET /pets `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 响应 data | `Pet[]`（本人全字段；不含 care_notes，另行接口） |

#### POST /pets `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ name(1-20), species: "CAT"\|"DOG"\|"BIRD"\|"SMALL_ANIMAL"\|"OTHER", breed?, sex?, birthDate?(ISO 日期不超今天), weightValue?(>0), weightUnit?("kg"\|"g"\|"lb"), sterilized?("YES"\|"NO"\|"UNKNOWN"), visibility?("PRIVATE"\|"PUBLIC") }` |
| 响应 data | Pet |
| 约束 | 每用户宠物数上限 50（防滥用，可配置）；错误 `PET_LIMIT_REACHED`(409,契约) |

#### GET /pets/:petId `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开（按 visibility 过滤） |
| 所有权 | 本人→全字段；他人→PUBLIC 时仅白名单 `{id,name,species,breed,sex,birthDate,visibility}`；PRIVATE→404（不泄露存在性） |
| 错误码 | `RESOURCE_NOT_FOUND`(404,已实现) |

#### PATCH /pets/:petId `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录；所有权 = pet.owner_user_id = current |
| 请求 | 同 POST 的可选子集 |

#### DELETE /pets/:petId `[契约]`
| 项 | 值 |
|---|---|
| 鉴权+所有权 | 同上 |
| 逻辑 | 软删除（archived_at）；已出现在订单快照中的档案不受影响 |

#### POST/GET /pets/:petId/health-logs `[已实现]`（M6）
| 项 | 值 |
|---|---|
| 鉴权 | POST 须所有权；GET 本人或授权方 |
| POST 请求 | `{ logType: "WEIGHT"\|"DIET"\|"WATER"\|"ACTIVITY"\|"EVENT", valueNum?, unit?, recordedAt, source: "MANUAL"\|"DEVICE"\|"VET", notes? }` |
| GET 分页 | 同通用分页；可按 logType 过滤 |
| 约束 | 只存记录不产建议；紧急症状文案提示就医（6.5） |

#### POST/GET /pets/:petId/mood-logs `[已实现]`（M6）
| 项 | 值 |
|---|---|
| POST 请求 | `{ moodTags: string[](观察标签), severity?(1-5), observedAt, notes? }` |
| 约束 | 主观观察，不作诊断结论 |

## 3. 互助服务（care）——M2

状态机权威：[STATE_MACHINES](STATE_MACHINES.md)。所有状态变更走领域服务+事务+事件表。

#### GET /care/offerings `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开（未登录可浏览） |
| 查询 | `?areaCode=&serviceType=&dateFrom=&dateTo=&pricingType=&page=` |
| 响应 | OfferingSummary[]（含 provider 信任摘要：验证状态/完成次数/评价样本量） |

#### POST /care/offerings `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录；手机号已验证方可发布（运营开关） |
| 请求 | `{ serviceType: "FEED"\|"WALK"\|"BOARD"\|"OTHER", title(5-50), description, areaCode, radiusKm?, pricingType: "FREE"\|"FIXED"\|"NEGOTIABLE"\|"BARTER", priceMinor?(FIXED 时必填≥0), availabilities: [{startAt,endAt,capacity}], cancelRule }` |
| 状态 | 创建即 `PUBLISHED` 或 `DRAFT`（请求指定） |

#### GET /care/offerings/:id `[已实现]` — 详情：公告全字段 + 服务者信任摘要 + 可用时段 + 安全提示（7.2）
#### PATCH /care/offerings/:id `[已实现]` — 所有权；`REMOVED` 不可改；价格类型变更需重新确认关联订单不受影响

#### POST /care/requests `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录；**须已有宠物档案**（服务快照来源） |
| 请求 | `{ petIds: uuid[](1-5), serviceType, title, description, areaCode, startAt, endAt,频次?, pricingType, priceMinor?, cancelRule, emergencyContact? }` |
| 响应 | Request（状态 `PUBLISHED`） |
| 安全 | 响应与公开列表**绝不含**精确地址/门禁/手机号（只有 areaCode） |

#### GET /care/requests `[已实现]` — 公开检索；同上字段过滤
#### GET /care/requests/:id `[已实现]` — 需求详情（公开仅 PUBLISHED；本人可见全状态；其余 404 不泄露存在性）

#### POST /care/requests/:id/applications `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录；申请人≠需求方；同一 request+applicant 唯一（DB 约束） |
| 请求 | `{ message(≤500), proposedPriceMinor? }` |
| 响应 | Application（PENDING）；**不创建订单** |

#### GET /care/requests/:id/applications `[已实现]` — 仅需求方可见

#### POST /care/applications/:applicationId/accept `[已实现]` ⭐关键事务
| 项 | 值 |
|---|---|
| 鉴权 | 仅需求方 |
| 幂等键 | 必须 |
| 前置 | application=PENDING 且 request=PUBLISHED |
| 事务 | 行锁 request → 其余 PENDING 申请置 EXPIRED → application=ACCEPTED → 创建 order(PENDING_CONFIRMATION，含条款快照) → request=MATCHED |
| 响应 | `{ applicationId, orderId }` |
| 错误码 | `APPLICATION_STATE_INVALID`(409) `REQUEST_NOT_OPEN`(409) `CARE_ORDER_EXISTS`(409)（均契约）；失败整体回滚，不留"已接受无订单" |

#### POST /care/applications/:applicationId/reject `[已实现]` — 仅需求方；PENDING→REJECTED（记 reason）
#### POST /care/applications/:applicationId/withdraw `[已实现]` — 仅申请人；PENDING→WITHDRAWN

#### POST /care/orders `[契约]`
仅限系统内部路径（如 offering 直接预约的聚合事务）；**客户端禁止绕过申请接受流创建已确认订单**。若开放预约申请（offerings/:id/applications）先创建 Application，仍走 accept 流。

#### GET /care/orders `[已实现]` — 参与方（需求方/服务者）；按 role/status 过滤
#### GET /care/orders/:id `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 仅参与方 |
| 响应 | Order 公共字段 + `agreedTerms` 快照；**地址/门禁/紧急联系人不在本响应**，见下条独立接口 |

#### GET /care/orders/:id/private-details `[已实现]` ⭐敏感
| 项 | 值 |
|---|---|
| 鉴权 | 仅参与方 且 order 状态 ∈ {CONFIRMED, IN_PROGRESS, COMPLETION_SUBMITTED} |
| 逻辑 | AES 解密返回 address/entryInstructions/emergencyContact；**每次读取写 sensitive_access_logs**（actor/resource/field_group/purpose/request_id） |
| 错误码 | `PRIVATE_DETAIL_NOT_AVAILABLE`(403)（契约）——状态未到或非参与方 |

#### PUT /care/orders/:id/private-details `[已实现]` ⭐敏感（D-011 契约补口）
| 项 | 值 |
|---|---|
| 鉴权 | 仅需求方；order 状态 ∈ {PENDING_CONFIRMATION, CONFIRMED} |
| 请求 | `{ address(1-300，必填), entryInstructions?(≤500), emergencyContact?(≤200) }` |
| 逻辑 | AES-256-GCM 加密落库（同 private-details 表）；**每次写入写 sensitive_access_logs** |
| 错误码 | `PRIVATE_DETAIL_NOT_AVAILABLE`(403) `ORDER_STATE_INVALID`(409)（已实现）——确认订单前必须已有地址，否则 confirm 报 `ORDER_PRIVATE_DETAILS_REQUIRED` |

#### POST /care/orders/:id/confirm `[已实现]` — 参与方双方各自确认；双方条款版本一致→CONFIRMED
#### POST /care/orders/:id/start `[已实现]` — 仅服务者；CONFIRMED→IN_PROGRESS；校验时间窗±24h（可配）
#### POST /care/orders/:id/visits `[已实现]` — 幂等键；IN_PROGRESS 下创建 SCHEDULED visit（多频次订单）
#### PATCH /care/orders/:id/visits/:visitId `[已实现]` — 服务者更新：开始/完成/异常（EXCEPTION+说明）
#### POST /care/orders/:id/complete `[已实现]` — 幂等键；仅服务者；全部 visit 完成或有 EXCEPTION 已说明→COMPLETION_SUBMITTED；需求方确认→COMPLETED（或确认期超时自动完成的规则由产品定，见 23.5）
#### POST /care/orders/:id/cancel `[已实现]` — 按 agreedTerms.cancelRule 计算责任方；CANCEL_REQUESTED→CANCELLED；写 reason_code
#### POST /care/orders/:id/disputes `[已实现]` — 参与方；创建 disputes 工单（care_order_id 非空 CHECK）；订单状态进入争议组合
#### POST /care/orders/:id/reviews `[已实现]` — 幂等键；仅 COMPLETED；双向各一次；reviewer/target/角色由服务端推导；争议期间暂缓公开展示

## 4. 集市与交易（marketplace）——M3

列表公告与交易状态分离（STATE_MACHINES §6）。

#### GET /market/categories `[已实现]` — 公开分类字典（含 riskLevel；HIGH 类目发布即人审）
#### GET /market/listings `[已实现]` — 公开；`?listingType=&categoryCode=&areaCode=&priceMin=&priceMax=&keyword=&page=`
#### POST /market/listings `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ listingType: "GIFT"\|"SWAP"\|"SALE"\|"WANTED", categoryCode, title, description, priceMinor?(SALE 必填>0；GIFT 必须 0/空), condition, areaCode, handoverWindow?, images: mediaId[](1-9) }` |
| 校验 | 价格与 listingType 一致（GIFT≠价格>0）；类目风险级（market_categories.risk_level）→ 高风险类目进入人工审核 `PENDING_REVIEW`(契约)；违禁词/图先机审后人审 |
| 错误码 | `LISTING_PRICE_INVALID`(400) `LISTING_CATEGORY_RESTRICTED`(403)（契约） |

#### GET /market/listings/:id `[已实现]` — 详情；不暴露卖家精确位置（areaCode 级）
#### PATCH /market/listings/:id `[已实现]` — 所有权；`HANDED_OVER/COMPLETED/REMOVED` 后关键字段（价格/描述）禁改
#### PUT/DELETE /market/listings/:id/favorite `[已实现]` — 幂等（PUT 重复=已收藏，DELETE 重复=已取消）；reactions 唯一约束
#### POST /market/deals `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录；买家≠卖家 |
| 请求 | `{ listingId, message? }` |
| 逻辑 | 校验 listing 可交易（PUBLISHED）；创建 deal(CONTACTED)+受限会话(conversation)；**不托管资金** |
| 并发 | 同一 listing 只允许一笔进行中 deal 的规则由类目配置（一物一单）→ `DEAL_ALREADY_IN_PROGRESS`(409,契约) |

#### GET /market/deals `[已实现]` — 仅交易双方
#### GET /market/deals/:id `[已实现]` — 交易详情（仅参与方；非参与方 404 不泄露存在性；响应含 conversationId 供进入受限会话）
#### POST /market/deals/:id/agree `[已实现]` — 双方确认交接约定（地点级别到商圈/公共场所，不强制住址）→AGREED
#### POST /market/deals/:id/complete `[已实现]` — 双方各自确认已交接→COMPLETED；页面强提示"线下交接完成不代表平台验证物品"
#### POST /market/deals/:id/cancel `[已实现]` — 任一方；记原因
#### POST /market/deals/:id/disputes `[已实现]` — 创建 disputes 工单（market_deal_id 非空）
#### POST /market/deals/:id/reviews `[已实现]` — 仅 COMPLETED；每方一次

## 5. 社区与审核（community + moderation）——M4

#### GET /community/feed `[已实现]` — 公开可浏览前 N 条；`?tab=recommended|following|latest`；关注流需登录；被屏蔽/删除/隐藏内容不出现在任何人的流
#### POST /community/posts `[已实现]` — 登录；`{ content(≤2000), images: mediaId[](0-9), topicIds? }`；新号/高频/重复图→机审降权或转人工 `PENDING_REVIEW`
#### GET /community/posts/:id `[已实现]` — 公开（作者隐私设置为 PRIVATE 时仅自己）
#### POST /community/posts/:id/comments `[已实现]` — 登录；`{ content(≤500), parentId? }`（两级回复）
#### PATCH/DELETE /community/comments/:id `[已实现]` — 作者本人；删除为软删（审计保留）
#### POST /community/reactions `[已实现]`（另有 DELETE 补口：取消互动）
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ targetType: "POST"\|"COMMENT", targetId, reactionType: "LIKE"\|"FAVORITE" }` |
| 约束 | (user,target,type) 唯一；服务端校验目标存在且可见；限流 |

#### PUT/DELETE /community/users/:userId/follow `[已实现]` — 幂等；禁自关注（CHECK）；屏蔽关系优先（被屏蔽者的帖子不出现在关注流）
#### POST /community/posts/:id/hide `[已实现]` — 仅影响当前用户信息流（本地偏好）
#### GET /conversations/:id/messages `[已实现]` — 仅会话参与方；分页；消息不可含联系方式的放行策略见反骚扰规则（7.3）
#### POST /conversations/:id/messages `[已实现]` — 参与方；限流（如 10 条/分钟）；关键词风险提醒；带业务对象的会话才可发起（订单/交易）
#### POST /conversations/:id/report `[已实现]` — 举报会话/消息→reports(targetType=CONVERSATION/MESSAGE)
#### POST /reports `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ targetType: "USER"\|"POST"\|"COMMENT"\|"LISTING"\|"OFFERING"\|"REQUEST"\|"DEAL", targetId, reason: "SCAM"\|"HARASSMENT"\|"MISINFO"\|"DANGEROUS"\|"ANIMAL_ABUSE"\|"PROHIBITED"\|"IP"\|"AD"\|"OTHER", details?(≤1000), images? }` |
| 逻辑 | 创建工单(NEW)；同一用户对同一 target 重复举报幂等合并；进入后台队列 |
| 错误码 | `REPORT_DUPLICATE`(409,契约) |

#### POST /media/upload-authorizations `[已实现-M3]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ purpose: "PET_AVATAR"\|"POST_IMAGE"\|"LISTING_IMAGE"\|"EVIDENCE", count, mimeTypeWhitelist由服务端按purpose下发, maxBytes }` |
| 响应 data | `{ uploads: [{ mediaId, uploadUrl(短时签名), headers, expiresAt }] }`（对象存储私有桶直传） |
| 约束 | 频控（如 20 次/小时/人）；MVP 本地盘适配器实现同形状（DECISIONS D-007） |

#### POST /media/:mediaId/finalize `[已实现-M3]` — 上传完成后登记大小/类型/对象 key → 审核态 PENDING
#### PUT/GET /media/:mediaId/upload · /file `[已实现-M3]`（D-012 补充）— 短时签名 token 直传/读取；对象 key 不出现在 URL
#### GET /media/:mediaId/url `[已实现-M3]` — 业务授权校验后签发 5 分钟读取签名（EVIDENCE 仅订单参与方且写审计）

#### GET /notifications `[已实现]` — 本人；`?unreadOnly=`
#### POST /notifications/:id/read `[已实现]` — 本人幂等
#### GET /me/reports `[已实现]` — 本人举报的处理状态（不含他人信息）
#### GET /community/leaderboards `[已实现]` — 已配置榜单（三类，12.3）；返回规则说明字段；不可售卖排名
#### GET /badges `[已实现]` — 徽章定义与获取条件；本人已获徽章

## 5.5 地铁（transit）——M1.5（D-009，零地图 API）

> 设计原则：不接任何地图 API。数据=OSM 静态导入；"最近站"=用户自选+地址文本模糊匹配；路线=Dijkstra 本地计算；导航=客户端跳转本地地图 App（不在服务端契约内）。

#### GET /transit/cities `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 响应 data | `{ id, name, lineCount, stationCount }[]`（仅 ACTIVE） |

#### GET /transit/stations?cityId=&q= `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 逻辑 | 站名前缀/包含/拼音模糊匹配（pg_trgm 或 ILIKE），上限 20 条 |
| 响应 data | `{ id, name, lines: {id, ref, name}[] }[]`（每站带经过线路） |

#### GET /transit/route?fromStationId=&toStationId= `[契约]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开 |
| 逻辑 | transit_edges 上 Dijkstra；换乘惩罚 5 分、站间 3 分（可配置） |
| 响应 data | `{ totalMinutes, transfers, legs: [{ lineId, lineName, fromStation, toStation, stops }] }`（legs 按乘坐段分节） |
| 错误码 | `TRANSIT_SAME_STATION`(400,契约) `TRANSIT_NO_ROUTE`(404,契约) `TRANSIT_DATA_EMPTY`(503,契约——城市未导入数据) |

#### POST /transit/match-address `[契约]
| 项 | 值 |
|---|---|
| 鉴权 | 登录 |
| 请求 | `{ cityId, addressText(≤200) }`（用户手填地址，不调地理编码） |
| 响应 data | `{ candidates: [{ stationId, stationName, score }], top?: stationId }`——地址文本与站名/站点别名模糊匹配；客户端展示候选让用户确认 |
| 说明 | D-009：纯字符串匹配；无坐标计算 |

#### GET/POST/DELETE /me/stations `[契约]
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| GET 响应 | `{ stationId, stationName, cityId, cityName, label }[]` |
| POST 请求 | `{ cityId, stationId, label?(≤20) }`；同 user+station 幂等 |
| DELETE | `/me/stations/:stationId` 幂等 |

## 5.6 通用求助帖（help_posts）——M4（D-010，契约先行）

> 两层模型的轻量层：无订单机制。响应走评论+站内信。首期分类白名单 PET_CARE/NEIGHBOR。

#### POST /community/help-posts `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 必须登录 |
| 请求 | `{ category: "PET_CARE"\|"NEIGHBOR", title(5-50), content(≤1000), cityId?, stationId?, deadlineAt? }` |
| 响应 data | HelpPost（状态 OPEN） |
| 约束 | 分类不在白名单→`HELP_CATEGORY_NOT_ALLOWED`(400,契约)；频率限制（如 5 篇/天） |

#### GET /community/help-posts `[已实现]`
| 项 | 值 |
|---|---|
| 鉴权 | 公开（登录可看更多字段） |
| 查询 | `?category=&cityId=&stationId=&status=OPEN&page=` |

#### GET /community/help-posts/:id `[已实现]` — 详情+评论区入口
#### POST /community/help-posts/:id/resolve `[已实现]` — 仅发帖人；OPEN→RESOLVED（幂等）
#### POST /community/help-posts/:id/cancel `[已实现]` — 仅发帖人；OPEN→CLOSED

## 6. 管理后台（admin）——M4，前缀 /api/v1/admin

统一鉴权：`AdminGuard` + `@AdminRoles`（11.6：content_moderator / support_operator / catalog_operator / analyst / super_admin），最小权限；高危操作二次确认+理由+审计。

| 组 | 路由要点 `[已实现]`（契约见 docs/modules/moderation.md） |
|---|---|
| 用户 | `GET /admin/users`（检索/风险标签）`POST /admin/users/:id/status`（封禁/解封，理由必填） |
| 审核队列 | `GET /admin/moderation/queue`（帖子/评论/集市内容）`POST /admin/moderation/:id/decision`（APPROVE/REMOVE，理由+证据引用） |
| 举报工单 | `GET /admin/reports` `POST /admin/reports/:id/assign` `POST /admin/reports/:id/resolve` |
| 纠纷 | `GET /admin/disputes` `POST /admin/disputes/:id/evidence` `POST /admin/disputes/:id/ruling`（裁定+理由）`POST /admin/disputes/:id/appeal` |
| 订单/交易 | `GET /admin/care-orders` `GET /admin/market-deals`（只读必要字段；地址/紧急联系人**默认不可见**，按工单临时授权+审计） |
| 配置 | `GET/PUT /admin/categories` `GET/PUT /admin/badges` `GET/PUT /admin/leaderboard-config` `GET/PUT /admin/risk-rules`（新服务者接单上限等） |
| 报表 | `GET /admin/metrics/overview`（聚合：响应率/完成率/取消率/纠纷率/举报处理时长） |
| 审计 | `GET /admin/audit-logs`（只读；admin_audit_logs） |

## 7. 实施优先级映射

| 里程碑 | 路由组 | 状态 |
|---|---|---|
| M0 | system.health/meta | ✅ 已实现 |
| M1 | 1.1 认证（微信 Mock）+ 1.2 部分 + 2 宠物 CRUD | 🚧 进行中（迁移已建） |
| M1.5 | §5.5 transit（D-009 地铁，随 M1 一起） | 🚧 进行中 |
| M2 | §3 全部（18 路由已实现；offerings/:id/applications 预约流与内部 POST /care/orders 未开放） + 1.2 其余（M1 已覆盖） | 🚧 代码完成，待部署验收 |
| M3 | §4 全部（12 路由）+ 媒体管线 4 路由 + 会话表（消息端点随 M4） | ✅ 已实现 |
| M4 | §5 + §5.6 求助帖 + §6 后台（28 路由） | ✅ 已实现 |
| M6 | health/mood-logs（✅ 已实现）、badges/leaderboards（M4 已实现；growth 榜单 M6 接线） | ✅ 已实现 |

> 新路由实现时：本表状态更新 + 三级契约文档 + ERRORS.md 登记错误码（check-docs 强制）。
