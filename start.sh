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

# Application des migrations de base de données
echo "Running database migrations (Alembic)..."
cd /app/backend
alembic upgrade head

# Seeding des comptes par défaut (idempotent, ne reset jamais les comptes modifiés)
echo "Ensuring default accounts (non-destructive seed)..."
python create_admin.py

# Retour au dossier de base
cd /app

# Demarrage de Supervisor pour orchestrer tous les services
echo "Starting Supervisor..."
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
