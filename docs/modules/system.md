# 模块：system（系统）

> 二级模块文档。一级索引见 [docs/README.md](../README.md)；模块边界定义见 [ARCHITECTURE](../ARCHITECTURE.md#模块边界)。

## 职责

平台级系统能力：存活检查、服务元信息。不承载业务规则，M1+ 的业务模块不得反向依赖本模块的内部实现。

## 代码位置

```
apps/api/src/modules/system/
├── system.module.ts              # 模块装配（controllers + providers）
└── endpoints/
    ├── health/                   # GET /api/v1/health
    │   ├── get-health.controller.ts
    │   └── get-health.service.ts
    └── meta/                     # GET /api/v1/meta
        └── get-meta.controller.ts
```

**约定：一个接口 = endpoints/ 下一个目录**，controller 只做参数/DTO 与 HTTP 语义，业务逻辑放同目录 service。新增接口时在 endpoints/ 下建目录，并按 [DOC-SYNC](../DOC-SYNC.md) 同步本文件与 L3 契约。

## 接口清单

| 方法 | 路径 | 契约文档 | 状态 |
|---|---|---|---|
| GET | `/api/v1/health` | [health.md](system/health.md) | ✅ 已上线 |
| GET | `/api/v1/meta` | [meta.md](system/meta.md) | ✅ 已上线 |

## 依赖

| 依赖 | 用途 |
|---|---|
| PrismaService | 健康检查探测数据库连通性 |

## 错误码

本模块错误码见 [ERRORS.md](../ERRORS.md#system)（`HEALTH_DB_UNAVAILABLE`）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M0） |
