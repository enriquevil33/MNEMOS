@echo off
echo Starting MNEMOS in Dev Mode (Hot Reload)...
echo Starting backend containers...
docker volume create ollama_models >nul 2>&1
docker-compose -f docker-compose.yml up --no-deps --build app worker ollama mcp db redis adminer -d

echo Waiting for backend to be ready...
timeout /t 15 /nobreak >nul

echo Starting Angular dev server...
cd frontend_spa
start "" cmd /c "ng serve -o --port 5200"
cd ..

echo Dev server starting at http://localhost:5200
pause
