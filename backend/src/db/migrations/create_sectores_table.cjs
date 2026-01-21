const { createDb } = require('../setup/db.js');
const db = createDb('./data/investments.db');

const initialSectores = [
    'Energía',
    'Materiales',
    'Industrial',
    'Consumo Discrecional',
    'Consumo Masivo',
    'Salud',
    'Financiero',
    'Tecnología',
    'Servicios de Comunicación',
    'Utilidades (Public Services)',
    'Bienes Raíces',
    'Fondos Mutuos / ETFs',
    'Otros'
];

try {
    console.log('Creating sectores table...');
    db.prepare(`
    CREATE TABLE IF NOT EXISTS sectores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    )
  `).run();
    console.log('sectores table created.');

    console.log('Seeding sectores...');
    const insert = db.prepare('INSERT OR IGNORE INTO sectores (nombre) VALUES (?)');
    const insertMany = db.transaction((sectores) => {
        for (const sector of sectores) insert.run(sector);
    });
    insertMany(initialSectores);
    console.log('Sectores seeded.');

    console.log('Adding sector_id to tickers...');
    try {
        db.prepare('ALTER TABLE tickers ADD COLUMN sector_id INTEGER DEFAULT NULL REFERENCES sectores(id)').run();
        console.log('sector_id column added.');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('sector_id column already exists.');
        } else {
            throw err;
        }
    }

} catch (error) {
    console.error('Migration failed:', error);
}
