import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const db = new Database('./data/investments.db');
const outputPath = './tickers_exchange_assignment.csv';

console.log('='.repeat(80));
console.log('EXPORTANDO TICKERS PARA ASIGNACIÓN DE EXCHANGE');
console.log('='.repeat(80));

// Obtener todos los tickers con información relevante
const tickers = db.prepare(`
  SELECT 
    t.id,
    t.ticker,
    t.nombre,
    t.moneda,
    t.tipo_inversion_id,
    t.estado,
    COUNT(DISTINCT i.id) as num_inversiones,
    MIN(i.fecha) as primera_inversion,
    GROUP_CONCAT(DISTINCT i.plataforma) as plataformas
  FROM tickers t
  LEFT JOIN inversiones i ON i.ticker_id = t.id
  GROUP BY t.id
  ORDER BY t.ticker
`).all();

console.log(`\n✓ Encontrados ${tickers.length} tickers\n`);

// Generar sugerencias de exchange basadas en patrones
function suggestExchange(ticker) {
    const t = ticker.ticker.toUpperCase();
    const moneda = ticker.moneda;

    // Tickers peruanos conocidos
    const tickersPeru = ['PML', 'BAP', 'SCCO'];
    if (tickersPeru.includes(t) && moneda === 'USD') {
        return 'BVL';
    }

    // Si es PEN, casi seguro es BVL
    if (moneda === 'PEN') {
        return 'BVL';
    }

    // Tickers USA conocidos
    const tickersUSA = ['AMZN', 'GOOGL', 'GOOG', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'META', 'NFLX', 'SPY', 'QQQ'];
    if (tickersUSA.includes(t)) {
        // Si tiene inversiones en plataforma peruana, podría ser BVL
        if (ticker.plataformas && (ticker.plataformas.includes('Trii') || ticker.plataformas.includes('tyba'))) {
            return 'BVL,NYSE';  // Ambos posibles
        }
        return 'NYSE';
    }

    // Default por moneda
    return moneda === 'USD' ? 'NYSE' : 'BVL';
}

// Crear CSV con headers
const headers = [
    'id',
    'ticker',
    'nombre',
    'moneda',
    'num_inversiones',
    'primera_inversion',
    'plataformas',
    'exchange_sugerido',
    'exchange_confirmado'
];

let csvContent = headers.join(',') + '\n';

// Agregar cada ticker
tickers.forEach(ticker => {
    const suggestion = suggestExchange(ticker);

    const row = [
        ticker.id,
        ticker.ticker,
        `"${ticker.nombre.replace(/"/g, '""')}"`,  // Escape quotes
        ticker.moneda,
        ticker.num_inversiones,
        ticker.primera_inversion || '',
        `"${ticker.plataformas || ''}"`,
        suggestion,
        ''  // Columna vacía para que el usuario complete
    ];

    csvContent += row.join(',') + '\n';
});

// Guardar archivo
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log('✓ CSV generado:', outputPath);
console.log('\n' + '='.repeat(80));
console.log('INSTRUCCIONES:');
console.log('='.repeat(80));
console.log('\n1. Abrir archivo CSV en Excel o editor de texto');
console.log('2. Revisar columna "exchange_sugerido" (sugerencias automáticas)');
console.log('3. COMPLETAR columna "exchange_confirmado" con el exchange correcto:');
console.log('   - BVL: Bolsa de Valores de Lima');
console.log('   - NYSE: New York Stock Exchange');
console.log('   - NASDAQ: NASDAQ');
console.log('\n4. IMPORTANTE: Si un ticker tiene inversiones en MÚLTIPLES exchanges:');
console.log('   - Deja la fila original con un exchange');
console.log('   - COPIA la fila completa');
console.log('   - Cambia el exchange en la copia');
console.log('   - El script creará 2 tickers separados');
console.log('\n   Ejemplo para AMZN:');
console.log('   17,AMZN,Amazon.com Inc.,USD,3,2024-02-14,Trii,BVL,BVL');
console.log('   17,AMZN,Amazon.com Inc.,USD,2,2024-01-15,Tyba,NYSE,NYSE');
console.log('\n5. Guardar CSV');
console.log('6. Ejecutar: node import_exchanges_from_csv.js');
console.log('\n' + '='.repeat(80));

// Mostrar preview
console.log('\nPREVIEW DEL CSV (primeras 5 filas):\n');
console.log(csvContent.split('\n').slice(0, 6).join('\n'));
console.log('...\n');

db.close();
