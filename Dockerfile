FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# COPY .env .env

ARG NEXT_PUBLIC_LLM_MANAGER_API_BASE_URL 
ARG NEXT_PUBLIC_AGENT_ADK_BASE_URL 
 
ENV NEXT_PUBLIC_LLM_MANAGER_API_BASE_URL=$NEXT_PUBLIC_LLM_MANAGER_API_BASE_URL 
ENV NEXT_PUBLIC_AGENT_ADK_BASE_URL=$NEXT_PUBLIC_AGENT_ADK_BASE_URL
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runner
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/out ./

EXPOSE 8080
