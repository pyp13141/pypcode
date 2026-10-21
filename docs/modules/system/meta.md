# GET /api/v1/meta

> 三级接口契约。模块背景见 [system](../system.md)；通用约定见 [API](../../API.md)。

## 说明

返回服务版本、运行环境与支付开关状态。客户端可用它做能力探测（如 `paymentEnabled` 恒为 false 时隐藏支付入口）。

## 请求

| 项 | 值 |
|---|---|
| 方法/路径 | `GET /api/v1/meta` |
| 鉴权 | 无 |
| 请求体 | 无 |

## 响应 200

```json
{
  "data": {
    "name": "pet-neighbor-api",
    "version": "0.1.0",
    "env": "production",
    "paymentEnabled": false
  },
  "meta": { "requestId": "..." },
  "error": null
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `data.name` | string | 服务标识 |
| `data.version` | string | 来自 `APP_VERSION` 环境变量 |
| `data.env` | string | `NODE_ENV` |
| `data.paymentEnabled` | boolean | 文档 15.3：MVP 恒为 false |

## 错误

无专项错误码。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M0） |
