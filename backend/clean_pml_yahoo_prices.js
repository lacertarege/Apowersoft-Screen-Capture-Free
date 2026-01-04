import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('🧹 Limpiando precios incorrectos de Yahoo para PML (BVL)...\n');

// 0. Obtener el ID del ticker PML
const tickerInfo = db.prepare('SELECT id, ticker, exchange FROM tickers WHERE ticker = ?').get('PML');

if (!tickerInfo) {
    console.error('❌ No se encontró el ticker PML en la BD');
    process.exit(1);
}

console.log(`📋 Ticker: ${tickerInfo.ticker} (ID: ${tickerInfo.id}, Exchange: ${tickerInfo.exchange})\n`);

// 1. Ver cuántos precios de Yahoo hay para PML
const yahooCount = db.prepare(`
  SELECT COUNT(*) as count 
  FROM precios_historicos 
  WHERE ticker_id = ? AND fuente_api LIKE 'yahoo%'
`).get(tickerInfo.id);

console.log(`📊 Precios de Yahoo encontrados: ${yahooCount.count}`);

// 2. Ver un sample de los precios de Yahoo (probablemente incorrectos)
const yahooSample = db.prepare(`
  SELECT fecha, precio, fuente_api 
  FROM precios_historicos 
  WHERE ticker_id = ? AND fuente_api LIKE 'yahoo%'
  ORDER BY fecha DESC
  LIMIT 10
`).all(tickerInfo.id);

console.log('\n📋 Sample de precios de Yahoo (probablemente PIMCO $7.xx):');
yahooSample.forEach(p => {
    console.log(`   ${p.fecha}: $${p.precio} (${p.fuente_api})`);
});

//  3. Eliminar todos los precios de Yahoo para PML
const deleted = db.prepare(`
  DELETE FROM precios_historicos 
  WHERE ticker_id = ? AND fuente_api LIKE 'yahoo%'
`).run(tickerInfo.id);

console.log(`\n✅ Eliminados ${deleted.changes} precios incorrectos de Yahoo`);

// 4. Ver cuántos precios de BVL hay
const bvlCount = db.prepare(`
  SELECT COUNT(*) as count 
  FROM precios_historicos 
  WHERE ticker_id = ? AND fuente_api LIKE 'bvl%'
`).get(tickerInfo.id);

console.log(`📊 Precios de BVL restantes: ${bvlCount.count}`);

// 5. Ver sample de precios de BVL (correctos)
const bvlSample = db.prepare(`
  SELECT fecha, precio, fuente_api 
  FROM precios_historicos 
  WHERE ticker_id = ? AND fuente_api LIKE 'bvl%'
  ORDER BY fecha DESC
  LIMIT 10
`).all(tickerInfo.id);

console.log('\n📋 Sample de precios de BVL (correctos ~$0.24):');
bvlSample.forEach(p => {
    console.log(`   ${p.fecha}: $${p.precio} (${p.fuente_api})`);
});

console.log('\n✅ Limpieza completada!');
console.log('👉 Ahora ejecuta "Actualizar Todo" en el frontend para rellenar los precios faltantes con BVL API');

db.close();
