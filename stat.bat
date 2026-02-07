@echo off
echo Starting MNEMOS with existing cache (no rebuild/download)...
docker volume create ollama_models >nul 2>&1
docker-compose -f docker-compose.yml up --no-build %*
pause
