#!/bin/sh
set -e

# ==============================================================================
# POSTGRESQL DATABASE RESTORE SCRIPT (T57)
# ==============================================================================

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Lỗi: Vui lòng chỉ định đường dẫn tệp backup cần khôi phục."
  echo "Cách dùng: $0 ./backups/dps_contracts_backup_YYYYMMDD_HHMMSS.dump"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Lỗi: Không tìm thấy tệp $BACKUP_FILE"
  exit 1
fi

echo "[RESTORE] Bắt đầu khôi phục dữ liệu từ $BACKUP_FILE..."

if [ -n "$DATABASE_URL" ]; then
  pg_restore --clean --if-exists -d "$DATABASE_URL" "$BACKUP_FILE"
else
  PGPASSWORD="${POSTGRES_PASSWORD:-postgres_secret_password}" \
  pg_restore -h "${POSTGRES_HOST:-localhost}" \
             -p "${POSTGRES_PORT:-5432}" \
             -U "${POSTGRES_USER:-postgres}" \
             -d "${POSTGRES_DB:-contracts_db}" \
             --clean --if-exists \
             "$BACKUP_FILE"
fi

echo "[RESTORE] Khôi phục cơ sở dữ liệu thành công hoàn tất!"

