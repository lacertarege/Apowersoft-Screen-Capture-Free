import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database('./data/investments.db');

console.log('💰 Creando tabla de dividendos BVL y cacheando datos...\n');

// 1. Crear tabla para dividendos/beneficios
console.log('📋 Creando tabla bvl_benefits...');
db.exec(`
  CREATE TABLE IF NOT EXISTS bvl_benefits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rpj_code TEXT NOT NULL,
    ticker TEXT,
    isin TEXT,
    value_type TEXT,
    benefit_type TEXT,
    amount REAL,
    currency TEXT,
    record_date TEXT,
    payment_date TEXT,
    ex_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rpj_code) REFERENCES bvl_companies(rpj_code)
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_bvl_benefits_rpj 
  ON bvl_benefits(rpj_code)
`);

console.log('✅ Tabla bvl_benefits creada\n');

// 2. Cargar datos desde benef.json
let companies;
try {
    const jsonData = readFileSync('../benef.json', 'utf-8');
    companies = JSON.parse(jsonData);
    console.log(`📋 Empresas en benef.json: ${companies.length}\n`);
} catch (error) {
    console.error('❌ Error leyendo benef.json:', error.message);
    db.close();
    process.exit(1);
}

// 3. Importar dividendos
const insertBenefit = db.prepare(`
  INSERT INTO bvl_benefits 
  (rpj_code, ticker, isin, value_type, benefit_type, amount, currency, record_date, payment_date, ex_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let imported = 0;
let companies_with_benefits = 0;

const transaction = db.transaction((companiesList) => {
    for (const company of companiesList) {
        if (!company.fixedValues || company.fixedValues.length === 0) continue;

        let company_has_benefits = false;

        for (const value of company.fixedValues) {
            if (!value.listBenefit || value.listBenefit.length === 0) continue;

            for (const benefit of value.listBenefit) {
                insertBenefit.run(
                    company.companyCode,
                    value.nemonico || null,
                    value.isin || null,
                    value.valueType || null,
                    benefit.typeBenefit || 'Dividendo',
                    benefit.benefit || null,
                    benefit.currency || null,
                    benefit.recordDate || null,
                    benefit.paymentDate || null,
                    benefit.exDate || null
                );

                imported++;
                company_has_benefits = true;
            }
        }

        if (company_has_benefits) {
            companies_with_benefits++;
        }

        if (imported % 100 === 0 && imported > 0) {
            console.log(`   Importados: ${imported} dividendos...`);
        }
    }
});

console.log('⏳ Importando dividendos...');
transaction(companies);

console.log(`\n✅ Importación completada!`);
console.log(`   ✅ Dividendos importados: ${imported}`);
console.log(`   ✅ Empresas con dividendos: ${companies_with_benefits}`);
console.log(`   📊 Total empresas: ${companies.length}`);

// 4. Verificar nuestros tickers
console.log(`\n📋 Tickers con dividendos en caché:`);
const ourTickersWithDividends = db.prepare(`
  SELECT DISTINCT t.ticker, t.nombre, COUNT(b.id) as dividends_count
  FROM tickers t
  INNER JOIN bvl_benefits b ON t.rpj_code = b.rpj_code
  WHERE t.exchange = 'BVL'
  GROUP BY t.ticker, t.nombre
  ORDER BY t.ticker
`).all();

ourTickersWithDividends.forEach(t => {
    console.log(`   ✅ ${t.ticker.padEnd(15)} - ${t.dividends_count} dividendos`);
});

console.log(`\n📊 Total tickers BVL con dividendos: ${ourTickersWithDividends.length}`);

db.close();
console.log('\n✅ Dividendos BVL cacheados localmente!');
