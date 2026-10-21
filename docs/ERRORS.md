# 错误码汇总（ERRORS）

> **单一源是代码**：`apps/api/src/common/error-codes.ts`。本文件是与之同步的人类可读汇总；
> `scripts/check-docs-sync.sh` 强制两边一致，任何一侧漏更即 CI 失败（规则见 [DOC-SYNC](DOC-SYNC.md)）。

## 通用码（所有模块共用）

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `INTERNAL_ERROR` | 500 | 未预期的服务端异常 | 提示用户稍后重试；带 requestId 反馈 |
| `REQUEST_INVALID` | 400 | 请求格式/参数整体非法 | 检查请求构造 |
| `REQUEST_VALIDATION_FAILED` | 400 | 字段校验失败（message 为逐字段说明） | 按 message 修正字段 |
| `AUTH_REQUIRED` | 401 | 未登录或令牌失效 | 引导登录 |
| `RESOURCE_FORBIDDEN` | 403 | 已登录但无权访问该资源 | 不重试，提示无权限 |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在或已删除 | 展示空态/已删除提示 |
| `RESOURCE_CONFLICT` | 409 | 状态机/唯一约束冲突 | 刷新后重试 |
| `RATE_LIMITED` | 429 | 触发速率限制 | 退避后重试 |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 同 Idempotency-Key 携带了不同请求体 | 换新 key 重新发起 |

## 模块码

### system

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `HEALTH_DB_UNAVAILABLE` | 503 | 健康检查时数据库探测失败 | 运维介入；对外展示服务降级 |

### identity

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `AUTH_CODE_INVALID` | 400 | 验证码错误/过期/尝试超次 | 提示重新获取；不清空手机号输入 |
| `AUTH_RATE_LIMITED` | 429 | 短信发送 60 秒内重复 | 倒计时禁用发送按钮 |
| `AUTH_EMAIL_SEND_FAILED` | 502 | SMTP 供应商拒收/超时（邮箱不存在、写错、服务商故障） | 核对邮箱地址；稍后重试 |
| `AUTH_REFRESH_INVALID` | 401 | 刷新令牌无效或检测到复用（复用会撤销全部会话） | 清本地令牌，回登录页 |
| `AUTH_REFRESH_EXPIRED` | 401 | 刷新令牌超过 30 天 | 同上 |
| `AUTH_SECOND_FACTOR_FAILED` | 401 | 身份关联二次认证失败 | 重新认证 |
| `AUTH_WECHAT_NOT_CONFIGURED` | 503 | 生产未配置微信凭证（开发 Mock 未启用） | 运维配置 AppID；用户稍后重试 |
| `USER_BANNED` | 403 | 账号被封禁 | 展示封禁提示与申诉入口 |
| `IDENTITY_ALREADY_LINKED` | 409 | 该登录身份已关联当前账号 | 无需重复操作 |
| `IDENTITY_TAKEN` | 409 | 登录身份已被其他账号绑定 | 客服介入；防抢绑 |

### users

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `SELF_BLOCK_NOT_ALLOWED` | 400 | 尝试屏蔽自己 | 前端本就不应出现此入口 |
| `BLOCK_TARGET_NOT_FOUND` | 404 | 屏蔽目标用户不存在 | 视为已屏蔽/刷新列表 |

### pets

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `PET_LIMIT_REACHED` | 409 | 宠物档案达 50 只上限 | 提示归档不用的档案 |

### transit

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `TRANSIT_SAME_STATION` | 400 | 路径规划起终点相同 | 表单校验拦截 |
| `TRANSIT_NO_ROUTE` | 404 | 两站间无可达路径 | 提示换其他站点组合 |
| `TRANSIT_DATA_EMPTY` | 503 | 城市地铁数据未导入 | 展示"该城市暂不支持地铁规划" |

