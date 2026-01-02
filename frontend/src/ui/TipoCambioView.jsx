import React, { useState, useEffect } from 'react'
import { API } from './config'
import { fmtDateLima } from './utils'

export default function TipoCambioView(){
  const [items, setItems] = useState([])
  const [limit, setLimit] = useState(60)
  const [loading, setLoading] = useState(false)
  const [fecha, setFecha] = useState('')
  const [usdPen, setUsdPen] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Estados para edición
  const [editModal, setEditModal] = useState({
    open: false,
    fecha: '',
    usdPen: '',
    fuente: 'manual'
  })
  const [deleting, setDeleting] = useState(null)

  // Estados para carga CSV
  const [csvModal, setCsvModal] = useState({
    open: false,
    file: null,
    preview: [],
    columns: [],
    mapping: {
      fecha: '',
      precio: ''
    },
    processing: false
  })

  const load = async ()=>{
    setLoading(true)
    try{
      const r = await fetch(`${API}/config/tipo-cambio?limit=${limit}`)
      const d = await r.json().catch(()=>({}))
      setItems(d.items||[])
    }catch{
      setItems([])
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [limit])

  const latest = items[0] || null

  const fmtRate = (v)=>{
    const n = Number(v)
    if (!isFinite(n)) return '-'
    return n.toFixed(3)
  }

  const addManual = async ()=>{
    const f = (fecha||'').trim()
    const v = Number(usdPen)
    if (!f || !isFinite(v) || v <= 0){ alert('Ingrese fecha y un valor válido (> 0)'); return }
    setSaving(true)
    try{
      const r = await fetch(`${API}/config/tipo-cambio`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fecha: f, usd_pen: v, fuente_api:'manual' }) })
      const d = await r.json().catch(()=>({}))
      if (!r.ok || d.error){ throw new Error(d.error || 'No se pudo guardar') }
      setFecha(''); setUsdPen('')
      await load()
      alert('Tipo de cambio guardado')
    }catch(e){ alert(e.message) }
    finally{ setSaving(false) }
  }


  // Función para abrir modal de edición
  const handleEdit = (item) => {
    setEditModal({
      open: true,
      fecha: item.fecha,
      usdPen: item.usd_pen.toString(),
      fuente: item.fuente_api || 'manual'
    })
  }

  // Función para guardar cambios
  const handleSaveEdit = async () => {
    if (!editModal.fecha || !editModal.usdPen) return
    
    try {
      const response = await fetch(`${API}/config/tipo-cambio/${editModal.fecha}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usd_pen: parseFloat(editModal.usdPen),
          fuente_api: editModal.fuente
        })
      })
      
      if (response.ok) {
        setEditModal({ open: false, fecha: '', usdPen: '', fuente: 'manual' })
        await load()
        alert('Tipo de cambio actualizado exitosamente')
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Error al actualizar: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Error updating exchange rate:', error)
      alert('Error al actualizar el tipo de cambio')
    }
  }

  // Función para eliminar
  const handleDelete = async (fecha) => {
    if (!confirm(`¿Estás seguro de eliminar el tipo de cambio del ${fmtDateLima(fecha)}?`)) return
    
    setDeleting(fecha)
    
    try {
      const response = await fetch(`${API}/config/tipo-cambio/${fecha}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await load()
        alert('Tipo de cambio eliminado exitosamente')
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Error al eliminar: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Error deleting exchange rate:', error)
      alert('Error al eliminar el tipo de cambio')
    } finally {
      setDeleting(null)
    }
  }

  // Función para parsear una línea CSV respetando valores entre comillas
  const parseCSVLine = (line, delimiter) => {
    const values = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Comilla escapada ("")
          current += '"'
          i += 2
        } else {
          // Inicio o fin de valor entre comillas
          inQuotes = !inQuotes
          i++
        }
      } else if (char === delimiter && !inQuotes) {
        // Separador encontrado fuera de comillas
        values.push(current.trim())
        current = ''
        i++
      } else {
        // Carácter normal
        current += char
        i++
      }
    }

    // Agregar el último valor
    values.push(current.trim())

    return values
  }

  // Función para parsear CSV
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) return { columns: [], rows: [] }
    
    // Detectar delimitador (coma o punto y coma)
    // Si hay punto y coma, usarlo; de lo contrario, usar coma
    const delimiter = text.includes(';') ? ';' : ','
    
    // Parsear primera línea como encabezados
    const headers = parseCSVLine(lines[0], delimiter).map(h => {
      // Remover comillas externas si existen
      h = h.trim()
      if ((h.startsWith('"') && h.endsWith('"')) || (h.startsWith("'") && h.endsWith("'"))) {
        h = h.slice(1, -1)
      }
      // Reemplazar comillas escapadas
      return h.replace(/""/g, '"')
    })
    
    // Parsear resto de líneas
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter).map(v => {
        // Remover comillas externas si existen
        v = v.trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        // Reemplazar comillas escapadas
        return v.replace(/""/g, '"')
      })
      
      if (values.length > 0 && values.some(v => v)) {
        const row = {}
        headers.forEach((header, idx) => {
          row[header] = values[idx] || ''
        })
        rows.push(row)
      }
    }
    
    return { columns: headers, rows }
  }

  // Función para manejar carga de archivo
  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Por favor, selecciona un archivo CSV')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const { columns, rows } = parseCSV(text)
        
        if (columns.length === 0) {
          alert('El archivo CSV no tiene columnas válidas')
          return
        }

        setCsvModal({
          ...csvModal,
          file,
          columns,
          preview: rows.slice(0, 5), // Mostrar primeras 5 filas como preview
          mapping: {
            fecha: columns.find(c => /fecha|date/i.test(c)) || '',
            precio: columns.find(c => /precio|tipo.cambio|usd|pen|rate|valor/i.test(c)) || ''
          }
        })
      } catch (error) {
        console.error('Error parsing CSV:', error)
        alert('Error al leer el archivo CSV: ' + error.message)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  // Función para procesar e importar CSV
  const handleImportCSV = async () => {
    if (!csvModal.mapping.fecha || !csvModal.mapping.precio) {
      alert('Por favor, selecciona las columnas de fecha y precio')
      return
    }

    setCsvModal({ ...csvModal, processing: true })

    try {
      // Leer el archivo nuevamente para obtener todos los datos
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const text = event.target.result
          const { rows } = parseCSV(text)
          
          // Convertir a formato esperado por el backend
          const items = []
          for (const row of rows) {
            const fechaRaw = row[csvModal.mapping.fecha]
            const precioRaw = row[csvModal.mapping.precio]
            
            if (!fechaRaw || !precioRaw) continue

            // Normalizar fecha (aceptar varios formatos)
            let fecha = fechaRaw.trim()
            
            // Si ya está en formato YYYY-MM-DD, usarla directamente
            if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
              // Ya está en el formato correcto
            } else if (fecha.includes('.')) {
              // Formato DD.MM.YYYY o DD.M.YYYY
              const parts = fecha.split('.')
              if (parts.length === 3) {
                const [d, m, y] = parts
                fecha = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
              }
            } else if (fecha.includes('/')) {
              // Formato DD/MM/YYYY o DD/M/YYYY
              const parts = fecha.split('/')
              if (parts.length === 3) {
                const [d, m, y] = parts
                fecha = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
              }
            } else if (fecha.includes('-')) {
              const parts = fecha.split('-')
              if (parts.length === 3) {
                if (parts[0].length === 2) {
                  // Formato DD-MM-YYYY
                  const [d, m, y] = parts
                  fecha = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
                } else if (parts[0].length === 4) {
                  // Ya está en formato YYYY-MM-DD
                  fecha = fecha
                }
              }
            }

            // Validar formato de fecha YYYY-MM-DD
            if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
              console.warn(`Fecha inválida: ${fechaRaw} -> ${fecha}`)
              continue
            }

            // Normalizar precio (manejar coma como separador decimal)
            let precioStr = precioRaw.toString().trim()
            // Si tiene punto y coma, probablemente es formato europeo (coma como decimal)
            // Si tiene solo coma, verificar si es separador decimal o de miles
            if (precioStr.includes(',') && !precioStr.includes('.')) {
              // Formato europeo: reemplazar coma por punto
              precioStr = precioStr.replace(',', '.')
            } else if (precioStr.includes(',') && precioStr.includes('.')) {
              // Tiene ambos: el último es el decimal
              const lastComma = precioStr.lastIndexOf(',')
              const lastDot = precioStr.lastIndexOf('.')
              if (lastComma > lastDot) {
                // La coma es el separador decimal
                precioStr = precioStr.replace(/\./g, '').replace(',', '.')
              } else {
                // El punto es el separador decimal, la coma es de miles
                precioStr = precioStr.replace(/,/g, '')
              }
            } else if (precioStr.includes(',')) {
              // Solo tiene coma, asumir que es separador decimal
              precioStr = precioStr.replace(',', '.')
            }
            
            const precio = parseFloat(precioStr)
            if (isNaN(precio) || precio <= 0) {
              console.warn(`Precio inválido: ${precioRaw} -> ${precioStr}`)
              continue
            }

            items.push({ fecha, usd_pen: precio })
          }

          if (items.length === 0) {
            alert('No se encontraron datos válidos en el CSV')
            setCsvModal({ ...csvModal, processing: false })
            return
          }

          // Enviar al backend
          const response = await fetch(`${API}/config/tipo-cambio/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, fuente_api: 'csv' })
          })

          let data
          try {
            data = await response.json()
          } catch (e) {
            const text = await response.text().catch(() => '')
            throw new Error(`Error del servidor (${response.status}): ${text || response.statusText}`)
          }

          if (!response.ok) {
            const errorMsg = data?.error || data?.message || `Error HTTP ${response.status}: ${response.statusText}`
            throw new Error(errorMsg)
          }

          if (data.error) {
            throw new Error(data.error)
          }

          // Mostrar resultados detallados
          let mensaje = `✅ Importación exitosa:\n\n`
          mensaje += `📊 Total procesados: ${data.total}\n`
          mensaje += `➕ Nuevos registros: ${data.inserted}\n`
          mensaje += `🔄 Actualizados: ${data.updated}`
          
          if (data.errors && data.errors.length > 0) {
            mensaje += `\n\n⚠️ Errores (${data.errors.length}):\n`
            data.errors.slice(0, 5).forEach((err, idx) => {
              mensaje += `${idx + 1}. ${err.error || 'Error desconocido'}\n`
            })
            if (data.errors.length > 5) {
              mensaje += `... y ${data.errors.length - 5} más`
            }
          }
          
          alert(mensaje)
          
          // Cerrar modal y recargar datos
          setCsvModal({
            open: false,
            file: null,
            preview: [],
            columns: [],
            mapping: { fecha: '', precio: '' },
            processing: false
          })
          await load()
        } catch (error) {
          console.error('Error importing CSV:', error)
          
          // Mensaje de error más detallado
          let errorMsg = 'Error al importar datos'
          
          if (error.message) {
            errorMsg = error.message
          } else if (error instanceof TypeError && error.message.includes('fetch')) {
            errorMsg = 'Error de conexión con el servidor. Verifica que el backend esté ejecutándose.'
          } else {
            errorMsg = `Error: ${error.toString()}`
          }
          
          alert(`❌ ${errorMsg}\n\nPor favor, verifica:\n- El formato de las fechas\n- Los valores numéricos\n- La conexión con el servidor`)
          setCsvModal({ ...csvModal, processing: false })
        }
      }
      reader.readAsText(csvModal.file, 'UTF-8')
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Error al leer el archivo: ' + error.message)
      setCsvModal({ ...csvModal, processing: false })
    }
  }

  return (
    <div className="container">
      <h2>Tipo de Cambio</h2>

      <div className="card" style={{marginBottom:12}}>
        <h3 className="card-title" style={{margin:0}}>Recientes</h3>
        {latest ? (
          <div className="text-muted" style={{marginTop:4}}>
            Último: 1 USD = {fmtRate(latest.usd_pen)} PEN · {fmtDateLima(latest.fecha)}
          </div>
        ) : (
          <div className="text-muted" style={{marginTop:4}}>Sin datos</div>
        )}

        <table style={{marginTop:12, margin:0}}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>USD → PEN</th>
              <th>Fuente</th>
              <th style={{textAlign:'center', width:'120px'}}>Acciones</th>
            </tr>
          </thead>
        </table>
        
        <div style={{maxHeight:'calc(60vh - 40px)', overflow:'auto', marginTop:'-1px'}}>
          <table style={{margin:0}}>
            <colgroup>
              <col />
              <col />
              <col />
              <col style={{width:'120px'}} />
            </colgroup>
            <tbody>
              {items.map((it)=> (
                <tr key={it.fecha}>
                  <td>{fmtDateLima(it.fecha)}</td>
                  <td style={{textAlign:'right'}}>{fmtRate(it.usd_pen)}</td>
                  <td>{it.fuente_api || '-'}</td>
                  <td style={{textAlign:'center'}}>
                    <div style={{display:'flex', gap:'4px', justifyContent:'center'}}>
                      <button
                        onClick={() => handleEdit(it)}
                        className="btn btn-sm"
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Editar tipo de cambio"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(it.fecha)}
                        disabled={deleting === it.fecha}
                        className="btn btn-sm"
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: deleting === it.fecha ? '#f9fafb' : '#fef2f2',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: deleting === it.fecha ? 'not-allowed' : 'pointer',
                          opacity: deleting === it.fecha ? 0.6 : 1
                        }}
                        title="Eliminar tipo de cambio"
                      >
                        {deleting === it.fecha ? '⏳' : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-muted" style={{marginTop:8}}>
          Mostrando {items.length} registros · Límite:
          <select value={limit} onChange={e=>setLimit(Number(e.target.value))} style={{marginLeft:6}}>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
            <option value={365}>365</option>
          </select>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 className="card-title">Agregar manual</h3>
        <div className="grid grid-tight" style={{alignItems:'end'}}>
          <div className="form-group">
            <label>Fecha:</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />
          </div>
          <div className="form-group">
            <label>USD → PEN:</label>
            <input type="number" min="0" step="0.0001" value={usdPen} onChange={e=>setUsdPen(e.target.value)} />
          </div>
          <div>
            <button onClick={addManual} disabled={saving || !fecha || !usdPen} className="btn-primary">Guardar</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 className="card-title">Importar desde CSV</h3>
        <p style={{marginBottom:12, color:'#6b7280', fontSize:'14px'}}>
          Carga un archivo CSV con tipos de cambio. Selecciona las columnas que corresponden a la fecha y al precio.
        </p>
        <button 
          onClick={() => setCsvModal({...csvModal, open: true})}
          className="btn-primary"
          style={{padding:'8px 16px'}}
        >
          📁 Cargar archivo CSV
        </button>
      </div>

      {/* Modal de Edición */}
      {editModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Editar Tipo de Cambio</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Fecha:
              </label>
              <input
                type="date"
                value={editModal.fecha}
                disabled
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: '#f9fafb',
                  color: '#6b7280'
                }}
              />
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                La fecha no se puede modificar
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                USD → PEN:
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={editModal.usdPen}
                onChange={(e) => setEditModal(prev => ({ ...prev, usdPen: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Fuente:
              </label>
              <select
                value={editModal.fuente}
                onChange={(e) => setEditModal(prev => ({ ...prev, fuente: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              >
                <option value="manual">Manual</option>
                <option value="api">API</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditModal({ open: false, fecha: '', usdPen: '', fuente: 'manual' })}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editModal.usdPen}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: !editModal.usdPen ? '#d1d5db' : '#2563eb',
                  color: 'white',
                  cursor: !editModal.usdPen ? 'not-allowed' : 'pointer'
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carga CSV */}
      {csvModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Importar desde CSV</h3>
            
            {csvModal.columns.length === 0 ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Seleccionar archivo CSV:
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                  El archivo debe contener columnas con fecha y tipo de cambio (precio).
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Archivo seleccionado:
                  </label>
                  <div style={{ 
                    padding: '8px', 
                    backgroundColor: '#f3f4f6', 
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    {csvModal.file.name}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Mapear columnas:
                  </label>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                      Columna de Fecha:
                    </label>
                    <select
                      value={csvModal.mapping.fecha}
                      onChange={(e) => setCsvModal({...csvModal, mapping: {...csvModal.mapping, fecha: e.target.value}})}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="">Seleccionar...</option>
                      {csvModal.columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                      Columna de Precio / Tipo de Cambio:
                    </label>
                    <select
                      value={csvModal.mapping.precio}
                      onChange={(e) => setCsvModal({...csvModal, mapping: {...csvModal.mapping, precio: e.target.value}})}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="">Seleccionar...</option>
                      {csvModal.columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {csvModal.preview.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                      Vista previa (primeras 5 filas):
                    </label>
                    <div style={{ 
                      maxHeight: '200px', 
                      overflow: 'auto', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f3f4f6', position: 'sticky', top: 0 }}>
                          <tr>
                            {csvModal.columns.map(col => (
                              <th key={col} style={{ 
                                padding: '6px', 
                                textAlign: 'left', 
                                borderBottom: '1px solid #d1d5db',
                                fontWeight: 'bold'
                              }}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvModal.preview.map((row, idx) => (
                            <tr key={idx}>
                              {csvModal.columns.map(col => (
                                <td key={col} style={{ 
                                  padding: '6px', 
                                  borderBottom: '1px solid #e5e7eb',
                                  backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb'
                                }}>
                                  {row[col] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setCsvModal({
                      open: false,
                      file: null,
                      preview: [],
                      columns: [],
                      mapping: { fecha: '', precio: '' },
                      processing: false
                    })}
                    disabled={csvModal.processing}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      cursor: csvModal.processing ? 'not-allowed' : 'pointer',
                      opacity: csvModal.processing ? 0.6 : 1
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImportCSV}
                    disabled={csvModal.processing || !csvModal.mapping.fecha || !csvModal.mapping.precio}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: (csvModal.processing || !csvModal.mapping.fecha || !csvModal.mapping.precio) ? '#d1d5db' : '#2563eb',
                      color: 'white',
                      cursor: (csvModal.processing || !csvModal.mapping.fecha || !csvModal.mapping.precio) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {csvModal.processing ? '⏳ Importando...' : '✅ Importar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}