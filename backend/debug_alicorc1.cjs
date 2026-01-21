const db = require('better-sqlite3')('./data/investments.db');

// Obtener datos de ALICORC1
const ticker = db.prepare(`
  SELECT v.id, v.ticker, v.precio_reciente, 
         (SELECT COALESCE(SUM(monto), 0) FROM dividendos WHERE ticker_id = v.id) as total_dividends 
  FROM v_resumen_empresas v 
  WHERE v.ticker = 'ALICORC1'
`).get();

console.log('=== DATOS ALICORC1 ===');
console.log('ID:', ticker.id);
console.log('Precio:', ticker.precio_reciente);
console.log('Dividendos:', ticker.total_dividends);

// Calcular posición
const invs = db.prepare('SELECT * FROM inversiones WHERE ticker_id = ? ORDER BY fecha').all(ticker.id);
let qty = 0, cpp = 0, realGain = 0;
invs.forEach(i => {
    const a = Number(i.importe), q = Number(i.cantidad);
    if (i.tipo_operacion === 'INVERSION') {
        const old = qty * cpp;
        qty += q;
        cpp = qty > 0 ? (old + a) / qty : 0;
    } else if (i.tipo_operacion === 'DESINVERSION') {
        const cost = q * cpp;
        realGain += (a - cost);
        qty -= q;
        if (qty < 0.01) { qty = 0; cpp = 0; }
    }
});

const importe_total = qty * cpp;
const balance = qty * ticker.precio_reciente;
const unrealizedGain = balance - importe_total;
const dividends = ticker.total_dividends || 0;
const rendimiento = unrealizedGain + realGain + dividends;
const rentabilidad = importe_total > 0 ? rendimiento / importe_total : 0;

console.log('\n=== CALCULOS ===');
console.log('Cantidad:', qty);
console.log('CPP:', cpp.toFixed(4));
console.log('Importe Total (Qty*CPP):', importe_total.toFixed(2));
console.log('Balance (Qty*Precio):', balance.toFixed(2));
console.log('Ganancia No Realizada:', unrealizedGain.toFixed(2));
console.log('Ganancia Realizada (Ventas):', realGain.toFixed(2));
console.log('Dividendos:', dividends.toFixed(2));
console.log('\n=== RENDIMIENTO TOTAL ===');
console.log('Rendimiento:', rendimiento.toFixed(2));
console.log('Rentabilidad:', (rentabilidad * 100).toFixed(2) + '%');
