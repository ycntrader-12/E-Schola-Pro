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

# Application explicite des migrations de base de donnees (PostgreSQL & Alembic)
echo "Executing explicit database migrations for production deployment..."
cd /app/backend

# Desactivation stricte de la synchronisation automatique ORM en production
export AUTO_SYNC_SCHEMA=false
export ENVIRONMENT=${ENVIRONMENT:-production}

python run_migrations.py

# Seeding des comptes administratifs (idempotent, ne reset jamais les comptes modifiés)
echo "Ensuring administrative access (strictly non-destructive)..."
export SEED_DEMO_DATA=${SEED_DEMO_DATA:-false}
python create_admin.py || echo "create_admin notice: continuing startup..."

# Retour au dossier de base
cd /app

# Demarrage de Supervisor pour orchestrer tous les services
echo "Starting Supervisor..."
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
