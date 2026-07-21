FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app

# All environment variables in one layer
ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_NO_PROGRESS=1 \
    PYTHONUNBUFFERED=1 \
    DOCKER_CONTAINER=1 \
    AWS_REGION=us-east-1 \
    AWS_DEFAULT_REGION=us-east-1



COPY src/agent_runtime/bedrock_agentcore/bedrock_agentcore_requirements.txt requirements.txt
# Install from requirements file
RUN uv pip install -r requirements.txt


# Create non-root user
RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore

EXPOSE 8080

# Copy entire project (respecting .dockerignore)     #confirm this
COPY . .   

# Use the full module path

CMD ["python", "-m", "src.agent_runtime.bedrock_agentcore.main"]
