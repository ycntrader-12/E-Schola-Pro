# Etape 1 : Construction du Frontend Next.js
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
ENV NEXT_PUBLIC_API_URL=/api/v1
RUN npm run build

# Etape 2 : Construction de l'image finale unifiée
FROM python:3.11-slim
WORKDIR /app

# Installation de Node.js, Nginx et Supervisor
RUN apt-get update && apt-get install -y \
    curl \
    nginx \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Configuration du Backend FastAPI
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# Copie du Frontend Next.js compilé
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# Fichiers de configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start.sh .

RUN sed -i 's/\r$//' start.sh
RUN chmod +x start.sh

# Port d'écoute dynamique géré par start.sh et Nginx
CMD ["./start.sh"]
