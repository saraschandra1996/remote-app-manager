FROM python:3.11-slim

# Install system dependencies required for cryptography & kerberos build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libkrb5-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set Python path so 'from app.x import y' works everywhere
ENV PYTHONPATH=/app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data

EXPOSE 5000
