# 🍎 Sistema de Diseño - Apple HIG

## Guía de Componentes y Estándares

**Versión:** 3.5  
**Fecha:** 07 de Octubre de 2025  
**Basado en:** Apple Human Interface Guidelines

---

## 📐 Principios Fundamentales

### 1. Clarity (Claridad)
- Jerarquía visual clara y consistente
- Tipografía legible en todos los tamaños
- Iconos y símbolos reconocibles
- Uso apropiado del color

### 2. Deference (Deferencia)
- El contenido siempre es lo primero
- Chrome (UI) sutil y no intrusivo
- Animaciones que guían, no distraen
- Espaciado generoso

### 3. Depth (Profundidad)
- Sombras estratificadas para elevación
- Transiciones suaves entre estados
- Layers visuales claros
- Feedback visual inmediato

---

## 🎨 Sistema de Colores

### Colores Base
```css
--bg: #f5f5f7           /* Fondo principal (gris claro Apple) */
--bg-elevated: #ffffff   /* Superficies elevadas (blanco) */
--fg: #1d1d1f           /* Texto principal (negro Apple) */
--fg-secondary: #86868b  /* Texto secundario (gris medio) */
--fg-tertiary: #6e6e73   /* Texto terciario (gris claro) */
```

### Colores de Acción
```css
--primary: #007aff       /* Azul sistema iOS */
--primary-hover: #0051d5
--primary-active: #004fc4
```

### Colores de Estado
```css
--success: #34c759       /* Verde iOS */
--success-bg: #e8f8ed
--warning: #ff9500       /* Naranja iOS */
--warning-bg: #fff4e5
--danger: #ff3b30        /* Rojo iOS */
--danger-bg: #ffebea
--info: #5ac8fa         /* Azul claro iOS */
--info-bg: #e5f6fd
```

### Bordes y Separadores
```css
--border: #d2d2d7
--border-light: #e5e5ea
--separator: rgba(60, 60, 67, 0.12)
```

---

## 📏 Espaciado

### Sistema de Espaciado
```css
--space-xs: 4px
--space-sm: 8px
--space-md: 12px
--space-lg: 16px
--space-xl: 24px
--space-2xl: 32px
```

### Aplicación
- **Elementos pequeños:** xs, sm
- **Elementos medianos:** md, lg
- **Secciones grandes:** xl, 2xl

---

## 🔤 Tipografía

### Familia de Fuentes
```css
--font-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
```

### Tamaños y Pesos

#### Títulos
```css
/* H1 - Página */
font-size: 32px;
font-weight: 700;
letter-spacing: -0.03em;

/* H2 - Sección */
font-size: 28px;
font-weight: 600;
letter-spacing: -0.02em;

/* H3 - Modal/Card */
font-size: 20px;
font-weight: 600;
letter-spacing: -0.02em;

/* H4 - Subsección */
font-size: 18px;
font-weight: 600;
letter-spacing: -0.01em;
```

#### Cuerpo
```css
/* Base */
font-size: 17px;
line-height: 1.47;

/* Texto de tabla */
font-size: 15px;

/* Texto pequeño */
font-size: 14px;

/* Caption/Helper */
font-size: 13px;
```

#### Labels
```css
font-size: 13px;
font-weight: 600;
color: var(--fg-secondary);
text-transform: none;
```

---

## 🎯 Componentes

### Modales

#### Estructura Estándar
```jsx
<div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
  <div className="modal-content" style={{ maxWidth: '480px' }}>
    {/* Header */}
    <div className="modal-header">
      <h3>Título del Modal</h3>
      <button onClick={onClose} aria-label="Cerrar">×</button>
    </div>

    {/* Body */}
    <div className="modal-body">
      {/* Contenido */}
    </div>

    {/* Footer */}
    <div className="modal-footer">
      <button onClick={onClose}>Cancelar</button>
      <button className="btn-primary">Guardar</button>
    </div>
  </div>
</div>
```

#### Especificaciones
- **Max-width:** 480px (formularios), 540px (búsqueda), 600px (informativo)
- **Header:** Sticky, border-bottom con separator
- **Body:** Scroll independiente, padding xl
- **Footer:** Sticky, border-top con separator
- **Backdrop:** rgba(0,0,0,0.5) con blur(8px)
- **Animación:** fadeIn (250ms) + slideUp (350ms)

