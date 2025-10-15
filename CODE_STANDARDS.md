# Estándares de Código - Proyecto Inversiones

## 🚫 Prohibiciones

### 1. Logs de Depuración en Producción
- **NO** usar `console.log()` en componentes de producción
- **NO** usar `console.log()` en funciones de manejo de eventos
- **SÍ** usar `console.error()` solo para errores reales

### 2. Código Duplicado
- **NO** duplicar lógica de validación
- **NO** duplicar mensajes de error idénticos
- **NO** duplicar funciones de carga de datos
- **SÍ** usar hooks personalizados para lógica compartida

### 3. Manejo de Estados
- **NO** crear múltiples estados para la misma funcionalidad
- **NO** duplicar funciones `setLoading(true/false)`
- **SÍ** usar un solo estado de carga por componente

### 4. Validaciones
- **NO** validar lo mismo en múltiples lugares
- **NO** crear mensajes de error contradictorios
- **SÍ** centralizar validaciones en un lugar

## ✅ Buenas Prácticas

### 1. Estructura de Componentes
```javascript
// ✅ BUENO
export default function Componente({ prop1, prop2 }) {
  // 1. Estados
  const [state1, setState1] = useState(initialValue)
  
  // 2. Validaciones tempranas
  if (!prop1) return <ErrorComponent />
  
  // 3. Efectos
  useEffect(() => { /* lógica */ }, [deps])
  
  // 4. Funciones
  const handleAction = async () => { /* lógica */ }
  
  // 5. Render
  return <div>...</div>
}
```

### 2. Manejo de Errores
```javascript
// ✅ BUENO
try {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const data = await response.json()
  setData(data)
} catch (error) {
  console.error('Error específico:', error)
  setError(error.message)
} finally {
  setLoading(false)
}
```

### 3. Hooks Personalizados
```javascript
// ✅ BUENO - Centralizar lógica repetitiva
export function useApiData(url) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      setData(result.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  return { data, loading, error, fetchData }
}
```

## 🔍 Checklist de Revisión

Antes de hacer commit, verificar:

- [ ] No hay `console.log()` innecesarios
- [ ] No hay código duplicado
- [ ] No hay validaciones duplicadas
- [ ] No hay mensajes de error contradictorios
- [ ] Estados de carga son consistentes
- [ ] Manejo de errores es robusto
- [ ] Código sigue la estructura estándar

## 🛠️ Herramientas de Verificación

### 1. Buscar Logs de Depuración
```bash
grep -r "console\.log" frontend/src/
grep -r "console\.log" backend/src/
```

### 2. Buscar Código Duplicado
```bash
# Buscar patrones específicos
grep -r "Ya existe una inversión" backend/src/
grep -r "setLoading(true)" frontend/src/
```

### 3. Verificar Estructura
```bash
# Verificar que no hay validaciones duplicadas
grep -r "if.*ticker.*id" frontend/src/
```

## 📝 Notas de Implementación

- Usar ESLint para detectar código duplicado
- Implementar pre-commit hooks
- Revisar código antes de merge
- Mantener documentación actualizada
