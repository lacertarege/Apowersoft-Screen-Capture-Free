@echo off
echo ========================================
echo   ACTUALIZANDO BASE DE DATOS EN DOCKER
echo ========================================

echo.
echo [1/4] Deteniendo contenedores...
docker-compose down

echo.
echo [2/4] Verificando base de datos local...
if exist "backend\data\investments.db" (
    echo Base de datos encontrada: backend\data\investments.db
    
    REM Crear backup antes de actualizar
    echo Creando backup de seguridad...
    copy "backend\data\investments.db" "backups\investments-backup-pre-update-%date:~-4,4%%date:~-7,2%%date:~-10,2%-%time:~0,2%%time:~3,2%%time:~6,2%.db"
    
    REM Eliminar archivos WAL
    if exist "backend\data\investments.db-wal" (
        echo Eliminando archivo WAL...
        del "backend\data\investments.db-wal"
    )
    
    if exist "backend\data\investments.db-shm" (
        echo Eliminando archivo SHM...
        del "backend\data\investments.db-shm"
    )
) else (
    echo ERROR: No se encuentra backend\data\investments.db
    pause
    exit /b 1
)

echo.
echo [3/4] Verificando datos en la base de datos...
cd backend
node -e "import('./src/setup/db.js').then(async (db) => { const { createDb } = db; const database = createDb('./data/investments.db'); const count = database.prepare('SELECT COUNT(*) as count FROM tipos_cambio').get(); console.log('Total registros en tipos_cambio:', count.count); const sample = database.prepare('SELECT * FROM tipos_cambio ORDER BY fecha DESC LIMIT 3').all(); console.log('Ultimos 3 registros:'); sample.forEach(r => console.log('  ' + r.fecha + ': ' + r.usd_pen + ' (' + r.fuente_api + ')')); database.close(); })"
cd ..

echo.
echo [4/4] Iniciando contenedores con base de datos actualizada...
docker-compose up -d

echo.
echo Esperando 5 segundos para que el backend se inicie...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   ACTUALIZACION COMPLETADA
echo ========================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost
echo.
echo Presiona cualquier tecla para salir...
pause >nul

