# GET /api/v1/admin/care-orders · /api/v1/admin/market-deals

> 契约同 [API §6](../../API.md#6-管理后台adminm4前缀-apiv1admin)。角色：`support_operator` / `analyst`。

**只读**；只出必要字段（状态、双方昵称、金额/物品摘要、时间）。
**地址、门禁说明、紧急联系人默认不可见**——按工单临时授权的专用路径待评（D-013），当前无任何字段级地址访问接口。

分页信封（`?status=&page=`）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版（M4） |
