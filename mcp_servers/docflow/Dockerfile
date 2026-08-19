# DocFlow AI POC — single-container image for Cloud Run.
#
# The server is standard-library-only, so there is no pip install step: the
# image is just Python plus the POC's own files, builds in seconds, and pulls
# in no third-party supply chain.
FROM python:3.12-slim

# Cloud Run sends SIGTERM and expects a prompt exit; unbuffered stdout keeps
# the request log flowing into Cloud Logging in real time.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app

WORKDIR /app

# Front-end (served as static files) …
COPY index.html styles.css ./
COPY data.js api.js dms.js pdfgen.js chat.js app.js ./
# … and the server that backs it.
COPY server/ ./server/

# Run unprivileged. /data is the SQLite home: on Cloud Run it is an in-memory
# tmpfs unless you mount a volume over it — see DEPLOY.md, this is the single
# most important thing to get right before a real demo.
RUN useradd --create-home --uid 1000 docflow \
    && mkdir -p /data \
    && chown -R docflow:docflow /data /app
USER docflow

EXPOSE 8080

# Local `docker run` convenience; Cloud Run uses its own probes and ignores this.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT','8080') + '/healthz').read()"

CMD ["python", "server/app.py"]
