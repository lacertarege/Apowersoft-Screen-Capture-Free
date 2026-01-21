const { createDb } = require('../../setup/db.js');
const db = createDb('./data/investments.db');

const sectoresData = [
    { nombre: 'Financiero', descripcion: 'Bancos, seguros y holdings financieros.' },
    { nombre: 'Materiales', descripcion: 'Minería, metales, químicos y construcción.' },
    { nombre: 'Consumo Masivo', descripcion: 'Productos de primera necesidad (comida, higiene).' },
    { nombre: 'Consumo Discrecional', descripcion: 'Bienes de lujo, ocio, hoteles y retail no esencial.' },
    { nombre: 'Energía', descripcion: 'Petróleo, gas y combustibles fósiles.' },
    { nombre: 'Industrial', descripcion: 'Transporte, logística y maquinaria.' },
    { nombre: 'Utilidades (Public Services)', descripcion: 'Servicios públicos (luz, agua, gas).' },
    { nombre: 'Salud', descripcion: 'Farmacéuticas, clínicas y biotecnología.' },
    { nombre: 'Tecnología', descripcion: 'Software, hardware y semiconductores.' },
    { nombre: 'Servicios de Comunicación', descripcion: 'Telefonía, medios y redes sociales.' },
    { nombre: 'Bienes Raíces', descripcion: 'Fideicomisos inmobiliarios (REITs).' },
    { nombre: 'Fondos Mutuos / ETFs', descripcion: 'Fondos de inversión y ETFs.' },
    { nombre: 'Otros', descripcion: 'Otros sectores no clasificados.' }
];

try {
    console.log('Adding descripcion column to sectores table...');
    try {
        db.prepare('ALTER TABLE sectores ADD COLUMN descripcion TEXT DEFAULT NULL').run();
        console.log('descripcion column added.');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('descripcion column already exists.');
        } else {
            throw err;
        }
    }

    console.log('Updating sectores data...');
    const update = db.prepare('UPDATE sectores SET descripcion = ? WHERE nombre = ?');
    const insert = db.prepare('INSERT OR IGNORE INTO sectores (nombre, descripcion) VALUES (?, ?)');

    const updateMany = db.transaction((sectores) => {
        for (const s of sectores) {
            const info = update.run(s.descripcion, s.nombre);
            if (info.changes === 0) {
                insert.run(s.nombre, s.descripcion);
            }
        }
    });

    updateMany(sectoresData);
    console.log('Sectores updated successfully.');

} catch (error) {
    console.error('Migration failed:', error);
}
