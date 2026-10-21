# 宠邻技术主文档（MASTER）

> **本文是技术侧总入口**：项目状态、进度总表、文档导航、当前审核点。
> 产品需求权威：[PRODUCT_DESIGN](PRODUCT_DESIGN.md)（v1.1 原文）。本文只做技术落地的索引与状态跟踪，不重复产品内容。

## 1. 项目一句话

Taro 4.3（微信小程序 + H5 一套代码）+ NestJS 模块化单体 + PostgreSQL 16，实现本地宠物互助（服务/集市/社区/健康）MVP；支付默认关闭。

## 2. 里程碑进度总表

| 里程碑 | 范围 | 状态 | 证据 |
|---|---|---|---|
| M0 骨架 | Monorepo/CI/文档体系/部署链路 | ✅ 完成 | 服务运行中；CI 绿；`make deploy` 可重复 |
| 审查与初始化 | hello-pets 审查、技术决策冻结 | ✅ 完成 | [REVIEW-HELLO-PETS](REVIEW-HELLO-PETS.md)、[DECISIONS](DECISIONS.md) |
| 契约文档 | 全量 API 契约 + 完整 ERD + 状态机 | ✅ 完成（本轮） | [API](API.md) 76 路由、[ERD](ERD.md) 40+ 表、[STATE_MACHINES](STATE_MACHINES.md) |
| M1 账号与档案 | 微信/H5 登录、会话、资料/隐私/屏蔽、宠物 CRUD | ✅ 完成 | 集成测试覆盖（登录/越权/白名单） |
| M2 互助闭环 | 公告/需求/申请/订单/Visit 五状态机、私密地址、履约凭证、评价 | 🚧 **代码完成**（18 接口 + 22 集成测试全绿） | [care 模块](modules/care.md)、[API §3](API.md#3-互助服务carem2)；验收见 §5 |
| M3 集市 | 发布/审核/收藏/交易记录/纠纷 + 媒体管线 | 🚧 **代码完成**（12+4 接口 + 16 集成测试） | [market](modules/market.md)、[media](modules/media.md)；一物一单见 D-012 |
| M4 社区与治理 | 帖子/互动/关注/信息流 + 求助帖 + 会话消息 + 举报 + 后台/审计 | 🚧 **代码完成**（28 接口 + 25 集成测试） | [community](modules/community.md)/[moderation](modules/moderation.md)；后台授权 `scripts/grant-admin.mjs` |
| M5 双端回归 | H5/小程序构建、授权、上传、分享、返回行为回归 + 隐私审查 + 备份演练 | 🚧 **构建与自动化项完成**（客户端 14 页面；真机交互回归待用户侧） | [M5-REGRESSION](M5-REGRESSION.md) |
| M6 健康与增长 | 健康/情绪日志、徽章、多维榜单 | 🚧 **代码完成**（4 接口 + growth 榜单接线 + 徽章钩子补全，5 项集成测试） | [health](modules/health.md) |

## 3. 文档地图（按读者路由）

| 我想… | 读 |
|---|---|
| 了解产品全貌与验收标准 | [PRODUCT_DESIGN](PRODUCT_DESIGN.md)（0/5/11 章最关键） |
| 了解系统怎么分层、模块边界 | [ARCHITECTURE](ARCHITECTURE.md) |
| 查某个接口的请求/响应/错误码 | [API](API.md) → 对应三级契约（modules/） |
| 查某张表的字段与约束 | [ERD](ERD.md) → schema.prisma |
| 查状态机允许的转换 | [STATE_MACHINES](STATE_MACHINES.md) |
| 查错误码含义 | [ERRORS](ERRORS.md) |
| 部署/启停/排障/交接 | [RUNBOOK](RUNBOOK.md) |
| 改代码要同步哪些文档 | [DOC-SYNC](DOC-SYNC.md) |
| 为什么选这些技术/踩过什么坑 | [DECISIONS](DECISIONS.md)、[REVIEW-HELLO-PETS](REVIEW-HELLO-PETS.md) |

## 4. 仓库结构（导航）

```
pet-neighbor/
├── apps/api/src/
│   ├── common/          # 错误码单一源、信封、过滤器、（待加）auth guard/加密/限流
│   ├── modules/<模块>/  # 一领域一目录；endpoints/<接口>/ 一接口一文件
│   └── prisma/          # PrismaClient
├── apps/client/         # Taro 双端（构建坑见其 README）
├── docs/                # 本文档树（入口 docs/README.md）
├── scripts/             # check-docs-sync / dev / deploy
├── infra/               # systemd + Caddy 片段
├── ref/hello-pets/      # 隔离审查副本（.gitignore 排除，不进仓库）
└── .cnb.yml             # CI
```

## 5. 当前审核点

### M2 验收点（2026-10-10 完成，待用户验收）

1. **accept 关键事务**（`POST /care/applications/:applicationId/accept`）：行锁需求 → 其余申请 EXPIRED →
   建订单 → 需求 MATCHED，单事务失败全回滚；幂等键重放返回同一订单；并发只成一单（集成测试覆盖）。
2. **私密地址**：新增 D-011 补口 `PUT /care/orders/:id/private-details`（原契约只有读，确认前必须能写入）；
   `confirm` 在无地址时返回 409 `ORDER_PRIVATE_DETAILS_REQUIRED`。读写每次均写 `sensitive_access_logs`。
3. **需求携带字段**：`petIds`/`frequency`/`emergencyContact` 落库为 `pet_ids[]/frequency/emergency_contact_encrypted`
   （ERD 原表未列，D-011 补口 ②）；公开响应绝不含密文/明文。
4. **cancelRule 语义**：收窄为 `FREE`（开始前立即取消生效）/`MUTUAL`（需对方同意）（D-011 #4）。
5. **履约凭证**：M2 只支持 NOTE 文本凭证；PHOTO 随 M4 媒体上传管线（D-011 #9）。
6. **发布门槛开关**：`CARE_REQUIRE_PHONE_VERIFIED` 默认 false（手机号验证流程未上线，D-011 #7）。
7. **未开放路由**（契约保留）：公告预约申请 `POST /care/offerings/:id/applications`、内部 `POST /care/orders`。

### M3/M4/M5 验收点（代码已完成，随 M2 验收点一并过）

- **集市一物一单**：同意交接起跨买家互斥；交接时行锁商品→SOLD 并自动终结同物品其它交易（D-012，测试覆盖并发）。
- **HIGH 风险类目**：宠物食品/药品发布即 PENDING_REVIEW，人工审核后上架。
- **媒体管线**：本地盘 `/var/lib/petn-media`（D-007），换 COS 只替换 MediaStorageService；对象 key 不进 URL。
- **后台权限**：五角色最小权限（AdminGuard+@AdminRoles）；后台账号授权 `scripts/grant-admin.mjs`；
  只读记录不含地址/紧急联系人（临时授权路径待评，D-013 #10）。
- **纠纷裁定**：COMPLETED/CANCELLED 驱动业务终态并写业务事件（actorRole=ADMIN）；NO_FAULT 退回继续举证。
- **M5**：真机交互回归待用户侧（AppID/备案域名）；备份演练已通过，自动备份 crontab 已加（2026-10-11，`scripts/backup-db.sh` 每日 03:30，保留 7 天）。

### M1 审核点（已确认）

1. **微信登录 Mock 策略（D-006）**：✅ 已确认（用户 2026-01-10 批准）。
2. **H5 登录方式**：按设计文档先做手机号+短信码（短信供应商 Mock，返回码打日志）；微信内 H5 的网页授权二期接。可接受？
3. **宠物数量上限 50/人**、**宠物档案必须先建才能发需求**（API §2/§3 约束）。符合预期？
4. **私密地址读取**：只在订单 CONFIRMED 之后、经独立接口 `/care/orders/:id/private-details` 返回并每次写审计日志（M2 实现）。符合设计文档 5.1/7.2？
5. **M1 完成定义**：认证(微信 Mock+H5)+资料/隐私/屏蔽+宠物 CRUD+越权测试+上传授权接口（本地盘适配器）+ **地铁模块（D-009，用户已确认方案：自选站点+模糊匹配+本地地图 App 跳转）**。做完这个再进 M2。认可这个范围？
6. **通用求助帖（D-010，用户已确认两层模型+首期分类白名单）**：契约已定（API §5.6），代码随 M4 社区一起实现。无异议则按此排期。

## 6. 环境与入口

| 项 | 值 |
|---|---|
| 线上入口 | <http://YOUR_SERVER_IP/petn/>（80 端口；443 未在安全组放行） |
| API/Swagger | `http://YOUR_SERVER_IP/petn/api/v1/docs` |
| 仓库 | <https://github.com/YOUR_GITHUB_USER/pet-neighbor> main 分支 |
| 部署 | `make deploy`（详见 [RUNBOOK](RUNBOOK.md)） |
| 数据库 | 本机 PostgreSQL 16，独立库 `pet_neighbor`、账号 `petn_app` |

## 7. 外部依赖阻塞项（只有用户侧能解）

| 阻塞 | 影响 | 未解时的替代 |
|---|---|---|
| ICP 备案域名 | 小程序提审、H5 正式域名 | IP+HTTP 先行开发与内测 |
| 微信小程序 AppID+认证主体 | 真实微信登录、订阅消息、提审 | 开发 Mock 登录（D-006） |
| 名称/商标核验 | 上线更名风险 | 开发期用代号 |
| 对象存储（腾讯云 COS） | 正式图片/凭证存储 | 本地盘适配器（D-007，接口同形） |
| 短信供应商 | H5 真实验证码 | Mock（码打日志） |

## 8. 更新记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 主文档建立；hello-pets 审查完成；全量 API/ERD 契约定稿；M1 迁移落库，模块代码待审核后开工 |
| 2026-10-10 | M1+M1.5 完成并部署（认证/用户/宠物/地铁）；交接文档建立 |
| 2026-10-10 | **M2 互助闭环代码完成**：care 九表 + 6 张支撑表迁移（D-011）；18 接口（accept 关键事务/私密地址审计/评价/纠纷）；集成测试 43/43 |
| 2026-10-10 | **M3 集市代码完成**：market 四表 + 媒体管线（D-007/D-012）；12+4 接口（一物一单原子关闭/收藏幂等/HIGH 类目人审）；集成测试 59/59 |
| 2026-10-10 | **M4 社区与治理代码完成**：28 接口（信息流/发帖评论互动/求助帖/会话消息/举报/通知/后台五角色）；通知已接入 care/market 关键事件；集成测试 84/84 |
| 2026-10-10 | **M5 双端回归**：客户端 14 页面（API 客户端/适配层/媒体上传/分享）+ H5/小程序构建通过；隐私审查与备份演练完成（报告 M5-REGRESSION） |
| 2026-10-11 | **登录改为邮箱验证码（D-014）**：新增 email 发码/登录端点（Mock 邮件供应商）；发布门槛=手机号或邮箱已验证；顺带修复验证码限流 401→429；客户端登录 bug 修复（公开接口 auth 透传）+ 视觉体系重写 |
| 2026-10-11 | **M6 健康与成长完成**：健康/情绪日志 4 接口（只记录不产建议）+ growth 榜单接线 + 徽章发放钩子补全（D-015）；集成测试 94/94 |
| 2026-10-11 | **邮箱验证码真实发送上线**（126 SMTP，直显开关移除）；前端玻璃拟态 v3（无头 Chrome 截图自证流程确立，修复 H5 视觉失效三根因）；全量冒烟脚本 49 项 + TEST-REPORT；**续交接文档 [HANDOVER-NEXT](HANDOVER-NEXT.md)** |
| 2026-10-11 | **运维三件套**：①Caddy 入口缓存头（HTML no-cache + contenthash 资源 immutable，D-016）；②冒烟脚本修复并查明 47/49 基线失真根因（取码机制随真实 SMTP 失效级联 34 项），51/51 两轮（[TEST-REPORT](TEST-REPORT.md) 首次落盘）；③pg_dump 每日备份 crontab 上线（`scripts/backup-db.sh`，保留 7 天） |
| 2026-10-11 | **全量 UI 走查（[UX-REVIEW](UX-REVIEW-2026-10-11.md)）**：双账号逐页逐钮黑盒测试，发现 4 个 P0 闭环断裂（互助 Tab 白屏 / 求助需求无列表入口 / 交易详情 404 / 发布表单状态残留）、7 项 P1、8 项系统性"后端有 UI 无"缺口 + Rover/PetBacker/滴滴宠物对标；修复排期见该报告 §8 |
| 2026-10-11 | **P0/P1 修复 + UI v4 换肤上线**：补齐 GET /market/deals/:id、GET /care/requests/:id、GET /market/categories 三契约（D-017 记录前端契约消费缺口教训）+ 新增错误码 AUTH_EMAIL_SEND_FAILED；客户端 care 重写（需求列表/申请/accept 入口）、market 分类与 SOLD 拦截、登录门禁、通知跳转已读；设计系统 v4「暖纸·净面」（shadcn token + transitions.dev 微动效）替换玻璃拟态；e2e 94/94、冒烟 51/51、5 Tab+新页截图回归通过 |
