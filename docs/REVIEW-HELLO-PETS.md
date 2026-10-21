# hello-pets 仓库审查报告

> 审查日期：2026-10-10。对象：<https://github.com/584sentiment/hello-pets>（shallow clone 至 `ref/hello-pets/`，隔离目录，不并入主仓库）。
> 审查依据：设计文档 20.3 节复用策略。**结论先行：只作阅读参考，不复制任何代码/图片进本项目。**

## 1. 授权（一票否决项）

| 检查项 | 结果 |
|---|---|
| LICENSE 文件 | ❌ 无 |
| package.json `license` 字段 | ❌ 无 |
| README 声称 | MIT（README 文本） |

**判定**：README 单方面写 MIT 而仓库无 LICENSE 文件，不构成有效授权（MIT 要求随附许可证文本）。按设计文档 20.3 红线——"无明确许可证的代码不得直接并入商业产品"——**禁止复制其代码、图片、图标到本仓库**。页面交互、字段设计等"思想层面"可参考，实现须原创。

## 2. 技术栈与耦合度

| 项 | hello-pets | 本项目 | 差距判定 |
|---|---|---|---|
| Taro | 3.6.24 | 4.3.0 | 版本差距大，构建体系不同，不能照搬 |
| 后端 | **微信云开发**（51 个云函数，`wx-server-sdk` + 云数据库） | NestJS + PostgreSQL | **架构性不兼容**：云函数=无服务器 NoSQL，我们的模块化单体=关系型事务；订单/状态机逻辑无法直接移植 |
| 数据库 | 云 NoSQL 集合 12 个（users/posts/orders/…） | PostgreSQL 关系表 | 字段设计可参考，DDL/约束/迁移须自建 |
| H5 | 有 `build:h5` 脚本，但配置为默认值，README 未承诺 H5 完整适配 | 双端均需构建通过 | 不能假设其 H5 可用 |
| 服务端鉴权 | 云函数内 `cloud.getWXContext().OPENID` | 自建会话 + 身份映射 | 云函数把 openid 当隐式信任源；我们必须自建（设计文档 5.4 明确要求） |

## 3. 值得参考的资产（只看不抄）

| 资产 | 位置 | 参考价值 |
|---|---|---|
| 页面流：喂养预约 flow（列表→详情→预约表单）、服务者工作台（接单大厅/我的订单/收入） | `src/pages/service/`、`src/pages/provider/` | ⭐⭐⭐ M2 互助模块的页面组织与字段收集项（服务类型 feed/board、时长、价格、备注） |
| 数据库字段设计（users/orders/posts 等 12 集合的字段与索引） | `DATABASE_DESIGN.md`（320 行） | ⭐⭐⭐ 核对我们 ERD 是否漏字段（如订单 petInfo/address 快照思路与我们一致） |
| 表单校验规则（手机号/邮箱/金额/密码） | `src/utils/validator.ts` | ⭐⭐ 正则思路可参考，重新实现 |
| 平台架构文档、DEV_NOTES、PROGRESS | 仓库根目录 | ⭐⭐ 看他们踩过的坑（云函数分包、Taro3 兼容处理） |
| provider 五角色页面（接单/工作台/收入） | `src/pages/provider/` | ⭐⭐ M2 服务者侧功能清单输入 |

## 4. 明确不采用的部分

1. **51 个云函数**：全部不采用。我们的写接口在 NestJS 模块中实现（设计文档 8.4 模块边界）。
2. **云数据库集合设计**：不采用其存储形态；字段命名仅作查漏。
3. **openid 直接当用户标识**：其云函数隐式信任 OPENID；我们按设计文档 5.4 用 `user_identities(provider, provider_subject)` 映射。
4. **assets 图片/图标（796K）**：授权不明，不用。视觉按设计文档 13 节 Token 自建。
5. **Taro 3.6 依赖锁定**：我们已用 Taro 4.3 并踩完升级坑（见 apps/client/README）。

## 6. 复用决策记录

| 决策 | 理由 |
|---|---|
| 不 fork、不复制代码 | 无 LICENSE；云开发架构不兼容 |
| 保留 `ref/hello-pets/` 在本机不进 Git | 隔离审查要求；`.gitignore` 已排除 `ref/` |
| M2 开工前重读其 service/provider 页面流 | 补齐功能清单盲区 |

（决策已同步进 docs/DECISIONS.md D-005。）
