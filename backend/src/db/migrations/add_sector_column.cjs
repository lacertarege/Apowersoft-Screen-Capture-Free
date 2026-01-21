const { createDb } = require('../setup/db.js');
const db = createDb('./data/investments.db');

try {
    console.log('Adding sector column to tickers table...');
    db.prepare('ALTER TABLE tickers ADD COLUMN sector TEXT DEFAULT NULL').run();
    console.log('Column sector added successfully.');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('Column sector already exists.');
    } else {
        console.error('Error adding column:', error);
    }
}
