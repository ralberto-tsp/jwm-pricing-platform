// No abre conexiones ni escribe datos al importar este módulo.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { CAMPOS, construirConsulta, hash } = require('./consulta-viajes-modelo');

function leerCsv(file, required) {
    const before = fs.statSync(file);
    const bytes = fs.readFileSync(file);
    const after = fs.statSync(file);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('Archivo cambió durante lectura: ' + path.basename(file));
    const workbook = XLSX.read(bytes.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: true, FS: ',' });
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: true });
    const headers = matrix.shift() || [];
    if (new Set(headers).size !== headers.length) throw new Error('Encabezados duplicados: ' + path.basename(file));
    const missing = required.filter(h => !headers.includes(h));
    if (missing.length) throw new Error('Faltan columnas en ' + path.basename(file) + ': ' + missing.join(', '));
    const rows = matrix.filter(r => r.some(v => String(v).trim())).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
    if (!rows.length) throw new Error('Archivo vacío: ' + path.basename(file));
    return { rows, hash: hash(bytes), file, size: after.size, mtimeMs: after.mtimeMs };
}
function preparar(staging) {
    const costs = leerCsv(path.join(staging, 'STAGING_COSTOS.csv'), ['N_OT', 'ESTADO', 'ETL_FECHA', 'ETL_ID',
        'ORIGEN_ARCHIVO', 'ORIGEN_TABLA', 'LUGAR_DE_CARGA', 'LUGAR_DE_DESCARGA', 'MATERIAL_TRANSPOR',
        ...Object.values(CAMPOS)]);
    const operations = leerCsv(path.join(staging, 'FACT_PROGRAMACION.csv'), ['OT_CLAVE', 'SERVICIO_ID', 'SERVICIO_VALIDO',
        'ETL_FECHA', 'FECHA_SERVICIO', 'LUGAR_DE_CARGA', 'LUGAR_DE_DESCARGA', 'PROPIO_TERC', 'MATERIAL_TRANSPOR']);
    const cutoffs = [...costs.rows, ...operations.rows].map(r => String(r.ETL_FECHA).slice(0, 19));
    // UTC solo para comparar intervalos de timestamps sin zona, no para convertir la hora fuente.
    const times = cutoffs.map(v => Date.parse(v.replace(' ', 'T') + 'Z'));
    if (times.some(t => !Number.isFinite(t)) || Math.max(...times) - Math.min(...times) > 30 * 60 * 1000)
        throw new Error('Cortes ETL incompatibles o sin fecha. Requiere archivos de la misma corrida.');
    const items = construirConsulta(costs.rows, operations.rows);
    if (!items.length) throw new Error('No hay OT consultables.');
    const ids = new Set();
    for (const r of operations.rows) {
        if (!String(r.SERVICIO_ID).trim() || ids.has(r.SERVICIO_ID)) throw new Error('SERVICIO_ID vacío o duplicado');
        ids.add(r.SERVICIO_ID);
    }
    for (const item of items) {
        if (item.summary.ot.length > 120) throw new Error('OT supera longitud admitida');
        for (const e of item.filtros) {
            if (e.origen.length > 500 || e.destino.length > 500 || e.unidad.length > 200 || e.modalidad.length > 120)
                throw new Error('Campo operativo supera longitud admitida: ' + item.summary.ot);
        }
    }
    // Comprobación posterior al armado para no publicar archivos cambiados durante el proceso.
    for (const source of [costs, operations]) {
        const stat = fs.statSync(source.file);
        if (stat.size !== source.size || stat.mtimeMs !== source.mtimeMs) throw new Error('El lote ETL cambió durante preparación.');
    }
    const id = hash(costs.hash + operations.hash + '|consulta-v2-departamento-unidad');
    const metadata = { version: 1, corteEtL: cutoffs.slice().sort().at(-1), zonaCorte: 'Hora local del ETL, sin zona en CSV',
        preparado: new Date().toISOString(), ot: items.length,
        componentes: items.reduce((n, i) => n + i.componentes.length, 0),
        fuentes: [{ nombre: 'STAGING_COSTOS.csv', hash: costs.hash, filas: costs.rows.length },
            { nombre: 'FACT_PROGRAMACION.csv', hash: operations.hash, filas: operations.rows.length }],
        avisos: items.filter(i => i.summary.avisos.length).length };
    return { id, metadata, items };
}
async function publicar(pool, batch) {
    const connection = await pool.getConnection();
    let locked = false;
    try {
        const [lock] = await connection.query("SELECT GET_LOCK('jwm_consulta_import', 10) AS adquirido");
        if (Number(lock[0].adquirido) !== 1) throw new Error('Otra importación está en curso.');
        locked = true;
        await connection.beginTransaction();
        const [existing] = await connection.execute('SELECT id FROM consulta_viajes_lotes WHERE id = ?', [batch.id]);
        if (!existing.length) {
            await connection.execute('INSERT INTO consulta_viajes_lotes (id, metadata) VALUES (?, ?)', [batch.id, JSON.stringify(batch.metadata)]);
            async function insertar(sql, records, width) {
                for (let start = 0; start < records.length; start += 100) {
                    const group = records.slice(start, start + 100);
                    const placeholders = group.map(() => '(' + Array(width).fill('?').join(',') + ')').join(',');
                    await connection.execute(sql + placeholders, group.flat());
                }
            }
            await insertar('INSERT INTO consulta_viajes_ot (lote_id, ot, fecha, resumen, detalle) VALUES ',
                batch.items.map(item => [batch.id, item.summary.ot, item.summary.fecha, JSON.stringify(item.summary),
                    JSON.stringify({ componentes: item.componentes, ejecuciones: item.ejecuciones })]), 5);
            await insertar('INSERT INTO consulta_viajes_ejecuciones (lote_id, ot, ordinal, fecha, origen, destino, unidad, modalidad, carga) VALUES ',
                batch.items.flatMap(item => item.filtros.map((e, i) => [batch.id, item.summary.ot, i, e.fecha,
                    e.origen, e.destino, e.unidad, e.modalidad, e.carga])), 9);
        }
        await connection.execute('INSERT INTO consulta_viajes_activo (id, lote_id) VALUES (1, ?) ON DUPLICATE KEY UPDATE lote_id = VALUES(lote_id)', [batch.id]);
        await connection.commit();
        return { lote: batch.id, reutilizado: !!existing.length, ot: batch.items.length };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        if (locked) await connection.query("SELECT RELEASE_LOCK('jwm_consulta_import')").catch(() => {});
        connection.release();
    }
}
async function main() {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    const args = process.argv.slice(2);
    const pos = args.indexOf('--staging');
    const staging = pos >= 0 ? args[pos + 1] : process.env.JWM_STAGING_DIR;
    if (!staging || staging.startsWith('--')) throw new Error('Indica --staging RUTA o JWM_STAGING_DIR.');
    const batch = preparar(path.resolve(staging));
    console.log(JSON.stringify({ lote: batch.id, ...batch.metadata }, null, 2));
    if (!args.includes('--aplicar')) { console.log('Diagnóstico de importación. No se escribió en MySQL.'); return; }
    const { pool } = require('./db');
    try { console.log(JSON.stringify(await publicar(pool, batch))); }
    finally { await pool.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { preparar, publicar, leerCsv };