### care（M2 互助服务）

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `PHONE_VERIFICATION_REQUIRED` | 403 | 运营开关开启时未验证手机号即发布 | 引导先完成手机号验证 |
| `APPLICATION_STATE_INVALID` | 409 | 申请非 PENDING（已接受/拒绝/撤回/过期） | 刷新申请列表 |
| `REQUEST_NOT_OPEN` | 409 | 需求已 MATCHED/关闭，不再接受操作 | 刷新需求状态；已被他人匹配时提示 |
| `CARE_ORDER_EXISTS` | 409 | 同一需求已存在订单 | 前往订单列表查看 |
| `ORDER_STATE_INVALID` | 409 | 订单状态机非法流转（如未确认就开始） | 刷新订单状态后按当前状态操作 |
| `ORDER_START_WINDOW_INVALID` | 409 | 开始服务超出约定时间窗（默认 ±24h） | 联系对方或按异常流程处理 |
| `ORDER_PRIVATE_DETAILS_REQUIRED` | 409 | 确认订单前未登记地址等私密履约信息 | 先提交服务地址再确认 |
| `PRIVATE_DETAIL_NOT_AVAILABLE` | 403 | 非参与方或订单状态未到可读状态 | 不重试；确认后由需求方提供 |
| `VISIT_STATE_INVALID` | 409 | 单次上门状态不允许该操作 | 刷新上门记录 |
| `ORDER_CANCEL_NOT_ALLOWED` | 409 | 当前状态不可取消（已完成/已取消/争议中/待对方同意） | 已转 CANCEL_REQUESTED 时等待对方处理或发起纠纷 |
| `REVIEW_NOT_ALLOWED` | 409 | 订单未 COMPLETED 或非参与方 | 完成服务后再评价 |
| `REVIEW_ALREADY_EXISTS` | 409 | 该订单已评价过（每方一次） | 展示已提交的评价 |
| `DISPUTE_ALREADY_OPEN` | 409 | 该订单已有未决纠纷工单 | 前往纠纷详情跟进 |

### market（M3 集市与交易）

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `LISTING_PRICE_INVALID` | 400 | 价格与交易类型不一致（SALE 无价/GIFT 带价） | 修正表单价格 |
| `LISTING_CATEGORY_RESTRICTED` | 403 | 分类已停用/暂不接受发布 | 换分类或联系客服 |
| `LISTING_NOT_AVAILABLE` | 409 | 列表已下架/已售出 | 刷新列表；提示物品状态变化 |
| `DEAL_ALREADY_IN_PROGRESS` | 409 | 同一物品已有进行中交易（或买家已有未终结交易） | 前往我的交易继续/等待 |
| `DEAL_STATE_INVALID` | 409 | 交易状态机非法流转 | 刷新交易状态后按当前状态操作 |

### community / moderation（M4 社区与治理）

| 错误码 | HTTP | 触发条件 | 客户端处理建议 |
|---|---:|---|---|
| `ADMIN_REQUIRED` | 403 | 非后台账号访问 /admin 接口 | 不重试；确认账号权限 |
| `ADMIN_ROLE_REQUIRED` | 403 | 后台角色权限不足（最小权限） | 不重试；找对应角色同事处理 |
| `REPORT_DUPLICATE` | 409 | 同一目标已有本人未决举报（合并处理） | 提示处理中，避免重复提交 |
| `HELP_CATEGORY_NOT_ALLOWED` | 400 | 求助帖分类不在首期白名单 | 改用 PET_CARE/NEIGHBOR |
| `SELF_FOLLOW_NOT_ALLOWED` | 400 | 尝试关注自己 | 前端不应出现此入口 |

<!-- 新模块的错误码在下方按模块名新增小节，格式同上 -->

## 响应结构

所有错误响应遵循统一信封（docs/API.md）：

```json
{
  "data": null,
  "meta": { "requestId": "req_xxx" },
  "error": { "code": "HEALTH_DB_UNAVAILABLE", "message": "数据库不可用" }
}
```
