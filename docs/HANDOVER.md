# 交接文档（HANDOVER）

> 写于 2026-01-10，交接点：M0 + M1 + M1.5 完成，下一步 M2。
> 配套阅读：运维细节看 [RUNBOOK](RUNBOOK.md)，架构看 [ARCHITECTURE](ARCHITECTURE.md)，现状与进度看 [MASTER](MASTER.md)。本文回答"接手这个项目需要知道的一切"，不重复已有文档，只讲增量。

> **2026-10-10 更新（M2 完成后）**：M2 互助闭环已实现并部署（care 九表 + 6 张支撑表迁移、18 接口、
> 集成测试 43/43）。接手 M3 前请补充阅读：
> - [care 模块文档](modules/care.md)（实现要点/开关/状态机落地方式）与 [DECISIONS D-011](DECISIONS.md)（落地细则与两处契约补口）；
> - M2 新增坑位见本文 §4 末三行；M2 验收点见 [MASTER §5](MASTER.md)。

## 1. 一分钟了解现状

**宠邻**：宠物互助小程序+H5（Taro 4.3 双端 + NestJS + PostgreSQL 16），产品基线是 [PRODUCT_DESIGN](PRODUCT_DESIGN.md) v1.1。

| 已完成 | 内容 |
|---|---|
| M0 | Monorepo、CI（.cnb.yml）、三级文档体系、Caddy 部署链路 |
| M1 | 微信 Mock 登录+H5 短信登录、会话（刷新轮换+盗用检测）、用户资料/隐私/屏蔽、宠物档案（公私字段白名单） |
| M1.5 | 地铁模块（D-009 零地图 API）：OSM 深圳数据（18 线 859 站）、Dijkstra 路径规划、用户常驻站 |
| M2 | 互助闭环（18 接口）：公告/需求/申请/订单/Visit 五状态机、accept 关键事务（行锁+幂等）、私密地址加密+审计、NOTE 履约凭证、双向评价、纠纷工单 |
| 质量 | 集成测试 43/43（独立测试库，不碰生产、不依赖外网）；`make deploy` 测试不过不发布 |

| 下一步 | 内容 |
|---|---|
| **M6 健康与增长** | 健康/情绪日志、徽章发放扩展、榜单数据源（契约已定 [API](API.md) §2 尾段） |
| 已完成 | M3 集市（含媒体管线 D-007/D-012）、M4 社区与治理（含后台五角色）、M5 双端回归（构建/隐私/备份；真机回归待用户侧） |

## 2. 环境与资产（全部实测过）

| 项 | 值 |
|---|---|
| 服务器 | 自有 Linux 服务器（生产部署信息不进入仓库） |
| 仓库 | 远端 <https://github.com/YOUR_GITHUB_USER/pet-neighbor> main 分支 |
| API | systemd `pet-neighbor-api`，仅监听 127.0.0.1:3001 |
| H5 | `/var/www/petn/`，对外入口 **<http://YOUR_SERVER_IP/petn/>**（Caddy 80 端口路径；443 未在安全组放行） |
| Swagger | <http://YOUR_SERVER_IP/petn/api/v1/docs> |
| 数据库 | PostgreSQL 16 本机；生产库 `pet_neighbor`、测试库 `pet_neighbor_test`、账号 `petn_app`（密码由部署环境注入） |
| 生产环境变量 | `/etc/pet-neighbor/api.env`（600 root）：DATABASE_URL、SENSITIVE_ENCRYPTION_KEY、ALLOW_WECHAT_MOCK=true（拿到 AppID 后删） |
| 一键操作 | 根目录 `make setup/dev/build/test/check-docs/deploy/status/logs`，详见 [RUNBOOK](RUNBOOK.md) |

**对外端口铁律**：不装任何隧道；新对外端口必须先由用户在云厂商防火墙放行；改 Caddy 配置只能 `systemctl restart caddy`（admin off 不能 reload，会中断其他站点几秒）。

## 3. 前置知识：这个项目的工程约定（新 Agent 必读）

1. **文档同步是强制的**：改代码必须同步文档，规则在 [DOC-SYNC](DOC-SYNC.md)，`make check-docs` 本地和 CI 双重校验。错误码单一源是 `apps/api/src/common/error-codes.ts`，与 `ERRORS.md` 双向镜像。
2. **目录即规范**：一模块一目录 `src/modules/<name>/`，一接口一目录 `endpoints/<e>/`（controller+service 分离）；新接口必须带三级契约 `docs/modules/<m>/<e>.md` 并登记进 L2 和 README 索引（check-docs 会查）。
3. **契约先行**：[API](API.md) 有全部 76 个路由的完整契约（鉴权/所有权/幂等/状态前置/错误码），实现前先读对应契约小节，实现后把状态从 `[契约]` 改 `[已实现]`。
4. **测试门禁**：单元测试（`pnpm test:api`）+ 集成测试（`pnpm --filter @pet-neighbor/api test:e2e`，跑测试库）；`make deploy` 先测试后发布。集成测试模式：fixture 造数据，不依赖外网。
5. **AuthGuard 语义**：默认所有路由要登录，`@Public()` 豁免；但公开路由**仍解析令牌注入用户**（字段白名单按"登录的主人 vs 陌生人"区分——M1 踩过坑：health 漏标 `@Public()` 上线即 401，有回归测试守着）。
6. **生产护栏**：NODE_ENV=production 未配 WECHAT_APPID 且无 ALLOW_WECHAT_MOCK=true 时启动直接失败（D-006）；敏感字段 AES-256-GCM（D-008），密钥在 api.env。

