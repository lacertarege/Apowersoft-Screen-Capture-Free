import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('🔄 Actualizando ticker INREF a INRETC1...\n');

// 1. Verificar si existe INREF
const inref = db.prepare('SELECT id, ticker, nombre, exchange FROM tickers WHERE ticker = ?').get('INREF');

if (!inref) {
    console.error('❌ No se encontró el ticker INREF en la base de datos');
    db.close();
    process.exit(1);
}

console.log('📋 Ticker encontrado:');
console.log(`   ID: ${inref.id}`);
console.log(`   Ticker actual: ${inref.ticker}`);
console.log(`   Empresa: ${inref.nombre}`);
console.log(`   Exchange: ${inref.exchange || 'N/A'}`);

// 2. Verificar si ya existe INRETC1
const existing = db.prepare('SELECT id FROM tickers WHERE ticker = ?').get('INRETC1');

if (existing) {
    console.error('\n❌ Ya existe un ticker con el código INRETC1 (ID: ' + existing.id + ')');
    console.error('   Por favor elimina o renombra el ticker existente primero');
    db.close();
    process.exit(1);
}

// 3. Actualizar el ticker
try {
    db.prepare('UPDATE tickers SET ticker = ? WHERE id = ?').run('INRETC1', inref.id);

    console.log('\n✅ Ticker actualizado exitosamente:');
    console.log(`   ${inref.ticker} → INRETC1`);

    // 4. Verificar la actualización
    const updated = db.prepare('SELECT ticker, nombre FROM tickers WHERE id = ?').get(inref.id);
    console.log('\n📋 Verificación:');
    console.log(`   Nuevo ticker: ${updated.ticker}`);
    console.log(`   Empresa: ${updated.nombre}`);

    // 5. Contar registros relacionados
    const preciosCount = db.prepare('SELECT COUNT(*) as count FROM precios_historicos WHERE ticker_id = ?').get(inref.id);
    const inversionesCount = db.prepare('SELECT COUNT(*) as count FROM inversiones WHERE ticker_id = ?').get(inref.id);

    console.log('\n📊 Registros relacionados actualizados automáticamente:');
    console.log(`   Precios históricos: ${preciosCount.count}`);
    console.log(`   Inversiones: ${inversionesCount.count}`);

} catch (error) {
    console.error('\n❌ Error al actualizar:', error.message);
    db.close();
    process.exit(1);
}

console.log('\n✅ Actualización completada!');
console.log('👉 Recarga el frontend para ver los cambios');

db.close();
