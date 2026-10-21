# M5 双端回归与上线前检查报告（2026-10-10）

> 依据：MASTER「M5 双端回归」= H5/小程序构建、授权、上传、分享、返回行为回归 + 隐私审查 + 备份演练。
> 结论：**双端构建通过、核心闭环在线上 H5 与接口层回归通过、隐私审查与备份演练完成**；
> 真机/开发者工具交互回归与 ICP 备案域名相关事项见 §6（用户侧）。

## 1. 双端构建回归 ✅

| 端 | 命令 | 结果 | 产物 |
|---|---|---|---|
| H5 | `pnpm build:h5` | ✅ 编译成功（仅 webpack 体积提示） | `dist/h5` → `/var/www/petn/`（`/petn/` 访问 200，bundle 200） |
| 微信小程序 | `pnpm build:weapp` | ✅ 编译成功（8.1s） | `dist/weapp`（微信开发者工具打开） |

- 14 个页面全部进入构建产物（5 Tab + 登录/详情/发布/通知等）；
- 锁定配置未被改动（webpack 5.91.0、`compiler: { type:'webpack5', prebundle:{enable:false} }`、`src/index.html` 模板、`@babel/preset-react`）。

## 2. 授权（登录/会话）回归 ✅

| 场景 | 实现 | 验证 |
|---|---|---|
| 小程序登录 | `Taro.login()` 取 code → `POST /auth/wechat/login`（开发期服务端 Mock，D-006） | 构建通过；线上接口 200 |
| H5 登录 | 开发期本机模拟凭证（持久化 code）+ 手机号短信登录（Mock 码打日志） | 线上 `POST /auth/wechat/login` 200 |
| 会话失效 | `api-client` 收到 401 → 清 token + 跳登录（统一回调） | 代码路径明确；接口层 401 语义回归通过 |
| 封禁用户 | 登录链路 403 `USER_BANNED`（M4 补强） | 集成测试覆盖 |

## 3. 上传（媒体管线）回归 ✅

- 客户端 `services/media.ts`：`POST /media/upload-authorizations` → `PUT uploadPath`（ArrayBuffer 直传）→ `POST /media/:id/finalize`；
- 平台差异只在 `adapters/`：H5 用 `fetch(file).arrayBuffer()`，小程序用 `getFileSystemManager + base64ToArrayBuffer`；
- 服务端按 purpose 限制类型/大小/频控（集成测试覆盖 403/400/413/429）；
- 使用位置：发帖图片、集市物品图片（发布流程必经）。

## 4. 分享与返回行为回归 ✅（代码路径 + 构建）

- 分享：
  - 小程序：4 个可分享页面（服务公告/物品详情/订单/帖子详情）已挂 `useShareAppMessage`（右上角「···」→ 转发）；
  - H5：`navigator.share` 优先，降级剪贴板复制（`adapters/h5`）；
- 返回：tab 页用 `switchTab`（无栈）、详情页 `navigateTo`/`navigateBack` 成对使用；H5 路由 basename `/petn` 与浏览器回退兼容。

## 5. 隐私审查 ✅

| 检查 | 结果 |
|---|---|
| 客户端渲染敏感字段 | 仅登录页（本人手机号输入）与订单页（**需求方本人填写地址**，走授权 PUT）；无任何页面展示他人的地址/手机号/密文 |
| API 日志 | care/market/media 模块无敏感载荷打印（仅失败告警） |
| 公开响应白名单 | 集成测试 8 处显式断言（订单/需求/列表响应不含手机号/地址/密文） |
| 私密地址读取 | 唯一路径 `GET /care/orders/:id/private-details`（参与方+状态+每次写审计） |
| 密钥与配置 | `apps/api/.env` 被 gitignore；生产 `/etc/pet-neighbor/api.env` 为 `-rw-------` root |
| 后台边界 | /admin 只读记录不含地址/紧急联系人（契约与测试双保险） |

## 6. 备份演练 ✅（可重复执行）

```bash
pg_dump -h 127.0.0.1 -U petn_app -d pet_neighbor -Fc -f /tmp/petn_backup_$(date +%Y%m%d).dump
sudo -u postgres psql -c "CREATE DATABASE pet_neighbor_restore_drill OWNER petn_app;"
pg_restore -h 127.0.0.1 -U petn_app -d pet_neighbor_restore_drill --no-owner <dump>
# 校验：表数一致（53/53）、_prisma_migrations=7、append_only 触发器=4；演练后 DROP
```

> ✅ 已落地（2026-10-11）：pg_dump 加入 crontab（每日 03:30，`scripts/backup-db.sh`，`-Fc` 格式，保留 7 天）；
> 恢复命令见 RUNBOOK §5。正式上线前再演练一次"从备份启动服务"。

## 7. 待用户侧完成（阻塞项不变）

1. **ICP 备案域名**：小程序提审/H5 正式域名硬门槛；小程序 request 合法域名需 HTTPS。
2. **微信 AppID**：拿到后替换 `apps/client/project.config.json` 与 `api.env`，删除 `ALLOW_WECHAT_MOCK`。
3. **真机/开发者工具交互回归**：登录→建宠→发需求→申请→接受→地址→履约→评价；集市发布（拍照上传）→交易；社区发帖（图片）→评论/点赞。
4. **443 端口**（可选）：H5 目前 80 明文；正式上线建议放行并在 Caddy 配置 HTTPS。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 首版：双端构建/授权/上传/分享/返回/隐私/备份演练完成；客户端 14 页面落地 |
