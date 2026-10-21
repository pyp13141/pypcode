# 宠邻 pet-neighbor

宠物互助小程序 + H5。**文档中心（从这里进入）：[docs/README.md](docs/README.md)**；产品总纲见 [docs/PRODUCT_DESIGN.md](docs/PRODUCT_DESIGN.md)。

## 当前状态：M0–M6 已完成

**访问入口：`http://YOUR_SERVER_IP/petn/`**（部署后替换为你的服务器地址或域名；生产建议启用 HTTPS）

| 组件 | 状态 |
|---|---|
| `apps/api` NestJS + Prisma | ✅ 模块化目录，一接口一文件；81 个接口控制器 |
| `apps/client` Taro 4.3 | ✅ H5 + 微信小程序双端构建通过；5 Tab |
| `apps/admin` | ⏳ 占位（仅 API，后台前端待补） |
| 数据库 | PostgreSQL 16 本机，**独立库 `pet_neighbor` + 专用账号 `petn_app`**（与其他项目隔离） |

## 一键操作（详见 [docs/RUNBOOK.md](docs/RUNBOOK.md)）

```bash
make setup        # 装依赖 + Prisma 生成 + .env
make dev          # 本地开发：API watch + H5 dev 并行
make build        # 三端构建（API / H5 / 小程序）
make test         # 单元测试
make check-docs   # 文档同步强制检查
make deploy       # 本机部署：构建→迁移→发布→重启→探活
make help         # 全部命令
```

## 目录导览

```
apps/api/src/
├── common/            # 公共层：error-codes.ts(错误码单一源)、信封、过滤器
├── modules/<模块>/    # 业务模块，一领域一目录
│   └── endpoints/<接口>/   # 一接口一目录（controller + service）
└── prisma/            # PrismaClient 与迁移
docs/                  # 文档中心：一级索引/模块二级/接口三级，见 docs/README.md
scripts/               # check-docs-sync / dev / deploy
infra/                 # systemd 单元 + Caddy 路由片段
```

## 配置与密钥

仓库内**不含任何真实密钥或服务器凭据**。以下配置全部通过环境变量或部署环境中的 `.env` 注入：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（密码不要写进仓库） |
| `SENSITIVE_ENCRYPTION_KEY` | 敏感字段 AES-256-GCM 密钥，`openssl rand -base64 32` 生成 |
| `WECHAT_APPID` / `WECHAT_APPSECRET` | 微信小程序凭证；未配置时仅开发环境可用 Mock 登录 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 验证码邮件发件配置 |

`.env`、数据库备份、`ref/` 参考素材已在 `.gitignore` 中排除。部署时请使用服务器本地 env 文件或密钥管理服务，不要把真实值提交到 Git。

## CI

仓库保留 CNB 流水线配置（[.cnb.yml](.cnb.yml)）：main 分支 push → 装依赖 → Prisma 生成 → **文档同步检查** → 测试 → API/H5/小程序三端构建。迁移到 GitHub Actions 时可复用同一组命令（`pnpm install`、`pnpm test:api`、`pnpm build:api/h5/weapp`）。

## 待办（需要用户侧动作，服务器解决不了）

1. **ICP 备案域名**：微信小程序合法域名硬性要求；H5 上正式域名也建议尽早。
2. **注册微信小程序拿 AppID**：填入 `apps/client/project.config.json` 的 `appid`。
3. 名称/商标核验（产品文档 1.3 清单）。
4. 对象存储：MVP 本地盘，上线前换腾讯云 COS。
