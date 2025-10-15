@echo off
REM Script para crear backup de la base de datos
echo ========================================
echo CREANDO BACKUP DE BASE DE DATOS
echo ========================================

REM Crear directorio de backups si no existe
if not exist "backups" mkdir backups

REM Obtener fecha y hora actual
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%%MM%%DD%-%HH%%Min%%Sec%"

echo Fecha y hora: %timestamp%

REM Verificar que existe la base de datos
if not exist "backend\data\investments.db" (
    echo ERROR: No se encontro la base de datos en backend\data\investments.db
    pause
    exit /b 1
)

REM Crear backup
echo Creando backup: investments-backup-%timestamp%.db
copy "backend\data\investments.db" "backups\investments-backup-%timestamp%.db"

if %errorlevel% equ 0 (
    echo.
    echo ✅ BACKUP CREADO EXITOSAMENTE
    echo Archivo: investments-backup-%timestamp%.db
    echo Ubicacion: backups\
    
    REM Mostrar informacion del archivo
    for %%F in ("backups\investments-backup-%timestamp%.db") do (
        echo Tamaño: %%~zF bytes
        echo Fecha: %%~tF
    )
) else (
    echo.
    echo ❌ ERROR AL CREAR BACKUP
)

echo.
echo ========================================
pause



