# Base Python image
FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr (ensures instant Cloud Run logs)
ENV PYTHONUNBUFFERED=1

# Install Node.js, npm, and curl cleanly
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependencies list first to leverage Docker layer caching
COPY requirements.txt .

# Install dependencies without cache
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Launch Uvicorn bound to dynamic $PORT (defaulting to 8080)
CMD ["sh", "-c", "uvicorn sap_api:web_app --host 0.0.0.0 --port ${PORT:-8080}"]
