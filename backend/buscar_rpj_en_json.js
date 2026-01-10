import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database('./data/investments.db');

console.log('🔍 Buscando códigos RPJ faltantes en RPJ_CODES.json...\n');

// 1. Obtener tickers sin rpj_code
const missingTickers = db.prepare(`
  SELECT id, ticker, nombre 
  FROM tickers 
  WHERE exchange = 'BVL' AND rpj_code IS NULL
  ORDER BY ticker
`).all();

console.log(`📊 Tickers sin RPJ code: ${missingTickers.length}\n`);

if (missingTickers.length === 0) {
    console.log('✅ Todos los tickers BVL ya tienen RPJ code!');
    db.close();
    process.exit(0);
}

// 2. Cargar JSON de códigos BVL
let bvlCompanies;
try {
    const jsonData = readFileSync('../RPJ_CODES.json', 'utf-8');
    bvlCompanies = JSON.parse(jsonData);
    console.log(`📋 Empresas en JSON: ${bvlCompanies.length}\n`);
} catch (error) {
    console.error('❌ Error leyendo RPJ_CODES.json:', error.message);
    db.close();
    process.exit(1);
}

// 3. Buscar cada ticker en el JSON
let found = 0;
let notFound = 0;

for (const ticker of missingTickers) {
    console.log(`🔍 Buscando ${ticker.ticker} - ${ticker.nombre}...`);

    // Buscar por ticker symbol en el array "stock"
    const matchByTicker = bvlCompanies.find(company =>
        company.stock && company.stock.includes(ticker.ticker)
    );

    if (matchByTicker) {
        db.prepare('UPDATE tickers SET rpj_code = ? WHERE id = ?').run(
            matchByTicker.companyCode,
            ticker.id
        );
        console.log(`   ✅ Encontrado: ${matchByTicker.companyName} (${matchByTicker.companyCode})`);
        console.log(`      Sector: ${matchByTicker.sectorDescription} `);
        console.log(`      Tickers: ${matchByTicker.stock.join(', ')} `);
        found++;
        continue;
    }

    // Si no se encuentra por ticker, buscar por nombre de empresa (fuzzy match)
    const nombreParts = ticker.nombre.toLowerCase().split(' ');
    const matchByName = bvlCompanies.find(company => {
        const companyNameLower = company.companyName.toLowerCase();
        return nombreParts.some(part =>
            part.length > 3 && companyNameLower.includes(part)
        );
    });

    if (matchByName) {
        console.log(`   ⚠️  Posible match por nombre: `);
        console.log(`      ${matchByName.companyName} (${matchByName.companyCode})`);
        console.log(`      Tickers: ${matchByName.stock.join(', ')} `);
        console.log(`      ¿Vincular ? (requiere confirmación manual)`);
        // No actualizar automáticamente, solo sugerir
        notFound++;
    } else {
        console.log(`   ❌ No encontrado en JSON`);
        notFound++;
    }

    console.log('');
}

console.log(`\n📊 Resumen: `);
console.log(`   ✅ Encontrados y vinculados: ${found} `);
console.log(`   ❌ No encontrados: ${notFound} `);

db.close();
console.log('\n✅ Búsqueda completada!');
