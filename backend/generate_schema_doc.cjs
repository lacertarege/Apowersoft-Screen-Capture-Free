const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./data/investments.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

let output = '# Esquema de Base de Datos - Sistema de Inversiones\n\n';
output += `Generado: ${new Date().toLocaleString()}\n\n`;
output += '## Índice\n\n';
tables.forEach(t => {
    output += `- [${t.name}](#tabla-${t.name.toLowerCase()})\n`;
});
output += '\n---\n\n';

// Diagrama Mermaid ER
output += '## Diagrama Entidad-Relación\n\n';
output += '```mermaid\nerDiagram\n';

tables.forEach(t => {
    const fks = db.prepare(`PRAGMA foreign_key_list(${t.name})`).all();
    fks.forEach(fk => {
        output += `    ${t.name} ||--o{ ${fk.table} : "tiene"\n`;
    });
});

output += '```\n\n---\n\n';

// Detalles de cada tabla
tables.forEach(t => {
    output += `## Tabla: \`${t.name}\`\n\n`;

    const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
    output += '| Columna | Tipo | Null | Default | PK |\n';
    output += '|---------|------|------|---------|----|\n';
    info.forEach(col => {
        output += `| \`${col.name}\` | ${col.type} | ${col.notnull ? 'NO' : 'YES'} | ${col.dflt_value || '-'} | ${col.pk ? '✓' : ''} |\n`;
    });
    output += '\n';

    const fks = db.prepare(`PRAGMA foreign_key_list(${t.name})`).all();
    if (fks.length > 0) {
        output += '### Relaciones (Foreign Keys)\n\n';
        fks.forEach(fk => {
            output += `- \`${fk.from}\` → \`${fk.table}(\`${fk.to}\`)\`\n`;
        });
        output += '\n';
    }

    const indexes = db.prepare(`PRAGMA index_list(${t.name})`).all().filter(idx => !idx.name.startsWith('sqlite_'));
    if (indexes.length > 0) {
        output += '### Índices\n\n';
        indexes.forEach(idx => {
            const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all();
            output += `- **${idx.name}** (${idx.unique ? 'UNIQUE' : 'INDEX'}): ${cols.map(c => `\`${c.name}\``).join(', ')}\n`;
        });
        output += '\n';
    }

    output += '---\n\n';
});

fs.writeFileSync('./database_schema.md', output, 'utf8');
console.log('✓ Documentación generada en: database_schema.md');
console.log(`✓ ${tables.length} tablas documentadas`);

db.close();
