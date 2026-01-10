import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('🔧 Corrigiendo código de AIHC1 y creando tablas de caché BVL...\n');

// 1. Corregir código de AIHC1
console.log('📝 Actualizando AIHC1...');
db.prepare('UPDATE tickers SET rpj_code = ? WHERE ticker = ?').run('71500', 'AIHC1');
console.log('✅ AIHC1 → RPJ: 71500\n');

// 2. Crear tabla para información de empresas BVL
console.log('📋 Creando tabla bvl_companies...');
db.exec(`
  CREATE TABLE IF NOT EXISTS bvl_companies (
    rpj_code TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    sector_code TEXT,
    sector_description TEXT,
    stock TEXT, -- JSON array de tickers
    indices TEXT, -- JSON array de índices
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('✅ Tabla bvl_companies creada\n');

// 3. Crear tabla para eventos corporativos BVL
console.log('📋 Creando tabla bvl_corporate_events...');
db.exec(`
  CREATE TABLE IF NOT EXISTS bvl_corporate_events (
    id TEXT PRIMARY KEY,
    rpj_code TEXT NOT NULL,
    business_name TEXT,
    event_date TEXT,
    register_date TEXT,
    session TEXT,
    event_types TEXT, -- JSON array de tipos
    documents TEXT, -- JSON array de documentos
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rpj_code) REFERENCES bvl_companies(rpj_code)
  )
`);

// Índice para búsquedas rápidas por rpj_code
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_bvl_events_rpj 
  ON bvl_corporate_events(rpj_code, event_date DESC)
`);
console.log('✅ Tabla bvl_corporate_events creada\n');

// 4. Mostrar estructura
console.log('📊 Tablas creadas:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'bvl%'").all();
tables.forEach(t => console.log(`   - ${t.name}`));

console.log('\n✅ Migración completada!');
console.log('\n💡 Próximo paso: Popular las tablas con datos de RPJ_CODES.json');

db.close();
