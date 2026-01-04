import Database from 'better-sqlite3';
import fs from 'fs';

const csvPath = './tickers_exchange_assignment.csv';
const db = new Database('./data/investments.db');

console.log('='.repeat(80));
console.log('IMPORTANDO EXCHANGES DESDE CSV - VERSIÓN SIMPLE (SIN DUPLICACIÓN)');
console.log('='.repeat(80));

// Verificar que el archivo existe
if (!fs.existsSync(csvPath)) {
    console.error('\n❌ ERROR: Archivo no encontrado:', csvPath);
    console.error('Ejecuta primero: node export_tickers_for_exchange.js\n');
    process.exit(1);
}

// Leer CSV
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim());

// Detectar delimitador (coma o punto y coma)
const firstLine = lines[0];
const delimiter = firstLine.includes(';') ? ';' : ',';
console.log(`\nDelimitador detectado: ${delimiter === ';' ? 'punto y coma (;)' : 'coma (,)'}`);

// Parse headers
const headers = lines[0].split(delimiter).map(h => h.trim());
const exchangeIndex = headers.indexOf('exchange_confirmado');

if (exchangeIndex === -1) {
    console.error('\n❌ ERROR: Columna "exchange_confirmado" no encontrada en CSV');
    console.error('Headers encontrados:', headers);
    console.error('\n');
    process.exit(1);
}

console.log('✓ Archivo CSV cargado:', csvPath);
console.log('✓ Total líneas:', lines.length - 1, '(sin contar header)\n');

// Paso 1: Agregar columna exchange si no existe
try {
    db.prepare('ALTER TABLE tickers ADD COLUMN exchange TEXT').run();
    console.log('✓ Columna "exchange" agregada a tabla tickers');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('✓ Columna "exchange" ya existe');
    } else {
        throw e;
    }
}

// Paso 2: NO modificar constraint UNIQUE
// Mantenemos UNIQUE(ticker) para evitar duplicados
console.log('✓ Manteniendo constraint UNIQUE(ticker) - NO se crearán duplicados');

// Paso 3: Procesar cada línea del CSV
console.log('\n' + '='.repeat(80));
console.log('PROCESANDO ASIGNACIONES');
console.log('='.repeat(80) + '\n');

const validExchanges = ['BVL', 'NYSE', 'NASDAQ'];
const tickerAssignments = new Map();  // id -> exchange

let errors = 0;
let warnings = 0;

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split por delimitador
    const fields = line.split(delimiter).map(f => f.trim().replace(/^"|"$/g, ''));

    if (fields.length < exchangeIndex + 1) {
        console.error(`⚠️  Línea ${i + 1}: Formato inválido (${fields.length} campos, esperados ${exchangeIndex + 1}), omitiendo`);
        errors++;
        continue;
    }

    const id = parseInt(fields[0]);
    const ticker = fields[1];
    const exchange = fields[exchangeIndex].trim().toUpperCase();

    if (isNaN(id)) {
        console.error(`⚠️  Línea ${i + 1}: ID no válido "${fields[0]}", omitiendo`);
        errors++;
        continue;
    }

    if (!exchange) {
        console.log(`⚠️  Línea ${i + 1}: Ticker "${ticker}" (ID ${id}) sin exchange asignado, omitiendo`);
        continue;
    }

    if (!validExchanges.includes(exchange)) {
        console.error(`❌ Línea ${i + 1}: Exchange "${exchange}" no válido. Debe ser: ${validExchanges.join(', ')}`);
        errors++;
        continue;
    }

    // Si ya hay una asignación para este ID
    if (tickerAssignments.has(id)) {
        const prevExchange = tickerAssignments.get(id);
        if (prevExchange !== exchange) {
            console.log(`⚠️  Línea ${i + 1}: Ticker ID ${id} (${ticker}) aparece con diferentes exchanges`);
            console.log(`    Usando primera aparición: ${prevExchange}, ignorando: ${exchange}`);
            warnings++;
        }
        continue;
    }

    tickerAssignments.set(id, exchange);
}

// Paso 4: Actualizar tickers (SIN DUPLICAR)
console.log('\nActualizando exchanges...\n');

let processed = 0;

for (const [id, exchange] of tickerAssignments.entries()) {
    const ticker = db.prepare('SELECT * FROM tickers WHERE id = ?').get(id);

    if (!ticker) {
        console.error(`❌ Ticker ID ${id} no encontrado en BD`);
        errors++;
        continue;
    }

    db.prepare('UPDATE tickers SET exchange = ? WHERE id = ?').run(exchange, id);
    console.log(`✓ ${ticker.ticker.padEnd(12)} → ${exchange}`);
    processed++;
}

console.log('\n' + '='.repeat(80));
console.log('RESUMEN');
console.log('='.repeat(80));
console.log(`✓ Tickers actualizados: ${processed}`);
if (warnings > 0) {
    console.log(`⚠️  Advertencias: ${warnings} (filas duplicadas ignoradas)`);
}
if (errors > 0) {
    console.log(`❌ Errores: ${errors}`);
}

// Paso 5: Verificar resultado
console.log('\n' + '='.repeat(80));
console.log('VERIFICACIÓN');
console.log('='.repeat(80) + '\n');

const tickersWithExchange = db.prepare(`
  SELECT ticker, exchange
  FROM tickers
  WHERE exchange IS NOT NULL
  ORDER BY ticker
`).all();

console.log('Tickers con exchange asignado:\n');
tickersWithExchange.forEach(t => {
    console.log(`  ${t.ticker.padEnd(12)} | ${t.exchange}`);
});

const tickersWithoutExchange = db.prepare(`
  SELECT COUNT(*) as count FROM tickers WHERE exchange IS NULL
`).get();

if (tickersWithoutExchange.count > 0) {
    console.log(`\n⚠️  ${tickersWithoutExchange.count} ticker(s) sin exchange asignado`);
}

// Verificar que NO hay duplicados
const duplicateCheck = db.prepare(`
  SELECT ticker, COUNT(*) as count
  FROM tickers
  GROUP BY ticker
  HAVING COUNT(*) > 1
`).all();

if (duplicateCheck.length > 0) {
    console.log('\n⚠️  ADVERTENCIA: Se encontraron tickers duplicados:');
    duplicateCheck.forEach(d => {
        console.log(`  ${d.ticker}: ${d.count} registros`);
    });
} else {
    console.log('\n✅ Sin duplicados: Cada ticker tiene un solo registro');
}

console.log('\n' + '='.repeat(80));
console.log('✅ IMPORTACIÓN COMPLETADA');
console.log('='.repeat(80));
console.log('\nNota: Cada ticker tiene UN exchange asignado.');
console.log('El campo "plataforma" en inversiones identifica dónde compraste (Tyba/Trii).');
console.log('Para tickers USA en BVL, el sistema usará precios NYSE (mejor cobertura API).\n');

db.close();
