const Database = require('better-sqlite3');
const db = new Database('./data/investments.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLAS EN LA BASE DE DATOS ===\n');
tables.forEach((t, i) => console.log(`${i + 1}. ${t.name}`));
console.log(`\nTotal: ${tables.length} tablas`);
