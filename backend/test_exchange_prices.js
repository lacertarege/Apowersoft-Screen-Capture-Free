import Database from 'better-sqlite3';
import { fetchPriceForSymbol } from './src/sources/marketData.js';

const db = new Database('./data/investments.db');

console.log('='.repeat(80));
console.log('TEST: Verificando fetch de precios con exchange field');
console.log('='.repeat(80));

async function testFetch() {
    // Obtener algunos tickers con exchange
    const tickers = db.prepare(`
    SELECT id, ticker, nombre, exchange 
    FROM tickers 
    WHERE ticker IN ('PML', 'AMZN', 'GOOGL', 'BAP')
    LIMIT 5
  `).all();

    console.log(`\nEncontrados ${tickers.length} tickers para probar:\n`);

    for (const tickerObj of tickers) {
        console.log(`\nTicker: ${tickerObj.ticker} (${tickerObj.nombre})`);
        console.log(`Exchange: ${tickerObj.exchange || 'NULL (usará NYSE por defecto)'}`);

        try {
            const start = Date.now();
            const { price, source } = await fetchPriceForSymbol(tickerObj);
            const elapsed = Date.now() - start;

            console.log(`✅ Precio: $${price}`);
            console.log(`   Fuente: ${source}`);
            console.log(`   Tiempo: ${elapsed}ms`);
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Test completado');
    console.log('='.repeat(80));
}

testFetch()
    .then(() => {
        db.close();
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Error fatal:', err);
        db.close();
        process.exit(1);
    });
