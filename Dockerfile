FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY .env .env
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runner
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/out ./

EXPOSE 8080
