const { createDb } = require('./src/setup/db.js');
const db = createDb('./data/investments.db');

const rows = db.prepare('SELECT * FROM sectores').all();
console.log('Sectores count:', rows.length);
console.log('First 5 sectors:', rows.slice(0, 5));
