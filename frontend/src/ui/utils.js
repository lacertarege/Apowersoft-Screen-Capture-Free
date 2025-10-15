export function fmtDateLima(s){
  if (!s) return '-'
  const parts = String(s).split('-')
  if (parts.length === 3){
    const [y,m,d] = parts
    return `${String(d).padStart(2,'0')}-${String(m).padStart(2,'0')}-${y}`
  }
  const dt = new Date(s)
  if (!isNaN(dt)){
    const dd = String(dt.getDate()).padStart(2,'0')
    const mm = String(dt.getMonth()+1).padStart(2,'0')
    const yy = String(dt.getFullYear())
    return `${dd}-${mm}-${yy}`
  }
  return s
}

export function fmtPct(value){
  return new Intl.NumberFormat('es-PE', { style:'percent', minimumFractionDigits:2, maximumFractionDigits:2 }).format(value||0)
}

export function fmtCurr(value, currency){
  const curr = currency || 'USD'
  const numValue = Number(value) || 0
  
  // Forzar símbolos específicos para evitar inconsistencias
  if (curr === 'PEN') {
    return `S/ ${new Intl.NumberFormat('es-PE', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(numValue)}`
  }
  
  if (curr === 'USD') {
    return `$ ${new Intl.NumberFormat('es-PE', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(numValue)}`
  }
  
  // Para otras monedas, usar el formateo estándar
  return new Intl.NumberFormat('es-PE', { style:'currency', currency: curr }).format(numValue)
}