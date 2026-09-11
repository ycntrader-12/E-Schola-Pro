#!/bin/bash
set -e

# Variables d'environnement strictes de production
export ENVIRONMENT=${ENVIRONMENT:-production}
export REQUIRE_POSTGRES_IN_RAILWAY=${REQUIRE_POSTGRES_IN_RAILWAY:-true}
export AUTO_SYNC_SCHEMA=false
export SEED_DEMO_DATA=false

# Configuration du port dynamique de Railway dans Nginx
PORT=${PORT:-8080}
echo "Configuring Nginx to listen on port $PORT"
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/nginx.conf

# S'assurer que les dossiers de persistance et d'uploads existent
mkdir -p /app/backend/uploads
mkdir -p /app/backend/data
mkdir -p /app/data
mkdir -p /data 2>/dev/null || true
if [ -n "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
    mkdir -p "$RAILWAY_VOLUME_MOUNT_PATH"
fi

# Application explicite des migrations de base de donnees (PostgreSQL & Alembic)
echo "Executing explicit database migrations for production deployment..."
cd /app/backend

python run_migrations.py

# Seeding des comptes administratifs (idempotent, ne reset jamais les comptes modifiés)
echo "Ensuring administrative access (strictly non-destructive)..."
python create_admin.py || echo "create_admin notice: continuing startup..."

# Retour au dossier de base
cd /app

# Demarrage de Supervisor pour orchestrer tous les services
echo "Starting Supervisor..."
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
