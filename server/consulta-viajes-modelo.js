const crypto = require('crypto');

const CAMPOS = {
    rendimiento: 'REND_KM_GL', combustible: 'COMBUSTIBLE_COSTO', peaje: 'PEAJE_COSTO',
    viatico: 'VIATICO', sueldo: 'SUELDO_OPERATIVO', neumaticos: 'COSTO_NEUMATICO',
    comisiones: 'COMISIONES_COMERCIAL_3', otrosOriginal: 'OTROS', terceros: 'TERCEROS',
    costo: 'COGS_FINAL', flete: 'TOTAL_FLETE_JWM', utilidad: 'UT_BRUTA',
    stdKm: 'STD_TOTAL_KM', stdRendimiento: 'STD_REND_KM_GL', stdGalones: 'STD_TOTAL_GLS',
    stdCombustible: 'STD_COMB_COSTO', stdOtros: 'STD_OTROS_COSTOS', stdCosto: 'STD_COGS',
    stdContribucion: 'STD_CONTR_MARG', factorOpex: 'FACTOR_DE_OPEX', opex: 'OPEX',
    utilidadOperativa: 'STD_UT_OPERATIVA', dias: 'TOTAL_DIAS', km: 'TOTAL_KM', galones: 'TOTAL_GLS'
};
function texto(value) { return value == null ? '' : String(value).trim(); }
function clave(value) { return texto(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }
function numero(value) {
    const s = texto(value);
    if (!s || /^(falta|nan|none|null|mal formato operaciones)$/i.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
function fecha(value) {
    const s = texto(value);
    if (!s) return null;
    const match = /^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/.exec(s);
    if (!match) return null;
    const d = new Date(match[1] + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === match[1] ? match[1] : null;
}
function modalidad(value) {
    const v = clave(value);
    return v === 'JWM' ? 'Propio' : v === 'TERC' ? 'Tercero' : texto(value) || 'Sin dato';
}
function unidad(value) {
    const v = clave(value);
    return v === 'CBJA' || v === 'CBAJA' ? 'CBAJA' : texto(value);
}
function ratio(a, b) { return a == null || b == null || b === 0 ? null : a / b; }
function sumaCompleta(items, campo) {
    if (!items.length || items.some(x => x[campo] == null)) return null;
    return items.reduce((sum, x) => sum + x[campo], 0);
}
function unica(items, campo) {
    const values = [...new Set(items.map(x => x[campo]).filter(Boolean))];
    return values.length > 1 ? 'Varios' : values[0] || 'Sin dato';
}
function operacion(row, source, index) {
    return {
        id: texto(row.SERVICIO_ID) || source + '|' + index,
        fuente: source, ot: clave(row.OT_CLAVE || row.N_OT), fecha: fecha(row.FECHA_SERVICIO || row.F_PROGRA),
        fechaFin: fecha(row.F_FIN_SERVICIO2 || row.F_FIN), cliente: texto(row.CLIENTE),
        origen: texto(row.LUGAR_DE_CARGA), destino: texto(row.LUGAR_DE_DESCARGA),
        departamento: texto(row.DEPARTAMEN || row.DEPARTAMENTO), lugarDescarga: texto(row.LUGAR_DE_DESCARGA),
        unidad: unidad(row.TIPO_DE_UNIDAD), unidadOriginal: texto(row.TIPO_DE_UNIDAD), modalidad: modalidad(row.PROPIO_TERC || row.PROP_TERC),
        modalidadOriginal: texto(row.PROPIO_TERC || row.PROP_TERC), carga: texto(row.MATERIAL_TRANSPOR),
        placa: texto(row.PLACA_TRACTO), acople: texto(row.PLACA_ACOPLE), conductor: texto(row.CONDUCTOR_OPERADOR),
        peso: texto(row.PESO), estado: texto(row.ESTADO_CLAVE || row.ESTADO_DE_OPERACIONES || row.ESTADO),
        liquidacion: texto(row.N_LIQUIDA)
    };
}
function componente(row, index) {
    const item = operacion(row, 'COSTOS', index);
    item.referencia = { archivo: texto(row.ORIGEN_ARCHIVO), tabla: texto(row.ORIGEN_TABLA),
        anio: texto(row.ORIGEN_ANIO), etlId: texto(row.ETL_ID), filaCsv: index + 2 };
    item.avisos = [];
    for (const [field, original] of Object.entries(CAMPOS)) {
        item[field] = numero(row[original]);
        if (texto(row[original]) && item[field] == null) item.avisos.push('Sin valor numérico: ' + original);
    }
    // Excel suma celdas vacías como cero. Se conserva el vacío en cada concepto.
    item.otros = item.otrosOriginal == null ? null : item.otrosOriginal -
        (item.peaje ?? 0) - (item.viatico ?? 0) - (item.neumaticos ?? 0) - (item.comisiones ?? 0);
    item.margen = item.costo == null ? null : ratio(item.utilidad, item.flete);
    item.margenOperativo = item.opex == null ? null : ratio(item.utilidadOperativa, item.flete);
    item.baseOperativa = clave(row.ESTADO) === 'CERRADO' ? 'Registrada' : 'Estándar';
    item.opexDiario = item.factorOpex > 0 && item.dias > 0 ? ratio(item.opex, item.factorOpex * item.dias) : null;
    if (item.costo == null || item.flete == null) item.avisos.push('Falta costo o flete');
    if (item.costo != null && item.combustible != null && item.otrosOriginal != null && item.terceros != null &&
        Math.abs(item.costo - item.combustible - item.otrosOriginal - item.terceros) > 0.02)
        item.avisos.push('COGS no concilia con sus componentes');
    if (item.utilidad != null && item.flete != null && item.costo != null && Math.abs(item.utilidad - (item.flete - item.costo)) > 0.02)
        item.avisos.push('Utilidad no concilia con flete y COGS');
    return item;
}
function construirConsulta(costos, programacion) {
    const map = new Map();
    const get = ot => { if (!map.has(ot)) map.set(ot, { ot, componentes: [], ejecuciones: [] }); return map.get(ot); };
    costos.forEach((row, i) => {
        const ot = clave(row.N_OT);
        if (!ot || /ANULAD|DESACTIV/.test(clave(row.ESTADO))) return;
        get(ot).componentes.push(componente(row, i));
    });
    programacion.forEach((row, i) => {
        const ot = clave(row.OT_CLAVE || row.N_OT);
        if (!ot || clave(row.SERVICIO_VALIDO) === 'FALSE' || clave(row.ES_ANULADO) === 'TRUE') return;
        get(ot).ejecuciones.push(operacion(row, 'PROGRAMACION', i));
    });
    const result = [];
    for (const item of map.values()) {
        const c = item.componentes, operations = item.ejecuciones.length ? item.ejecuciones : c;
        if (!operations.length) continue;
        const summary = { ot: item.ot, fecha: operations.map(x => x.fecha).filter(Boolean).sort()[0] || null,
            cliente: unica(operations, 'cliente'), origen: unica(operations, 'origen'), destino: unica(operations, 'destino'), departamento: unica(operations, 'departamento'),
            unidad: unica(operations, 'unidad'), modalidad: unica(operations, 'modalidad'), carga: unica(operations, 'carga'),
            cantidadEjecuciones: item.ejecuciones.length, cantidadComponentes: c.length,
            soloCostos: !item.ejecuciones.length,
            costo: sumaCompleta(c, 'costo'), flete: sumaCompleta(c, 'flete'), utilidad: sumaCompleta(c, 'utilidad'),
            opex: sumaCompleta(c, 'opex'), utilidadOperativa: sumaCompleta(c, 'utilidadOperativa'),
            stdCosto: sumaCompleta(c, 'stdCosto'), stdContribucion: sumaCompleta(c, 'stdContribucion'),
            baseOperativa: unica(c, 'baseOperativa'), avisos: [...new Set(c.flatMap(x => x.avisos))] };
        summary.margen = summary.costo == null ? null : ratio(summary.utilidad, summary.flete);
        summary.margenOperativo = summary.opex == null ? null : ratio(summary.utilidadOperativa, summary.flete);
        summary.margenEstandar = ratio(summary.stdContribucion, summary.flete);
        if (!c.length) summary.avisos.push('Sin costos relacionados');
        if (summary.utilidadOperativa == null) summary.avisos.push('Resultado operativo sin información completa');
        // No presentar una suma parcial como total completo de un concepto.
        for (const field of ['combustible', 'peaje', 'viatico', 'sueldo', 'neumaticos', 'comisiones', 'otros', 'otrosOriginal', 'terceros']) {
            summary[field] = sumaCompleta(c, field);
        }
        summary.conceptosIncompletos = ['combustible', 'peaje', 'viatico', 'sueldo', 'neumaticos', 'comisiones', 'otros', 'terceros']
            .filter(field => c.length && c.some(x => x[field] == null));
        if (summary.conceptosIncompletos.length) summary.avisos.push('Conceptos sin información completa: ' + summary.conceptosIncompletos.join(', '));
        result.push({ summary, componentes: c, ejecuciones: item.ejecuciones, filtros: operations });
    }
    return result;
}
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
module.exports = { CAMPOS, texto, clave, numero, fecha, modalidad, ratio, construirConsulta, hash };
