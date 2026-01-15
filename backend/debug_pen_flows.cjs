const db = require('better-sqlite3')('./data/investments.db');

// 1. Flujo Neto calculado como en el endpoint /series (excluye reinversiones)
const flujoNeto = db.prepare(`
  SELECT 
    SUM(CASE 
      WHEN tipo_operacion = 'INVERSION' AND (origen_capital IS NULL OR origen_capital != 'REINVERSION') 
      THEN importe 
      ELSE 0 
    END) as aportes_frescos,
    SUM(CASE 
      WHEN tipo_operacion = 'DESINVERSION' 
      THEN importe 
      ELSE 0 
    END) as retiros
  FROM inversiones i 
  JOIN tickers t ON i.ticker_id = t.id 
  WHERE t.moneda = 'PEN'
`).get();

console.log('=== ANÁLISIS DE FLUJOS PEN ===');
console.log('Aportes Frescos (excl reinversiones):', flujoNeto.aportes_frescos?.toFixed(2));
console.log('Retiros:', flujoNeto.retiros?.toFixed(2));
console.log('Flujo Neto:', (flujoNeto.aportes_frescos - flujoNeto.retiros).toFixed(2));

// 2. Capital Invertido como en Empresas (Qty * CPP para cada ticker)
const tickers = db.prepare(`
  SELECT t.id, t.ticker 
  FROM tickers t 
  JOIN inversiones i ON i.ticker_id = t.id 
  WHERE t.moneda = 'PEN'
  GROUP BY t.id
`).all();

let totalCapitalInvertido = 0;

tickers.forEach(ticker => {
    const invs = db.prepare('SELECT * FROM inversiones WHERE ticker_id = ? ORDER BY fecha').all(ticker.id);
    let qty = 0, cpp = 0;

    invs.forEach(i => {
        const a = Number(i.importe), q = Number(i.cantidad);
        if (i.tipo_operacion === 'INVERSION') {
            const old = qty * cpp;
            qty += q;
            cpp = qty > 0 ? (old + a) / qty : 0;
        } else if (i.tipo_operacion === 'DESINVERSION') {
            qty -= q;
            if (qty < 0.01) { qty = 0; cpp = 0; }
        }
    });

    const capitalInvertido = qty * cpp;
    if (qty > 0) {
        console.log(`  ${ticker.ticker}: Qty=${qty.toFixed(2)}, CPP=${cpp.toFixed(4)}, Capital=${capitalInvertido.toFixed(2)}`);
    }
    totalCapitalInvertido += capitalInvertido;
});

console.log('\n=== COMPARACIÓN ===');
console.log('Flujo Neto (gráfico Dashboard):', (flujoNeto.aportes_frescos - flujoNeto.retiros).toFixed(2));
console.log('Capital Invertido (Empresas):', totalCapitalInvertido.toFixed(2));
console.log('Diferencia:', (totalCapitalInvertido - (flujoNeto.aportes_frescos - flujoNeto.retiros)).toFixed(2));
