# Etape 1 : Construction du Frontend Next.js
FROM node:20-slim AS frontend-builder
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
    gnupg \
    ca-certificates \
    nginx \
    supervisor \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y nodejs \
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
COPY --from=frontend-builder /app/frontend/next.config.ts ./frontend/
COPY --from=frontend-builder /app/frontend/messages ./frontend/messages

# Fichiers de configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start.sh .

RUN sed -i 's/\r$//' start.sh
RUN chmod +x start.sh

# Variables d'environnement par defaut (overridable via Railway)
ENV SECRET_KEY=supersecretkey_please_change_in_production
ENV ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Port d'écoute dynamique géré par start.sh et Nginx
EXPOSE 8080
CMD ["./start.sh"]
