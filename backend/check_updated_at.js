import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('🔍 Investigando campo updated_at en precios_historicos...\n');

// 1. Ver algunos registros recientes
console.log('📋 Sample de registros recientes:');
const sample = db.prepare(`
  SELECT ticker_id, fecha, precio, fuente_api, updated_at 
  FROM precios_historicos 
  ORDER BY id DESC 
  LIMIT 10
`).all();

sample.forEach(row => {
    console.log(`  Fecha: ${row.fecha}, Precio: ${row.precio}, Fuente: ${row.fuente_api || 'N/A'}, Updated: ${row.updated_at || 'NULL'}`);
});

// 2. Contar cuántos tienen updated_at NULL
const nullCount = db.prepare(`
  SELECT COUNT(*) as count 
  FROM precios_historicos 
  WHERE updated_at IS NULL
`).get();

const totalCount = db.prepare('SELECT COUNT(*) as count FROM precios_historicos').get();

console.log(`\n📊 Estadísticas:`);
console.log(`   Total de registros: ${totalCount.count}`);
console.log(`   Con updated_at NULL: ${nullCount.count}`);
console.log(`   Con updated_at poblado: ${totalCount.count - nullCount.count}`);

// 3. Ver si hay alguno con updated_at no NULL
const withDate = db.prepare(`
  SELECT fecha, precio, fuente_api, updated_at 
  FROM precios_historicos 
  WHERE updated_at IS NOT NULL 
  LIMIT 5
`).all();

console.log(`\n📋 Registros con updated_at poblado (${withDate.length}):`);
withDate.forEach(row => {
    console.log(`  Fecha: ${row.fecha}, Updated: ${row.updated_at}`);
});

db.close();
