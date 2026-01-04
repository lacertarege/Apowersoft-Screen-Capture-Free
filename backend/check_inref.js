import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

// Ver estructura de la tabla tickers
console.log('📋 Estructura de tabla tickers:\n');
const schema = db.prepare("PRAGMA table_info(tickers)").all();
schema.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

// Ver INREF
console.log('\n📋 Datos de INREF:');
const inref = db.prepare('SELECT * FROM tickers WHERE ticker = ?').get('INREF');
if (inref) {
    console.log(JSON.stringify(inref, null, 2));
} else {
    console.log('  No encontrado');
}

db.close();
