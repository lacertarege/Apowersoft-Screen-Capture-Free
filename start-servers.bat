@echo off
echo ========================================
echo   INICIANDO SERVIDORES DE INVERSIONES
echo ========================================

echo.
echo [1/3] Verificando directorios...
if not exist "backend\src\server.js" (
    echo ERROR: No se encuentra backend\src\server.js
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo ERROR: No se encuentra frontend\package.json
    pause
    exit /b 1
)

echo [2/3] Iniciando Backend (puerto 3001)...
start "Backend - Investing" cmd /k "cd /d %~dp0backend && node src/server.js"

echo Esperando 3 segundos para que el backend se inicie...
timeout /t 3 /nobreak >nul

echo [3/3] Iniciando Frontend (puerto 5173)...
start "Frontend - Investing" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   SERVIDORES INICIADOS
echo ========================================
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul


