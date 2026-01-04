import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('='.repeat(80));
console.log('VERIFICACIÓN COMPLETA POST-CAMBIO: PML.TRV → PML');
console.log('='.repeat(80));

const tickerId = 17;

// 1. Verificar tabla tickers
const ticker = db.prepare('SELECT * FROM tickers WHERE id = ?').get(tickerId);
console.log('\n1. TABLA TICKERS:');
console.log('   ID:', ticker.id);
console.log('   Ticker:', ticker.ticker);
console.log('   Nombre:', ticker.nombre);
console.log('   Moneda:', ticker.moneda);
console.log('   Tipo Inversión ID:', ticker.tipo_inversion_id);
console.log('   Estado:', ticker.estado);

// 2. Verificar inversiones
const inversiones = db.prepare(`
  SELECT i.*, t.ticker 
  FROM inversiones i 
  JOIN tickers t ON i.ticker_id = t.id 
  WHERE i.ticker_id = ?
`).all(tickerId);
console.log('\n2. INVERSIONES:');
console.log('   Total:', inversiones.length);
if (inversiones.length > 0) {
    inversiones.forEach((inv, idx) => {
        console.log(`   [${idx + 1}] Fecha: ${inv.fecha}, Importe: ${inv.importe}, Cantidad: ${inv.cantidad}, Ticker: ${inv.ticker}`);
    });
}

// 3. Verificar precios históricos
const precios = db.prepare(`
  SELECT COUNT(*) as total, MIN(fecha) as primera, MAX(fecha) as ultima
  FROM precios_historicos 
  WHERE ticker_id = ?
`).get(tickerId);
console.log('\n3. PRECIOS HISTÓRICOS:');
console.log('   Total registros:', precios.total);
console.log('   Primera fecha:', precios.primera);
console.log('   Última fecha:', precios.ultima);

// Últimos 5 precios
const ultimosPrecios = db.prepare(`
  SELECT fecha, precio, fuente_api 
  FROM precios_historicos 
  WHERE ticker_id = ? 
  ORDER BY fecha DESC 
  LIMIT 5
`).all(tickerId);
if (ultimosPrecios.length > 0) {
    console.log('   Últimos 5 precios:');
    ultimosPrecios.forEach(p => {
        console.log(`     ${p.fecha}: $${p.precio} (${p.fuente_api})`);
    });
}

// 4. Verificar dividendos
const dividendos = db.prepare(`
  SELECT COUNT(*) as total 
  FROM dividendos 
  WHERE ticker_id = ?
`).get(tickerId);
console.log('\n4. DIVIDENDOS:');
console.log('   Total registros:', dividendos.total);

// 5. Verificar vista v_resumen_empresas
const resumen = db.prepare('SELECT * FROM v_resumen_empresas WHERE id = ?').get(tickerId);
console.log('\n5. VISTA V_RESUMEN_EMPRESAS:');
console.log('   Ticker:', resumen.ticker);
console.log('   Nombre:', resumen.nombre);
console.log('   Importe Total:', resumen.importe_total);
console.log('   Balance:', resumen.balance);
console.log('   Rendimiento:', resumen.rendimiento);
console.log('   Rentabilidad:', (resumen.rentabilidad * 100).toFixed(2) + '%');

// 6. Verificar que PML.TRV ya no existe
const tickerViejo = db.prepare('SELECT * FROM tickers WHERE ticker = ?').get('PML.TRV');
console.log('\n6. VERIFICACIÓN TICKER VIEJO:');
console.log('   PML.TRV existe:', tickerViejo ? 'SÍ (ERROR!)' : 'NO ✓');

// 7. Verificar que PML existe
const tickerNuevo = db.prepare('SELECT * FROM tickers WHERE ticker = ?').get('PML');
console.log('\n7. VERIFICACIÓN TICKER NUEVO:');
console.log('   PML existe:', tickerNuevo ? 'SÍ ✓' : 'NO (ERROR!)');
console.log('   ID coincide:', tickerNuevo?.id === tickerId ? 'SÍ ✓' : 'NO (ERROR!)');

console.log('\n' + '='.repeat(80));
console.log('✅ VERIFICACIÓN COMPLETA');
console.log('='.repeat(80));

db.close();
