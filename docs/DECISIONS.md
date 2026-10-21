# 技术决策记录（DECISIONS）

> 依据：`docs/PRODUCT_DESIGN.md`（宠邻产品与技术设计文档 v1.1）。与该文档冲突时以产品设计文档的状态机、权限和安全约束为准，并回写本文件。

## D-001 技术栈（冻结）

| 项 | 决策 | 来源 |
|---|---|---|
| 前端 | Taro 4.x + React 18 + TypeScript，一套代码编译微信小程序 + H5 | 文档 0.3 |
| 后端 | NestJS + TypeScript，模块化单体，不拆微服务 | 文档 0.3 |
| ORM | Prisma（二选一锁定，不混用 TypeORM） | 文档 8.3 |
| 数据库 | PostgreSQL 16（服务器本机已有实例） | 文档 0.3 |
| 缓存/队列 | MVP 不引入 Redis | 文档 0.3 |
| 对象存储 | MVP 用本地磁盘适配器，接口按 S3 兼容形状设计；上线前换云 OSS | 文档 0.3 + 现实约束 |
| 支付 | `PAYMENT_ENABLED=false`，不实现钱包/托管 | 文档 15.3 |

## D-002 部署形态（本服务器实测后冻结）

- API：systemd 常驻 `pet-neighbor-api.service`，仅监听 `127.0.0.1:3001`，不对外。
- H5：静态构建产物发布到 `/var/www/petn/`。
- 对外入口：复用本机 Caddy（ACLI 管理），挂在已放行的 80/443 端口路径 `/petn/` 下：
  - `http://YOUR_SERVER_IP/petn/` → H5 静态文件（SPA，`try_files` 回退 index.html）。
  - `http://YOUR_SERVER_IP/petn/api/*` → 反代 `127.0.0.1:3001`。
  - Caddy 片段文件：`/etc/caddy/acli.d/routes/pet-neighbor.caddy`，由本仓库 `infra/deploy/` 同步。
- **不使用任何免配置隧道**（ngrok/cloudflared 等），符合服务器强规则。
- 小程序 request 域名：待用户提供 ICP 备案域名后，在微信后台配置 `https://<备案域名>`；开发阶段用开发者工具"不校验合法域名"直连本机。

## D-003 ID 与数据约定

- 主键 UUID（Prisma `uuid()`），公开业务编号（如 `order_no`）另行生成，见文档 9 节。
- 时间一律 UTC 存储（`timestamptz`），前端按用户时区展示。
- 金额整数分（`price_minor`），不用浮点。
- 关键表不做物理删除，用软删除/状态隐藏。

## D-004 环境变量

见 `apps/api/.env.example`。生产值只放 systemd 的 `EnvironmentFile=/etc/pet-neighbor/api.env`（root 可读 600），不进 Git。

## D-005 hello-pets 参考仓库处置（2026-01-10 审查）

- **不 fork、不复制任何代码/图片**：仓库无 LICENSE 文件（README 标 MIT 无效），按产品文档 20.3 红线；且其 51 个云函数绑定微信云开发，与 NestJS+PG 架构不兼容。
- 保留本机隔离副本 `ref/hello-pets/`（不进 Git）仅作阅读参考；M2 开工前重读其 service/provider 页面流补齐功能清单。
- 详见 [REVIEW-HELLO-PETS](REVIEW-HELLO-PETS.md)。

## D-006 微信登录的开发 Mock 与生产护栏

- AppID/AppSecret 未配置时，`/auth/wechat/login` 将 `code` 字符串哈希派生为假 openid，走完整真实链路（identity 查找/创建、session、令牌哈希），保证接口形状与行为和真登录一致。
- **生产环境（NODE_ENV=production）未配置微信凭证时，服务启动直接失败**——绝不静默回退 Mock（产品文档 21.1 禁止虚构成功）。
- 拿到真实 AppID 后：填 `.env` 的 WECHAT_APPID/WECHAT_APPSECRET 即切换，无代码改动。

## D-007 对象存储：本地盘适配器先行

- MVP 用本地盘（`/var/lib/petn-media`）实现与 S3 兼容的接口形状（短时授权上传 URL + finalize 登记 + 短时读取链接），业务代码只依赖 `MediaStoragePort` 接口。
- 上线前换腾讯云 COS：只替换适配器实现，不动业务层。

