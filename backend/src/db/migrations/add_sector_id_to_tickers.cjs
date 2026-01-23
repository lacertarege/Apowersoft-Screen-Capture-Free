
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../../data/investments.db');
console.log('Opening database at:', dbPath);
const db = new Database(dbPath);

try {
    console.log('Checking for sector_id column in tickers...');
    const tableInfo = db.prepare("PRAGMA table_info(tickers)").all();
    const hasColumn = tableInfo.some(c => c.name === 'sector_id');

    if (!hasColumn) {
        console.log('Adding sector_id column...');
        db.prepare("ALTER TABLE tickers ADD COLUMN sector_id INTEGER REFERENCES sectores(id)").run();
        console.log('Column added successfully.');
    } else {
        console.log('Column sector_id already exists.');
    }

    // Verify
    const updatedInfo = db.prepare("PRAGMA table_info(tickers)").all();
    console.log('Updated Schema:', updatedInfo.map(c => c.name).join(', '));

} catch (error) {
    console.error('Migration failed:', error);
}
