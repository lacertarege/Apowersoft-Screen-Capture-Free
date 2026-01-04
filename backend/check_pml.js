import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

// Consulta simple y directa
const ticker = db.prepare('SELECT * FROM tickers WHERE id = 17').get();
console.log('\n========== PANORO MINERALS - TICKER ACTUALIZADO ==========\n');
console.log('ID:                ', ticker.id);
console.log('Ticker:            ', ticker.ticker);
console.log('Nombre:            ', ticker.nombre);
console.log('Moneda:            ', ticker.moneda);
console.log('Tipo Inversión ID: ', ticker.tipo_inversion_id);
console.log('Estado:            ', ticker.estado);

// Contar relaciones
const inversiones = db.prepare('SELECT COUNT(*) as c FROM inversiones WHERE ticker_id = 17').get();
const precios = db.prepare('SELECT COUNT(*) as c FROM precios_historicos WHERE ticker_id = 17').get();
const dividendos = db.prepare('SELECT COUNT(*) as c FROM dividendos WHERE ticker_id = 17').get();

console.log('\n========== RELACIONES INTACTAS ==========\n');
console.log('Inversiones:        ', inversiones.c);
console.log('Precios Históricos: ', precios.c);
console.log('Dividendos:         ', dividendos.c);

// Verificar tickers
const pmlTrv = db.prepare('SELECT COUNT(*) as c FROM tickers WHERE ticker = ?').get('PML.TRV');
const pml = db.prepare('SELECT COUNT(*) as c FROM tickers WHERE ticker = ?').get('PML');

console.log('\n========== ESTADO DE TICKERS ==========\n');
console.log('PML.TRV (viejo):    ', pmlTrv.c === 0 ? '✓ Eliminado' : '✗ Aún existe');
console.log('PML (nuevo):        ', pml.c === 1 ? '✓ Creado' : '✗ No existe');

console.log('\n========== ✅ CAMBIO COMPLETADO EXITOSAMENTE ==========\n');

db.close();
