# Solución de Problemas - Aplicación de Inversiones

## 🔧 Problemas Solucionados

### 1. **Dependencias Conflictivas de SQLite**
- ❌ **Problema**: `package.json` tenía tanto `better-sqlite3` como `sqlite3`
- ✅ **Solución**: Eliminé `sqlite3` y mantuve solo `better-sqlite3`
- ✅ **Mejora**: Actualicé el Dockerfile para instalar dependencias de compilación

### 2. **Configuración del Servidor**
- ❌ **Problema**: Uso de `await` en nivel superior sin función async
- ✅ **Solución**: Envolvió el código en función `startServer()` async
- ✅ **Mejora**: Agregué logging detallado para debugging

### 3. **Configuración CORS**
- ❌ **Problema**: CORS demasiado permisivo (`*`)
- ✅ **Solución**: Configuré CORS específico para localhost
- ✅ **Mejora**: Agregué middleware de logging para requests

### 4. **Cálculos de Rendimiento y Rentabilidad**
- ❌ **Problema**: Cálculos duplicados y inconsistentes en frontend
- ✅ **Solución**: Simplifiqué para usar valores de la base de datos
- ✅ **Mejora**: Mejoré la vista SQL con `COALESCE` y `ROUND`

### 5. **Manejo de Errores**
- ❌ **Problema**: Manejo de errores inconsistente
- ✅ **Solución**: Agregué verificación de conexión y mensajes claros
- ✅ **Mejora**: Timeout en APIs externas y mejor logging

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Con Docker (Recomendado)
```bash
# Iniciar todo el stack
docker-compose up --build

# En modo detached
docker-compose up -d --build
```

### Opción 2: Desarrollo Manual
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm install
npm run dev
```

## 🔍 Scripts de Verificación

### Verificar Conexión
```bash
node test-connection.js
```
- Prueba conexión a base de datos
- Verifica APIs externas (Polygon, Alpha Vantage, Yahoo)
- Comprueba comunicación frontend-backend

### Verificar Integridad de Datos
```bash
node verify-data-integrity.js
```
- Verifica estructura de tablas
- Comprueba integridad referencial
- Valida cálculos de rendimiento y rentabilidad

### Iniciar con Verificaciones
```bash
node start-app.js
```
- Verifica archivos necesarios
- Crea directorios si no existen
- Ofrece opciones de inicio

## 📊 Estructura de Datos Protegida

### Base de Datos
- **Ubicación**: `./data/investments.db`
- **Backup**: `./backups/investments-backup-*.db`
- **Modo**: WAL (Write-Ahead Logging) para mejor rendimiento
- **Claves Foráneas**: Habilitadas para integridad

### Tablas Principales
1. **tickers**: Símbolos de inversión
2. **inversiones**: Compras realizadas
3. **precios_historicos**: Precios por fecha
4. **tipos_cambio**: USD/PEN por fecha
5. **tipos_inversion**: Categorías (Acciones, ETFs, etc.)

### Vista de Resumen
- **v_resumen_empresas**: Agregados calculados automáticamente
- **Cálculos**: Balance, Rendimiento, Rentabilidad
- **Precisión**: Redondeo a 2-4 decimales según necesidad

## 🛡️ Protección de Datos

### Medidas Implementadas
1. **Backup Automático**: Scripts de respaldo en `backend/src/db/backup.js`
2. **Transacciones**: Uso de prepared statements para consistencia
3. **Validación**: Verificación de tipos y rangos en frontend y backend
4. **Logging**: Registro detallado de operaciones críticas
5. **Rollback**: Capacidad de restaurar desde backups

### Comandos de Respaldo
```bash
# Crear backup
cd backend && npm run backup

# Restaurar desde backup (manual)
cp ./backups/investments-backup-YYYYMMDD-HHMMSS.db ./data/investments.db
```

## 🔧 Configuración de APIs Externas

### Variables de Entorno Requeridas
```bash
# Backend (.env)
ALPHAVANTAGE_KEY=tu_clave_alpha_vantage
POLYGON_KEY=tu_clave_polygon
TZ=America/Lima
DB_PATH=./data/investments.db
```

### APIs Configuradas
1. **Polygon.io**: Precios en tiempo real y históricos
2. **Alpha Vantage**: Fallback para precios y búsqueda
3. **Yahoo Finance**: Fallback gratuito sin API key
4. **Decolecta**: Tipo de cambio USD/PEN
5. **Frankfurter**: Fallback para tipo de cambio

## 📈 Cálculos Verificados

### Rendimiento
```
Rendimiento = (Cantidad × Precio_Actual) - Importe_Invertido
```

### Rentabilidad
```
Rentabilidad = Rendimiento / Importe_Invertido
```

### Balance
```
Balance = Cantidad × Precio_Actual
```

## 🚨 Solución de Problemas Comunes

### Backend no inicia
1. Verificar que el puerto 3001 esté libre
2. Comprobar que `better-sqlite3` se instaló correctamente
3. Ejecutar `node test-connection.js` para diagnóstico

### Frontend no conecta
1. Verificar que el backend esté ejecutándose
2. Comprobar la URL en `frontend/src/ui/config.js`
3. Revisar la consola del navegador para errores CORS

### Datos no se muestran
1. Ejecutar `node verify-data-integrity.js`
2. Verificar que las migraciones se ejecutaron
3. Comprobar que hay datos en las tablas

### Cálculos incorrectos
1. La vista `v_resumen_empresas` se recalcula automáticamente
2. Verificar que los precios históricos estén actualizados
3. Comprobar que las inversiones tengan fechas válidas

## 📞 Soporte

Si encuentras problemas:
1. Ejecuta los scripts de verificación
2. Revisa los logs del backend
3. Verifica la consola del navegador
4. Comprueba la integridad de la base de datos

**¡Los datos están protegidos y la aplicación está lista para usar!** 🎉

