# GET /api/v1/media/:mediaId/url

> 契约同 [API §5](../../API.md#5-社区与审核community--moderationm4)（媒体段）。

## 行为

业务授权校验后签发 5 分钟有效的读取签名地址：
响应 200：`{ mediaId, path, url, expiresAt }`。

| purpose | 读取授权 |
|---|---|
| `PET_AVATAR` | 公开 |
| `LISTING_IMAGE` | 关联列表 `PUBLISHED` 时公开；否则 owner |
| `POST_IMAGE` | owner（公开可见性随 M4 帖子可见性接入） |
| `EVIDENCE` | **仅订单参与方**；签发即写 `sensitive_access_logs`（EVIDENCE 组，purpose=CARE_EVIDENCE_READ） |

`REJECTED` 媒体一律 404；owner 对自己的媒体恒可读（不写审计）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M3） |