## D-008 敏感字段加密

- 手机号、订单地址、门禁说明、紧急联系人统一 AES-256-GCM；密钥经环境变量注入（`SENSITIVE_ENCRYPTION_KEY`，32 字节 base64），生产与开发隔离。
- 解密只发生在授权路径（参与方+订单状态联合校验），且每次读取写 `sensitive_access_logs`。

## D-009 位置与导航：地铁静态数据，零地图 API（2026-01-10 用户确认）

**背景**：用户明确不使用高德/百度等收费地图 API（地理编码/路径规划/定位 SDK 均不接）。

- **用户位置表达**：用户手填地址文本；公开层只暴露"常用地铁站"（自选）+ 区域码；精确地址仍只存在于加密订单私密表（不变）。
- **最近地铁站**：不做"地址→坐标"地理编码（这正是收费点）。改为**用户自选站点** + 地址文本与站名**模糊匹配预选候选**（纯字符串匹配，零成本），用户确认。
- **路线规划**：地铁网络静态图，Dijkstra 最短路（换乘惩罚可配）。"坐几站/在哪换乘"本地算出，不调任何外部服务。
- **最后一公里**：刻意不算步行导航；客户端提供**跳转手机本地地图 App** 的深链（amap://、baidumap://、iosamap:// 等），由用户设备上的地图应用接管——服务器零成本、零授权问题。
- **数据源**：OpenStreetMap Overpass（ODbL 协议，须署名"© OpenStreetMap contributors"）；导入脚本 `apps/api/scripts/import-osm-subway.mjs` 可重复执行（按 osm id upsert）。无地铁城市回退区域码筛选。
- **数据边界**：站点坐标是公共数据；用户与站点的关联只存 station id。不引入地图瓦片。

## D-010 通用求助帖：两层模型（2026-01-10 用户确认）

- **结构化互助**（care_requests，M2）：喂养/遛宠/照看等有明确交付的，走申请→订单→履约→评价→纠纷全链保护。不变。
- **通用求助帖**（help_posts，随 M4 社区实现，契约已定）：轻量求助，评论+站内响应，无订单机制。字段：分类/标题/正文/城市/地铁站/截止时间/状态。
- **首期分类白名单**：`PET_CARE`（宠物相关）+ `NEIGHBOR`（邻里小事）；跑腿/代办等商业类目不开（审核压力与平台定位漂移风险，试运营后再议）。
- 生命周期：`OPEN → RESOLVED / CLOSED / EXPIRED`；发帖人可标记已解决；举报/审核复用社区机制。

## D-011 M2 落地细则与契约补口（2026-10-10）

> 背景：M2 端点（API §3）依赖 ERD 中列为 M4 批次的支撑表；且 API 契约存在两处无法闭环的缺口。
> 按"以产品设计文档状态机/安全约束为准，先记录决策不自行猜测"的流程，逐项记录如下。

1. **提前落库的支撑表**（按 ERD 定义实现，不做裁剪）：`sensitive_access_logs`、`idempotency_records`、
   `disputes`、`dispute_events`、`reviews`、`media_assets`。原因：M2 的私密地址审计、幂等键、纠纷工单、
   评价、履约凭证 FK 都需要它们；对应端点也在 API §3 中。上传/读取媒体端点仍按 M4 实现。
2. **契约补口①（私密信息写入路径）**：API §3 只有 `GET /care/orders/:id/private-details`，没有写入路径，
   而订单确认（CONFIRMED）前必须先有地址。新增 `PUT /care/orders/:id/private-details`（仅需求方，
   PENDING_CONFIRMATION/CONFIRMED 可写；每次写入同样写 `sensitive_access_logs`）；`POST /care/orders/:id/confirm`
   在地址缺失时返回 409 `ORDER_PRIVATE_DETAILS_REQUIRED`（不能让服务者在无地址的情况下确认订单）。
3. **契约补口②（需求携带字段）**：`POST /care/requests` 请求体含 `petIds`/频次/紧急联系人，但 ERD 的
   care_requests 未列这些列。落库为：`pet_ids UUID[]（1-5）`、`frequency?`、`emergency_contact_encrypted?`
   （AES-256-GCM，接受时复制进订单私密表）；**公开响应绝不回显密文或明文**。
