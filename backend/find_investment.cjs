const Database = require('better-sqlite3');
const db = new Database('./data/investments.db');

// Search for investment of approximately 3696.7 in any currency
const results = db.prepare(`
  SELECT 
    i.id,
    i.fecha,
    i.importe,
    i.cantidad,
    i.tipo_operacion,
    i.plataforma,
    t.ticker,
    t.nombre,
    t.moneda
  FROM inversiones i
  JOIN tickers t ON i.ticker_id = t.id
  WHERE i.importe BETWEEN 3690 AND 3700
    AND i.tipo_operacion != 'DESINVERSION'
  ORDER BY i.fecha DESC
`).all();

console.log('Inversiones encontradas con importe ~3696.7:');
console.log(JSON.stringify(results, null, 2));

// Also check USD tickers (typically NYSE)
const usdInvs = db.prepare(`
  SELECT 
    i.id,
    i.fecha,
    i.importe,
    i.cantidad,
    i.tipo_operacion,
    i.plataforma,
    t.ticker,
    t.nombre,
    t.moneda
  FROM inversiones i
  JOIN tickers t ON i.ticker_id = t.id
  WHERE t.moneda = 'USD'
  ORDER BY i.fecha DESC
  LIMIT 30
`).all();

console.log('\n\nÚltimas 30 inversiones en USD:');
console.log(JSON.stringify(usdInvs, null, 2));
