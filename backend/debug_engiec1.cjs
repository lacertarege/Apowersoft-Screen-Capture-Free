const Database = require('better-sqlite3');
const db = new Database('./data/investments.db');

// Check latest prices for ENGIEC1
const tickerId = db.prepare("SELECT id FROM tickers WHERE ticker = 'ENGIEC1'").get()?.id;
console.log('ENGIEC1 ticker_id:', tickerId);

const prices = db.prepare(`
  SELECT fecha, precio 
  FROM precios_historicos 
  WHERE ticker_id = ?
  ORDER BY fecha DESC 
  LIMIT 10
`).all(tickerId);

console.log('Últimos 10 precios de ENGIEC1:');
console.log(prices);

// Check what the /historicos endpoint would return
const allPrices = db.prepare(`
  SELECT fecha, precio 
  FROM precios_historicos 
  WHERE ticker_id = ?
  ORDER BY fecha ASC
`).all(tickerId);

console.log('\nTotal precios en historicos:', allPrices.length);
console.log('Primer precio:', allPrices[0]);
console.log('Último precio:', allPrices[allPrices.length - 1]);
