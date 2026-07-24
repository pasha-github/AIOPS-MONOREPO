FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

RUN npm init -y \
 && npm install @playwright/mcp@0.0.78

RUN npx playwright install --with-deps chromium

ENV PORT=8080

CMD ["sh", "-c", "npx @playwright/mcp --headless --browser chromium --host 0.0.0.0 --port ${PORT} --no-sandbox --allowed-hosts playwright-mcp-428716175586.us-central1.run.app"]
