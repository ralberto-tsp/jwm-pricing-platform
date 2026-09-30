const test = require('node:test');
const assert = require('node:assert/strict');
const { construirConsulta, modalidad, fecha } = require('../server/consulta-viajes-modelo');
function costo(extra = {}) {
    return { N_OT: '000001-2026', ESTADO: 'Cerrado', F_PROGRA: '2026-09-01', TOTAL_FLETE_JWM: '1000',
        COGS_FINAL: '600', UT_BRUTA: '400', COMBUSTIBLE_COSTO: '200', OTROS: '300', TERCEROS: '100',
        PEAJE_COSTO: '50', VIATICO: '40', COSTO_NEUMATICO: '30', COMISIONES_COMERCIAL_3: '30',
        SUELDO_OPERATIVO: '90', OPEX: '100', STD_UT_OPERATIVA: '300', FACTOR_DE_OPEX: '1',
        TOTAL_DIAS: '2', MATERIAL_TRANSPOR: 'Encofrados / Materiales varios', PROP_TERC: 'JWM', ...extra };
}
test('Separar Otros conserva COGS y no incorpora el sueldo informativo', () => {
    const { summary: s, componentes: [c] } = construirConsulta([costo()], [])[0];
    assert.equal(c.otros, 150);
    assert.equal(c.combustible + c.peaje + c.viatico + c.neumaticos + c.comisiones + c.otros + c.terceros, 600);
    assert.equal(s.costo, 600); assert.equal(s.utilidad, 400); assert.equal(s.margen, .4);
    assert.equal(s.utilidadOperativa, 300); assert.equal(s.margenOperativo, .3);
});
test('OT con dos componentes calcula porcentaje sobre totales, no promedio', () => {
    const s = construirConsulta([costo(), costo({ TOTAL_FLETE_JWM: '3000', COGS_FINAL: '2700', UT_BRUTA: '300' })], [])[0].summary;
    assert.equal(s.flete, 4000); assert.equal(s.utilidad, 700); assert.equal(s.margen, .175);
});
test('Mantener carga literal, modalidad original y alternativas desconocidas', () => {
    const c = construirConsulta([costo()], [])[0].componentes[0];
    assert.equal(c.carga, 'Encofrados / Materiales varios'); assert.equal(c.modalidad, 'Propio');
    assert.equal(c.modalidadOriginal, 'JWM'); assert.equal(modalidad('TERC'), 'Tercero'); assert.equal(modalidad('OTROS'), 'OTROS');
});
test('Costo faltante no genera un margen rentable ficticio', () => {
    const s = construirConsulta([costo({ COGS_FINAL: '', UT_BRUTA: '' })], [])[0].summary;
    assert.equal(s.costo, null); assert.equal(s.utilidad, null); assert.equal(s.margen, null);
});
test('Preservar base operativa del libro y señalar mezcla de bases', () => {
    const s = construirConsulta([costo(), costo({ ESTADO: 'Programado', STD_UT_OPERATIVA: '180' })], [])[0].summary;
    assert.equal(s.baseOperativa, 'Varios'); assert.equal(s.utilidadOperativa, 480);
});
test('Rendimiento sigue por componente y sueldo no se agrega a costos', () => {
    const item = construirConsulta([costo({ REND_KM_GL: '7.1' }), costo({ REND_KM_GL: '8.3' })], [])[0];
    assert.deepEqual(item.componentes.map(c => c.rendimiento), [7.1, 8.3]); assert.equal(item.summary.costo, 1200);
});
test('Cancelar costos anulados y conservar OT sin costos con su ejecución', () => {
    const items = construirConsulta([costo({ ESTADO: 'Anulado' })], [{ OT_CLAVE: '000001-2026', SERVICIO_ID: 'SRV-1', SERVICIO_VALIDO: 'True', FECHA_SERVICIO: '2026-09-01' }]);
    assert.equal(items.length, 1); assert.equal(items[0].summary.costo, null); assert.equal(items[0].ejecuciones.length, 1);
});
test('Fecha inválida se mantiene ausente y concepto parcial no se presenta completo', () => {
    assert.equal(fecha('2026-02-30'), null);
    const s = construirConsulta([costo(), costo({ VIATICO: '' })], [])[0].summary;
    assert.equal(s.viatico, null); assert.ok(s.conceptosIncompletos.includes('viatico'));
});
