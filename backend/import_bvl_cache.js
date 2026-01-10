import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database('./data/investments.db');

console.log('📥 Importando datos BVL desde RPJ_CODES.json...\n');

// 1. Cargar JSON
let companies;
try {
    const jsonData = readFileSync('../RPJ_CODES.json', 'utf-8');
    companies = JSON.parse(jsonData);
    console.log(`📋 Empresas en JSON: ${companies.length}\n`);
} catch (error) {
    console.error('❌ Error leyendo JSON:', error.message);
    process.exit(1);
}

// 2. Preparar statement de inserción
const insertCompany = db.prepare(`
  INSERT OR REPLACE INTO bvl_companies 
  (rpj_code, company_name, sector_code, sector_description, stock, indices, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

// 3. Importar solo empresas con stock (que tienen tickers)
let imported = 0;
let skipped = 0;

const transaction = db.transaction((companiesList) => {
    for (const company of companiesList) {
        // Solo importar si tiene stock (tickers)
        if (!company.stock || company.stock.length === 0) {
            skipped++;
            continue;
        }

        insertCompany.run(
            company.companyCode,
            company.companyName,
            company.sectorCode,
            company.sectorDescription,
            JSON.stringify(company.stock),
            JSON.stringify(company.index || [])
        );

        imported++;

        if (imported % 100 === 0) {
            console.log(`   Importadas: ${imported}...`);
        }
    }
});

console.log('⏳ Importando...');
transaction(companies);

console.log(`\n✅ Importación completada!`);
console.log(`   ✅ Importadas: ${imported}`);
console.log(`   ⏭️  Sin stock (skipped): ${skipped}`);
console.log(`   📊 Total: ${companies.length}`);

// 4. Verificar empresas de nuestros tickers
console.log(`\n📋 Verificando tickers vinculados:`);
const ourTickers = db.prepare(`
  SELECT t.ticker, t.rpj_code, c.company_name, c.sector_description
  FROM tickers t
  LEFT JOIN bvl_companies c ON t.rpj_code = c.rpj_code
  WHERE t.exchange = 'BVL' AND t.rpj_code IS NOT NULL
  ORDER BY t.ticker
`).all();

ourTickers.forEach(t => {
    const status = t.company_name ? '✅' : '❌';
    console.log(`   ${status} ${t.ticker.padEnd(15)} ${t.company_name || 'No encontrado en caché'}`);
});

db.close();
console.log('\n✅ Datos BVL cacheados localmente!');
