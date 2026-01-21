const Database = require('better-sqlite3');
const db = new Database('./data/investments.db');

// Check latest prices for INRETC1
const prices = db.prepare(`
  SELECT fecha, precio 
  FROM precios_historicos 
  WHERE ticker_id = (SELECT id FROM tickers WHERE ticker = 'INRETC1') 
  ORDER BY fecha DESC 
  LIMIT 10
`).all();

console.log('Últimos 10 precios de INRETC1:');
console.log(prices);

// Check latest investments for INRETC1
const inversiones = db.prepare(`
  SELECT fecha, importe, cantidad, tipo_operacion 
  FROM inversiones 
  WHERE ticker_id = (SELECT id FROM tickers WHERE ticker = 'INRETC1') 
  ORDER BY fecha DESC 
  LIMIT 5
`).all();

console.log('\nÚltimas 5 inversiones de INRETC1:');
console.log(inversiones);

// Check what getLimaDate would return
const today = new Date();
const limaDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(today);

const d = new Date(limaDate);
d.setUTCDate(d.getUTCDate() - 1);
const fechaFin = d.toISOString().slice(0, 10);

console.log('\nFecha Lima hoy:', limaDate);
console.log('Fecha fin (ayer):', fechaFin);
