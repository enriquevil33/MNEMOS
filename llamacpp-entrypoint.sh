#!/bin/bash
set -e

# Directory where models are mounted
MODELS_DIR="/models"

# Check if a specific model path is set in environment
if [ -n "$LLAMACPP_MODEL_PATH" ] && [ -f "$LLAMACPP_MODEL_PATH" ]; then
    MODEL_PATH="$LLAMACPP_MODEL_PATH"
    echo "Using specified model: $MODEL_PATH"
else
    # Auto-detect first available .gguf model
    MODEL_PATH=$(find "$MODELS_DIR" -maxdepth 1 -name "*.gguf" -type f | head -n 1)

    if [ -z "$MODEL_PATH" ]; then
        echo "=========================================="
        echo "WARNING: No .gguf model files found in $MODELS_DIR"
        echo "Please download a model and place it in the models/ folder"
        echo "Recommended: SmolLM2-1.7B-Instruct-Q3_K_S.gguf"
        echo "Download from: https://huggingface.co/models?search=gguf"
        echo "=========================================="
        echo "Container will keep running. Waiting for model..."
        # Keep container alive but don't start server
        tail -f /dev/null
        exit 0
    fi

    echo "Auto-detected model: $MODEL_PATH"
fi

# Get context size from environment or use default
CONTEXT_SIZE=${LLAMACPP_NUM_CTX:-16384}

# Start llama.cpp server with the detected model
echo "Starting llama.cpp server..."
echo "  Model: $MODEL_PATH"
echo "  Context size: $CONTEXT_SIZE"
echo "  Port: 8080"

exec /app/llama-server \
    --port 8080 \
    --host 0.0.0.0 \
    -m "$MODEL_PATH" \
    -ngl 999 \
    -c "$CONTEXT_SIZE"
