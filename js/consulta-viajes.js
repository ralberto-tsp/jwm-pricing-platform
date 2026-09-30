const consultaViajesEstado = { pagina: 1, paginas: 0, lote: null, filtros: {}, secuencia: 0, detalleSecuencia: 0 };
function consultaEscapar(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function consultaDinero(value){ return value == null ? 'Sin dato' : new Intl.NumberFormat('es-PE', {style:'currency',currency:'PEN'}).format(value); }
function consultaNumero(value){ return value == null ? 'Sin dato' : new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(value); }
function consultaPorcentaje(value){ return value == null ? 'Sin dato' : new Intl.NumberFormat('es-PE',{style:'percent',minimumFractionDigits:2,maximumFractionDigits:2}).format(value); }
function consultaMensaje(text, error=false){
    const node=document.getElementById('consultaViajesMensaje');
    node.textContent=text; node.dataset.error=String(error);
}
async function consultaPeticion(path){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    try { return await apiRequest(path,{signal:controller.signal}); }
    catch(error){ if(error.name==='AbortError') throw new Error('La consulta tardó demasiado. Reintenta en unos segundos.'); throw error; }
    finally { clearTimeout(timer); }
}
function inicializarConsultaViajes(){
    const back=document.getElementById('consultaVolverCotizacion');
    if(back) back.hidden=!puedeVerPantalla('cotizacion');
}
function consultaLeerFiltros(){
    const filters={};
    for(const [key,id] of Object.entries({origen:'consultaOrigen',destino:'consultaDestino',ot:'consultaOT',desde:'consultaDesde',hasta:'consultaHasta',unidad:'consultaUnidad',modalidad:'consultaModalidad',carga:'consultaCarga'})){
        const v=document.getElementById(id).value.trim(); if(v) filters[key]=v;
    }
    return filters;
}
async function cargarConsultaViajes(pagina=1, conservarFiltros=false){
    const filters=conservarFiltros?consultaViajesEstado.filtros:consultaLeerFiltros();
    if(filters.desde && filters.hasta && filters.desde>filters.hasta){consultaMensaje('Desde debe ser anterior a Hasta.',true);return;}
    const seq=++consultaViajesEstado.secuencia;
    cerrarDetalleViaje();
    const button=document.getElementById('consultaBuscar');button.disabled=true;
    document.getElementById('consultaAnterior').disabled=true;document.getElementById('consultaSiguiente').disabled=true;
    document.getElementById('tablaConsultaViajes').innerHTML='<tr><td colspan="9">Consultando…</td></tr>';
    consultaMensaje('Consultando viajes…');
    try{
        const params=new URLSearchParams({...filters,pagina});
        const response=await consultaPeticion('/consulta-viajes?'+params);
        if(seq!==consultaViajesEstado.secuencia)return;
        Object.assign(consultaViajesEstado,{pagina:response.pagina,paginas:response.paginas,lote:response.lote,filtros:filters});
        document.getElementById('consultaViajesCorte').textContent=response.lote?'Corte ETL: '+response.lote.corteEtL.replace('T',' ').replace('Z','')+' · Fecha del sistema ETL':'Sin lote publicado';
        document.getElementById('consultaViajesConteo').textContent=response.total+' OT encontradas';
        const cell=(v,numeric=false)=>'<td class="'+(numeric?'consulta-numero':'consulta-texto')+'">'+consultaEscapar(v ?? 'Sin dato')+'</td>';
        document.getElementById('tablaConsultaViajes').innerHTML=response.items.length?response.items.map(r=>'<tr>'+[
            cell(r.ot),cell(r.fecha),cell(r.cliente),cell(r.origen),cell(r.destino),cell(r.departamento),
            cell(consultaDinero(r.flete),true),cell(consultaDinero(r.utilidad),true),cell(consultaPorcentaje(r.margen),true),cell(consultaDinero(r.utilidadOperativa),true),cell(consultaPorcentaje(r.margenOperativo),true),
            '<td><button type="button" data-consulta-ot="'+consultaEscapar(r.ot)+'">Ver</button></td>'
        ].join('')+'</tr>').join(''):'<tr><td colspan="12">'+(response.lote?'Sin antecedentes para estos filtros.':'Todavía no se ha importado un lote de viajes.')+'</td></tr>';
        document.getElementById('tablaConsultaViajes').onclick=e=>{const b=e.target.closest('[data-consulta-ot]');if(b)verDetalleViaje(b.dataset.consultaOt);};
        document.getElementById('consultaPagina').textContent=response.paginas?'Página '+response.pagina+' de '+response.paginas:'';
        document.getElementById('consultaAnterior').disabled=pagina<=1;
        document.getElementById('consultaSiguiente').disabled=pagina>=response.paginas;
        consultaMensaje(response.lote?'':'Solicita la importación del histórico al administrador.');
    }catch(error){
        if(seq!==consultaViajesEstado.secuencia)return;
        document.getElementById('tablaConsultaViajes').innerHTML='<tr><td colspan="9">Consulta no disponible.</td></tr>';
        document.getElementById('consultaViajesConteo').textContent='';
        document.getElementById('consultaPagina').textContent='';
        consultaMensaje(error.message,true);
    }finally{if(seq===consultaViajesEstado.secuencia)button.disabled=false;}
}
function paginarConsultaViajes(delta){cargarConsultaViajes(consultaViajesEstado.pagina+delta,true);}
function limpiarConsultaViajes(){document.getElementById('consultaViajesForm').reset();cargarConsultaViajes(1);}
function cerrarDetalleViaje(){consultaViajesEstado.detalleSecuencia++;document.getElementById('consultaViajesDetalle').close();}
function consultarViajesDesdeCotizacion(){
    document.getElementById('consultaViajesForm').reset();
    document.getElementById('consultaOrigen').value=document.getElementById('origen').value;
    document.getElementById('consultaDestino').value=document.getElementById('destino').value;
    mostrarPantalla('consulta-viajes');cargarConsultaViajes(1);
}
async function verDetalleViaje(ot){
    const seq=++consultaViajesEstado.detalleSecuencia;
    consultaMensaje('Cargando detalle de '+ot+'…');
    try{
        const data=await consultaPeticion('/consulta-viajes/'+encodeURIComponent(ot)+'?lote='+encodeURIComponent(consultaViajesEstado.lote.id));
        if(seq!==consultaViajesEstado.detalleSecuencia)return;
        const r=data.resumen;
        document.getElementById('consultaDetalleTitulo').textContent='Detalle de '+r.ot;
        document.getElementById('consultaDetalleAvisos').textContent=[r.cantidadEjecuciones+' ejecuciones · '+r.cantidadComponentes+' componentes de costo · Importes completos de la OT',
            r.soloCostos?'Sin ejecución relacionada en Programación; se muestran datos de Costos.':'',...r.avisos].filter(Boolean).join('. ');
        document.getElementById('consultaDetalleIndicadores').innerHTML=[['Utilidad bruta referencial',consultaDinero(r.utilidad)],['Margen bruto referencial',consultaPorcentaje(r.margen)],['Utilidad operativa referencial',consultaDinero(r.utilidadOperativa)],['Margen operativo referencial',consultaPorcentaje(r.margenOperativo)]].map(([k,v])=>'<div class="kpi-card"><h3>'+consultaEscapar(k)+'</h3><strong>'+consultaEscapar(v)+'</strong></div>').join('');
        const values=items=>items.map(v=>'<td>'+consultaEscapar(v ?? 'Sin dato')+'</td>').join('');
        document.getElementById('consultaEjecuciones').innerHTML=data.ejecuciones.length?data.ejecuciones.map((e,i)=>'<article class="consulta-bloque"><h3>Ejecución '+(i+1)+'</h3><dl class="consulta-viaje-grid">'+[['Fecha inicio',e.fecha],['Fecha fin',e.fechaFin],['Origen',e.origen],['Departamento destino',e.departamento||e.destino],['Lugar de descarga',e.lugarDescarga||e.destino],['Tipo de unidad',e.unidad],['Modalidad',e.modalidad],['Tipo de carga',e.carga],['Placa tracto',e.placa],['Acople',e.acople],['Conductor',e.conductor],['Peso',e.peso],['Estado',e.estado]].map(([k,v])=>'<div><dt>'+consultaEscapar(k)+'</dt><dd>'+consultaEscapar(v||'Sin dato')+'</dd></div>').join('')+'</dl></article>').join(''):'<p>Sin ejecuciones relacionadas.</p>';
        const concepts=list=>list.map(([name,val,total])=>'<tr'+(total?' class="consulta-fila-total"':'')+'><td>'+consultaEscapar(name)+'</td><td class="consulta-numero">'+consultaEscapar(val)+'</td></tr>').join('');
        document.getElementById('consultaCostos').innerHTML=concepts([
            ['Combustible costo',consultaDinero(r.combustible)],['Peaje costo',consultaDinero(r.peaje)],['Viático',consultaDinero(r.viatico)],['Sueldo operativo',consultaDinero(r.sueldo)],['Costo neumático',consultaDinero(r.neumaticos)],['Comisiones Comercial 3%',consultaDinero(r.comisiones)],['Otros',consultaDinero(r.otros)],['Terceros',consultaDinero(r.terceros)],['COGS FINAL · costo registrado',consultaDinero(r.costo),true],['TOTAL FLETE JWM',consultaDinero(r.flete),true],['UT BRUTA · referencial',consultaDinero(r.utilidad),true],['UT % BRUTA · margen referencial',consultaPorcentaje(r.margen),true]
        ]);
        document.getElementById('consultaEstandar').innerHTML=concepts([
            ['Std COGS',consultaDinero(r.stdCosto)],['Std Contr Marg',consultaDinero(r.stdContribucion)],['Margen estándar referencial',consultaPorcentaje(r.margenEstandar)],['OPEX asignado',consultaDinero(r.opex),true],['Std Ut Operativa · referencial',consultaDinero(r.utilidadOperativa),true],['Margen operativo referencial',consultaPorcentaje(r.margenOperativo),true]
        ]);
        document.getElementById('consultaComponentes').innerHTML=data.componentes.length?data.componentes.map((c,i)=>{
            const registered=[['REND KM*GL',consultaNumero(c.rendimiento)],['Combustible costo',consultaDinero(c.combustible)],['Peaje costo',consultaDinero(c.peaje)],['Viático',consultaDinero(c.viatico)],['Sueldo operativo',consultaDinero(c.sueldo)],['Costo neumático',consultaDinero(c.neumaticos)],['Comisiones Comercial 3%',consultaDinero(c.comisiones)],['Otros',consultaDinero(c.otros)],['Terceros',consultaDinero(c.terceros)],['COGS FINAL',consultaDinero(c.costo),true],['Total flete JWM',consultaDinero(c.flete),true],['UT BRUTA referencial',consultaDinero(c.utilidad),true],['UT % BRUTA referencial',consultaPorcentaje(c.margen),true]];
            const standard=[['Std Total KM',consultaNumero(c.stdKm)],['Std Rend KM*GL',consultaNumero(c.stdRendimiento)],['Std Total GLS',consultaNumero(c.stdGalones)],['Std Comb Costo',consultaDinero(c.stdCombustible)],['Std OTROS Costos',consultaDinero(c.stdOtros)],['Std COGS',consultaDinero(c.stdCosto)],['Std Contr Marg',consultaDinero(c.stdContribucion)],['Factor OPEX',consultaNumero(c.factorOpex)],['Días OPEX',consultaNumero(c.dias)],['OPEX diario por factor',consultaDinero(c.opexDiario)],['OPEX',consultaDinero(c.opex),true],['Std Ut Operativa referencial',consultaDinero(c.utilidadOperativa),true],['Margen operativo referencial',consultaPorcentaje(c.margenOperativo),true]];
            const table=(title,list)=>'<section><h3>'+title+'</h3><table class="tabla-drivers consulta-conceptos"><thead><tr><th>Concepto</th><th>Importe</th></tr></thead><tbody>'+concepts(list)+'</tbody></table></section>';
            return '<article class="consulta-bloque"><h3>OT '+consultaEscapar(c.ot)+' · Componente '+(i+1)+'</h3><div class="consulta-componente-meta">'+[['Liquidación',c.liquidacion],['Fecha',c.fecha],['Estado',c.estado]].map(([k,v])=>'<span>'+k+': '+consultaEscapar(v||'Sin dato')+'</span>').join('')+'</div><div class="consulta-costos">'+table('Costos registrados',registered)+table('Estándar y OPEX',standard)+'</div></article>';
        }).join(''):'<p>Sin costos relacionados.</p>';
        consultaCambiarTab('Viaje');
        const dialog=document.getElementById('consultaViajesDetalle');
        if(!dialog.open)dialog.showModal();
        consultaMensaje('Detalle completo de '+ot+'.');
    }catch(error){if(seq===consultaViajesEstado.detalleSecuencia)consultaMensaje(error.message,true);}
}

function consultaCambiarTab(name){
    for(const tab of ['Viaje','Costos','Economico']){
        document.getElementById('consultaPanel'+tab).hidden=tab!==name;
        document.getElementById('consultaTab'+tab).setAttribute('aria-selected',String(tab===name));
    }
    const body=document.querySelector('#consultaViajesDetalle .consulta-dialogo-cuerpo');
    if(body)body.scrollTop=0;
}