4. **cancelRule 语义**（ERD/API 只给字段名未给取值）：收窄为受约束字符串 `FREE`（开始前取消即生效，
   立即 CANCELLED）| `MUTUAL`（需对方同意：第二方再次 cancel 时转 CANCELLED）。PENDING_CONFIRMATION
   一律可立即取消；IN_PROGRESS 一律需对方同意（服务已开始）。
5. **visit 完成语义（MVP）**：`PATCH visits/:visitId` 的 COMPLETE 由服务者驱动，置 visit=COMPLETED；
   `COMPLETION_SUBMITTED` 作为 visit 状态保留（逐次确认流程二期）；订单级 `complete` 由服务者提交
   （→COMPLETION_SUBMITTED）、需求方确认（→COMPLETED）。
6. **命名统一**：可用时段表统一为 `care_offerings_availability`（原 ERD 批次表/正文两处不一致）。
7. **发布门槛运营开关**：`CARE_REQUIRE_PHONE_VERIFIED`（默认 false）。原因：`/auth/phone/verify` 尚未
   实现（在 API §1.1，非 M2 范围），强制开启会导致无人可发布；验证流程上线后置 true 即生效。
8. **分页响应形状**（API §0 约定）：`data: [...]`，`meta: { requestId, page, pageSize, total }`
   （信封拦截器识别分页结果对象后合并分页 meta）。
9. **履约凭证（M2 范围收窄）**：只支持 NOTE 文本凭证（写 `care_evidence` 并写 EVIDENCE 敏感审计）；
   PHOTO 凭证依赖媒体上传管线（媒体端点属 M4），`media_assets` 表已按 ERD 提前落库以承接 FK。
10. **纠纷可发起的订单状态扩展**：在 STATE_MACHINES §4 的 {IN_PROGRESS, COMPLETION_SUBMITTED}
    之外，允许 `CANCEL_REQUESTED` 发起纠纷（取消协商陷入僵持时的逃生阀）；订单详情仍以事件表
    保持完整历史，裁定/申诉由 M4 后台实现。

## D-012 M3 落地细则：媒体管线先行与提前依赖（2026-10-10）

1. **媒体管线随 M3 实现**（API §5 原列 M4）：集市列表图片（`images: mediaId[]`，1-9 张必填）无法在无上传管线时闭环。
   实现端点为 upload-authorizations / media-blob（直传+读取）/ media-finalize / media-url，存储走 D-007 本地盘适配器
   （`MEDIA_DIR`，生产 `/var/lib/petn-media`），token 为 HMAC 短时签名（复用 D-008 密钥）。
2. **提前落库的支撑表**：`reactions`（集市收藏复用，target_type 增 `LISTING`）、`conversations`/`messages`
   （POST /market/deals 强制创建受限会话）、`market_listing_media`（ERD 未列的图片关联表，对齐 post_media 形状）。
3. **一物一单实现方式**：不使用 partial unique index（人工索引会被 Prisma 后续迁移判为漂移删除），
   改为**事务 + listing 行锁**：自 `AGREEMENT_PENDING` 起跨买家互斥；`AGREED → HANDED_OVER` 时
   行锁 → `SOLD` + 同物品未终结交易自动 `CANCELLED(LISTING_SOLD)`（集成测试覆盖并发与竞品终结）。
4. **dispute_events.actor_role 扩展**：M2 的 CHECK 只允许 REQUESTER/PROVIDER/ADMIN/SYSTEM，
   集市纠纷需要 BUYER/SELLER（独立迁移 `m3_dispute_event_roles` 扩展）。
5. **消息端点归属**：会话/消息表随 M3 落库并创建会话记录；`GET/POST /conversations/:id/messages` 端点按
   API §5 随 M4 实现（限流+关键词提示）。列表图片只返回 mediaId，客户端经 `/media/:id/url` 取签名地址。
6. **列表关键字段保护**：`SOLD/REMOVED` 后标题/描述/价格/图片禁改（403）；修改非关键字段仍允许（如区域）。
   `PENDING_REVIEW` 不公开可见，owner 可改可下架（EXPIRED）。

## D-013 M4 落地细则（2026-10-10）

