# NEXORA AI - Production LangGraph Multi-Agent Backend Container
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Install project dependencies
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-install-project

# Copy application source code
COPY langgraph.json ./
COPY agents/ ./agents/
COPY utils/ ./utils/
COPY notebooks/ ./notebooks/
COPY mcp/ ./mcp/

# Expose LangGraph server port
EXPOSE 2024
ENV PORT=2024
ENV HOST=0.0.0.0

# Start LangGraph server with all 9 registered graphs
CMD ["uv", "run", "langgraph", "dev", "--host", "0.0.0.0", "--port", "2024"]
