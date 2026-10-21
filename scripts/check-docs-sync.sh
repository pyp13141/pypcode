#!/usr/bin/env bash
# 文档同步强制检查（docs/DOC-SYNC.md 的执行器）。
# 本地: make check-docs；CI: .cnb.yml。任一失败退出非零。
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
err() { echo "✗ $*" >&2; fail=1; }
ok()  { echo "✓ $*"; }

# ---------- 1. 错误码镜像检查：error-codes.ts 的每个码必须出现在 ERRORS.md ----------
ts=apps/api/src/common/error-codes.ts
codes=$(grep -oE "^\s+[A-Z][A-Z0-9_]+:" "$ts" | tr -d ' :' | sort -u)
missing=0
for c in $codes; do
  grep -q "\`$c\`" docs/ERRORS.md || { err "错误码 $c 未登记进 docs/ERRORS.md"; missing=1; }
done
[ "$missing" -eq 0 ] && ok "错误码镜像一致（$(echo "$codes" | wc -w) 个）"

# ---------- 2. ERRORS.md 中不存在的码（防残留） ----------
extra=0
while IFS= read -r c; do
  grep -q "^\s\+$c:" "$ts" || { err "docs/ERRORS.md 引用了不存在的错误码 $c"; extra=1; }
done < <(grep -oE '^\| `([A-Z][A-Z0-9_]+)`' docs/ERRORS.md | tr -d '| `' )
[ "$extra" -eq 0 ] && ok "ERRORS.md 无失效错误码"

# ---------- 3. 每个模块目录必须有二级文档 ----------
for moddir in apps/api/src/modules/*/; do
  mod=$(basename "$moddir")
  [ -f "docs/modules/$mod.md" ] || err "模块 $mod 缺少二级文档 docs/modules/$mod.md"
done
ok "模块二级文档覆盖检查"

# ---------- 4. 每个接口目录必须有三级契约 + 二级文档接口表行 ----------
for epdir in apps/api/src/modules/*/endpoints/*/; do
  mod=$(basename "$(dirname "$(dirname "$epdir")")")
  ep=$(basename "$epdir")
  [ -f "docs/modules/$mod/$ep.md" ] || err "接口 $mod/$ep 缺少契约 docs/modules/$mod/$ep.md"
  grep -q "$ep" "docs/modules/$mod.md" 2>/dev/null || err "接口 $mod/$ep 未登记进 docs/modules/$mod.md 接口表"
done
ok "接口契约覆盖检查"

# ---------- 5. docs/README.md 索引必须链接每个模块二级文档 ----------
for f in docs/modules/*.md; do
  base=$(basename "$f")
  [ "$base" = "README.md" ] && continue
  grep -q "$base" docs/README.md || err "docs/README.md 主索引未链接 $base"
done
ok "主索引链接检查"

# ---------- 6. 每个接口契约必须被 docs/README.md 三级表引用 ----------
for f in docs/modules/*/*.md; do
  base=$(basename "$f")
  grep -q "$base" docs/README.md || err "docs/README.md 三级表未引用 $f"
done
ok "三级契约索引检查"

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "文档同步检查失败：按 docs/DOC-SYNC.md 同步后重试。" >&2
  exit 1
fi
echo "文档同步检查全部通过。"