1. **提前/复用落库**：M4 表一次迁移完成（posts/post_media/comments/post_hides/follows/reports/notifications/
   moderation_actions/admin_roles/admin_users/admin_audit_logs/badges/user_badges/help_posts/app_settings）。
   新增表 `post_hides`（「不感兴趣」本地偏好，API §5 需要、ERD 未列）与 `app_settings`（运营配置键值，D-013 配套）。
2. **机审路由不做自动判定**：新账号（<24h）或命中风险关键词 → `PENDING` 人工审核（产品 5.3 的实现策略）；
   审核决定由后台执行并写 `moderation_actions` + 审计 + 通知作者。
3. **通知接线**：`NotificationsService` 供 care/market/community 复用；通知失败不影响主流程；
   `payload_json` 只存业务引用。已接线事件清单见 notifications 模块文档。
4. **运营配置接线**：`admin PUT /admin/risk-rules` 的 `messagePerMinute` **已生效**（会话限流）；
   `leaderboard-config.weights` 当前仅存储/展示（榜单实现用常量，M6 统一调优时改为读取）。
5. **后台权限**：`AdminGuard` + `@AdminRoles`；super_admin 全通；高危配置（风控规则/榜单配置/审计日志）限 super_admin。
   后台账号授权用 `apps/api/scripts/grant-admin.mjs`（运维脚本，不走 API）。
6. **裁定驱动业务终态**：`POST /admin/disputes/:id/ruling` 的 COMPLETED/CANCELLED 会把 care order/market deal
   从 DISPUTED 直接推进终态，但**必须**写业务事件表（actorRole=ADMIN）；NO_FAULT 退回 PENDING_RULING 不动业务状态。
7. **reactions 的 DELETE 补口**：原契约只有 POST（点赞/收藏），无取消路径；补 `DELETE /community/reactions`（同 body，幂等）。
8. **消息上下文**：`POST /community/posts` 接受 `topicIds` 但不落库（话题体系二期）；求助帖内容存于 posts（post_type=HELP）
   以满足内容治理复用；`GET /community/posts/:id` 对求助帖返回 `helpPostId`。
9. **封禁语义补强**：封禁即撤销全部会话；**登录链路拒绝封禁用户**（403 USER_BANNED，契约 API §1.1 原有约定，M1 漏实现）。
10. **私有字段边界**：后台只读订单/交易不含地址/紧急联系人；按工单临时授权的专用路径尚未开放（需审计设计，随 M5 复核）。

## D-014 首期以邮箱验证码替代手机号（2026-10-11 用户确认）

**背景**：用户决定首期不做手机号验证，改用**邮箱验证码**方式（无短信供应商依赖，成本为零）。

1. **新增端点**：`POST /auth/email/send-code`、`POST /auth/email/login`（契约见 docs/modules/identity/email-code.md、email-login.md）；
   身份 provider 增加 `EMAIL`（subject=规范化邮箱）；邮箱密文/掩码/验证时间写入 `user_private_profiles`
   （AES-256-GCM，D-008 同规）。
2. **暂缓项**：`POST /auth/h5/login`、`POST /auth/sms/send-code`、`POST /auth/phone/verify` 保留契约但**当前不启用**
   （前端登录页改邮箱流；短信代码保留待接入供应商后启用）。
3. **邮件供应商 Mock**：验证码打日志（`EMAIL-MOCK` 标注），与 D-006 微信 Mock 同策略；接入真实供应商（SMTP/API）
   时只替换 `AuthSharedService.sendEmailCode` 的发送实现，接口形状不变。
4. **发布门槛语义**：`CARE_REQUIRE_PHONE_VERIFIED` 开关改为"联系人已验证"（手机号 **或** 邮箱任一已验证），
   默认仍为 false；邮箱验证流程已可用，随时可置 true 收紧（D-011 #7 的阻塞已解除）。
5. **缺陷修复（顺手）**：验证码限流此前抛 401（`UnauthorizedException`），与契约 `AUTH_RATE_LIMITED=429` 不符；
   邮箱与短信发码一并修复为 429。
6. **测试辅助**：`AuthSharedService.peekMockCode(subject)` 仅供测试/运维在 Mock 供应商阶段读取内存验证码，
   接入真实供应商后应移除。
