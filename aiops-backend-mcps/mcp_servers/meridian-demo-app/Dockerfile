# =========================================================
# Stage 1: Build the Frontend
# =========================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build static files
COPY frontend/ .
RUN npm run build

# =========================================================
# Stage 2: Build the Backend & Assemble Production Image
# =========================================================
FROM python:3.11-slim
WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY backend/ .

# Copy built frontend assets from Stage 1 into 'static/' folder
COPY --from=frontend-builder /app/dist ./static

# Cloud Run sets the $PORT environment variable. Default to 8080 if not set.
ENV PORT=8080

# Start Uvicorn pointing to the port specified by Cloud Run
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
