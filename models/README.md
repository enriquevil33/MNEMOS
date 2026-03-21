# GGUF Models Directory

This directory stores your GGUF quantized models for llama.cpp.

## Quick Start

1. Download a GGUF model file (e.g., from Hugging Face)
2. Place it in this directory as `model.gguf` (or update the docker-compose.yml command)
3. Start the services: `docker compose up`

## Updating llama.cpp

llama.cpp uses a rolling release model. To get the latest version:

```bash
docker compose pull llamacpp  # Pull latest image
docker compose up -d          # Restart with new version
```

The `pull_policy: always` in docker-compose.yml ensures you get the latest when rebuilding.

## Example Models

Popular GGUF models you can download:

- **Llama 3.1 8B**: `huggingface-cli download meta-llama/Llama-3.1-8B-GGUF`
- **Qwen 2.5 7B**: `huggingface-cli download Qwen/Qwen2.5-7B-Instruct-GGUF`
- **Mistral 7B**: `huggingface-cli download TheBloke/Mistral-7B-Instruct-v0.2-GGUF`

## Model Naming

The default configuration expects `model.gguf`. To use a different file:

Edit the `llamacpp` service in `docker-compose.yml`:

```yaml
command: >
  --port 8080
  --host 0.0.0.0
  -m /models/your-model-name.gguf
  -ngl 999
  -c 2048
```

## Parameters Explained

- `-m`: Path to model file
- `-ngl 999`: GPU layers (999 = load all layers to GPU)
- `-c 2048`: Context size (adjust based on VRAM)
- `--port 8080`: API server port
- `--host 0.0.0.0`: Listen on all interfaces

## Downloading Models

### Using Hugging Face CLI

```bash
pip install huggingface-hub
huggingface-cli download TheBloke/Mistral-7B-Instruct-v0.2-GGUF mistral-7b-instruct-v0.2.Q4_K_M.gguf --local-dir ./models --local-dir-use-symlinks False
```

### Manual Download

1. Visit Hugging Face model pages (search for "GGUF")
2. Download the `.gguf` file directly
3. Move to this `models/` directory
4. Rename to `model.gguf` or update docker-compose.yml

## Recommended Quantization Levels

- **Q4_K_M**: Good balance (recommended for most use cases)
- **Q5_K_M**: Better quality, slightly larger
- **Q8_0**: High quality, larger file size
- **Q4_0**: Smallest, lower quality

## Troubleshooting

### Out of Memory
Reduce context size in docker-compose.yml: `-c 1024` or `-c 512`

### Model Not Found
Ensure the file path in docker-compose.yml matches your actual file name

### No GPU Acceleration
Check NVIDIA drivers and docker GPU support:
```bash
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```
