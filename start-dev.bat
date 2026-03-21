@echo off
echo Starting MNEMOS in Dev Mode (Hot Reload)...
echo.

:: --- AUTO CLEANUP ORPHANED IMAGES ---
echo Cleaning up orphaned images...
docker image prune -f >nul 2>&1
echo Cleaning up old unused images (keeps running containers)...
docker image prune -a -f --filter "until=168h" >nul 2>&1
:: -------------------------------------

:: --- SMART BUILD LOGIC ---
echo Checking for dependency changes...
powershell -Command "$last = Get-Item .last_build_dev -ErrorAction SilentlyContinue; $files = @('requirements.txt', 'Dockerfile', 'docker-compose.yml', 'docker-compose.dev.yml'); $newest = $files | ForEach-Object { Get-Item $_ -ErrorAction SilentlyContinue } | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if (-not $last -or ($newest.LastWriteTime -gt $last.LastWriteTime)) { exit 1 } else { exit 0 }"

if %errorlevel%==1 (
    echo [SMART BUILD] Changes detected. Rebuilding backend...
    set DOCKER_ARGS=up --no-deps --build
    type nul > .last_build_dev
) else (
    echo [SMART BUILD] No changes detected. Fast start...
    set DOCKER_ARGS=up --no-deps
)
:: -------------------------

echo Starting backend containers...
docker-compose -f docker-compose.yml %DOCKER_ARGS% app worker llamacpp mcp db redis adminer -d

echo Waiting for backend to be ready (15s)...
timeout /t 15 /nobreak >nul

echo Starting Angular dev server in new window...
cd frontend_spa
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
start "Angular Dev Server" cmd /k "npx ng serve -o --port 5200"
cd ..

echo Showing backend logs (Ctrl+C to stop)...
docker-compose -f docker-compose.yml logs -f app worker llamacpp
