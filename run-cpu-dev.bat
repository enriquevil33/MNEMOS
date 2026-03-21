@echo off
echo Starting MNEMOS in CPU Dev Mode (Hot Reload)...

:: --- AUTO CLEANUP ORPHANED IMAGES ---
echo Cleaning up orphaned images...
docker image prune -f >nul 2>&1
:: -------------------------------------

echo Starting backend containers...
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up --no-deps --build app worker llamacpp mcp db redis adminer -d

echo Waiting for backend to be ready...
timeout /t 15 /nobreak >nul

echo Starting Angular dev server in new window...
cd frontend_spa
start "" cmd /c "ng serve -o --port 5200"
cd ..

echo Showing backend logs (Ctrl+C to stop)...
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml logs -f app worker llamacpp
