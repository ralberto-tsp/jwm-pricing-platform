function json(value) { return typeof value === 'string' ? JSON.parse(value) : value; }
function registrarConsultaViajes(app, pool, requireAuth, requireReadAccess) {
    const handle = fn => async (req, res) => {
        try { await fn(req, res); }
        catch (error) {
            console.error('Consulta viajes:', error.code || error.message);
            res.status(error.status || 503).json({ message: error.status ? error.message :
                'Consulta de viajes no disponible. Revisa la migración, la importación o la conexión.' });
        }
    };
    async function lote() {
        const [rows] = await pool.query('SELECT l.id, l.metadata, l.created_at FROM consulta_viajes_activo a JOIN consulta_viajes_lotes l ON l.id = a.lote_id WHERE a.id = 1');
        return rows[0] ? { id: rows[0].id, ...json(rows[0].metadata), publicado: rows[0].created_at } : null;
    }
    app.get('/api/consulta-viajes', requireAuth, requireReadAccess, handle(async (req, res) => {
        const active = await lote();
        if (!active) return res.json({ items: [], total: 0, pagina: 1, paginas: 0, lote: null });
        const page = Math.max(1, Math.min(100000, parseInt(req.query.pagina, 10) || 1));
        const limit = 25;
        const values = [active.id], filters = [];
        function field(name, col) {
            const value = String(req.query[name] || '').trim();
            if (value.length > 500) { const e = new Error('Filtro demasiado largo.'); e.status = 400; throw e; }
            if (value) { filters.push('LOCATE(?, e.' + col + ') > 0'); values.push(value); }
        }
        if (req.query.ot) { filters.push('LOCATE(?, e.ot) > 0'); values.push(String(req.query.ot).trim().slice(0, 120)); }
        field('origen', 'origen'); field('destino', 'destino'); field('unidad', 'unidad');
        field('modalidad', 'modalidad'); field('carga', 'carga');
        for (const [name, op] of [['desde', '>='], ['hasta', '<=']]) {
            if (!req.query[name]) continue;
            const value = String(req.query[name]);
            const { fecha } = require('./consulta-viajes-modelo');
            if (fecha(value) !== value) { const e = new Error('Fecha inválida.'); e.status = 400; throw e; }
            filters.push('e.fecha ' + op + ' ?'); values.push(value);
        }
        if (req.query.desde && req.query.hasta && req.query.desde > req.query.hasta) {
            const e = new Error('La fecha desde debe ser anterior a hasta.'); e.status = 400; throw e;
        }
        const where = 'v.lote_id = ? AND EXISTS (SELECT 1 FROM consulta_viajes_ejecuciones e WHERE e.lote_id = v.lote_id AND e.ot = v.ot' +
            (filters.length ? ' AND ' + filters.join(' AND ') : '') + ')';
        const [count] = await pool.execute('SELECT COUNT(*) AS total FROM consulta_viajes_ot v WHERE ' + where, values);
        const [rows] = await pool.execute('SELECT resumen FROM consulta_viajes_ot v WHERE ' + where +
            ' ORDER BY v.fecha DESC, v.ot ASC LIMIT ' + limit + ' OFFSET ' + ((page - 1) * limit), values);
        res.json({ items: rows.map(r => json(r.resumen)), total: Number(count[0].total), pagina: page,
            paginas: Math.ceil(Number(count[0].total) / limit), lote: active });
    }));
    app.get('/api/consulta-viajes/:ot', requireAuth, requireReadAccess, handle(async (req, res) => {
        const active = await lote();
        // Permite fijar el lote que estaba visible aun si una importación termina al abrir el detalle.
        const id = String(req.query.lote || active?.id || '');
        if (!/^[a-f0-9]{64}$/.test(id)) return res.status(404).json({ message: 'Sin lote publicado.' });
        const [rows] = await pool.execute('SELECT resumen, detalle FROM consulta_viajes_ot WHERE lote_id = ? AND ot = ?', [id, req.params.ot]);
        if (!rows.length) return res.status(404).json({ message: 'OT no encontrada en el lote seleccionado.' });
        const [batch] = await pool.execute('SELECT metadata FROM consulta_viajes_lotes WHERE id = ?', [id]);
        res.json({ resumen: json(rows[0].resumen), ...json(rows[0].detalle), lote: { id, ...json(batch[0].metadata) } });
    }));
}
module.exports = { registrarConsultaViajes };
