#!/usr/bin/env bash
# 宠邻生产库每日备份（HANDOVER-NEXT §2 待办3；方案=M5-REGRESSION §6 演练过的 pg_dump -Fc）。
# crontab（root）：
#   30 3 * * * /root/pet-neighbor/scripts/backup-db.sh >> /var/log/petn-backup.log 2>&1
# 保留最近 7 天；恢复方法见 docs/RUNBOOK §5。同日重跑覆盖当日文件（幂等）。
set -euo pipefail

BACKUP_DIR=/var/backups/petn
DB=pet_neighbor
DB_USER=petn_app
KEEP_DAYS=7
PASSWORD_FILE="${PETN_DB_PASSWORD_FILE:-/etc/pet-neighbor/db-password}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
export PGPASSWORD="$(cat "$PASSWORD_FILE")"

STAMP=$(date +%F)
DEST="$BACKUP_DIR/${DB}_${STAMP}.dump"

# 先写 .tmp，成功后原子改名：中断不会留下看似完整的坏档
pg_dump -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Fc -f "$DEST.tmp"
mv "$DEST.tmp" "$DEST"
chmod 600 "$DEST"

# 档案完整性自检（能列出目录才允许算成功）
pg_restore --list "$DEST" > /dev/null

find "$BACKUP_DIR" -name "${DB}_*.dump" -mtime "+$KEEP_DAYS" -delete

echo "$(date '+%F %T') backup ok: $DEST ($(du -h "$DEST" | cut -f1))，剩余 $(ls "$BACKUP_DIR"/${DB}_*.dump | wc -l) 份"