#### Botón de Cerrar
```jsx
<button 
  onClick={onClose}
  style={{
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    color: 'var(--fg-secondary)',
    transition: 'all var(--transition-fast)'
  }}
  onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.06)'}
  onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
  aria-label="Cerrar"
>
  ×
</button>
```

---

### Botones

#### Botón Principal (Primary)
```css
background: var(--primary);
color: white;
padding: 12px 20px;
border-radius: 12px;
font-size: 15px;
font-weight: 600;
min-width: 100px;
box-shadow: var(--shadow-sm);
```

#### Botón Secundario
```css
background: var(--bg-elevated);
color: var(--fg);
border: 1px solid var(--border);
padding: 12px 20px;
border-radius: 12px;
```

#### Estados
- **Hover:** Cambio de color + sombra
- **Active:** scale(0.98)
- **Disabled:** opacity: 0.4
- **Focus:** outline azul (accesibilidad)

---

### Inputs y Forms

#### Input Estándar
```css
padding: 12px 16px;
border: 1px solid var(--border);
border-radius: 12px;
font-size: 15px;
background: var(--bg-elevated);
```

#### Estados
- **Hover:** border-color: var(--fg-tertiary)
- **Focus:** border-color: var(--primary) + box-shadow
- **Disabled:** background: var(--bg), opacity: 0.6
- **Error:** border-color: var(--danger)

#### Select
```jsx
<select>
  <option value="USD">🇺🇸 Dólar (USD)</option>
  <option value="PEN">🇵🇪 Sol (PEN)</option>
</select>
```
*Nota: Usar emojis de banderas para monedas*

---

### Grid Layouts

#### Grid 1fr 2fr (Símbolo + Nombre)
```jsx
<div style={{ 
  display: 'grid', 
  gridTemplateColumns: '1fr 2fr',
  gap: 'var(--space-md)' 
}}>
  <input placeholder="AAPL" />
  <input placeholder="Apple Inc." />
</div>
```

#### Grid 1fr 1fr (Igual peso)
```jsx
<div style={{ 
  display: 'grid', 
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-md)' 
}}>
  <select>...</select>
  <select>...</select>
</div>
```

---

### Cards y Contenedores

#### Card Estándar
```css
background: var(--bg-elevated);
border: 1px solid var(--border-light);
border-radius: 16px;
padding: 24px;
box-shadow: var(--shadow);
```

#### Card Informativo
```jsx
<div style={{
  padding: 'var(--space-md) var(--space-lg)',
  background: 'var(--bg)',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-light)'
}}>
  <div style={{ 
    fontSize: '13px', 
    color: 'var(--fg-secondary)',
    fontWeight: 600 
  }}>
    Label
  </div>
  <div style={{ 
    fontSize: '20px', 
    fontWeight: 600,
    color: 'var(--fg)'
  }}>
    Valor
  </div>
</div>
```

#### Card de Estado (Success/Error/Info)
```jsx
<div style={{
  padding: 'var(--space-md) var(--space-lg)',
  background: 'var(--success-bg)',
  borderRadius: 'var(--radius)',
  border: '1px solid rgba(52, 199, 89, 0.3)',
  display: 'flex',
  gap: 'var(--space-md)'
}}>
  <span>✓</span>
  <p>Mensaje de éxito</p>
</div>
```

---

### Tablas

#### Estructura
```css
/* Table */
background: var(--bg-elevated);
border: 1px solid var(--border-light);
border-radius: 16px;
overflow: hidden;

/* Headers */
background: var(--bg);
font-size: 13px;
font-weight: 600;
color: var(--fg-secondary);
text-transform: uppercase;
letter-spacing: 0.06em;
padding: 12px 16px;

/* Celdas */
font-size: 15px;
padding: 12px 16px;
border-bottom: 1px solid var(--border-light);

/* Hover */
tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

/* Zebra striping */
tbody tr:nth-child(even) {
  background: rgba(0, 0, 0, 0.01);
}
```

---

## ✨ Animaciones

### Timing Functions
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition: 250ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Keyframes

#### FadeIn
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

