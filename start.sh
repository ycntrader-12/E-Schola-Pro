#!/bin/bash
set -e

# Configuration du port dynamique de Railway dans Nginx
PORT=${PORT:-8080}
echo "Configuring Nginx to listen on port $PORT"
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/nginx.conf

# S'assurer que le dossier uploads existe
mkdir -p /app/backend/uploads

# Application des migrations de base de données (SQLite)
echo "Running database migrations (Alembic)..."
cd /app/backend
alembic upgrade head

# Seeding de l'utilisateur Admin
echo "Seeding default admin account..."
python create_admin.py

# Retour au dossier de base
cd /app

# Demarrage de Supervisor pour orchestrer tous les services
echo "Starting Supervisor..."
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
