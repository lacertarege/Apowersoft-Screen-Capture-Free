import Database from 'better-sqlite3';
import { InvestmentService } from './src/services/InvestmentService.js';

const db = new Database('./data/investments.db');

console.log('Recalculando ganancias realizadas para CCLIQSOLES...\n');

// Obtener ticker_id de CCLIQSOLES
const ticker = db.prepare('SELECT id FROM tickers WHERE ticker = ?').get('CCLIQSOLES');
if (!ticker) {
    console.error('No se encontró el ticker CCLIQSOLES');
    process.exit(1);
}

const tickerId = ticker.id;
console.log(`Ticker ID: ${tickerId}\n`);

// Obtener todas las desinversiones
const desinversiones = db.prepare(`
  SELECT id, fecha, importe, cantidad, realized_return
  FROM inversiones
  WHERE ticker_id = ? AND tipo_operacion = 'DESINVERSION'
  ORDER BY fecha ASC
`).all(tickerId);

console.log(`Encontradas ${desinversiones.length} desinversiones:\n`);

// Recalcular y actualizar cada desinversión
const updateStmt = db.prepare('UPDATE inversiones SET realized_return = ? WHERE id = ?');

let totalRealizedGains = 0;

desinversiones.forEach((desv, index) => {
    console.log(`${index + 1}. Desinversión del ${desv.fecha}`);
    console.log(`   Importe: S/ ${desv.importe}`);
    console.log(`   Cantidad: ${desv.cantidad}`);

    // Calcular CPP hasta esa fecha
    const cpp = InvestmentService.calculateWeightedAverageCost(db, tickerId, desv.fecha);
    console.log(`   CPP calculado: S/ ${cpp.toFixed(4)}`);

    // Calcular ganancia realizada
    const realizedReturn = InvestmentService.calculateRealizedReturn(
        desv.importe,
        desv.cantidad,
        cpp
    );

    console.log(`   Ganancia Realizada: S/ ${realizedReturn.amount.toFixed(2)} (${realizedReturn.rate.toFixed(2)}%)`);
    console.log(`   Base de Costo: S/ ${realizedReturn.costBasis.toFixed(2)}`);

    // Actualizar en la base de datos
    updateStmt.run(realizedReturn.amount, desv.id);
    totalRealizedGains += realizedReturn.amount;

    console.log(`   ✓ Actualizado en BD\n`);
});

console.log('========================================');
console.log(`Total Ganancia Realizada: S/ ${totalRealizedGains.toFixed(2)}`);
console.log('========================================\n');

// Verificar la actualización
const verificacion = db.prepare(`
  SELECT SUM(realized_return) as total_realized
  FROM inversiones
  WHERE ticker_id = ? AND tipo_operacion = 'DESINVERSION'
`).get(tickerId);

console.log(`Verificación - Total en BD: S/ ${(verificacion.total_realized || 0).toFixed(2)}`);

db.close();
console.log('\n✓ Proceso completado');
