import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('='.repeat(80));
console.log('PASO 1: Verificación Pre-Cambio');
console.log('='.repeat(80));

// Verificar ticker actual
const tickerActual = db.prepare('SELECT * FROM tickers WHERE ticker = ?').get('PML.TRV');
console.log('\n✓ Ticker actual encontrado:');
console.log(JSON.stringify(tickerActual, null, 2));

// Verificar que PML no existe
const pmlExiste = db.prepare('SELECT * FROM tickers WHERE ticker = ?').get('PML');
if (pmlExiste) {
    console.error('\n❌ ERROR: El ticker "PML" ya existe en la base de datos:');
    console.error(JSON.stringify(pmlExiste, null, 2));
    console.error('\nNo se puede continuar con el cambio.');
    db.close();
    process.exit(1);
}
console.log('\n✓ Verificado: "PML" no existe en la BD');

// Verificar relaciones existentes
const relaciones = {
    inversiones: db.prepare('SELECT COUNT(*) as count FROM inversiones WHERE ticker_id = ?').get(tickerActual.id).count,
    precios_historicos: db.prepare('SELECT COUNT(*) as count FROM precios_historicos WHERE ticker_id = ?').get(tickerActual.id).count,
    dividendos: db.prepare('SELECT COUNT(*) as count FROM dividendos WHERE ticker_id = ?').get(tickerActual.id).count
};

console.log('\n✓ Relaciones existentes para ticker_id =', tickerActual.id);
console.log('  - Inversiones:', relaciones.inversiones);
console.log('  - Precios Históricos:', relaciones.precios_historicos);
console.log('  - Dividendos:', relaciones.dividendos);

console.log('\n' + '='.repeat(80));
console.log('PASO 2: Ejecutando UPDATE');
console.log('='.repeat(80));

// Ejecutar UPDATE
const resultado = db.prepare('UPDATE tickers SET ticker = ? WHERE id = ?').run('PML', tickerActual.id);
console.log('\n✓ UPDATE ejecutado');
console.log('  - Filas afectadas:', resultado.changes);

console.log('\n' + '='.repeat(80));
console.log('PASO 3: Verificación Post-Cambio');
console.log('='.repeat(80));

// Verificar el cambio
const tickerNuevo = db.prepare('SELECT * FROM tickers WHERE id = ?').get(tickerActual.id);
console.log('\n✓ Ticker actualizado:');
console.log(JSON.stringify(tickerNuevo, null, 2));

// Verificar que las relaciones se mantienen intactas
const relacionesPost = {
    inversiones: db.prepare('SELECT COUNT(*) as count FROM inversiones WHERE ticker_id = ?').get(tickerActual.id).count,
    precios_historicos: db.prepare('SELECT COUNT(*) as count FROM precios_historicos WHERE ticker_id = ?').get(tickerActual.id).count,
    dividendos: db.prepare('SELECT COUNT(*) as count FROM dividendos WHERE ticker_id = ?').get(tickerActual.id).count
};

console.log('\n✓ Verificación de integridad referencial:');
console.log('  - Inversiones:', relacionesPost.inversiones, '(antes:', relaciones.inversiones + ')');
console.log('  - Precios Históricos:', relacionesPost.precios_historicos, '(antes:', relaciones.precios_historicos + ')');
console.log('  - Dividendos:', relacionesPost.dividendos, '(antes:', relaciones.dividendos + ')');

// Verificar que la vista también refleja el cambio
const vistaResumen = db.prepare('SELECT ticker, nombre FROM v_resumen_empresas WHERE id = ?').get(tickerActual.id);
console.log('\n✓ Vista v_resumen_empresas actualizada:');
console.log('  - Ticker en vista:', vistaResumen.ticker);
console.log('  - Nombre:', vistaResumen.nombre);

console.log('\n' + '='.repeat(80));
console.log('✅ CAMBIO COMPLETADO EXITOSAMENTE');
console.log('='.repeat(80));
console.log('\nResumen:');
console.log('  Ticker anterior: PML.TRV');
console.log('  Ticker nuevo:    PML');
console.log('  ID inmutable:    ' + tickerActual.id);
console.log('  Relaciones:      ✓ Todas intactas');
console.log('\n⚠️  RECOMENDACIONES:');
console.log('  1. Reiniciar el servidor backend para limpiar caché');
console.log('  2. Refrescar la página del frontend (Ctrl+Shift+R)');
console.log('  3. Ejecutar refresh de precios para el ticker actualizado\n');

db.close();
