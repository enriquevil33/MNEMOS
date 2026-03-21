
@echo off
echo ========================================================
echo   MNEMOS Docker Cleanup
echo ========================================================
echo.
echo This script will help free up disk space by removing:
echo  - Stopped containers
echo  - Unused networks
echo  - Unused images (dangling and unreferenced)
echo  - Build cache
echo.
echo [SAFETY CHECK] This will NOT delete your database volumes.
echo.
echo Press Ctrl+C to cancel, or any key to proceed...
pause >nul

echo.
echo Running docker system prune...
docker system prune -a

echo.
echo Done! 
echo To reclaim the disk space on Windows, please follow the instructions in DOCKER_MAINTENANCE.md
echo to shrink the WSL2 virtual disk file.
echo.
pause
