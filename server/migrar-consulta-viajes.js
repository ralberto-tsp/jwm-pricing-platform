const fs = require('fs');
const path = require('path');
async function main() {
    if (!process.argv.includes('--aplicar')) throw new Error('Requiere --aplicar. Ejecutar solo en la base autorizada.');
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    const { pool } = require('./db');
    try {
        const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'consulta-viajes.sql'), 'utf8');
        for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(statement);
        console.log('Esquema Consulta de viajes preparado.');
    } finally { await pool.end(); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