7. **内测直显补丁（2026-10-11）**：Mock 供应商不发真实邮件，用户无法自助获取验证码。新增环境开关
   `AUTH_CODE_ECHO=true`（仅本服务器）：发码响应附 `devCode`，登录页自动填入并提示"开发模式"。
   **接入真实邮件供应商（如 QQ SMTP 授权码 + nodemailer）后必须置 false/删除**，否则任何人可登录任意邮箱账号。
8. **真实邮件发送预装（2026-10-11）**：`MailerService`（nodemailer）按 SMTP 环境变量自动切换——
   配置 `SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM` 即真实发送（且不返回 devCode），未配置保持 Mock。
   平台方只需**一个**发件邮箱授权码（标准做法：验证码邮件由平台统一发送给所有注册用户，非每个用户提供）；
   手机短信走腾讯云 SMS（签名审批依赖备案域名，随阻塞项解决）。

## D-015 M6 落地细则（2026-10-11）

1. **health-logs 的"授权方"读取**（API §2 写"本人或授权方"）：MVP 先只开放主人读取——参与方授权需要与
   订单照料卡片快照（agreed_terms.pets[].careNotes）联动并写审计，二期实现；契约语义保留。
2. **growth 榜单口径**：近 30 天健康+情绪记录条数（记录持续性），规则文案随响应下发；
   不按体重、健康状况或外貌评判宠物价值（产品 12.3）。
3. **徽章发放补全**：M4 时 CARE_FIRST/CARE_VETERAN/REVIEW_FIRST 只种了子未挂钩子（文档曾超前描述，已更正）；
   M6 起由全局 `BadgeAwardService` 在"订单确认完成（服务者）"与"首次评价（评价者）"时发放，幂等。
4. **就医提示**：`emergencyHint`/`disclaimer` 固定文案随创建响应下发（6.5）；服务端不做症状判定、
   不产任何建议（产品 6.6 热量估算不在 M6 范围）。

## D-016 H5 缓存策略与备份自动化（2026-10-11）

1. **入口 HTML no-cache**：Taro H5 为 hash 路由，浏览器只请求 `/petn(/)` 入口 HTML；不加 `no-cache` 时
   浏览器按启发式缓存（Last-Modified 年龄的 10%）复用旧 HTML，会引用已不存在的旧 bundle（2026-10-11
   曾因此出现"点击没反应"误报）。Caddy 片段对 `/petn`、`/petn/`、`/petn/index.html` 下发
   `Cache-Control: no-cache`（每次协商复验）。若未来切 browser 路由，SPA 深层路径的 try_files 回退响应
   需一并覆盖，届时应重新评估。
2. **contenthash 资源 immutable**：`/petn/js/*`、`/petn/css/*` 文件名含 contenthash（webpack 配置锁定），
   下发 `Cache-Control: public, max-age=31536000, immutable`。文件名不变则内容不变（一票否决：改 Taro
   输出文件名规则时必须同步改这条）。
3. **备份自动化**：root crontab 每日 03:30 跑 `scripts/backup-db.sh`——`pg_dump -Fc`（M5-REGRESSION §6
   演练过的格式）→ `.tmp` 原子改名（中断不留坏档）→ `pg_restore --list` 完整性自检 → 保留 7 天。
   备份目录 `/var/backups/petn`（700）。恢复命令见 RUNBOOK §5。

## D-017 契约先行必须覆盖「客户端消费」侧（2026-10-11，源于 UX-REVIEW）

1. **教训**：UX-REVIEW 的 4 个 P0 中有两个（交易详情 404、互助列表白屏）根因都是**客户端调用了契约外/与契约不符的接口**——
   check-docs 只能校验「每个接口目录有契约文档」，校验不了「前端调用的每个接口都有契约+实现」。接口层 e2e/冒烟全绿，UI 层闭环断裂。
2. **规则**：客户端新增任何 API 调用时，先查 [API](API.md) 对应契约；契约缺失则**先补契约与实现再写前端**（本日补口：
   `GET /market/deals/:id`、`GET /care/requests/:id`、`GET /market/categories`）。
3. **部署前 UI 冒烟**：`make deploy` 后用无头 Chrome 走 5 Tab 主路径并截图（工具 `/root/preview-tools/uitest.js`），
   防止「接口全绿、UI 白屏」复发。

## 决策变更流程

新增决策追加编号；被推翻的决策标注 `[OBSOLETE]` 并指向替代项，不删除历史。
