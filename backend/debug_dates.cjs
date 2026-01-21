const Database = require('better-sqlite3');
const db = new Database('./data/investments.db');

// Simulate the endpoint calculation
const today = new Date();
const limaDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(today);

const d = new Date(limaDate);
d.setUTCDate(d.getUTCDate() - 1);
const fechaFin = d.toISOString().slice(0, 10);

console.log('Lima date (hoy):', limaDate);
console.log('fechaFin (ayer):', fechaFin);

// Test the recursive query for a specific ticker (ENGIEC1)
const tickerId = db.prepare("SELECT id FROM tickers WHERE ticker = 'ENGIEC1'").get()?.id;
if (!tickerId) {
    console.log('Ticker not found');
    process.exit(1);
}

const primeraInversion = db.prepare(`
  SELECT MIN(fecha) as fecha FROM inversiones WHERE ticker_id = ?
`).get(tickerId);

const fechaCalculoInicio = primeraInversion.fecha.slice(0, 10);
console.log('fechaCalculoInicio:', fechaCalculoInicio);
console.log('fechaVistaHasta:', fechaFin);

// Run the query to get dates
const fechasCalculo = db.prepare(`
  WITH RECURSIVE fechas_dias AS (
    SELECT DATE(?) as fecha
    UNION ALL
    SELECT DATE(fecha, '+1 day')
    FROM fechas_dias
    WHERE fecha < DATE(?, '+1 day')
  )
  SELECT fecha FROM fechas_dias
`).all(fechaCalculoInicio, fechaFin);

console.log('Total dates generated:', fechasCalculo.length);
console.log('Last 5 dates:', fechasCalculo.slice(-5));
