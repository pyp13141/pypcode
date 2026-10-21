#!/usr/bin/env bash
# 本地开发一键并行：API watch（:3001）+ H5 dev server（:10086）。Ctrl-C 全部停止。
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f apps/api/.env ] || { echo "缺少 apps/api/.env，先执行 make setup"; exit 1; }

pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

echo "→ API   http://127.0.0.1:3001/api/v1/health"
echo "→ H5    http://127.0.0.1:10086/petn/"
echo "（H5 开发代理需自行指向 API；M1 引入 api-client 时统一配置）"
echo ""

pnpm --filter @pet-neighbor/api run start:dev &
pids+=($!)
pnpm --filter @pet-neighbor/client run dev:h5 &
pids+=($!)

wait -n
