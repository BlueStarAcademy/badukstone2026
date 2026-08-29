# Frontend build
FROM node:lts-alpine AS build-frontend

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

ARG VITE_API_URL=same-origin
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# API build
FROM node:lts-alpine AS build-api

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/migrations ./migrations
RUN npm run build

# Production: Caddy(정적) + Express API(내부 3001) 단일 컨테이너
FROM node:lts-alpine

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NODE_ENV=production
ENV API_PORT=3001

RUN apk add --no-cache caddy

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=build-api /app/dist ./api-dist
COPY server/migrations ./migrations
COPY --from=build-frontend /app/dist ./dist

COPY Caddyfile ./
COPY scripts/start-production.sh ./start-production.sh
RUN chmod +x start-production.sh \
    && sed -i 's/\r$//' start-production.sh \
    && caddy fmt Caddyfile --overwrite

CMD ["./start-production.sh"]
