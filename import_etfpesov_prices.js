const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuración
const dbPath = path.join(__dirname, 'investments.db');
const csvPath = path.join(__dirname, 'backups', 'ETFPESOV_2025-09-02_2025-10-02 (1).csv');

// Conectar a la base de datos
const db = new Database(dbPath);

// Función para convertir fecha DD/MM/YYYY a YYYY-MM-DD
function convertDateFormat(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}

// Función para parsear el CSV
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(';');
  
  // Encontrar índices de las columnas que necesitamos
  const fechaIndex = headers.findIndex(h => h.includes('Fecha de cotización'));
  const cierreIndex = headers.findIndex(h => h.includes('Cierre'));
  
  console.log('Headers encontrados:', headers);
  console.log('Índice de fecha:', fechaIndex);
  console.log('Índice de cierre:', cierreIndex);
  
  if (fechaIndex === -1 || cierreIndex === -1) {
    throw new Error('No se encontraron las columnas necesarias');
  }
  
  const prices = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split(';');
    if (columns.length < Math.max(fechaIndex, cierreIndex) + 1) continue;
    
    const fechaStr = columns[fechaIndex]?.trim();
    const precioStr = columns[cierreIndex]?.trim();
    
    if (!fechaStr || !precioStr) continue;
    
    const fecha = convertDateFormat(fechaStr);
    const precio = parseFloat(precioStr);
    
    if (fecha && !isNaN(precio) && precio > 0) {
      prices.push({
        fecha: fecha,
        precio: precio,
        fuente: 'csv_import'
      });
    }
  }
  
  return prices;
}

// Función principal
async function importPrices() {
  try {
    console.log('Iniciando importación de precios para ETFPESOV...');
    
    // Leer el archivo CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    console.log('Archivo CSV leído correctamente');
    
    // Parsear el CSV
    const prices = parseCSV(csvContent);
    console.log(`Se encontraron ${prices.length} precios válidos`);
    
    if (prices.length === 0) {
      console.log('No hay precios válidos para importar');
      return;
    }
    
    // Obtener el ID del ticker ETFPESOV
    const tickerQuery = db.prepare('SELECT id FROM tickers WHERE ticker = ?');
    const ticker = tickerQuery.get('ETFPESOV');
    
    if (!ticker) {
      console.log('Ticker ETFPESOV no encontrado en la base de datos');
      return;
    }
    
    console.log(`Ticker ETFPESOV encontrado con ID: ${ticker.id}`);
    
    // Preparar la consulta de inserción
    const insertQuery = db.prepare(`
      INSERT OR REPLACE INTO historicos (ticker_id, fecha, precio, fuente)
      VALUES (?, ?, ?, ?)
    `);
    
    // Insertar los precios
    let inserted = 0;
    let updated = 0;
    
    for (const price of prices) {
      try {
        // Verificar si ya existe
        const existingQuery = db.prepare('SELECT id FROM historicos WHERE ticker_id = ? AND fecha = ?');
        const existing = existingQuery.get(ticker.id, price.fecha);
        
        const result = insertQuery.run(ticker.id, price.fecha, price.precio, price.fuente);
        
        if (existing) {
          updated++;
        } else {
          inserted++;
        }
        
        console.log(`${existing ? 'Actualizado' : 'Insertado'}: ${price.fecha} - S/ ${price.precio}`);
      } catch (error) {
        console.error(`Error al insertar precio para ${price.fecha}:`, error.message);
      }
    }
    
    console.log(`\nImportación completada:`);
    console.log(`- Nuevos precios insertados: ${inserted}`);
    console.log(`- Precios actualizados: ${updated}`);
    console.log(`- Total procesados: ${inserted + updated}`);
    
  } catch (error) {
    console.error('Error durante la importación:', error);
  } finally {
    db.close();
  }
}

// Ejecutar la importación
importPrices();