#### SlideUp
```css
@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

#### Spin (Loading)
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 🎭 Estados y Feedback

### Loading Spinner
```jsx
<div className="loading" style={{ width: '20px', height: '20px' }}></div>
```

### Status Badges
```jsx
<span className="badge badge-success">OK</span>
<span className="badge badge-danger">Error</span>
<span className="badge badge-warning">Pendiente</span>
```

### Status Dots
```jsx
<span style={{
  width: '10px',
  height: '10px',
  background: 'var(--success)',
  borderRadius: '50%',
  display: 'inline-block'
}}></span>
```

---

## 🔍 Búsqueda y Autocomplete

### Estructura
```jsx
<div style={{ position: 'relative' }}>
  <input 
    placeholder="Buscar..." 
    autoFocus
  />
  {isSearching && (
    <div style={{ position: 'absolute', right: '16px', top: '50%' }}>
      <div className="loading"></div>
    </div>
  )}
  {/* Resultados */}
  <div style={{
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    animation: 'slideUp 200ms ease-out'
  }}>
    {/* Items */}
  </div>
</div>
```

---

## 📱 Responsive

### Breakpoints
```css
/* Mobile */
@media (max-width: 768px) {
  .container { padding: 16px; }
  h1 { font-size: 28px; }
  h2 { font-size: 24px; }
}
```

---

## ♿ Accesibilidad

### Checklist
- [ ] Contraste WCAG AA (mínimo 4.5:1)
- [ ] Focus visible en todos los elementos interactivos
- [ ] Labels descriptivos en formularios
- [ ] aria-label en botones sin texto
- [ ] Tamaños táctiles mínimos (44x44px)
- [ ] AutoFocus en campos principales
- [ ] Escape para cerrar modales
- [ ] Tab navigation funcional

---

## 🎯 Patrones Comunes

### Header con Subtítulo
```jsx
<div className="modal-header">
  <div>
    <h3>Título Principal</h3>
    <p style={{ 
      fontSize: '14px', 
      color: 'var(--fg-secondary)',
      fontWeight: 500
    }}>
      Subtítulo o contexto
    </p>
  </div>
  <button onClick={onClose}>×</button>
</div>
```

### Separador Visual
```jsx
<div style={{ 
  height: '1px', 
  background: 'var(--separator)', 
  margin: 'var(--space-2xl) 0' 
}}></div>
```

### Valor Calculado Destacado
```jsx
<div style={{
  padding: 'var(--space-md) var(--space-lg)',
  background: 'var(--bg)',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-light)'
}}>
  <div style={{ 
    fontSize: '13px', 
    color: 'var(--fg-secondary)',
    fontWeight: 600
  }}>
    Precio de apertura
  </div>
  <div style={{ 
    fontSize: '20px', 
    fontWeight: 600,
    color: 'var(--fg)',
    fontVariantNumeric: 'tabular-nums'
  }}>
    $ 150.25
  </div>
</div>
```

---

## 📦 Componentes Renovados

### ✅ Completos (Apple HIG Compliant)
1. **TickerModal** - Nueva Empresa
2. **NuevaInversionModal** - Nueva Inversión
3. **EditarInversionModal** - Editar Inversión
4. **EditTickerModal** - Editar Empresa
5. **RefreshModal** - Actualización de Precios

### Características Comunes
- ✓ Header/Body/Footer estructura
- ✓ Botón × con hover effect
- ✓ Click outside para cerrar
- ✓ AutoFocus en campo principal
- ✓ Grid layouts inteligentes
- ✓ Emojis de banderas en monedas
- ✓ Cards informativos con valores destacados
- ✓ Separadores visuales
- ✓ Padding y spacing consistente
- ✓ Tipografía Apple HIG

---

## 🚀 Mejores Prácticas

### DO ✅
- Usar variables CSS para todos los valores
- Aplicar letter-spacing negativo en títulos grandes
- Incluir emojis para reconocimiento rápido
- Usar grid layout para campos relacionados
- Agregar separadores entre secciones
- Incluir helper text descriptivo
- Aplicar autoFocus en campo principal
- Usar fontVariantNumeric para números
- Incluir estados hover/focus/active
- Proporcionar feedback visual inmediato

### DON'T ❌
- No usar colores hardcodeados
- No usar text-transform uppercase en labels
- No amontonar campos sin espaciado
- No olvidar estados disabled
- No ignorar accesibilidad
- No usar animaciones muy largas (>400ms)
- No usar sombras muy fuertes
- No ignorar estados de error
- No olvidar min-width en botones
- No usar placeholders como labels

---

## 📚 Referencias

- [Apple HIG - Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- [Apple HIG - Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple HIG - Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple HIG - Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Mantenimiento:** Este sistema de diseño debe actualizarse cada vez que se agreguen nuevos componentes o patrones.

**Versión:** 3.5  
**Última actualización:** 07/10/2025  
**Status:** ✅ Implementado y Documentado



