# 文档同步规则（DOC-SYNC）

> 解决"改了模块文档没跟着改"的问题：规则写死在这里，`scripts/check-docs-sync.sh` 在 `make check-docs` 与 CI（`.cnb.yml`）中强制执行，不过就红。

## 核心机制

1. **单一源**：错误码的唯一权威在 `apps/api/src/common/error-codes.ts`；`docs/ERRORS.md` 是它的镜像汇总。
2. **一一对应**：接口代码目录 `apps/api/src/modules/<m>/endpoints/<e>/` ↔ 接口契约 `docs/modules/<m>/<e>.md` ↔ 模块文档 `docs/modules/<m>.md` 的接口表行。
3. **同步检查**：`check-docs-sync.sh` 校验上述对应关系与 ERRORS 镜像，任一缺失即退出非零。

## 何时必须同步（按变更类型）

| 你改了… | 必须同步 |
|---|---|
| 新增/删除接口 | 三级契约文档 + 模块二级文档接口表 + [API](API.md) 总表 + `docs/README.md` 三级表 |
| 接口字段/行为变化 | 三级契约（响应/错误表 + 变更记录） |
| 新增/改名错误码 | `error-codes.ts` + [ERRORS](ERRORS.md)（同一次提交） |
| 新增模块 | 二级文档 + `docs/README.md` 二级表 + [ARCHITECTURE](ARCHITECTURE.md) 检查单走一遍 |
| 状态机变化 | [STATE_MACHINES](STATE_MACHINES.md) |
| 表结构变化 | [ERD](ERD.md) + 相应迁移说明 |
| 部署/环境变量变化 | [RUNBOOK](RUNBOOK.md) + [DECISIONS](DECISIONS.md) |
| 技术选型推翻 | [DECISIONS](DECISIONS.md)（追加新条目，旧条目标 OBSOLETE，不删历史） |

## 提交前自检

```bash
make check-docs   # 文档同步强制检查
```

CI（`.cnb.yml`）在 push 时同样执行，失败会阻断流水线。

## 文档层级速查

- **一级**：`docs/README.md`（索引）、ARCHITECTURE、RUNBOOK、DECISIONS、API、ERRORS、ERD、STATE_MACHINES、PRODUCT_DESIGN。
- **二级**：`docs/modules/<模块>.md` —— 模块职责、接口表、依赖、变更记录。
- **三级**：`docs/modules/<模块>/<接口>.md` —— 单接口契约（请求/响应/错误/约束/变更记录）。
