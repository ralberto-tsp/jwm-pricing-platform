function inicializarResumen(){
    actualizarResumenEjecutivo();
}

function actualizarResumenEjecutivo(datosForzados){
    if(typeof obtenerDatosCotizacion !== "function"){
        return;
    }

    const datos = datosForzados || obtenerDatosResumenDisponible();
    const costos = obtenerCostosResumen();
    const costoTotal = costos.reduce(function(total, item){ return total + item.costo; }, 0);
    const margen = parseFloat(datos.margenObjetivo) || 20;
    const tarifaObjetivo = costoTotal > 0 ? costoTotal / (1 - (margen / 100)) : 0;
    const utilidad = tarifaObjetivo - costoTotal;
    const rentabilidad = tarifaObjetivo > 0 ? (utilidad / tarifaObjetivo) * 100 : 0;
    const km = parseFloat(datos.kmTotales) || 0;
    const personalCantidad = (datos.personalOperativo || []).reduce(function(total, item){
        return total + (parseFloat(item.cantidad) || 0);
    }, 0);

    resumenTexto("resumenNumero", datos.numero || "COT-0001");
    resumenTexto("resumenFecha", datos.fecha || "-");
    resumenTexto("resumenTitulo", datos.cliente ? "Cotizacion para " + datos.cliente : "Cotizacion de transporte");
    resumenTexto("resumenSubtitulo", [datos.origen, datos.destino, datos.tipoServicio].filter(Boolean).join(" / ") || "Servicio pendiente de calcular.");

    resumenTexto("resumenCosto", formatoMonedaResumen(costoTotal));
    resumenTexto("resumenCostoKm", km > 0 ? formatoMonedaResumen(costoTotal / km) + " por km" : "S/ 0.00 por km");
    resumenTexto("resumenTarifa", formatoMonedaResumen(tarifaObjetivo));
    resumenTexto("resumenMargen", "Margen objetivo " + margen.toFixed(1) + "%");
    resumenTexto("resumenUtilidad", formatoMonedaResumen(utilidad));
    resumenTexto("resumenRentabilidad", rentabilidad.toFixed(1) + "% rentabilidad");
    resumenTexto("resumenKm", km.toLocaleString("es-PE") + " km");
    resumenTexto("resumenDias", (parseFloat(datos.diasTotales) || 0).toLocaleString("es-PE") + " dias de servicio");

    resumenTexto("resumenCliente", datos.cliente || "-");
    resumenTexto("resumenComercial", datos.comercial || "-");
    resumenTexto("resumenOrigen", datos.origen || "-");
    resumenTexto("resumenDestino", datos.destino || "-");
    resumenTexto("resumenTipoServicio", datos.tipoServicio || "-");
    resumenTexto("resumenCarga", datos.descripcionCarga || datos.tipoCarga || "-");
    resumenTexto("resumenPeso", datos.peso ? datos.peso + " TN" : "-");
    resumenTexto("resumenConfig", datos.configuracion || "-");
    resumenTexto("resumenPermiso", datos.tipoPermiso || "-");

    resumenTexto("resumenConductores", datos.cantidadConductores || "0");
    resumenTexto("resumenEscoltas", datos.cantidadEscoltas || "0");
    resumenTexto("resumenPolicial", datos.cantidadApoyoPolicial || "0");
    resumenTexto("resumenTopografos", datos.cantidadTopografos || "0");
    resumenTexto("resumenPersonal", personalCantidad.toLocaleString("es-PE"));

    resumenTexto("resumenFormaPago", datos.formaPago || "-");
    resumenTexto("resumenDiasPago", datos.diasPago ? datos.diasPago + " dias" : "-");
    resumenTexto("resumenTipoCambio", datos.tipoCambio || "-");
    resumenTexto("resumenTarifaCliente", datos.tarifa ? formatoMonedaResumen(datos.tarifa) : "-");

    renderizarBarrasCostosResumen(costos, costoTotal);
    renderizarDesgloseTarifasResumen(costoTotal);
}

function obtenerDatosResumenDisponible(){
    const datosActuales = obtenerDatosCotizacion();
    if(datosActuales.numero || datosActuales.cliente || datosActuales.origen || datosActuales.destino){
        return datosActuales;
    }

    try{
        return JSON.parse(localStorage.getItem("ultimaCotizacionResumen")) || datosActuales;
    }catch(error){
        return datosActuales;
    }
}

function cerrarResumenCotizacion(){
    localStorage.removeItem("ultimaCotizacionResumen");
    if(typeof cerrarYPrepararNuevaCotizacion === "function"){
        cerrarYPrepararNuevaCotizacion();
    }else{
        mostrarPantalla("cotizacion");
    }
}

function obtenerCostosResumen(){
    if(typeof gruposResultado === "undefined" || typeof obtenerSubconceptosPorConfig !== "function"){
        return [];
    }

    return gruposResultado.map(function(grupo){
        const costo = grupo.configs.reduce(function(totalGrupo, config){
            const subconceptos = obtenerSubconceptosPorConfig(config);
            return totalGrupo + subconceptos.reduce(function(total, item){ return total + item.costo; }, 0);
        }, 0);
        return { nombre: grupo.nombre, costo: costo };
    }).filter(function(item){
        return item.costo > 0;
    });
}

function renderizarBarrasCostosResumen(costos, total){
    const contenedor = document.getElementById("resumenBarrasCostos");
    if(!contenedor){ return; }

    if(costos.length === 0){
        contenedor.innerHTML = '<div class="barra-vacia">Carga datos en Drivers para ver la composicion de costos.</div>';
        return;
    }

    contenedor.innerHTML = costos.map(function(item){
        const porcentaje = total > 0 ? (item.costo / total) * 100 : 0;
        return '<div class="barra-costo">' +
            '<div class="barra-costo-head"><span>' + escaparResumen(item.nombre) + '</span><strong>' + porcentaje.toFixed(1) + '%</strong></div>' +
            '<div class="barra-track"><span style="width:' + Math.min(porcentaje, 100).toFixed(2) + '%"></span></div>' +
            '<small>' + formatoMonedaResumen(item.costo) + '</small>' +
        '</div>';
    }).join("");
}

function renderizarDesgloseTarifasResumen(total){
    const contenedor = document.getElementById("resumenDesgloseTarifas");
    if(!contenedor){
        return;
    }

    if(typeof obtenerComponentesTarifaResultado !== "function"){
        contenedor.innerHTML = '<div class="barra-vacia">Calcule la tarifa para ver el desglose comercial.</div>';
        return;
    }

    const componentes = obtenerComponentesTarifaResultado(total || 0);
    contenedor.innerHTML = componentes.map(function(item){
        return '<article class="tarifa-apoyo-card' + (item.estado === "Pendiente driver" ? ' pendiente-driver' : '') + '">' +
            '<div class="tarifa-apoyo-head"><span>' + escaparResumen(item.nombre) + '</span><strong>' + formatoMonedaResumen(item.tarifa) + '</strong></div>' +
            '<div class="tarifa-barra"><i style="width:' + Math.min(item.porcentaje, 100).toFixed(2) + '%"></i></div>' +
            '<small>Costo: ' + formatoMonedaResumen(item.costo) + ' / Contribucion: ' + item.porcentaje.toFixed(1) + '% / ' + escaparResumen(item.estado) + '</small>' +
        '</article>';
    }).join("");
}

function resumenTexto(id, valor){
    const elemento = document.getElementById(id);
    if(elemento){ elemento.textContent = valor; }
}

function formatoMonedaResumen(valor){
    return "S/ " + (parseFloat(valor) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escaparResumen(valor){
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


