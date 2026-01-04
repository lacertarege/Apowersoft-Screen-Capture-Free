import Database from 'better-sqlite3';

const db = new Database('./data/investments.db');

console.log('='.repeat(80));
console.log('BÚSQUEDA: Panoro Minerals en tabla TICKERS');
console.log('='.repeat(80));

const query = `
  SELECT * FROM tickers 
  WHERE LOWER(nombre) LIKE LOWER('%panoro%') 
     OR LOWER(ticker) LIKE LOWER('%panoro%')
`;

const results = db.prepare(query).all();

if (results.length === 0) {
    console.log('\n❌ No se encontró ningún registro con "panoro" en la tabla tickers\n');
} else {
    console.log(`\n✅ Se encontraron ${results.length} registro(s):\n`);
    results.forEach((row, index) => {
        console.log(`--- Registro ${index + 1} ---`);
        console.log(`ID:                ${row.id}`);
        console.log(`Ticker:            ${row.ticker}`);
        console.log(`Nombre:            ${row.nombre}`);
        console.log(`Moneda:            ${row.moneda}`);
        console.log(`Tipo Inversión ID: ${row.tipo_inversion_id}`);
        console.log(`Estado:            ${row.estado}`);
        console.log('');
    });
}

db.close();
