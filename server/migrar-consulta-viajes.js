const fs = require('fs');
const path = require('path');
async function main() {
    if (!process.argv.includes('--aplicar')) throw new Error('Requiere --aplicar. Ejecutar solo en la base autorizada.');
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    const { pool } = require('./db');
    try {
        const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'consulta-viajes.sql'), 'utf8');
        for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(statement);
        const [columns] = await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'consulta_viajes_ejecuciones'");
        const names = new Set(columns.map(row => row.COLUMN_NAME));
        if (!names.has('departamento')) await pool.query("ALTER TABLE consulta_viajes_ejecuciones ADD COLUMN departamento VARCHAR(200) NOT NULL DEFAULT ''");
        if (!names.has('lugar_descarga')) await pool.query("ALTER TABLE consulta_viajes_ejecuciones ADD COLUMN lugar_descarga VARCHAR(500) NOT NULL DEFAULT ''");
        console.log('Esquema Consulta de viajes preparado.');
    } finally { await pool.end(); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
