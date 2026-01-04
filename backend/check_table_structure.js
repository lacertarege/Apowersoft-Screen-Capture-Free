import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

// Ver estructura de la tabla
console.log('📋 Estructura de tabla precios_historicos:\n');
const schema = db.prepare("PRAGMA table_info(precios_historicos)").all();
schema.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

db.close();
