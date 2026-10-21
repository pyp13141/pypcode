#!/usr/bin/env bash
# 本机部署：测试门禁 → 构建 → 迁移 → 发布 H5 → 重启 API → 健康检查。任何一步失败即停止。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/7] 单元测试..."
pnpm test:api

echo "[2/7] 集成测试（测试库，含越权/白名单/路径规划）..."
pnpm --filter @pet-neighbor/api test:e2e

echo "[3/7] 构建 API..."
pnpm build:api

echo "[4/7] 构建 H5..."
pnpm build:h5

echo "[5/7] 数据库迁移（deploy 模式，只执行未应用迁移）..."
pnpm --filter @pet-neighbor/api exec prisma migrate deploy

echo "[6/7] 发布 H5 静态产物 → /var/www/petn ..."
mkdir -p /var/www/petn
rsync -a --delete apps/client/dist/h5/ /var/www/petn/

echo "[7/7] 重启 API 服务并健康检查..."
systemctl restart pet-neighbor-api
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:3001/api/v1/health >/dev/null 2>&1; then
    echo "✅ 部署完成：API 健康"
    curl -s -o /dev/null -w "   H5 /petn/: HTTP %{http_code}\n" -H "Host: ${PETN_HOST:-127.0.0.1}" http://127.0.0.1/petn/
    exit 0
  fi
  sleep 1
done

echo "❌ 健康检查失败（15s 超时）。排查：journalctl -u pet-neighbor-api -n 50" >&2
exit 1
