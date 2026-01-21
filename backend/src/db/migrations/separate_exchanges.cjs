const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../../data/investments.db');
const db = new Database(dbPath);

console.log('Running migration: separate_exchanges.js');

try {
    db.transaction(() => {
        // 1. Create exchanges table
        console.log('Creating exchanges table...');
        db.exec(`
      CREATE TABLE IF NOT EXISTS exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        pais TEXT,
        moneda_principal TEXT DEFAULT 'USD',
        activo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

        // 2. Insert unique exchanges
        console.log('Inserting unique exchanges...');
        const insertExchange = db.prepare('INSERT OR IGNORE INTO exchanges (nombre, moneda_principal) VALUES (?, ?)');
        insertExchange.run('BVL', 'PEN');
        insertExchange.run('NYSE', 'USD');
        insertExchange.run('NASDAQ', 'USD');
        // Also cover "NYSE/NASDAQ" if it exists in data
        insertExchange.run('NYSE/NASDAQ', 'USD');

        // 3. Alter plataformas table
        console.log('Altering plataformas table...');
        const tableInfo = db.prepare('PRAGMA table_info(plataformas)').all();
        if (!tableInfo.find(c => c.name === 'exchange_id')) {
            db.exec('ALTER TABLE plataformas ADD COLUMN exchange_id INTEGER REFERENCES exchanges(id)');
        }

        // 4. Update plataformas.exchange_id based on exchange text
        console.log('Updating plataformas.exchange_id...');
        const updates = db.prepare(`
        UPDATE plataformas 
        SET exchange_id = (SELECT id FROM exchanges WHERE nombre = plataformas.exchange OR (plataformas.exchange = 'NYSE/NASDAQ' AND exchanges.nombre = 'NYSE/NASDAQ'))
        WHERE exchange IS NOT NULL
    `);
        updates.run();

        // 5. Alter inversiones table
        console.log('Altering inversiones table...');
        const invInfo = db.prepare('PRAGMA table_info(inversiones)').all();
        if (!invInfo.find(c => c.name === 'plataforma_id')) {
            db.exec('ALTER TABLE inversiones ADD COLUMN plataforma_id INTEGER REFERENCES plataformas(id)');
        }
        if (!invInfo.find(c => c.name === 'exchange_id')) {
            db.exec('ALTER TABLE inversiones ADD COLUMN exchange_id INTEGER REFERENCES exchanges(id)');
        }

        // 6. Update inversiones relationships
        console.log('Updating inversiones relationships...');
        // Update plataforma_id based on plataforma text
        db.exec(`
      UPDATE inversiones 
      SET plataforma_id = (SELECT id FROM plataformas WHERE nombre = inversiones.plataforma)
      WHERE plataforma IS NOT NULL
    `);

        // Update exchange_id based on plataforma's exchange
        db.exec(`
      UPDATE inversiones 
      SET exchange_id = (SELECT exchange_id FROM plataformas WHERE id = inversiones.plataforma_id)
      WHERE plataforma_id IS NOT NULL
    `);

        // 7. Alter dividendos table
        console.log('Altering dividendos table...');
        const divInfo = db.prepare('PRAGMA table_info(dividendos)').all();
        if (!divInfo.find(c => c.name === 'exchange_id')) {
            db.exec('ALTER TABLE dividendos ADD COLUMN exchange_id INTEGER REFERENCES exchanges(id)');
        }

        // 8. Update dividendos relationships
        console.log('Updating dividendos relationships...');
        // First ensure plataforma_id is set if missing (optional but good)

        // Update exchange_id based on mercado text
        db.exec(`
      UPDATE dividendos 
      SET exchange_id = (SELECT id FROM exchanges WHERE nombre = dividendos.mercado)
      WHERE mercado IS NOT NULL
    `);

        console.log('Migration completed successfully.');
    })();
} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}
