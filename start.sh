#!/bin/bash
set -e

# Variables d'environnement strictes de production
export ENVIRONMENT=${ENVIRONMENT:-production}
export REQUIRE_POSTGRES_IN_RAILWAY=${REQUIRE_POSTGRES_IN_RAILWAY:-true}
export AUTO_SYNC_SCHEMA=false
export SEED_DEMO_DATA=false
export DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:UWnrFUZDxtSEMhgyvfRSNKCPDkTzcVsq@postgres.railway.internal:5432/railway"}

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

# Demarrage de Supervisor pour orchestrer tous les services (FastAPI, Next.js, Nginx)
# Le demarrage se limite strictement au lancement des serveurs web sans toucher a la base de donnees
echo "Starting Supervisor..."
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
