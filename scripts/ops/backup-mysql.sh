#!/usr/bin/env sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --host="$DB_HOST" \
  --port="${DB_PORT:-3306}" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  "$DB_NAME" | gzip -9 > "$OUT"

gzip -t "$OUT"
find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete
printf 'Backup created and verified: %s\n' "$OUT"
