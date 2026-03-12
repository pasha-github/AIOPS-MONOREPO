FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
