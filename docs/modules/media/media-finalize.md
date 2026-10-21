# POST /api/v1/media/:mediaId/finalize

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)（媒体段）。

## 行为

仅 owner。校验对象已落盘 → 登记 `finalized_at`，审核态置 `PENDING`（机审接入前全部待人审/默认放行策略见 care.md 说明）。
未收到上传内容 → 409；重复 finalize 幂等返回当前结果。

响应 201：`{ mediaId, purpose, mimeType, sizeBytes, moderationStatus, finalizedAt }`。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
