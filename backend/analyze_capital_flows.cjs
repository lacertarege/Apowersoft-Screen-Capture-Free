const db = require('better-sqlite3')('./data/investments.db');

// Análisis por moneda
const byMoneda = db.prepare(`
  SELECT 
    t.moneda,
    SUM(CASE WHEN tipo_operacion='INVERSION' THEN importe ELSE 0 END) as total_compras,
    SUM(CASE WHEN tipo_operacion='DESINVERSION' THEN importe ELSE 0 END) as total_ventas,
    SUM(CASE WHEN tipo_operacion='INVERSION' THEN importe ELSE -importe END) as flujo_neto
  FROM inversiones i 
  JOIN tickers t ON i.ticker_id = t.id 
  GROUP BY t.moneda
`).all();

console.log('\n=== FLUJOS DE CAPITAL POR MONEDA ===');
byMoneda.forEach(row => {
  console.log(`\n${row.moneda}:`);
  console.log(`  Compras Totales: ${row.total_compras.toFixed(2)}`);
  console.log(`  Ventas Totales:  ${row.total_ventas.toFixed(2)}`);
  console.log(`  Flujo Neto:      ${row.flujo_neto.toFixed(2)}`);
});

// Análisis por origen_capital
const byOrigen = db.prepare(`
  SELECT 
    t.moneda,
    COALESCE(origen_capital, 'FRESH_CASH') as origen,
    SUM(importe) as total
  FROM inversiones i 
  JOIN tickers t ON i.ticker_id = t.id 
  WHERE tipo_operacion = 'INVERSION'
  GROUP BY t.moneda, origen_capital
  ORDER BY t.moneda, origen
`).all();

console.log('\n\n=== COMPRAS POR ORIGEN DE CAPITAL ===');
byOrigen.forEach(row => {
  console.log(`${row.moneda} - ${row.origen}: ${row.total.toFixed(2)}`);
});

// Verificar operaciones cross-currency (desinversión PEN -> inversión USD)
const crossCurrency = db.prepare(`
  SELECT 
    COUNT(*) as total_reinversiones,
    SUM(importe) as monto_reinversiones
  FROM inversiones i 
  JOIN tickers t ON i.ticker_id = t.id 
  WHERE origen_capital = 'REINVERSION'
`).get();

console.log('\n\n=== REINVERSIONES TOTALES ===');
console.log(`Total operaciones: ${crossCurrency.total_reinversiones}`);
console.log(`Monto: ${crossCurrency.monto_reinversiones?.toFixed(2) || 0}`);
