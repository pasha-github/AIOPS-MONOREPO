# Use Java 17 base
FROM eclipse-temurin:17-jdk

# Install Python + venv
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY requirements.txt .

# Install inside venv (no PEP 668 issue)
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x /app/talend/ETL008/ETL008/ETL008_run.sh

ENV PORT=8080
EXPOSE 8080

CMD ["bash", "-c", "uvicorn elt:app --host 0.0.0.0 --port 8080"]
