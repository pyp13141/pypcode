# 运维与交接手册（RUNBOOK）

> 面向运维与接手开发。架构见 [ARCHITECTURE](ARCHITECTURE.md)；文档索引见 [docs/README](README.md)。

## 1. 一键操作（根目录 Makefile）

| 命令 | 作用 |
|---|---|
| `make setup` | 装依赖 + 生成 Prisma Client + 建 `.env`（幂等） |
| `make dev` | 本地开发：API watch + H5 dev（并行，Ctrl-C 全停） |
| `make build` | 构建 API + H5 + 小程序三端产物 |
| `make test` | API 单元测试 |
| `make check-docs` | 文档同步强制检查（CI 同款） |
| `make deploy` | 本机部署：构建 → 迁移 → rsync H5 → 重启服务 → 健康检查 |
| `make status` | 查看服务与端口状态 |
| `make logs` | 跟踪 API 日志 |
| `make db` | 打开本项目 PostgreSQL psql |

## 2. 组件清单（生产）

| 组件 | 值 |
|---|---|
| 仓库 | `/root/pet-neighbor` |
| API 服务 | systemd `pet-neighbor-api.service`（开机自启） |
| API 监听 | `127.0.0.1:3001`（仅回环） |
| H5 发布目录 | `/var/www/petn/` |
| 对外入口 | Caddy 80 端口 `/petn/`（H5）与 `/petn/api/`（反代） |
| Caddy 路由片段 | `/etc/caddy/acli.d/routes/pet-neighbor.caddy`（源在仓库 `infra/deploy/`，改完 cp + validate + **restart**） |
| H5 缓存策略 | 入口 HTML `no-cache`（2026-10-11 起，防旧 bundle 误报）；`/petn/js/*`、`/petn/css/*`（文件名带 contenthash）`max-age=31536000, immutable` |
| 数据库 | PostgreSQL 16，库 `pet_neighbor`，账号 `petn_app`，仅 127.0.0.1 |
| 生产环境变量 | `/etc/pet-neighbor/api.env`（600 root） |
| DB 应用密码 | `/etc/pet-neighbor/db-password` |
| 数据库备份 | 每日 03:30 crontab → `scripts/backup-db.sh` → `/var/backups/petn/`（`-Fc` 格式，保留 7 天，日志 `/var/log/petn-backup.log`） |

## 3. 常用操作

```bash
systemctl restart pet-neighbor-api   # 重启 API
systemctl status pet-neighbor-api    # 状态
journalctl -u pet-neighbor-api -f    # 日志

# Caddy 配置变更（admin off，只能重启，会中断其他站点几秒）
cp infra/deploy/pet-neighbor.caddy /etc/caddy/acli.d/routes/
caddy validate --config /etc/caddy/Caddyfile && systemctl restart caddy
```

## 4. 部署流程（make deploy 内部）

1. `pnpm build:api` + `pnpm build:h5`。
2. `prisma migrate deploy`（只执行未应用的迁移，不动数据）。
3. `rsync -a --delete apps/client/dist/h5/ /var/www/petn/`。
4. `systemctl restart pet-neighbor-api`。
5. 探活 `GET http://127.0.0.1:3001/api/v1/health`，非 200 即失败退出。

## 5. 备份与恢复

**已自动化（2026-10-11）**：root crontab 每日 03:30 执行 `scripts/backup-db.sh`
（`pg_dump -Fc` → `/var/backups/petn/pet_neighbor_YYYY-MM-DD.dump`，权限 600，
写前 `.tmp` 原子改名 + `pg_restore --list` 完整性自检，自动清理 7 天前的旧档，
日志 `/var/log/petn-backup.log`）。手动立即备份直接跑同一脚本即可。

```bash
# 手动备份
bash /root/pet-neighbor/scripts/backup-db.sh
# 恢复（先建空库再灌入；-Fc 格式用 pg_restore，M5-REGRESSION §6 演练验证过）
sudo -u postgres psql -c "CREATE DATABASE pet_neighbor_restore OWNER petn_app;"
pg_restore -h 127.0.0.1 -U petn_app -d pet_neighbor_restore --no-owner /var/backups/petn/pet_neighbor_YYYY-MM-DD.dump
```

上线前按产品文档 22 节完成一次"从备份启动服务"的演练。`/var/www/petn` 为构建产物，可随时重建，无需备份。

## 6. 排障表

