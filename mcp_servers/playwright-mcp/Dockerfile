FROM mcr.microsoft.com/playwright:v1.55.0-jammy
WORKDIR /app

RUN npm init -y && npm install @playwright/mcp@latest
RUN npx playwright install chromium   # fetches the revision THIS playwright expects into /ms-playwright

ENV PORT=8080

CMD ["sh", "-c", "npx @playwright/mcp --headless --browser chromium --host 0.0.0.0 --port ${PORT} --no-sandbox --allowed-hosts playwright-mcp-428716175586.us-central1.run.app"]
