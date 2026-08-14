#!/usr/bin/env sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"
BACKUP_FILE="${1:-}"
[ -n "$BACKUP_FILE" ] || { echo "Usage: $0 <backup.sql.gz>" >&2; exit 2; }
[ -f "$BACKUP_FILE" ] || { echo "Backup not found: $BACKUP_FILE" >&2; exit 2; }

gzip -t "$BACKUP_FILE"
printf 'Restoring %s into %s on %s...\n' "$BACKUP_FILE" "$DB_NAME" "$DB_HOST"
gzip -dc "$BACKUP_FILE" | MYSQL_PWD="$DB_PASSWORD" mysql \
  --host="$DB_HOST" \
  --port="${DB_PORT:-3306}" \
  --user="$DB_USER" \
  "$DB_NAME"
printf 'Restore completed. Run application schema preflight before accepting traffic.\n'
