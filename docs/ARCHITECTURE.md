# 系统架构（ARCHITECTURE）

> 面向开发与交接。产品总纲见 [PRODUCT_DESIGN](PRODUCT_DESIGN.md) 8 节；决策依据见 [DECISIONS](DECISIONS.md)。

## 1. 总体拓扑

```
用户（微信小程序 / 移动 H5 浏览器）
        │  HTTPS(备案域名,待接入)  或  HTTP:80 /petn/(当前)
        ▼
┌─ Caddy（本机 80/443，ACLI 管理）────────────────────┐
│  /petn/*      → /var/www/petn（H5 静态产物, SPA 回退）│
│  /petn/api/*  → 127.0.0.1:3001（API 反代）          │
└──────────────────────────────────────────────────┘
        ▼
┌─ NestJS API（systemd: pet-neighbor-api）───────────┐
│  认证(未建) → 模块 controllers → services          │
│  → Prisma → PostgreSQL 16                          │
│  统一信封/错误码/requestId（common/ 层）            │
└──────────────────────────────────────────────────┘
        ▼
PostgreSQL 16 @ 127.0.0.1:5432
  库 pet_neighbor（专属，账号 petn_app，与其他项目隔离）
  对象存储：MVP 本地盘（适配器接口按 S3 形状），上线前换 COS
```

**边界原则**：数据库只本机访问；API 只回环访问；对外唯一入口是 Caddy。不使用隧道。

## 2. 代码分层（apps/api）

```
HTTP 请求 → RequestIdMiddleware → Controller（参数校验/HTTP 语义）
  → Service（业务规则/事务）→ Prisma → DB
  → 统一信封拦截器返回；异常经统一过滤器转错误码
```

| 层 | 位置 | 允许做的事 | 禁止 |
|---|---|---|---|
| Controller | `modules/<m>/endpoints/<e>/*.controller.ts` | DTO 校验、HTTP 状态、调用本接口 Service | 业务规则、直接查库 |
| Service | `modules/<m>/endpoints/<e>/*.service.ts`（复杂模块可提为模块级 `services/`） | 业务规则、事务、跨表约束 | 直接操作 HTTP 对象 |
| 公共层 | `common/` | 错误码、信封、过滤器、中间件 | 引用任何 modules |
| 数据 | `prisma/` | PrismaClient、迁移 | 业务逻辑 |

## 3. 模块边界

模块清单与状态见 [docs/README 二级表](README.md#二级模块文档docsmodules)。规则：

1. 一个领域一个模块目录：`apps/api/src/modules/<name>/`。
2. 模块间通过对方 **Module 导出的 Service** 调用；禁止跨模块 import 内部文件、禁止直写对方数据表。
3. 跨模块一致性用数据库事务；关键状态变更必须写 `*_events` 历史表（[STATE_MACHINES](STATE_MACHINES.md)）。
4. 新模块落地顺序：二级文档 → 迁移 → endpoints 目录 → 三级契约 → 测试。

## 4. 客户端架构（apps/client）

Taro 4.3 一套代码 → 微信小程序 + H5。平台差异只允许出现在 `adapters/`（weapp/、h5/），页面不得散落平台判断。目录与适配接口见 [apps/client/README](../apps/client/README.md)；页面清单见产品文档 4 节。

## 5. 数据库（隔离与约定）

- **实例**：本机 PostgreSQL 16（与其他项目共用实例）。
- **隔离**：本项目独立库 `pet_neighbor`、独立账号 `petn_app`（最小权限 + CREATEDB 供迁移影子库）。其他项目的库/表与本项目互不可见，避免混淆与误操作。
- **连接**：仅 `127.0.0.1`；生产值在 `/etc/pet-neighbor/api.env`（600）。
- **约定**：UUID 主键、UTC `timestamptz`、金额整数分、审计表软删除、私密字段独立表（[ERD](ERD.md)）。

## 6. 环境

| 环境 | API | 数据库 | H5 | 微信 |
|---|---|---|---|---|
| 本机生产 | systemd `pet-neighbor-api`，127.0.0.1:3001 | pet_neighbor 库 | Caddy `/petn/` | 开发者工具（未配域名） |
| 开发 | `make dev`（watch） | 同库（数据自建） | `pnpm dev:h5` :10086 | 开发者工具 |
| staging/生产域名 | 待备案域名接入后拆分 | 待独立实例/库 | HTTPS | 合法域名配置 |

## 7. 新增模块检查单

1. 二级文档 `docs/modules/<name>.md`（含接口表、依赖、变更记录）。
2. Prisma 迁移（如涉及表）。
3. `modules/<name>/`：module.ts + endpoints/<每个接口一目录>。
4. 每个接口一份三级契约 `docs/modules/<name>/<endpoint>.md`。
5. 错误码进 `error-codes.ts` + [ERRORS](ERRORS.md)（同一次提交）。
6. `make check-docs` 通过。
7. `docs/README.md` 二级表更新状态。
