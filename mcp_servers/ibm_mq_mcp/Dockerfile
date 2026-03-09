FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install uv (Astral) in the runtime image.
COPY --from=ghcr.io/astral-sh/uv:0.9.1 /uv /uvx /bin/

# Install project dependencies from pyproject.toml.
COPY pyproject.toml README.md /app/
RUN uv sync --no-dev --no-install-project

COPY mqmcpserver.py /app/mqmcpserver.py

EXPOSE 8000

CMD ["uv", "run", "mqmcpserver.py"]
