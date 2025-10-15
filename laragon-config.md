# Configuración del Proyecto Investing

## Opciones de Ejecución

Este proyecto puede ejecutarse de dos maneras:

1. **🐳 Docker** (Recomendado) - Usa la base de datos completa con datos históricos
2. **🏠 Laragon** - Para desarrollo local

## Requisitos Previos

### Para Docker (Recomendado):
1. **Docker Desktop** instalado y ejecutándose
2. **Git** (opcional)

### Para Laragon:
1. **Laragon** instalado en `C:\laragon`
2. **Node.js** (versión 18 o superior)
3. **Git** (opcional)

## Inicio Rápido

### Opción 1: Script Principal (Más Fácil)

Ejecuta `iniciar-aplicacion.bat` y selecciona tu opción preferida.

### Opción 2: Docker (Recomendado)

```bash
# Ejecuta este script para iniciar con Docker
start-docker.bat
```

El script automáticamente:
- Verifica que Docker esté instalado y ejecutándose
- Construye las imágenes de Docker
- Restaura la base de datos desde el respaldo más reciente
- Inicia los contenedores

**URLs con Docker:**
- Frontend: http://localhost
- Backend: http://localhost:3001

### Opción 3: Laragon (Desarrollo Local)

```bash
# Configuración inicial
setup-laragon.bat

# Iniciar aplicación
start-investing.bat
```

### Opción 4: Instalación Manual

Si prefieres hacer la instalación manualmente:

```bash
# 1. Copiar proyecto a Laragon
robocopy "C:\ruta\a\tu\proyecto" "C:\laragon\www\Investing" /E /XD node_modules .git

# 2. Instalar dependencias del backend
cd C:\laragon\www\Investing\backend
npm install

# 3. Instalar dependencias del frontend
cd ..\frontend
npm install

# 4. Configurar variables de entorno
cd ..\backend
copy .env.example .env
```

## Configuración de Variables de Entorno

Edita el archivo `backend\.env` con tus claves de API:

```env
NODE_ENV=development
PORT=3001
DB_PATH=./data/investments.db
ALPHAVANTAGE_KEY=tu_clave_alpha_vantage_aqui
POLYGON_KEY=tu_clave_polygon_aqui
TZ=America/Lima
```

### Obtener Claves de API

1. **Alpha Vantage**: https://www.alphavantage.co/support/#api-key
2. **Polygon.io**: https://polygon.io/dashboard

## Iniciar la Aplicación

### Método 1: Script de Inicio
Ejecuta `start-investing.bat` en la carpeta del proyecto.

### Método 2: Manual
1. Abre Laragon y haz clic en "Start All"
2. Abre dos terminales en `C:\laragon\www\Investing`:
   - Terminal 1: `cd backend && npm run dev`
   - Terminal 2: `cd frontend && npm run dev`

## URLs de Acceso

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Base de datos**: `backend\data\investments.db`

## Estructura del Proyecto en Laragon

```
C:\laragon\www\Investing\
├── backend/                 # Servidor Node.js
│   ├── src/                # Código fuente
│   ├── data/               # Base de datos SQLite
│   ├── package.json        # Dependencias backend
│   └── .env               # Variables de entorno
├── frontend/               # Aplicación React
│   ├── src/               # Código fuente React
│   ├── package.json       # Dependencias frontend
│   └── vite.config.js     # Configuración Vite
├── backups/               # Respaldos automáticos
├── setup-laragon.bat      # Script de instalación
└── start-investing.bat    # Script de inicio
```

## Comandos Útiles

```bash
# Iniciar solo el backend
cd backend && npm run dev

# Iniciar solo el frontend
cd frontend && npm run dev

# Ejecutar migraciones de base de datos
cd backend && npm run migrate

# Crear respaldo de la base de datos
cd backend && npm run backup

# Importar datos históricos
cd backend && npm run import:bvn:last-month
```

## Solución de Problemas

### Error: Puerto en uso
```bash
# Cambiar puerto en backend\.env
PORT=3002
```

### Error: Base de datos no encontrada
```bash
# Ejecutar migración
cd backend && npm run migrate && npm run seed
```

### Error: Dependencias no instaladas
```bash
# Reinstalar dependencias
cd backend && npm install
cd ..\frontend && npm install
```

### Error: Permisos en Windows
- Ejecuta el script como administrador
- Verifica que Laragon tenga permisos de escritura

## Configuración Avanzada

### Configurar Proxy en Laragon
1. Abre Laragon
2. Ve a Menu > Apache > Sites > Create
3. Crea un sitio para `investing.local`
4. Configura el proxy para el backend

### Configurar SSL
1. Usa el certificado SSL de Laragon
2. Accede via https://investing.local

## Respaldos Automáticos

El sistema crea respaldos automáticos en la carpeta `backups/`:
- Diario a las 2:00 AM
- Antes de migraciones importantes
- Respaldos manuales con `npm run backup`

## Desarrollo

Para desarrollo activo:
1. Usa `npm run dev` en ambas carpetas
2. Los cambios se recargan automáticamente
3. La base de datos se actualiza en tiempo real
4. Los logs se guardan en `backend/logs/`
