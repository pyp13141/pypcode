# 宠邻一键操作入口（交接从这里开始，细节见 docs/RUNBOOK.md）
.PHONY: setup dev build test check-docs deploy status logs db clean help

help: ## 列出所有命令
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## 安装依赖 + Prisma 生成 + 初始化 .env（幂等）
	pnpm install
	pnpm --filter @pet-neighbor/api exec prisma generate
	@test -f apps/api/.env || (sed "s|change_me|$${PETN_DB_PASSWORD:-change_me}|" apps/api/.env.example > apps/api/.env && echo "已生成 apps/api/.env（可用 PETN_DB_PASSWORD 注入密码）")
	@echo "setup 完成"

dev: ## 本地开发：API watch + H5 dev 并行
	bash scripts/dev.sh

build: ## 构建 API + H5 + 小程序
	pnpm build:api && pnpm build:h5 && pnpm build:weapp
	@echo "三端构建完成"

test: ## API 单元测试
	pnpm test:api

check-docs: ## 文档同步强制检查
	bash scripts/check-docs-sync.sh

deploy: ## 本机部署：构建→迁移→发布 H5→重启→探活
	bash scripts/deploy.sh

status: ## 服务与入口状态
	@systemctl is-active pet-neighbor-api && curl -sf http://127.0.0.1:3001/api/v1/health | head -c 200 && echo
	@curl -s -o /dev/null -w "H5 /petn/: HTTP %{http_code}\n" -H "Host: $${PETN_HOST:-127.0.0.1}" http://127.0.0.1/petn/

logs: ## 跟踪 API 日志
	journalctl -u pet-neighbor-api -f

db: ## 打开本项目 PostgreSQL
	sudo -u postgres psql pet_neighbor

clean: ## 清理构建产物
	rm -rf apps/api/dist apps/client/dist
