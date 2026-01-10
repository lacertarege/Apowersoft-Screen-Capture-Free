import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('🔧 Agregando campo rpj_code a tabla tickers...\n');

try {
    // 1. Verificar si la columna ya existe
    const tableInfo = db.prepare("PRAGMA table_info(tickers)").all();
    const hasRpjCode = tableInfo.some(col => col.name === 'rpj_code');

    if (hasRpjCode) {
        console.log('✅ La columna rpj_code ya existe');
    } else {
        // 2. Agregar la columna
        db.prepare('ALTER TABLE tickers ADD COLUMN rpj_code TEXT').run();
        console.log('✅ Columna rpj_code agregada');

        // 3. Crear índice para búsquedas rápidas
        db.prepare('CREATE INDEX IF NOT EXISTS idx_tickers_rpj_code ON tickers(rpj_code)').run();
        console.log('✅ Índice idx_tickers_rpj_code creado');
    }

    // 4. Mostrar estructura actualizada
    console.log('\n📋 Estructura actual de tabla tickers:');
    const updatedSchema = db.prepare("PRAGMA table_info(tickers)").all();
    updatedSchema.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });

    // 5. Contar tickers sin rpj_code
    const withoutRpjCode = db.prepare(`
    SELECT COUNT(*) as count 
    FROM tickers 
    WHERE rpj_code IS NULL
  `).get();

    console.log(`\n📊 Tickers sin rpj_code: ${withoutRpjCode.count}`);
    console.log('   (Estos pueden vincularse usando el buscador BVL en el frontend)');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

console.log('\n✅ Migración completada!');
db.close();
