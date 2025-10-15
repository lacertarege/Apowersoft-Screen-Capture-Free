import React from 'react'

export default function NumberCell({ value, currency='USD' }){
  if (value == null || !isFinite(Number(value))) return <span>-</span>
  try{
    const n = Number(value)
    const isNeg = n < 0
    
    // Forzar símbolos específicos para evitar inconsistencias
    if (currency === 'PEN') {
      const formatted = `S/ ${new Intl.NumberFormat('es-PE', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }).format(n)}`
      return <span style={{ color: isNeg ? '#dc2626' : undefined }}>{formatted}</span>
    }
    
    if (currency === 'USD') {
      const formatted = `$ ${new Intl.NumberFormat('es-PE', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }).format(n)}`
      return <span style={{ color: isNeg ? '#dc2626' : undefined }}>{formatted}</span>
    }
    
    // Para otras monedas, usar el formateo estándar
    const fmt = new Intl.NumberFormat('es-PE', { style:'currency', currency })
    return <span style={{ color: isNeg ? '#dc2626' : undefined }}>{fmt.format(n)}</span>
  }catch{
    return <span>{value}</span>
  }
}