# GET /api/v1/health

> 三级接口契约。模块背景见 [system](../system.md)；通用约定（信封、分页、错误结构）见 [API](../../API.md)。

## 说明

存活与数据库连通性检查。供部署探针、监控和运维排障使用，无鉴权。

## 请求

| 项 | 值 |
|---|---|
| 方法/路径 | `GET /api/v1/health` |
| 鉴权 | 无 |
| 请求体 | 无 |

## 响应 200

```json
{
  "data": { "status": "ok", "db": "ok", "uptimeSeconds": 118 },
  "meta": { "requestId": "b4013928-..." },
  "error": null
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `data.status` | `ok` \| `degraded` | 整体健康态 |
| `data.db` | `ok` \| `error` | 数据库探测结果 |
| `data.uptimeSeconds` | number | 进程运行秒数 |

## 错误

| 错误码 | HTTP | 条件 |
|---|---:|---|
| `HEALTH_DB_UNAVAILABLE` | 503 | 数据库探测失败（详见 [ERRORS](../../ERRORS.md#system)） |

## 实现约束

- 探测用 `SELECT 1`，不得写库。
- 本接口不做缓存，每次实时探测。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M0） |
