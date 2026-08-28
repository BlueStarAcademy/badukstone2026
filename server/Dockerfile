FROM node:lts-alpine AS build

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/migrations ./migrations
RUN npm run build

FROM node:lts-alpine

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NODE_ENV=production

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server/migrations ./migrations

EXPOSE 3001

CMD ["node", "dist/index.js"]
