#!/bin/sh
set -e

# ==============================================================================
# POSTGRESQL DATABASE BACKUP SCRIPT (T57)
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/dps_contracts_backup_$TIMESTAMP.dump"

echo "[BACKUP] Bắt đầu sao lưu cơ sở dữ liệu PostgreSQL..."

if [ -n "$DATABASE_URL" ]; then
  pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_FILE"
else
  PGPASSWORD="${POSTGRES_PASSWORD:-postgres_secret_password}" \
  pg_dump -h "${POSTGRES_HOST:-localhost}" \
          -p "${POSTGRES_PORT:-5432}" \
          -U "${POSTGRES_USER:-postgres}" \
          -d "${POSTGRES_DB:-contracts_db}" \
          -Fc -f "$BACKUP_FILE"
fi

FILESIZE=$(wc -c < "$BACKUP_FILE" | awk '{print $1}')
echo "[BACKUP] Hoàn tất sao lưu thành công!"
echo "[BACKUP] File: $BACKUP_FILE"
echo "[BACKUP] Kích thước: $FILESIZE bytes"

