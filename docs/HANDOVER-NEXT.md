# 交接文档 · 续（HANDOVER-NEXT，2026-10-11）

> 写给下一个接手的 AI / 开发者。前一份 [HANDOVER](HANDOVER.md) 覆盖 M0-M2，本文覆盖 M3-M6 全量现状、
> 待办清单、可扩展模块。开工前先读：本文 → [HANDOVER](HANDOVER.md) → [MASTER](MASTER.md) → [API](API.md)。

## 1. 一分钟现状

**宠邻**（宠物互助小程序+H5）：Taro 4.3 双端 + NestJS + PostgreSQL 16，仓库 `/root/pet-neighbor`
（远端 https://github.com/YOUR_GITHUB_USER/pet-neighbor main）。**M0-M6 全部完成并部署**：

- 生产入口 http://YOUR_SERVER_IP/petn/（Caddy 80）；**实时预览** http://YOUR_SERVER_IP:18080/（Taro dev 服常驻，devServer 代理 API，热更新）
- 集成测试 **94/94**（`pnpm --filter @pet-neighbor/api test:e2e`，独立测试库）；线上冒烟 `bash scripts/smoke-all.sh`（**51/51 连续两轮**，报告见 [TEST-REPORT](TEST-REPORT.md)；注意两次运行间隔 ≥1 分钟）
- 后端 **81 个接口控制器**、78 份三级契约、48 错误码镜像（`make check-docs` 强制）；文档体系见 [docs/README](README.md)
- 邮箱验证码走**真实 SMTP**（126 发件箱，`api.env` 的 `SMTP_*`）；`AUTH_CODE_ECHO` 已移除不得恢复（D-014 #7/#8）
- 视觉：玻璃拟态 v3（多色柔光底+半透明白玻璃卡片）；**改样式必须先用无头 Chrome 截图自证**（坑与命令见 RUNBOOK §9）

## 2. 还差哪些（按优先级）

| # | 事项 | 说明 |
|---|---|---|
| ~~0~~ | ✅ UI 走查 4 个 P0 + P1 清单修复完成（2026-10-11 晚） | 互助白屏/需求列表+详情+申请闭环（新页 care-request，含 accept 关键事务 UI 入口）/交易详情补口（GET /market/deals/:id）/表单重置/登录门禁/SOLD 拦截/分类选择器（新端点 GET /market/categories）/SMTP 错误友好化/通知可点已读/文案与布局；**UI 全量换肤 v4（暖纸·净面，shadcn 风格 token + 微动效）**；e2e 94/94、冒烟 51/51、无头截图回归通过 |
| ~~1~~ | ✅ 浏览器缓存治理（2026-10-11 完成） | 入口 HTML `no-cache` + contenthash 资源 `immutable` 已写入 Caddy 片段并 restart 生效；曾根因级联出 34 项冒烟失败的取码机制也已修（见 [TEST-REPORT](TEST-REPORT.md)） |
| ~~2~~ | ✅ smoke 脚本修复（2026-10-11 完成） | 根因不是 2 项 JX 表达式：真实 SMTP 上线后 journalctl 取码机制整体失效（级联 34 项）+ 请求了不存在的 `GET /market/deals/:id` + 固定幂等键二次运行必冲突。修复后 51/51 两轮全绿 |
| ~~3~~ | ✅ 自动备份（2026-10-11 完成） | root crontab 每日 03:30 → `scripts/backup-db.sh`（`pg_dump -Fc` + 完整性自检）→ `/var/backups/petn/` 保留 7 天；恢复命令见 [RUNBOOK §5](RUNBOOK.md) |
| 4 | 手机短信真实接入 | 接口已有（sms/h5-login），接腾讯云 SMS；**签名审批依赖备案域名**（阻塞项） |
| 5 | 443/HTTPS + 正式域名 + 小程序 AppID | 用户侧阻塞项；拿到后：Caddy 配 HTTPS、project.config.json 填 AppID、删 ALLOW_WECHAT_MOCK、真机回归 |
| 6 | 后台管理前端 | admin 只有 API（五角色），没有管理界面；建议独立 React admin 或复用客户端加 /admin 页 |
| 7 | care 订单会话 | 集市交易会话已通，互助订单会话未创建（契约保留，随消息功能补） |
| 8 | health "授权方"读取 | API §2 写"本人或授权方"，MVP 仅主人；需与订单照料卡片快照联动+审计（D-015 #1） |
| 9 | 小项 | topics 话题落库、公告预约申请流（offerings/:id/applications）、内部 POST /care/orders、宠物照片字段、私信图片消息、pg_trgm 关键词索引、评价/主页展示页、订阅消息 push |

