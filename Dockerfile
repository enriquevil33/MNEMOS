# ============================================
# Stage 1: Builder (includes build tools)
# ============================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies (only needed during pip install)
RUN apt-get update && apt-get install -y \
    gcc \
    git \
    pkg-config \
    libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies to /install directory
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Pre-download Whisper base model (will be copied to runtime stage)
RUN PYTHONPATH=/install/lib/python3.11/site-packages \
    python -c "import whisper; whisper.load_model('base')"

# ============================================
# Stage 2: Runtime (slim, production-ready)
# ============================================
FROM python:3.11-slim

WORKDIR /app

# Install ONLY runtime dependencies (no build tools)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy Whisper cache from builder (avoids re-download)
COPY --from=builder /root/.cache/whisper /root/.cache/whisper

# Copy application code
COPY . .

# Add entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 5000

# Entrypoint to run migrations
ENTRYPOINT ["./entrypoint.sh"]

# Default command
CMD ["gunicorn", "-b", "0.0.0.0:5000", "-w", "1", "--timeout", "1800", "app:create_app()"]
