FROM node:24-alpine AS build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM caddy:2.10-alpine
RUN apk add --no-cache python3
COPY --from=build /frontend/dist/nexo/browser /srv/nexo
COPY infra/web/Caddyfile /etc/caddy/Caddyfile
COPY infra/web/start-web.sh /usr/local/bin/start-web
RUN chmod +x /usr/local/bin/start-web
ENTRYPOINT ["/usr/local/bin/start-web"]
