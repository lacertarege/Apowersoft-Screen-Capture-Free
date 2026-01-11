# Guía de Scripts del Repositorio

## Política de Sincronización Git

Este documento explica qué scripts se sincronizan a GitHub y cuáles permanecen solo en el entorno local.

---

## ✅ Scripts Sincronizados (Parte del Sistema)

Estos scripts son **esenciales** para el funcionamiento del sistema o documentación y se mantienen en Git:

### Migraciones de Base de Datos (`backend/src/db/migrations/`)
- `create_benchmark_cache.js` - Tabla de caché de benchmarks
- `add_strategic_indexes.js` - Índices optimizados
- `add_tipo_operacion.js` - Columna tipo_operacion
- `add_origen_capital.js` - Columna origen_capital

**Razón:** Son cambios estructurales críticos del schema.

### Jobs Programados (`backend/src/jobs/`)
- `updatePortfolioEvolution.js` - Calcula evolución diaria
- `updateDailyPrices.js` - Actualiza precios
- `updateBenchmarks.js` - Actualiza caché de benchmarks
- `backfillFx.js` - Llena tipos de cambio
- `backfillHistoricalPrices.js` - Llena precios históricos

**Razón:** Son parte del funcionamiento automático del sistema.

### Repositorios y Servicios (`backend/src/`)
- Todos los archivos en `repositories/`, `services/`, `routes/`, `sources/`

**Razón:** Código core de la aplicación.

---

## ❌ Scripts NO Sincronizados (Utilidad Temporal)

Estos scripts son para **uso local puntual** y están excluidos del repositorio vía `.gitignore`:

### Scripts de Testing
- `test-*.js` - Scripts de pruebas ad-hoc
- `test_*.js` - Variantes de testing
- `debug-*.js` - Scripts de debugging

**Ejemplos:**
- `test-evolucion.js`
- `test-server.js`
- `debug-date.js`
- `debug-server.js`

### Scripts de Verificación
- `check_*.js` - Verificaciones puntuales
- `verify*.js` - Validaciones temporales

**Ejemplos:**
- `check_dates.js`
- `check_pml.js`
- `verify_pml_update.js`
- `verify-security.js`

### Scripts de Query Ad-hoc
- `query*.js` - Consultas específicas

**Ejemplos:**
- `query-ccliqsoles.js`
- `query_panoro.js`

### Scripts de Vinculación/Actualización
- `vincular*.js` - Vinculación puntual de datos
- `update_*_ticker.js` - Actualizaciones específicas de tickers

**Ejemplos:**
- `vincular_aihc1.js`
- `vincular_rpj_codes.js`
- `update_pml_ticker.js`
- `update_inref_ticker.js`

### Scripts de Limpieza/Mantenimiento
- `clean_*.js` - Limpieza temporal
- `drop-*.js` - Eliminación de datos
- `merge-*.js` - Fusión de bases de datos

**Ejemplos:**
- `clean_pml_yahoo_prices.js`
- `drop-presupuesto.js`
- `merge-databases.js`

### Scripts de Búsqueda/Exploración
- `buscar_*.js` - Búsquedas puntuales
- `find_*.js` - Localización de datos

**Ejemplos:**
- `buscar_rpj_en_json.js`
- `find_div_ticker.js`

### Scripts de Reemplazo/Modificación
- `replace-*.js` - Reemplazos temporales
- `REPLACEMENT_*.js` - Endpoints de reemplazo

**Ejemplos:**
- `replace-endpoint.js`
- `REPLACEMENT_SYNC_ENDPOINT.js`

### Scripts Misceláneos
- `start-safe.js` - Inicio en modo seguro
- `recalculate-realized-gains.js` - Recálculo puntual
- `*-safe.js` - Variantes "safe"

---

## 📝 Reglas del `.gitignore`

```gitignore
# Scripts temporales y de utilidad puntual (no sincronizar)
backend/test-*.js
backend/debug-*.js
backend/check_*.js
backend/verify*.js
backend/query*.js
backend/vincular*.js
backend/update_*_ticker.js
backend/clean_*.js
backend/buscar_*.js
backend/find_*.js
backend/drop-*.js
backend/start-safe.js
backend/merge-databases.js
backend/replace-endpoint.js
backend/REPLACEMENT_*.js
backend/*-safe.js
```

---

## 🤔 ¿Cuándo crear un script temporal vs permanente?

### Script Temporal (NO sincronizar)
Úsalo cuando:
- ✅ Resuelve un problema específico ONE-TIME
- ✅ Debugging local
- ✅ Consulta exploratoria de datos
- ✅ Corrección puntual de un ticker
- ✅ No es parte del flujo normal del sistema

**Ejemplo:** `vincular_aihc1.js` para vincular un ticker específico con datos BVL.

### Script Permanente (SÍ sincronizar)
Úsalo cuando:
- ✅ Es una migración de schema
- ✅ Es un job programado que se ejecuta automáticamente
- ✅ Es parte de la infraestructura del sistema
- ✅ Otros desarrolladores necesitarán ejecutarlo

**Ejemplo:** `updateBenchmarks.js` es un job que se ejecuta diariamente a las 3 AM.

---

## 🔧 Limpieza del Repositorio

Si tienes scripts temporales ya sincronizados en Git, puedes limpiarlos:

```bash
# Ver scripts que ya están en Git pero ahora son ignorados
git ls-files -c -i --exclude-standard backend/*.js

# Eliminarlos del índice de Git (no del disco)
git rm --cached backend/test-*.js
git rm --cached backend/debug-*.js
git rm --cached backend/check_*.js
# ... etc

# Commit la limpieza
git commit -m "chore: remove temporary utility scripts from repository"
```

**Nota:** Los archivos permanecerán en tu disco local, solo dejarán de sincronizarse.

---

## 📦 Estado Actual

Después de la última actualización del `.gitignore`:

**Scripts en Git que DEBERÍAN limpiarse:**
- `recalculate-realized-gains.js` (aparece como `??` - nuevo archivo no trackeado)

**Scripts modificados que SÍ se sincronizan (correcto):**
- `dashboard.js`, `tickers.js`, `marketData.js` (código core)
- `server.js`, `InvestmentService.js` (infraestructura)
- Migraciones y jobs nuevos (esenciales)

---

## 💡 Buenas Prácticas

1. **Antes de crear un script:** Pregúntate si será ONE-TIME o RECURRENTE
2. **Nombra scripts temporales:** Usa prefijos como `test-`, `debug-`, `check-`, `fix-`
3. **Documenta scripts permanentes:** Agrega comentarios explicando su propósito
4. **Limpia periódicamente:** Elimina scripts temporales obsoletos de tu disco
5. **Revisa el .gitignore:** Asegúrate que nuevos patrones se agreguen si es necesario

---

## 🚨 Advertencia de Seguridad

**NUNCA sincronices scripts que contengan:**
- ❌ Contraseñas o API keys hardcodeadas
- ❌ Datos financieros sensibles
- ❌ Información personal de usuarios
- ❌ Tokens de autenticación

Si accidentalmente subiste un script con credenciales:
1. Rotar inmediatamente las credenciales
2. Eliminar el archivo del historial de Git (git filter-branch o BFG)
3. Force push (si estás solo en el repo) o notificar a colaboradores
