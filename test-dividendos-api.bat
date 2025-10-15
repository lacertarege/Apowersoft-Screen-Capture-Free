@echo off
echo Probando API de Dividendos...
echo.

REM Iniciar backend en segundo plano
start "Backend Test" cmd /k "cd backend && node src/server.js"

echo Esperando 5 segundos...
timeout /t 5 /nobreak >nul

echo.
echo Probando endpoints...
curl http://localhost:3001/health
echo.
curl http://localhost:3001/dividendos/resumen

pause

