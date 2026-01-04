import Database from 'better-sqlite3';
import { fetchDailyHistory } from './src/sources/marketData.js';

const db = new Database('./data/investments.db');

async function testPML() {
    console.log('='.repeat(80));
    console.log('TEST MANUAL: Actualizando PML con exchange BVL');
    console.log('='.repeat(80));

    // Obtener info de PML
    const pml = db.prepare('SELECT id, ticker, exchange FROM tickers WHERE ticker = ?').get('PML');
    console.log('\n📋 Datos de PML en BD:');
    console.log(JSON.stringify(pml, null, 2));

    if (!pml) {
        console.error('❌ PML no encontrado en BD');
        process.exit(1);
    }

    // Crear objeto ticker
    const tickerObj = { ticker: pml.ticker, exchange: pml.exchange || 'NYSE' };
    console.log('\n📦 Objeto ticker para API:');
    console.log(JSON.stringify(tickerObj, null, 2));

    // Obtener fecha de primera compra
    const primeraCompra = db.prepare(`
    SELECT MIN(fecha) as fecha 
    FROM inversiones 
    WHERE ticker_id = ?
  `).get(pml.id);

    const fromDate = primeraCompra?.fecha || '2023-05-22';
    const toDate = '2026-01-04';

    console.log(`\n📅 Rango de fechas: ${fromDate} a ${toDate}`);
    console.log('\n🔍 Llamando a fetchDailyHistory...\n');

    try {
        const result = await fetchDailyHistory(tickerObj, fromDate, toDate);

        console.log('\n📊 Resultado:');
        console.log(`   Items: ${result.items?.length || 0}`);
        console.log(`   Source: ${result.source}`);
        console.log(`   Attempts: ${result.attempts?.length || 0}`);

        if (result.attempts && result.attempts.length > 0) {
            console.log('\n📝 Detalles de intentos:');
            result.attempts.forEach((attempt, i) => {
                console.log(`   ${i + 1}. ${attempt.source}: ${attempt.status} - ${attempt.message}`);
            });
        }

        if (result.items && result.items.length > 0) {
            console.log('\n✅ Primeros 5 precios obtenidos:');
            result.items.slice(0, 5).forEach(item => {
                console.log(`   ${item.fecha}: $${item.precio}`);
            });

            console.log('\n✅ Últimos 5 precios obtenidos:');
            result.items.slice(-5).forEach(item => {
                console.log(`   ${item.fecha}: $${item.precio}`);
            });
        } else {
            console.log('\n⚠️  No se obtuvieron precios');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }

    console.log('\n' + '='.repeat(80));
    db.close();
}

testPML().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
