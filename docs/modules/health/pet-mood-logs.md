# POST / GET /api/v1/pets/:petId/mood-logs

> 契约同 [API §2 尾段](../../API.md#2-宠物档案pets)。

## POST 记录

`{ "moodTags": ["1-5 个白名单标签"], "severity?": 1-5, "observedAt": "ISO（≤当前时间）", "notes?": "≤500字" }`

标签白名单（主观可观察行为，产品 6.5）：`平静 / 活跃 / 紧张 / 躲藏 / 食欲变化 / 异常叫声`。

响应 201：`{ log, disclaimer }`——"仅日常观察记录，不构成诊断或治疗建议"。

## GET 列表

仅主人；按 `observed_at` 倒序，分页信封。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版（M6） |
