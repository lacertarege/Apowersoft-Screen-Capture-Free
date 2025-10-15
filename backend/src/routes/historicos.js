import express from 'express'
import multer from 'multer'
import { backfillHistoricalPrices } from '../jobs/backfillHistoricalPrices.js'

// Configurar multer para manejar archivos CSV
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos CSV'), false)
    }
  }
})

export function historicosRouter(db){
  const r = express.Router()
  r.get('/:id', (req,res)=>{
    const id = Number(req.params.id)
    const from = req.query.from || '1970-01-01'
    const rows = db.prepare(`SELECT id, fecha, precio, fuente_api FROM precios_historicos WHERE ticker_id=? AND fecha>=? ORDER BY fecha ASC`).all(id, from)
    res.json({ items: rows })
  })

  r.post('/backfill', async (req,res)=>{
    try{
      ;(async ()=>{ try { await backfillHistoricalPrices(db) } catch(e){ console.error('backfill historicos API error', e) } })()
      res.json({ started: true })
    } catch(e){
      console.error('POST /historicos/backfill error', e)
      res.status(500).json({ error: 'No se pudo iniciar el backfill' })
    }
  })

  r.delete('/:id', (req,res)=>{
    try {
      const id = Number(req.params.id)
      const result = db.prepare('DELETE FROM precios_historicos WHERE id=?').run(id)
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Precio histórico no encontrado' })
      }
      res.json({ ok: true, deleted: result.changes })
    } catch (e) {
      console.error('DELETE /historicos/:id error', e)
      res.status(500).json({ error: e.message })
    }
  })

  // Endpoint para importar CSV
  r.post('/import-csv', upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo CSV' })
      }

      const tickerId = req.body.ticker_id
      if (!tickerId) {
        return res.status(400).json({ error: 'No se proporcionó ticker_id' })
      }

      // Verificar que el ticker existe
      const ticker = db.prepare('SELECT id, ticker FROM tickers WHERE id = ?').get(tickerId)
      if (!ticker) {
        return res.status(404).json({ error: 'Ticker no encontrado' })
      }

      // Obtener mapeo de columnas
      let columnMapping
      try {
        columnMapping = JSON.parse(req.body.column_mapping || '{}')
      } catch (e) {
        return res.status(400).json({ error: 'Mapeo de columnas inválido' })
      }

      const fechaIndex = parseInt(columnMapping.fecha)
      const precioIndex = parseInt(columnMapping.precio)

      if (isNaN(fechaIndex) || isNaN(precioIndex)) {
        return res.status(400).json({ 
          error: 'Se requieren mapeos válidos para las columnas de fecha y precio',
          received: { fecha: columnMapping.fecha, precio: columnMapping.precio }
        })
      }

      // Convertir buffer a string
      const csvContent = req.file.buffer.toString('utf-8')
      
      // Parsear CSV
      const lines = csvContent.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        return res.status(400).json({ error: 'El archivo CSV está vacío o tiene formato incorrecto' })
      }

      // Detectar separador automáticamente
      const firstLine = lines[0]
      const semicolonCount = (firstLine.match(/;/g) || []).length
      const commaCount = (firstLine.match(/,/g) || []).length
      const separator = semicolonCount > commaCount ? ';' : ','

      const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''))

      if (fechaIndex >= headers.length || precioIndex >= headers.length) {
        return res.status(400).json({ 
          error: 'Los índices de columnas están fuera del rango del archivo CSV' 
        })
      }

      // Función para convertir fecha a YYYY-MM-DD
      const convertDateFormat = (dateStr) => {
        if (!dateStr) return null
        
        // Limpiar la fecha
        const cleanDate = dateStr.trim().replace(/"/g, '')
        
        // Intentar diferentes formatos
        const formats = [
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
          /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // DD/MM/YY
          /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
          /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
        ]

        for (const format of formats) {
          const match = cleanDate.match(format)
          if (match) {
            let day, month, year
            
            if (format.source.includes('\\d{4}') && match[1].length === 4) {
              // YYYY-MM-DD o YYYY/MM/DD
              year = match[1]
              month = match[2].padStart(2, '0')
              day = match[3].padStart(2, '0')
            } else {
              // DD/MM/YYYY o DD-MM-YYYY
              day = match[1].padStart(2, '0')
              month = match[2].padStart(2, '0')
              year = match[3].length === 2 ? '20' + match[3] : match[3]
            }
            
            // Validar fecha
            const date = new Date(year, month - 1, day)
            if (date.getFullYear() == year && date.getMonth() == month - 1 && date.getDate() == day) {
              return `${year}-${month}-${day}`
            }
          }
        }
        
        console.log(`No se pudo convertir la fecha: "${cleanDate}"`)
        return null
      }

      let inserted = 0
      let updated = 0
      const errors = []

      // Preparar consultas
      const insertQuery = db.prepare(`
        INSERT OR REPLACE INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)

      // Procesar cada línea
      console.log(`Procesando ${lines.length - 1} líneas de datos...`)
      console.log(`Headers: ${headers.join(', ')}`)
      console.log(`Mapeo: fecha=${fechaIndex} (${headers[fechaIndex]}), precio=${precioIndex} (${headers[precioIndex]})`)

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const columns = line.split(separator).map(cell => cell.trim().replace(/"/g, ''))
        if (columns.length < Math.max(fechaIndex, precioIndex) + 1) {
          console.log(`Línea ${i + 1}: No hay suficientes columnas (${columns.length})`)
          continue
        }

        const fechaStr = columns[fechaIndex]
        const precioStr = columns[precioIndex]

        if (!fechaStr || !precioStr) {
          console.log(`Línea ${i + 1}: Fecha o precio vacío - fecha: "${fechaStr}", precio: "${precioStr}"`)
          continue
        }

        const fecha = convertDateFormat(fechaStr)
        const precio = parseFloat(precioStr)

        if (!fecha || isNaN(precio) || precio <= 0) {
          console.log(`Línea ${i + 1}: Datos inválidos - fecha: "${fechaStr}" -> "${fecha}", precio: "${precioStr}" -> ${precio}`)
          errors.push(`Línea ${i + 1}: Fecha (${fechaStr}) o precio (${precioStr}) inválido`)
          continue
        }

        try {
          // Verificar si ya existe
          const existing = db.prepare('SELECT id FROM precios_historicos WHERE ticker_id = ? AND fecha = ?')
            .get(tickerId, fecha)

          const nowIso = new Date().toISOString()
          insertQuery.run(tickerId, fecha, precio, 'Archivo csv', nowIso)

          if (existing) {
            updated++
          } else {
            inserted++
          }
        } catch (error) {
          console.log(`Línea ${i + 1}: Error en base de datos: ${error.message}`)
          errors.push(`Línea ${i + 1}: ${error.message}`)
        }
      }

      res.json({
        success: true,
        ticker: ticker.ticker,
        inserted,
        updated,
        total: inserted + updated,
        errors: errors.length > 0 ? errors : undefined
      })

    } catch (error) {
      console.error('Error al importar CSV:', error)
      res.status(500).json({ error: error.message })
    }
  })

  return r
}