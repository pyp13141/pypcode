# GET / POST / DELETE /api/v1/me/stations

> 契约同 [API §5.5](../../API.md#55-地铁transitm15d-009零地图-api)。

## 说明

用户常用地铁站（登录）。D-009 的关键替代方案：代替"根据地址自动算最近站"（那需要地理编码=收费）。

## 接口

| 方法 | 路径 | 语义 | 幂等 |
|---|---|---|---|
| GET | /me/stations | 我的常驻站列表 | — |
| POST | /me/stations | 添加 `{ cityId, stationId, label?(≤20) }` | ✅ 同站重复添加只更新 label |
| DELETE | /me/stations/:stationId | 移除 | ✅ 未存在也返回成功 |

## 响应

- GET: `[{ stationId, stationName, cityId, cityName, label }]`
- POST: `{ stationId, stationName, label }`；DELETE: `{ "removed": true }`

## 错误码

| 码 | HTTP | 条件 |
|---|---:|---|
| `RESOURCE_NOT_FOUND` | 404 | POST 时站点不存在或不属于该城市 |

## 用途（M2 起）

- 发布需求/服务时预填"我常在的站"。
- 匹配排序信号之一（同一站/同线优先），仍不暴露精确坐标。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M1.5） |
