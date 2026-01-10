import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('🔗 Vinculando AIHC1 con RPJ code J40120...\n');

db.prepare('UPDATE tickers SET rpj_code = ? WHERE ticker = ?').run('J40120', 'AIHC1');

console.log('✅ AIHC1 → RPJ: J40120 (Andino Investment Holding S.A.A.)');

// Verificar
const result = db.prepare('SELECT ticker, nombre, rpj_code FROM tickers WHERE ticker = ?').get('AIHC1');
console.log(`\n📋 Verificación:`);
console.log(`   Ticker: ${result.ticker}`);
console.log(`   Nombre: ${result.nombre}`);
console.log(`   RPJ Code: ${result.rpj_code}`);

// Resumen total
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN rpj_code IS NOT NULL THEN 1 ELSE 0 END) as vinculados
  FROM tickers 
  WHERE exchange = 'BVL'
`).get();

console.log(`\n📊 Resumen BVL:`);
console.log(`   Total tickers: ${stats.total}`);
console.log(`   Vinculados: ${stats.vinculados}`);
console.log(`   Sin vincular: ${stats.total - stats.vinculados}`);

db.close();
console.log('\n✅ Actualización completada!');