## 4. 已知坑（都踩过，别再踩）

| 坑 | 症状 | 解法 |
|---|---|---|
| Taro 4.3 webpack 版本 | ProgressPlugin schema 报错 | webpack 锁 5.91.0，勿升级 |
| Taro compiler 配置 | `prebundleOptions.enable` 崩 | `compiler` 必须写对象 `{type:'webpack5', prebundle:{enable:false}}` |
| H5 无 index.html | dist 只有 js/css | 必须有 `src/index.html` 模板 |
| pnpm peer 依赖 | babel 找不到 preset-react | `@babel/preset-react` 显式进 devDeps |
| Prisma 复合主键 | upsert where 字段名错 | 用 `blockerUserId_blockedUserId`（字段名拼接），不是 @map 名 |
| Overpass 504 | 导入脚本超时 | 脚本已内置三实例轮询+重试；环线重复站点导入时按 osmNodeId 去重 |
| Caddy reload | Job failed | `admin off` 是 ACLI 全局配置，只能 restart |
| 图算法回溯 | 路径规划 500 | 每节点持有"到达它的边"（不是前驱的边）——已修，改这段代码时盯紧 `edge` 挂载位置 |
| 事件表追加式触发器 | 清理/测试报 `append-only table ... not allowed` | `care_order_events`/`dispute_events` 禁用 UPDATE/DELETE（设计如此）；测试/运维清库用 `TRUNCATE ... CASCADE`（行级触发器不拦截 TRUNCATE） |
| Prisma 迁移 checksum | 改已应用的 migration 文件 → `migrate deploy` 报错 | 迁移一旦应用不可改；补充列/约束要新建迁移（M2 的 `m2_care_application_note` 即先例） |
| 幂等键语义 | 同 key 用于另一端点/资源 → 409 `IDEMPOTENCY_KEY_CONFLICT` | 设计行为：request hash = `{op, 资源 id, body}`；客户端每个业务操作生成新 key，重试沿用旧 key |
| 私密地址确认门槛 | confirm 报 409 `ORDER_PRIVATE_DETAILS_REQUIRED` | 需求方必须先 `PUT /care/orders/:id/private-details` 再确认条款（D-011 补口） |
| Taro H5 dev 缺依赖 | `pnpm dev:h5` 报 Cannot find module react-refresh-webpack-plugin | 已加 `@pmmmwh/react-refresh-webpack-plugin`+`react-refresh` devDeps；勿删 |
| 实时预览端口 | dev 服被占端口时自动 +1（18080 占用则落 18081） | config/dev.ts 固定 18080；先确认端口空闲再起 |
| 运营配置有缓存 | admin 改 risk-rules 后最多 30s 才生效 | SettingsService TTL=30s；测试里要在首个读取前写入（或走 admin API 触发失效） |

## 5. 用户侧待办（只有用户能做，你催不动就先绕过）

1. **ICP 备案域名**——微信小程序提审硬门槛；H5 正式域名也需要。未到位前小程序只能开发者工具内测。
2. **微信小程序 AppID + 认证主体**——拿到后：填 api.env 的 WECHAT_APPID/SECRET，删 ALLOW_WECHAT_MOCK；填 `apps/client/project.config.json` 的 appid。
3. 名称/商标核验（PRODUCT_DESIGN 1.3 清单）。
4. 443 安全组端口（可选，H5 目前走 80 明文；正式上线前建议让用户放行）。

## 6. M2 开工指引（✅ 2026-10-10 已完成，留档备查；实现结果见 [care 模块文档](modules/care.md)）

范围：PRODUCT_DESIGN 5.1 + API §3 + ERD §2。按此顺序做：

1. **先读**：STATE_MACHINES（5 套状态机是 M2 的灵魂）→ API §3 契约 → ERD §2（9 张表）。
2. **迁移**：care 九表（care_offerings/availabilities/requests/applications/orders/order_events/order_private_details/visits/evidence），注意 ERD §6 不变量（事务接受申请、私密表不进通用查询、events 追加式）。
3. **模块**：`modules/care/`，重点端点顺序：发布 offering/request → application（含唯一约束）→ **accept（事务：锁需求→过期其余申请→建订单→MATCHED，这是全项目最关键的事务）** → confirm/start/visits/complete/cancel → disputes/reviews。
4. **私密地址**：`care_order_private_details` 走 D-008 加密；读取接口独立（`/care/orders/:id/private-details`），参与方+状态联合校验，每次读写 `sensitive_access_logs`（这张表 M4 才有，M2 先按 ERD 建表）。
5. **评价**：只绑 COMPLETED 订单，每方一次（UNIQUE），目标/角色服务端推导。
6. **同步**：每端点写 L3 契约、更新 L2/API.md 状态/ERRORS.md，`make check-docs` 必绿；集成测试至少覆盖：并发 accept 只成一单、状态机非法流转 409、非参与方读订单 404、私密地址越权 403、重复评价 409。

地铁数据扩展（用户提新城市时）：`node scripts/import-osm-subway.mjs <城市名>`，幂等。二期优化项已记录在 transit.md 已知问题（OSM 换乘站多节点合并）。

## 7. 交接检查单

- [ ] `git pull` 后 `make setup && make test && make check-docs` 全绿
- [ ] `make deploy` 后 `make status` 显示健康
- [ ] 浏览器打开 <http://YOUR_SERVER_IP/petn/> 能看到 5 Tab 空壳；Swagger 能试 `/transit/route`
- [ ] 读完本文 §3 工程约定与 §4 坑清单
- [ ] 拿到 api.env 与 DB 密码交接（不要经聊天明文传输）
