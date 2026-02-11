@echo off
echo Starting MNEMOS in Default Mode (GPU Enabled)...

:: Check if any .gguf model exists
dir /b models\*.gguf >nul 2>&1
if %errorlevel%==0 (
    echo Model detected. Starting with llamacpp...
    docker-compose -f docker-compose.yml --profile llamacpp up --build -d --wait
) else (
    echo No model found. Starting without llamacpp. Visit Settings to download a model.
    docker-compose -f docker-compose.yml up --build -d --wait
)

echo Opening browser...
start http://localhost:5200

:: Show logs
docker-compose -f docker-compose.yml logs -f