## 3. 可以继续加的模块（按产品价值排序）

1. **管理后台 Web 界面**（审核/举报/纠纷裁定/指标可视化——API 全部就绪，纯前端工作量）
2. **微信订阅消息**（订单/交易/评论的推送，需 AppID + 模板申请）
3. **热量估算与喂养建议**（产品 6.6，三层保守展示）
4. **附近搜索**（PostGIS + private_locations 表，产品 12.1；启用前必须按 12.1 建私密位置表）
5. **成长档案分享图**（宠物年度报告海报，社区传播）
6. **评价标签聚合展示**（卖家/服务者主页的口碑卡片）
7. **风险规则中心**（新服务者接单上限等已留 env/配置位，补 UI 与生效逻辑）

## 4. 部署与配置

- API 仅监听回环地址 `127.0.0.1:3001`，由 Caddy 反代 `/petn/api/*`；H5 静态产物发布到 `/var/www/petn/`
- 数据库：PostgreSQL 16，生产库 `pet_neighbor`、测试库 `pet_neighbor_test`、账号 `petn_app`
- 生产环境变量放 `/etc/pet-neighbor/api.env`（600）：DATABASE_URL、SENSITIVE_ENCRYPTION_KEY、SMTP_* 等；仓库只保留 `.env.example`
- 备份：`scripts/backup-db.sh`（`pg_dump -Fc` + 完整性自检，保留 7 天）
- **服务器地址、SSH 端口、数据库密码等部署信息不进入仓库**，由部署环境单独管理

## 5. 给下一个对话 AI 的一段话（直接复制）

> 你在接手「宠邻」项目：仓库 https://github.com/YOUR_GITHUB_USER/pet-neighbor （NestJS+Prisma+PostgreSQL 16 后端 apps/api，Taro 4.3 双端客户端 apps/client）。先读 docs/HANDOVER-NEXT.md（本文的上一级交接），再读 docs/HANDOVER.md 与 docs/MASTER.md；改哪个接口先查 docs/API.md 与 docs/modules/ 三级契约。M0-M6 已全部完成并部署：生产 http://YOUR_SERVER_IP/petn/，实时预览 http://YOUR_SERVER_IP:18080/（dev 服常驻+API 代理）。集成测试 94/94（pnpm --filter @pet-neighbor/api test:e2e）；线上冒烟 bash scripts/smoke-all.sh（51/51，间隔 ≥1 分钟再跑，报告见 docs/TEST-REPORT.md）。硬规则：①改任何样式必须先用 google-chrome-stable --headless 截图自证（坑见 RUNBOOK §9）；②文档三级同步，make check-docs 不过不许提交；③不要改动服务器 SSH 端口（22 可能被防火墙丢弃，属正常）；④邮箱验证码走真实 SMTP（凭证只在部署 env 中，不进仓库），严禁恢复验证码直显开关；⑤不用任何隧道，新对外端口必须先由用户在云厂商防火墙放行；⑥Caddy 只能 restart 不能 reload。当前最优先待办见 HANDOVER-NEXT.md §2（余项：备案后接云短信、443/域名/AppID、admin 前端等用户侧或二期项）。遇到与设计文档冲突，先记录 docs/DECISIONS.md 再继续，不要猜。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版：M3-M6 交接、待办 9 项、扩展模块 7 项、下一手 AI 引导段 |
| 2026-10-11 | §2 待办 1/2/3 完成：Caddy 入口缓存头（no-cache/immutable）、smoke 脚本修复（根因=取码机制随真实 SMTP 失效，51/51 两轮，报告 TEST-REPORT.md 首次落盘）、pg_dump 每日备份 crontab |
