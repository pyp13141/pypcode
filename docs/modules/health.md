# 模块：health（健康与成长）

> 二级契约：docs/API.md §2 尾段。产品依据：PRODUCT_DESIGN 6.5/6.6/12.3。

## 职责与硬约束

健康日志（体重/饮食/饮水/活动/事件）+ 情绪日志（主观观察标签）。**只存记录不产建议、不作诊断结论**；
响应统一携带就医提醒/免责文案（服务端不做症状判定）；"近 30 天记录数"作为 growth 榜单口径（不按体重/健康评判宠物价值）。

读取权限（MVP）：**仅主人**；订单参与方授权查看复用 pet_care_notes 机制，二期（见下"已知项"）。

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| POST/GET | /api/v1/pets/:petId/health-logs | [pet-health-logs](health/pet-health-logs.md) | ✅ |
| POST/GET | /api/v1/pets/:petId/mood-logs | [pet-mood-logs](health/pet-mood-logs.md) | ✅ |

## 已知项（记录不猜测）

- GET 的"授权方"（API §2 写"本人或授权方"）当前仅主人可读——订单参与方授权路径需与照料卡片快照联动，二期（DECISIONS D-015）。
- 徽章发放钩子已随 M6 补全：互助完成 → CARE_FIRST/CARE_VETERAN（服务者）、首次评价 → REVIEW_FIRST（评价者）。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 模块建立（M6）；growth 榜单接线；徽章发放钩子补全 |
