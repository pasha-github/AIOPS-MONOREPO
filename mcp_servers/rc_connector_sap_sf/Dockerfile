# Base Python image
FROM python:3.11-slim

# Install Node.js (needed for npx MCP)
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "uvicorn sap_sf:app --host 0.0.0.0 --port ${PORT:-8080}"]