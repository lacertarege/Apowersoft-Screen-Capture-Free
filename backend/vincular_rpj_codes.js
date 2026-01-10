import Database from 'better-sqlite3';
import { request } from 'undici';

const db = new Database('./data/investments.db');

console.log('🔗 Vinculando tickers BVL con códigos RPJ...\n');

// Función para buscar empresa en BVL
async function searchBVL(companyQuery) {
    try {
        const response = await request('https://dataondemand.bvl.com.pe/v1/issuers/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                firstLetter: '',
                sectorCode: '',
                companyName: companyQuery
            })
        });

        if (response.statusCode !== 200) {
            return null;
        }

        const data = await response.body.json();
        return data;
    } catch (error) {
        console.error(`Error buscando ${companyQuery}:`, error.message);
        return null;
    }
}

// Función para encontrar el mejor match
function findBestMatch(results, tickerSymbol) {
    if (!results || results.length === 0) return null;

    // Buscar coincidencia exacta de ticker
    for (const company of results) {
        if (company.stock && company.stock.includes(tickerSymbol)) {
            return company;
        }
    }

    // Si no hay coincidencia exacta, devolver el primero
    return results.length === 1 ? results[0] : null;
}

async function main() {
    // 1. Obtener todos los tickers BVL sin rpj_code
    const bvlTickers = db.prepare(`
    SELECT id, ticker, nombre, rpj_code 
    FROM tickers 
    WHERE exchange = 'BVL' 
    ORDER BY ticker
  `).all();

    console.log(`📊 Encontrados ${bvlTickers.length} tickers BVL\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const ticker of bvlTickers) {
        // Si ya tiene rpj_code, saltar
        if (ticker.rpj_code) {
            console.log(`⏭️  ${ticker.ticker}: Ya tiene rpj_code (${ticker.rpj_code})`);
            skipped++;
            continue;
        }

        console.log(`🔍 Buscando ${ticker.ticker} - ${ticker.nombre}...`);

        // Buscar por nombre de empresa (más confiable que por ticker)
        const searchQuery = ticker.nombre.split(' ')[0]; // Primera palabra del nombre
        const results = await searchBVL(searchQuery);

        if (!results || results.length === 0) {
            console.log(`   ❌ No encontrado en BVL`);
            notFound++;
            continue;
        }

        const match = findBestMatch(results, ticker.ticker);

        if (!match) {
            console.log(`   ⚠️  Múltiples resultados, requiere selección manual:`);
            results.slice(0, 3).forEach(r => {
                console.log(`      - ${r.companyName} (${r.companyCode}) [${r.stock.join(', ')}]`);
            });
            notFound++;
            continue;
        }

        // Actualizar en BD
        db.prepare('UPDATE tickers SET rpj_code = ? WHERE id = ?').run(match.companyCode, ticker.id);

        console.log(`   ✅ ${ticker.ticker} → ${match.companyCode} (${match.companyName})`);
        console.log(`      Sector: ${match.sectorDescription}`);
        console.log(`      Tickers: ${match.stock.join(', ')}`);
        updated++;

        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ⏭️  Ya tenían código: ${skipped}`);
    console.log(`   ❌ No encontrados: ${notFound}`);
    console.log(`   📋 Total: ${bvlTickers.length}`);
}

main()
    .then(() => {
        console.log('\n✅ Vinculación completada!');
        db.close();
    })
    .catch(error => {
        console.error('\n❌ Error:', error);
        db.close();
        process.exit(1);
    });