| 现象 | 检查 | 处置 |
|---|---|---|
| H5 404 | `ls /var/www/petn` | 重新 `make deploy` |
| API 5xx / health db=error | `systemctl status pet-neighbor-api`；`sudo -u postgres psql -c 'SELECT 1'` | 查 api.env 的 DATABASE_URL；重启 postgresql@16-main |
| Caddy 502 | API 是否监听 3001（`ss -tlnp \| grep 3001`） | 重启 pet-neighbor-api |
| Caddy reload 失败 | 本机 Caddy `admin off` 属正常 | 用 restart 不用 reload |
| 迁移失败 | `pnpm --filter @pet-neighbor/api exec prisma migrate status` | 不要手改已应用迁移；追加新迁移修复 |
| 端口 YOUR_SSH_PORT 相关 | — | 该端口是 SSH，**禁止占用/改动**（服务器强规则） |

## 7. 安全基线（强规则）

- 对外只走 Caddy 80 `/petn/`；不装隧道（ngrok/cloudflared 等一律不用）。
- 新增对外端口必须先告知用户，由用户在云控制台安全组放行。
- PostgreSQL 端口不对公网开放；密钥不进 Git、不写日志。
- SSH 端口 YOUR_SSH_PORT 绝不动。

## 8. 交接检查单

- [ ] 能 `make deploy` 并看到健康检查通过。
- [ ] 读完 [docs/README](README.md) 阅读路径（PRODUCT_DESIGN 0/5/11 章 → ARCHITECTURE → 本文件）。
- [ ] 知道文档同步规则 [DOC-SYNC](DOC-SYNC.md)（改代码必须同步文档，CI 强制）。
- [ ] 拿到 /etc/pet-neighbor/api.env 与 DB 密码的交接（不通过聊天明文传输）。
- [ ] 了解阻塞项：备案域名、小程序 AppID（见 README 待办）。

## 9. 入口与端口（2026-10-11 用户公网实测确认）

| 端口 | 用途 | 说明 |
|---|---|---|
| 80 | 正式入口 `/petn/`（Caddy） | 对外唯一生产入口 |
| **18080** | **H5 实时预览（Taro dev 服）** | 实例防火墙已放通（用户公网实测 HTTP 200）；启动：`pnpm --filter @pet-neighbor/client dev:h5` 常驻；`config/dev.ts` 的 devServer.proxy 把 `/petn/api/*` 转发到 127.0.0.1:3001——**预览页与正式站共用相对路径 `/petn/api/v1`，远程浏览器才可用** |
| YOUR_SSH_PORT | SSH | 22 端口为 DROP（设计如此），连 22 失败属正常，勿误判为故障 |

**术语纠正**：本实例是轻量应用服务器（lhins-3v1ac011，广州三区），控制台入站规则叫「**防火墙**」（实例详情页标签），不叫"安全组"。对用户做操作指引时用词必须准确（此前因术语混用产生过一次误判）。

**邮箱验证码上线真实发送（用户只需一次配置）**：平台方提供一个发件邮箱的 SMTP 授权码（不是邮箱密码）——
QQ 邮箱：设置→账户→开启 SMTP→获取授权码。然后写入 `/etc/pet-neighbor/api.env`：
`SMTP_HOST=smtp.qq.com SMTP_PORT=465 SMTP_USER=<邮箱> SMTP_PASS=<授权码> SMTP_FROM=<邮箱>`，
`systemctl restart pet-neighbor-api` 后所有注册用户即可收到真实验证码邮件；同时**必须**把
`AUTH_CODE_ECHO` 从 api.env 删除（直显模式仅限无 SMTP 的内测）。短信（腾讯云 SMS）同理：签名/模板审批通过后
配 `SMS_*` 环境变量接入，正式运营国内用户注册短信是硬需求，且签名审批依赖备案域名（见阻塞项）。

**预览工作流**：改 `apps/client/src/**` → webpack watch 自动重编译 → 用户刷新即见（无需 deploy）。样式改动必须先用无头 Chrome 截图自证再发布：
`google-chrome-stable --headless=new --disable-gpu --no-sandbox --disable-features=HttpsUpgrades --screenshot=/tmp/x.png --window-size=390,844 --virtual-time-budget=8000 http://YOUR_SERVER_IP/petn/`
（H5 视觉三个坑已修并留档：`page{}` 选择器 H5 不生效、`.taro_page` 自带白底、TabBar 实际是 weui-tabbar 空图标占位。）

## 10. 邮件发送状态（2026-10-11 已接入真实 SMTP）

- 发件邮箱：your-email@example.com（SMTP 授权码在 `/etc/pet-neighbor/api.env` 的 `SMTP_*`，600 root，不进 Git）
- `AUTH_CODE_ECHO` 直显开关**已移除**：验证码现在只经真实邮件送达，任何人无法从接口拿到明文验证码
- 126 邮箱参数：`smtp.126.com:465(SSL)`；QQ 等外部邮箱若收到进垃圾箱，提示用户"标记非垃圾"
- 若后续更换发件邮箱：改 api.env 的 `SMTP_*` 后 `systemctl restart pet-neighbor-api`；SMTP 鉴权失败会表现为发码接口 500，查 `journalctl -u pet-neighbor-api`
