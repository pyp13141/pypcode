# POST / GET /api/v1/pets/:petId/health-logs

> 契约同 [API §2 尾段](../../API.md#2-宠物档案pets)。

## POST 记录

`{ "logType": "WEIGHT|DIET|WATER|ACTIVITY|EVENT", "valueNum?": >0, "unit?": "≤20字", "recordedAt": "ISO（≤当前时间）", "source?": "MANUAL|DEVICE|VET（默认 MANUAL）", "notes?": "≤500字" }`

响应 201：`{ log, emergencyHint }`——`emergencyHint` 为固定就医提醒文案（6.5；服务端不做症状判定，前端展示）。

## GET 列表

仅主人（他人 404，不泄露存在性）；`?logType=&page=&pageSize=`，按 `recorded_at` 倒序，分页信封。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版（M6） |
