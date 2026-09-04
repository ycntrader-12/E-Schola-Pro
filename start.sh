#!/bin/bash
set -e

# Configuration du port dynamique de Railway dans Nginx
PORT=${PORT:-8080}
echo "Configuring Nginx to listen on port $PORT"
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/nginx.conf

# S'assurer que les dossiers de persistance et d'uploads existent
mkdir -p /app/backend/uploads
mkdir -p /app/backend/data
if [ -n "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
    mkdir -p "$RAILWAY_VOLUME_MOUNT_PATH"
fi

# Application des migrations de base de données (PostgreSQL & SQLite)
echo "Checking database availability & running migrations..."
cd /app/backend

python -c "
import time
from app.db.database import engine
from sqlalchemy import text

for i in range(10):
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
            print('Database connection established successfully.')
            break
    except Exception as e:
        print(f'Database connection pending ({i+1}/10): {e}')
        time.sleep(2)
" || true

python migrate_user_profiles.py || true
python migrate_messages_schema.py || true
python migrate_classrooms.py || true
python migrate_tasks_attachment.py || true

alembic upgrade head || {
    echo "Alembic upgrade note: attempting safe reconciliation..."
    python -c "
import alembic.config
try:
    alembic.config.main(argv=['stamp', 'head'])
    print('Stamped database head successfully.')
except Exception as e:
    print('Stamp note:', e)
"
}

# Seeding des comptes par défaut (idempotent, ne reset jamais les comptes modifiés)
echo "Ensuring default accounts (non-destructive seed)..."
python create_admin.py || echo "create_admin notice: continuing startup..."

# Retour au dossier de base
cd /app

# Demarrage de Supervisor pour orchestrer tous les services
echo "Starting Supervisor..."
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
