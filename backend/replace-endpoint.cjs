const fs = require('fs');

const configPath = 'src/routes/config.js';
const replacementPath = 'REPLACEMENT_SYNC_ENDPOINT.js';

// Leer archivos
const config = fs.readFileSync(configPath, 'utf8');
const replacement = fs.readFileSync(replacementPath, 'utf8');

// Encontrar inicio: línea que contiene r.post('/tipo-cambio/sync-sunat'
// Encontrar fin: línea antes de "// Presupuesto: leer o establecer"
const startMarker = "  r.post('/tipo-cambio/sync-sunat'";
const endMarker = "  // Presupuesto: leer o establecer (id fijo = 1)";

const startIdx = config.indexOf(startMarker);
const endIdx = config.indexOf(endMarker);

console.log(`Búsqueda de marcadores:`)
console.log(`  Start marker encontrado en: ${startIdx}`)
console.log(`  End marker encontrado en: ${endIdx}`)

if (startIdx === -1 || endIdx === -1) {
    console.error('❌ No se encontraron los marcadores');
    console.error(`  Start: ${startIdx === -1 ? 'NO ENCONTRADO' : 'OK'}`);
    console.error(`  End: ${endIdx === -1 ? 'NO ENCONTRADO' : 'OK'}`);
    process.exit(1);
}

// Construir nuevo contenido
const before = config.substring(0, startIdx);
const after = config.substring(endIdx);
const newConfig = before + replacement.trim() + '\n\n\n  ' + after.substring(after.indexOf('// Presupuesto'));

// Escribir archivo
fs.writeFileSync(configPath, newConfig, 'utf8');
console.log('✅ Archivo config.js actualizado correctamente');
console.log(`   Reemplazado desde byte ${startIdx} hasta ${endIdx}`);
console.log(`   Tamaño anterior: ${config.length} bytes`);
console.log(`   Tamaño nuevo: ${newConfig.length} bytes`);
