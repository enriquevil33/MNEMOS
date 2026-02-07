@echo off
echo Starting MNEMOS in CPU Mode...
docker volume create ollama_models >nul 2>&1

echo Starting containers...
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up --build -d --wait

echo Opening browser...
start http://localhost:5200

:: Show logs
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml logs -f
