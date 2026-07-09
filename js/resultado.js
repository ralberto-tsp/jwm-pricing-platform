const gruposResultado = [
    {
        id: "variables",
        nombre: "Costos Variables",
        configs: [
            { id: "combustible", nombre: "Combustible", calculado: obtenerSubconceptosCombustible },
            { id: "mantenimiento", nombre: "Mantenimiento", calculado: obtenerSubconceptosMantenimiento },
            { id: "neumaticos", nombre: "Neumaticos", calculado: obtenerSubconceptosNeumaticos },
            { id: "peajes", nombre: "Peajes", calculado: obtenerSubconceptosPeajes },
            { id: "permisos", nombre: "Permisos", calculado: obtenerSubconceptosPermisos }
        ]
    },
    {
        id: "conductor",
        nombre: "Costos Conductor y Personal Operativo",
        configs: [
            { id: "conductores", nombre: "Conductor", calculado: obtenerSubconceptosConductores },
            { id: "personal", nombre: "Personal Operativo Adicional", calculado: obtenerSubconceptosPersonalOperativo },
            { id: "viaje-conductor", nombre: "Viaticos y Hospedaje", calculado: obtenerSubconceptosViajeConductor }
        ]
    },
    {
        id: "vehiculo",
        nombre: "Costos Vehiculo",
        configs: [
            { id: "seguros", nombre: "Seguros Vehiculo / Carga / SOAT", calculado: obtenerSubconceptosSeguros },
            { id: "operativos-vehiculo", nombre: "Implementos, GPS y Operativos Vehiculo", calculado: obtenerSubconceptosOperativosVehiculo },
            { id: "viaje-vehiculo", nombre: "Costos Vehiculo por Viaje", calculado: obtenerSubconceptosViajeVehiculo },
            { id: "unidades-apoyo", nombre: "Camionetas y Tractos de Apoyo", calculado: obtenerSubconceptosUnidadesApoyo }
        ]
    },
    {
        id: "adicionales",
        nombre: "Gastos Adicionales",
        configs: [
            { id: "personal-estructural", nombre: "Planillas por Area", calculado: obtenerSubconceptosPersonalEstructural },
            { id: "administrativos", nombre: "Gastos Administrativos", calculado: obtenerSubconceptosAdministrativos }
        ]
    },
    {
        id: "financieros",
        nombre: "Gastos Financieros",
        configs: [
            { id: "depreciacion", nombre: "Depreciacion", calculado: obtenerSubconceptosDepreciacion },
            { id: "financieros", nombre: "Gastos Financieros", calculado: obtenerSubconceptosFinancieros }
        ]
    }
];

const driversCostoResultado = gruposResultado.flatMap(function(grupo){ return grupo.configs; });
let resultadoExclusionesActuales = [];
let resultadoUltimoTotal = 0;

function inicializarResultado(){
    renderizarDesgloseCostos(resultadoExclusionesActuales);
}

function recalcularResultado(){
    resultadoExclusionesActuales = obtenerExclusionesResultado();
    renderizarDesgloseCostos(resultadoExclusionesActuales);
    validarTarifa();
}

function obtenerExclusionesResultado(){
    return Array.from(document.querySelectorAll("#gruposCostos input[data-excluir]:checked")).map(function(input){
        return input.dataset.excluir;
    });
}

function obtenerDriverResultado(nombre){
    try{ return JSON.parse(localStorage.getItem("driver_" + nombre)) || []; }
    catch(error){ return []; }
}

function renderizarDesgloseCostos(exclusiones = []){
    const contenedor = document.getElementById("gruposCostos");
    if(!contenedor){ return; }

    const grupos = gruposResultado.map(function(grupo){
        const conceptos = grupo.configs.map(function(config){
            const subconceptos = obtenerSubconceptosPorConfig(config);
            const costoBase = subconceptos.reduce(function(total, item){ return total + item.costo; }, 0);
            const costo = obtenerCostoConceptoConExclusiones(config.id, subconceptos, exclusiones);
            return { id: config.id, nombre: config.nombre, costo: costo, costoBase: costoBase, subconceptos: subconceptos };
        });
        const total = conceptos.reduce(function(suma, concepto){ return suma + concepto.costo; }, 0);
        return { id: grupo.id, nombre: grupo.nombre, conceptos: conceptos, total: total };
    });

    const totalGeneral = grupos.reduce(function(suma, grupo){ return suma + grupo.total; }, 0);
    resultadoUltimoTotal = totalGeneral;
    contenedor.innerHTML = grupos.map(function(grupo){
        return construirGrupoCosto(grupo, totalGeneral, exclusiones);
    }).join("");

    actualizarKpisResultado(totalGeneral);
    renderizarDesgloseTarifasResultado(totalGeneral);
}

function obtenerSubconceptosPorConfig(config){
    if(typeof config.calculado === "function"){
        return config.calculado(config);
    }
    return [];
}

function obtenerCostoConceptoConExclusiones(conceptoId, subconceptos, exclusiones){
    if(exclusiones.includes(conceptoId)){ return 0; }
    return subconceptos.reduce(function(total, item){
        return total + (exclusiones.includes(item.id) ? 0 : item.costo);
    }, 0);
}

function obtenerContextoResultado(){
    const resumenCargas = typeof obtenerResumenCargasCotizacion === "function"
        ? obtenerResumenCargasCotizacion()
        : { peso: numeroCampoResultado("pesoTotal"), largo: numeroCampoResultado("largoCarga"), ancho: numeroCampoResultado("anchoCarga"), alto: numeroCampoResultado("altoCarga") };
    const destino = valorCampoResultado("destino");
    const ubigeoDestino = obtenerDriverResultado("ubigeos").find(function(item){
        return normalizarTextoResultado(item.distrito) === normalizarTextoResultado(destino);
    }) || {};
    const configuracionPrincipal = valorCampoResultado("configuracionPrincipal");
    const configuracionAcople = valorCampoResultado("configuracionAcople");
    const tipoVehiculo = valorCampoResultado("tipoVehiculo");
    const tipoAcople = valorCampoResultado("tipoAcople");

    const unidadPrincipal = buscarRegistroFlexible(obtenerDriverResultado("flota"), {
        tipo: tipoVehiculo,
        configuracion: configuracionPrincipal
    }) || {};
    const acople = buscarRegistroFlexible(obtenerDriverResultado("acoples"), {
        tipoacople: tipoAcople,
        configuracion: configuracionAcople
    }) || {};
    const altoBaseCarga = numeroValorResultado(acople.altoplataforma || unidadPrincipal.altoplataforma);
    const largoOperativo = Math.max(
        resumenCargas.largo || numeroCampoResultado("largoCarga"),
        numeroValorResultado(unidadPrincipal.largo) + numeroValorResultado(acople.largo),
        numeroValorResultado(acople.largo)
    );
    const anchoOperativo = Math.max(
        resumenCargas.ancho || numeroCampoResultado("anchoCarga"),
        numeroValorResultado(unidadPrincipal.ancho),
        numeroValorResultado(acople.ancho)
    );
    const altoOperativo = (resumenCargas.alto || numeroCampoResultado("altoCarga")) + altoBaseCarga;
    const accesorios = obtenerAccesoriosResultado();
    const pesoAccesorios = accesorios.reduce(function(total, item){
        return total + numeroValorResultado(item.peso);
    }, 0);

    return {
        origen: valorCampoResultado("origen"),
        destino: destino,
        departamentoDestino: valorCampoResultado("departamentoDestino") || ubigeoDestino.departamento || "",
        zonaDestino: ubigeoDestino.zona || "",
        tipoCarga: valorCampoResultado("tipoServicio"),
        tipoServicio: valorCampoResultado("tipoServicio"),
        tipoVehiculo: tipoVehiculo,
        configuracionPrincipal: configuracionPrincipal,
        tipoAcople: tipoAcople,
        configuracionAcople: configuracionAcople,
        configuracionFinal: valorCampoResultado("configuracionFinal"),
        tractoApoyo: valorCampoResultado("tractoApoyo"),
        categoriaConductor: valorCampoResultado("categoriaConductor"),
        cantidadConductores: numeroCampoResultado("cantidadConductores") || 1,
        cantidadEscoltas: numeroCampoResultado("cantidadEscoltas"),
        cantidadApoyoPolicial: numeroCampoResultado("cantidadApoyoPolicial"),
        cantidadTopografos: numeroCampoResultado("cantidadTopografos"),
        tipoPermiso: valorCampoResultado("tipoPermiso"),
        tipoViaje: valorCampoResultado("tipoViaje") || "ida",
        km: numeroCampoResultado("kmTotales"),
        diasTransito: numeroCampoResultado("diasTransito"),
        dias: numeroCampoResultado("diasTotales") || numeroCampoResultado("diasTransito"),
        peso: resumenCargas.peso || numeroCampoResultado("pesoTotal"),
        pesoAccesorios: pesoAccesorios,
        pesoOperativo: (resumenCargas.peso || numeroCampoResultado("pesoTotal")) + pesoAccesorios,
        largo: resumenCargas.largo || numeroCampoResultado("largoCarga"),
        ancho: resumenCargas.ancho || numeroCampoResultado("anchoCarga"),
        alto: resumenCargas.alto || numeroCampoResultado("altoCarga"),
        largoOperativo: largoOperativo,
        anchoOperativo: anchoOperativo,
        altoOperativo: altoOperativo,
        altoBaseCarga: altoBaseCarga,
        formaPago: valorCampoResultado("formaPago"),
        diasPago: numeroCampoResultado("diasPago"),
        porcentajeFactoring: numeroCampoResultado("porcentajeFactoring"),
        unidadPrincipal: unidadPrincipal,
        acople: acople,
        accesorios: accesorios
    };
}

function obtenerAccesoriosResultado(){
    if(typeof obtenerAccesoriosCotizacion === "function"){
        return obtenerAccesoriosCotizacion();
    }
    try{
        return JSON.parse(localStorage.getItem("cotizacion_accesorios")) || [];
    }catch(error){
        return [];
    }
}

function obtenerSubconceptosCombustible(){
    const ctx = obtenerContextoResultado();
    const combustibleTipo = ctx.unidadPrincipal.combustible || "";
    const combustible = buscarRegistroFlexible(obtenerDriverResultado("combustible"), { tipo: combustibleTipo }) ||
        obtenerDriverResultado("combustible")[0] || {};
    const rendimiento = obtenerRendimiento(ctx, ctx.unidadPrincipal);
    const precio = numeroValorResultado(combustible.preciosinigv || combustible.precio || combustible.costo);
    const costo = ctx.km > 0 && rendimiento > 0 ? (ctx.km / rendimiento) * precio : 0;
    return crearListaCostos([{ id: "combustible-principal", nombre: "Combustible unidad principal", costo: costo }]);
}

function obtenerSubconceptosMantenimiento(){
    const ctx = obtenerContextoResultado();
    const registros = obtenerDriverResultado("mantenimiento");
    const items = [];
    registros.forEach(function(registro, index){
        if(!aplicaAUnidadCotizada(registro, ctx)){ return; }
        const factor = numeroValorResultado(registro.factorkm);
        const costoFijo = sumarCamposResultado(registro, ["mp1", "mp2", "mp3", "correctivo", "costo"]);
        const costo = factor > 0 ? factor * ctx.km : costoFijo;
        items.push({ id: "mantenimiento-" + index, nombre: etiquetaRegistroResultado(registro, ["tipounidad", "tipo", "configuracion"], "Mantenimiento"), costo: costo });
    });
    return crearListaCostos(items);
}

function obtenerSubconceptosNeumaticos(){
    const ctx = obtenerContextoResultado();
    const registros = obtenerDriverResultado("neumaticos");
    const items = [];
    registros.forEach(function(registro, index){
        if(!aplicaAUnidadCotizada(registro, ctx)){ return; }
        const costoKm = numeroValorResultado(registro.costokm);
        const cantidad = numeroValorResultado(registro.cantidadllantas) || 1;
        const precio = numeroValorResultado(registro.preciollanta);
        const duracion = numeroValorResultado(registro.kmduracion);
        const costo = costoKm > 0 ? costoKm * ctx.km : (duracion > 0 ? (cantidad * precio / duracion) * ctx.km : 0);
        items.push({ id: "neumaticos-" + index, nombre: etiquetaRegistroResultado(registro, ["tipounidad", "configuracion", "tipollanta", "modelo"], "Neumaticos"), costo: costo });
    });
    return crearListaCostos(items);
}

function obtenerSubconceptosPeajes(){
    const ctx = obtenerContextoResultado();
    const ejes = (numeroValorResultado(ctx.unidadPrincipal.ejes) || 0) + (numeroValorResultado(ctx.acople.ejes) || 0);
    const factorViaje = ctx.tipoViaje === "ida-vuelta" ? 2 : 1;
    const items = [];
    obtenerDriverResultado("peajes").forEach(function(registro, index){
        if(!coincideRutaODepartamento(registro, ctx)){ return; }
        const costoIda = numeroValorResultado(registro.costoida);
        const costoVuelta = numeroValorResultado(registro.costovuelta);
        const costoEje = numeroValorResultado(registro.costoeje);
        const ejesAplicables = numeroValorResultado(registro.ejesaplicables) || ejes || 1;
        let costo = 0;
        if(costoIda > 0 || costoVuelta > 0){
            costo = ctx.tipoViaje === "ida-vuelta" ? costoIda + costoVuelta : costoIda;
        }else{
            costo = costoEje * ejesAplicables * factorViaje;
        }
        items.push({ id: "peajes-" + index, nombre: etiquetaRegistroResultado(registro, ["ruta", "tramo", "peaje"], "Peaje"), costo: costo });
    });
    return crearListaCostos(items);
}

function obtenerSubconceptosPermisos(){
    const ctx = obtenerContextoResultado();
    const items = [];
    obtenerDriverResultado("permisos").forEach(function(registro, index){
        const coincidePermiso = !registro.tipopermiso || normalizarTextoResultado(registro.tipopermiso) === normalizarTextoResultado(ctx.tipoPermiso);
        const pesoDesde = numeroValorResultado(registro.pesodesde);
        const pesoHasta = numeroValorResultado(registro.pesohasta) || Infinity;
        const anchoDesde = numeroValorResultado(registro.anchodesde);
        const anchoHasta = numeroValorResultado(registro.anchohasta) || Infinity;
        if(coincidePermiso && ctx.peso >= pesoDesde && ctx.peso <= pesoHasta && ctx.ancho >= anchoDesde && ctx.ancho <= anchoHasta){
            items.push({ id: "permisos-" + index, nombre: etiquetaRegistroResultado(registro, ["tipopermiso", "requisito"], "Permiso"), costo: numeroValorResultado(registro.costo) });
        }
    });
    return crearListaCostos(items);
}

function obtenerSubconceptosConductores(){
    const ctx = obtenerContextoResultado();
    const conductor = buscarRegistroFlexible(obtenerDriverResultado("conductores"), {
        categoria: ctx.categoriaConductor,
        tipocarga: ctx.tipoCarga
    }) || buscarRegistroFlexible(obtenerDriverResultado("conductores"), { categoria: ctx.categoriaConductor }) || {};
    const costoDia = obtenerCostoDiario(conductor);
    const costo = costoDia * ctx.dias * ctx.cantidadConductores;
    const nombre = etiquetaRegistroResultado(conductor, ["categoria", "tipocarga", "habilitacion"], "Conductor");
    return crearListaCostos([{ id: "conductores-principal", nombre: nombre + " x " + ctx.cantidadConductores, costo: costo }]);
}

function obtenerSubconceptosPersonalOperativo(){
    const ctx = obtenerContextoResultado();
    let lista = [];
    try{ lista = JSON.parse(localStorage.getItem("cotizacion_personal_operativo")) || []; }
    catch(error){ lista = []; }
    return crearListaCostos(lista.map(function(item, index){
        const driver = buscarRegistroFlexible(obtenerDriverResultado("personal"), { cargo: item.cargo }) || item;
        const cantidad = numeroValorResultado(item.cantidad) || 1;
        const costo = obtenerCostoDiario(driver) * ctx.dias * cantidad;
        return { id: "personal-" + index, nombre: item.cargo + " x " + cantidad, costo: costo };
    }).concat(obtenerSubconceptosTopografosPersonal(ctx)));
}

function obtenerSubconceptosViajeConductor(){
    return obtenerCostosViajePorFiltro("viaje-conductor", esCostoViajeConductor, "Conductor");
}

function obtenerSubconceptosTopografosPersonal(ctx){
    if(!ctx.cantidadTopografos){ return []; }
    const driver = obtenerDriverResultado("personal").find(function(item){
        return esCostoTopografo(item);
    });
    if(!driver){ return []; }
    return [{
        id: "personal-topografo",
        nombre: "Topografo x " + ctx.cantidadTopografos,
        costo: obtenerCostoDiario(driver) * ctx.dias * ctx.cantidadTopografos
    }];
}

function obtenerSubconceptosSeguros(){
    const ctx = obtenerContextoResultado();
    const items = [];
    obtenerDriverResultado("seguros").forEach(function(registro, index){
        if(!aplicaAUnidadCotizada(registro, ctx)){ return; }
        const factorDiario = numeroValorResultado(registro.factordiario);
        const prima = numeroValorResultado(registro.prima || registro.costo);
        const costo = factorDiario > 0 ? factorDiario * ctx.dias : (prima > 0 ? (prima / 30) * ctx.dias : 0);
        items.push({ id: "seguros-" + index, nombre: etiquetaRegistroResultado(registro, ["tipo", "tipounidad", "configuracion"], "Seguro"), costo: costo });
    });
    return crearListaCostos(items);
}

function obtenerSubconceptosOperativosVehiculo(){
    const ctx = obtenerContextoResultado();
    const items = [];
    obtenerDriverResultado("operativos").forEach(function(registro, index){
        if(!esCostoVehiculo(registro)){ return; }
        items.push({ id: "operativos-" + index, nombre: etiquetaRegistroResultado(registro, ["grupo", "concepto"], "Operativo vehiculo"), costo: calcularCostoPorTipo(registro, ctx, numeroValorResultado(registro.cantidad) || 1) });
    });
    return crearListaCostos(items);
}

function obtenerSubconceptosViajeVehiculo(){
    const items = obtenerCostosViajePorFiltro("viaje-vehiculo", esCostoViajeVehiculo, "Vehiculo");
    const policiales = obtenerCostosViajePorFiltro("apoyo-policial", esCostoApoyoPolicial, "Apoyo policial", numeroCampoResultado("cantidadApoyoPolicial"));
    const topografos = obtenerCostosViajePorFiltro("topografo", esCostoTopografo, "Topografo", numeroCampoResultado("cantidadTopografos"));
    if(numeroCampoResultado("cantidadApoyoPolicial") > 0 && policiales.length === 0){
        policiales.push({ id: "apoyo-policial-pendiente", nombre: "Apoyo policial x " + numeroCampoResultado("cantidadApoyoPolicial") + " - pendiente driver", costo: 0, mostrarCero: true });
    }
    if(numeroCampoResultado("cantidadTopografos") > 0 && topografos.length === 0 && obtenerSubconceptosTopografosPersonal(obtenerContextoResultado()).length === 0){
        topografos.push({ id: "topografo-pendiente", nombre: "Topografo x " + numeroCampoResultado("cantidadTopografos") + " - pendiente driver", costo: 0, mostrarCero: true });
    }
    return crearListaCostos(items.concat(policiales, topografos));
}

function obtenerSubconceptosUnidadesApoyo(){
    const ctx = obtenerContextoResultado();
    const items = [];
    const camioneta = buscarUnidadApoyo("escolta") || buscarUnidadApoyo("camioneta");
    if(ctx.cantidadEscoltas > 0 && camioneta){
        items.push({
            id: "apoyo-camioneta",
            nombre: "Camioneta escolta x " + ctx.cantidadEscoltas,
            costo: calcularCostoUnidadApoyo(camioneta, ctx) * ctx.cantidadEscoltas
        });
    }

    const tractoApoyo = buscarUnidadApoyo("tracto");
    if(normalizarTextoResultado(ctx.tractoApoyo) === "si" && tractoApoyo){
        items.push({
            id: "apoyo-tracto",
            nombre: "Tracto de apoyo",
            costo: calcularCostoUnidadApoyo(tractoApoyo, ctx)
        });
    }
    return crearListaCostos(items);
}

function obtenerSubconceptosPersonalEstructural(){
    const ctx = obtenerContextoResultado();
    const items = [];
    obtenerDriverResultado("personal").forEach(function(registro, index){
        if(!esPersonalEstructural(registro)){ return; }
        const cantidad = numeroValorResultado(registro.cantidad) || 1;
        const costoBase = obtenerCostoMensual(registro) * cantidad;
        items.push({ id: "personal-estructural-" + index, nombre: etiquetaRegistroResultado(registro, ["area", "cargo"], "Planilla"), costo: calcularCostoProrrateado(costoBase, registro, ctx) });
    });
    return crearListaCostos(items);
}

function obtenerSubconceptosAdministrativos(){
    const ctx = obtenerContextoResultado();
    return crearListaCostos(obtenerDriverResultado("administrativos").map(function(registro, index){
        const cantidad = numeroValorResultado(registro.cantidad) || 1;
        const costoBase = numeroValorResultado(registro.costo) * cantidad;
        return { id: "administrativos-" + index, nombre: etiquetaRegistroResultado(registro, ["area", "concepto"], "Administrativo"), costo: calcularCostoProrrateado(costoBase, registro, ctx) };
    }));
}

function obtenerSubconceptosDepreciacion(){
    const ctx = obtenerContextoResultado();
    const activos = [];
    if(ctx.unidadPrincipal && Object.keys(ctx.unidadPrincipal).length > 0){
        activos.push({ id: "depreciacion-flota", nombre: "Tracto/Camion - " + etiquetaRegistroResultado(ctx.unidadPrincipal, ["tipo", "configuracion"], "Unidad"), costo: calcularDepreciacionActivo(ctx.unidadPrincipal, ctx.dias) });
    }
    if(ctx.acople && Object.keys(ctx.acople).length > 0){
        activos.push({ id: "depreciacion-acople", nombre: "Acople - " + etiquetaRegistroResultado(ctx.acople, ["tipo", "tipoacople", "configuracion"], "Acople"), costo: calcularDepreciacionActivo(ctx.acople, ctx.dias) });
    }
    ctx.accesorios.forEach(function(accesorio, index){
        activos.push({ id: "depreciacion-accesorio-" + index, nombre: "Accesorio - " + etiquetaRegistroResultado(accesorio, ["tipo"], "Accesorio"), costo: calcularDepreciacionActivo(accesorio, ctx.dias) });
    });
    return crearListaCostos(activos);
}

function obtenerSubconceptosFinancieros(){
    const ctx = obtenerContextoResultado();
    const items = obtenerDriverResultado("financieros").map(function(registro, index){
        const cantidad = numeroValorResultado(registro.cantidad) || 1;
        const costoBase = numeroValorResultado(registro.costo) * cantidad;
        return { id: "financieros-" + index, nombre: etiquetaRegistroResultado(registro, ["concepto", "periodicidad"], "Financiero"), costo: calcularCostoProrrateado(costoBase, registro, ctx) };
    });

    if(ctx.porcentajeFactoring > 0 && ctx.diasPago > 0){
        const costoFactoring = resultadoUltimoTotal * (ctx.porcentajeFactoring / 100) * (ctx.diasPago / 30);
        items.push({ id: "financieros-factoring", nombre: "Factoring segun dias de pago", costo: costoFactoring });
    }
    return crearListaCostos(items);
}

function obtenerCostosViajePorFiltro(prefijo, filtro, fallback, multiplicadorForzado){
    const ctx = obtenerContextoResultado();
    const items = [];
    obtenerDriverResultado("viaje").forEach(function(registro, index){
        if(!filtro(registro)){ return; }
        const cantidad = multiplicadorForzado !== undefined ? multiplicadorForzado : (numeroValorResultado(registro.cantidad) || 1);
        items.push({ id: prefijo + "-" + index, nombre: etiquetaRegistroResultado(registro, ["grupo", "concepto"], fallback), costo: calcularCostoPorTipo(registro, ctx, cantidad) });
    });
    return items;
}

function calcularCostoUnidadApoyo(unidad, ctx){
    const combustible = buscarRegistroFlexible(obtenerDriverResultado("combustible"), { tipo: unidad.combustible }) || obtenerDriverResultado("combustible")[0] || {};
    const rendimiento = obtenerRendimiento(ctx, unidad);
    const precio = numeroValorResultado(combustible.preciosinigv || combustible.precio || combustible.costo);
    const combustibleCosto = ctx.km > 0 && rendimiento > 0 ? (ctx.km / rendimiento) * precio : 0;
    const depreciacion = calcularDepreciacionActivo(unidad, ctx.dias);
    const costoDirecto = numeroValorResultado(unidad.costo || unidad.costodiario) * (unidad.costodiario ? ctx.dias : 1);
    return combustibleCosto + depreciacion + costoDirecto;
}

function buscarUnidadApoyo(texto){
    return obtenerDriverResultado("unidadesApoyo").find(function(item){
        return Object.values(item).join(" ").toLowerCase().includes(texto);
    });
}

function calcularCostoPorTipo(registro, ctx, cantidad){
    const costo = numeroValorResultado(registro.costoservicio || registro.costo);
    const tipo = normalizarTextoResultado(registro.tipocalculo || registro.periodicidad);
    const qty = cantidad || 1;
    if(tipo.includes("km")){ return costo * ctx.km * qty; }
    if(tipo.includes("dia") || tipo.includes("diario")){ return costo * ctx.dias * qty; }
    if(tipo.includes("persona")){ return costo * ctx.dias * ctx.cantidadConductores * qty; }
    if(tipo.includes("mensual") || tipo.includes("mes")){ return (costo / 30) * ctx.dias * qty; }
    return costo * qty;
}

function calcularCostoProrrateado(costoBase, registro, ctx = obtenerContextoResultado()){
    const totalFlota = obtenerTotalFlotaProrrateo();
    const periodicidad = normalizarTextoResultado(registro.periodicidad);
    const aplica = normalizarTextoResultado(registro.aplicaprorrateo || "Si");

    if(aplica === "no"){
        return costoBase;
    }
    if(totalFlota <= 0){
        return 0;
    }
    if(periodicidad.includes("diario") || periodicidad.includes("dia")){
        return (costoBase / totalFlota) * ctx.dias;
    }
    return (costoBase / 30 / totalFlota) * ctx.dias;
}

function obtenerTotalFlotaProrrateo(){
    return obtenerDriverResultado("flotaProrrateo").reduce(function(total, item){
        const aplica = normalizarTextoResultado(item.aplicaprorrateo || "Si");
        if(aplica === "no"){ return total; }
        return total + (numeroValorResultado(item.cantidad) || 0);
    }, 0);
}

function calcularDepreciacionActivo(item, dias){
    const precio = numeroValorResultado(item.precio);
    const porcentaje = numeroValorResultado(item.porcentajedepreciacion);
    const vidaUtil = numeroValorResultado(item.vidautil);
    if(precio <= 0 || porcentaje <= 0 || vidaUtil <= 0 || dias <= 0){ return 0; }
    return (precio * (porcentaje / 100) / vidaUtil / 30) * dias;
}

function obtenerRendimiento(ctx, unidad){
    const registros = obtenerDriverResultado("rendimiento");
    const registro = registros.find(function(item){
        return coincideTextoFlexible(item.zona, ctx.zonaDestino) &&
            coincideTextoFlexible(item.configuracion, unidad.configuracion || ctx.configuracionPrincipal) &&
            coincideTextoFlexible(item.tipocarga, ctx.tipoCarga);
    }) || registros.find(function(item){
        return coincideTextoFlexible(item.configuracion, unidad.configuracion || ctx.configuracionPrincipal);
    }) || {};

    const capacidad = Math.max(numeroValorResultado(unidad.capacidad) - (ctx.pesoAccesorios || 0), 0);
    const ocupacion = capacidad > 0 ? ctx.peso / capacidad : 1;
    const vacio = numeroValorResultado(registro.vacio);
    const medio = numeroValorResultado(registro["50porcentajepeso"] || registro["50peso"]);
    const lleno = numeroValorResultado(registro["100porcentajepeso"] || registro["100peso"]);
    if(ocupacion <= 0 && vacio > 0){ return vacio; }
    if(ocupacion <= 0.5 && medio > 0){ return medio; }
    if(lleno > 0){ return lleno; }
    return medio || vacio || 0;
}

function aplicaAUnidadCotizada(registro, ctx){
    const tipoUnidad = normalizarTextoResultado(registro.tipounidad || registro.tipo);
    const configuracion = normalizarTextoResultado(registro.configuracion);
    if(configuracion && configuracion !== normalizarTextoResultado(ctx.configuracionPrincipal) && configuracion !== normalizarTextoResultado(ctx.configuracionAcople) && configuracion !== normalizarTextoResultado(ctx.configuracionFinal)){
        return false;
    }
    if(!tipoUnidad){ return true; }
    const textoUnidad = [ctx.tipoVehiculo, ctx.tipoAcople, ctx.configuracionPrincipal, ctx.configuracionAcople].join(" ");
    return normalizarTextoResultado(textoUnidad).includes(tipoUnidad) || tipoUnidad.includes(normalizarTextoResultado(ctx.tipoVehiculo)) || tipoUnidad.includes(normalizarTextoResultado(ctx.tipoAcople));
}

function coincideRutaODepartamento(registro, ctx){
    const departamento = normalizarTextoResultado(registro.departamento);
    const ruta = normalizarTextoResultado(registro.ruta || registro.tramo);
    const rutaCotizada = normalizarTextoResultado(ctx.origen + " " + ctx.destino + " " + ctx.departamentoDestino);
    const coincideDepartamento = !departamento || departamento === normalizarTextoResultado(ctx.departamentoDestino);
    const coincideRuta = !ruta || rutaCotizada.includes(ruta) || ruta.includes(normalizarTextoResultado(ctx.destino));
    return coincideDepartamento && coincideRuta;
}

function buscarRegistroFlexible(registros, criterios){
    return registros.find(function(registro){
        return Object.keys(criterios).every(function(campo){
            return coincideTextoFlexible(registro[campo], criterios[campo]);
        });
    });
}

function coincideTextoFlexible(valorDriver, valorActual){
    if(!valorDriver || !valorActual){ return true; }
    return normalizarTextoResultado(valorDriver) === normalizarTextoResultado(valorActual);
}

function esPersonalEstructural(registro){
    const tipo = normalizarTextoResultado(registro.tipocosto);
    const prorrateo = normalizarTextoResultado(registro.aplicaprorrateo);
    return tipo.includes("estruct") || prorrateo === "si";
}

function esCostoViajeConductor(registro){
    const texto = Object.values(registro).join(" ").toLowerCase();
    return texto.includes("viatico") || texto.includes("viáticos") || texto.includes("hospedaje") || texto.includes("hotel");
}

function esCostoViajeVehiculo(registro){
    const texto = Object.values(registro).join(" ").toLowerCase();
    return texto.includes("cochera") || texto.includes("lavado") || texto.includes("encarp") || texto.includes("camioneta") || texto.includes("escolta") || texto.includes("tracto apoyo");
}

function esCostoApoyoPolicial(registro){
    const texto = Object.values(registro).join(" ").toLowerCase();
    return texto.includes("policial") || texto.includes("policia") || texto.includes("policía");
}

function esCostoTopografo(registro){
    const texto = Object.values(registro).join(" ").toLowerCase();
    return texto.includes("topografo") || texto.includes("topógrafo") || texto.includes("topografia") || texto.includes("topografía");
}

function esCostoVehiculo(registro){
    const texto = Object.values(registro).join(" ").toLowerCase();
    return texto.includes("gps") || texto.includes("vehiculo") || texto.includes("vehículo") || texto.includes("revision") || texto.includes("revisión") || texto.includes("implemento");
}

function obtenerCostoDiario(registro){
    const diario = numeroValorResultado(registro.costodiario);
    if(diario > 0){ return diario; }
    const empresa = numeroValorResultado(registro.costoempresa);
    if(empresa > 0){ return empresa / 30; }
    const sueldo = numeroValorResultado(registro.sueldo);
    return sueldo > 0 ? sueldo / 30 : numeroValorResultado(registro.costo);
}

function obtenerCostoMensual(registro){
    const empresa = numeroValorResultado(registro.costoempresa);
    if(empresa > 0){ return empresa; }
    const sueldo = numeroValorResultado(registro.sueldo);
    if(sueldo > 0){ return sueldo; }
    const diario = numeroValorResultado(registro.costodiario);
    return diario > 0 ? diario * 30 : numeroValorResultado(registro.costo);
}

function sumarCamposResultado(registro, campos){
    return campos.reduce(function(total, campo){ return total + numeroValorResultado(registro[campo]); }, 0);
}

function crearListaCostos(items){
    return items.filter(function(item){ return item && (item.costo > 0 || item.mostrarCero); });
}

function etiquetaRegistroResultado(registro, campos, fallback){
    const partes = campos.map(function(campo){ return registro[campo]; })
        .filter(function(valor){ return valor !== undefined && String(valor).trim() !== ""; });
    return partes.length === 0 ? fallback : partes.join(" - ");
}

function valorCampoResultado(id){
    return document.getElementById(id)?.value || "";
}

function numeroCampoResultado(id){
    return numeroValorResultado(valorCampoResultado(id));
}

function numeroValorResultado(valor){
    const numero = parseFloat(String(valor ?? "").replace("%", "").replace(",", "."));
    return Number.isNaN(numero) ? 0 : numero;
}

function normalizarTextoResultado(valor){
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "")
        .toLowerCase();
}

function construirGrupoCosto(grupo, totalGeneral, exclusiones){
    const porcentajeGrupo = totalGeneral > 0 ? (grupo.total / totalGeneral) * 100 : 0;
    return '<section class="grupo-costo">' +
        '<div class="grupo-costo-header"><h3>' + grupo.nombre + '</h3><div><strong>' + formatoMoneda(grupo.total) + '</strong><span>' + porcentajeGrupo.toFixed(2) + '%</span></div></div>' +
        '<table class="tabla-drivers tabla-resultado tabla-grupo-costo">' +
            '<thead><tr><th>Concepto</th><th>S/.</th><th>%</th><th>Detalle</th><th>Excluir</th></tr></thead>' +
            '<tbody>' + grupo.conceptos.map(function(concepto){
                return construirFilaConceptoCosto(concepto, totalGeneral, exclusiones) + construirFilaSubconceptosCosto(concepto, totalGeneral, exclusiones);
            }).join("") + '</tbody>' +
        '</table>' +
    '</section>';
}

function construirFilaConceptoCosto(concepto, total, exclusiones){
    const porcentaje = total > 0 ? (concepto.costo / total) * 100 : 0;
    const disabled = concepto.subconceptos.length === 0 ? " disabled" : "";
    const checked = exclusiones.includes(concepto.id) ? " checked" : "";
    return '<tr class="fila-concepto" data-concepto="' + concepto.id + '">' +
        '<td>' + concepto.nombre + '</td>' +
        '<td>' + formatoMoneda(concepto.costo) + '</td>' +
        '<td>' + porcentaje.toFixed(2) + '%</td>' +
        '<td><button class="btn-detalle" onclick="verDetalle(\'' + concepto.id + '\')"' + disabled + '>Ver</button></td>' +
        '<td class="col-excluir"><input type="checkbox" data-excluir="' + concepto.id + '"' + checked + '></td>' +
        '</tr>';
}

function construirFilaSubconceptosCosto(concepto, total, exclusiones){
    let contenido = "";
    if(concepto.subconceptos.length === 0){
        contenido = '<li><span>Sin registros aplicables en Driver</span><span>S/ 0.00</span><span>0.00%</span><input type="checkbox" disabled></li>';
    }else{
        contenido = concepto.subconceptos.map(function(item){
            const costoAplicado = exclusiones.includes(concepto.id) || exclusiones.includes(item.id) ? 0 : item.costo;
            const porcentaje = total > 0 ? (costoAplicado / total) * 100 : 0;
            const checked = exclusiones.includes(item.id) ? " checked" : "";
            return '<li><span>' + escaparResultado(item.nombre) + '</span><span>' + formatoMoneda(costoAplicado) + '</span><span>' + porcentaje.toFixed(2) + '%</span><input type="checkbox" data-excluir="' + item.id + '"' + checked + '></li>';
        }).join("");
    }
    return '<tr id="detalle-' + concepto.id + '" class="fila-subconceptos" style="display:none;"><td colspan="5"><ul class="lista-subconceptos">' + contenido + '</ul></td></tr>';
}

function renderizarDesgloseTarifasResultado(totalGeneral){
    const contenedor = document.getElementById("tarifasApoyoResultado");
    if(!contenedor){ return; }

    const componentes = obtenerComponentesTarifaResultado(totalGeneral);

    contenedor.innerHTML = '<div class="section-heading-row tarifas-detalle-heading"><div><span class="section-label">Tarifas por componente</span><h2>Desglose Comercial</h2></div></div>' +
    '<div class="tarifas-detalle-grid">' + componentes.map(function(item){
        return '<article class="tarifa-apoyo-card' + (item.estado === "Pendiente driver" ? ' pendiente-driver' : '') + '"><div class="tarifa-apoyo-head"><span>' + escaparResultado(item.nombre) + '</span><strong>' + formatoMoneda(item.tarifa) + '</strong></div><div class="tarifa-barra"><i style="width:' + Math.min(item.porcentaje, 100).toFixed(2) + '%"></i></div><small>Costo: ' + formatoMoneda(item.costo) + ' / Contribucion: ' + item.porcentaje.toFixed(1) + '% / ' + escaparResultado(item.estado) + '</small></article>';
    }).join("") + '</div>';
}

function obtenerComponentesTarifaResultado(totalGeneral){
    const margen = numeroCampoResultado("margenObjetivo") || 20;
    const componentes = [];
    const ctx = obtenerContextoResultado();
    const apoyos = obtenerSubconceptosUnidadesApoyo();
    const camioneta = apoyos.filter(function(item){ return item.id === "apoyo-camioneta"; });
    const tractoApoyo = apoyos.filter(function(item){ return item.id === "apoyo-tracto"; });
    const policial = obtenerCostosViajePorFiltro("apoyo-policial-tarifa", esCostoApoyoPolicial, "Apoyo policial", ctx.cantidadApoyoPolicial);
    const topografoViaje = obtenerCostosViajePorFiltro("topografo-tarifa", esCostoTopografo, "Topografo", ctx.cantidadTopografos);
    const topografoPersonal = obtenerSubconceptosTopografosPersonal(ctx);
    const topografo = topografoViaje.concat(topografoPersonal);
    const costoApoyos = [].concat(camioneta, tractoApoyo, policial, topografo).reduce(function(total, item){ return total + item.costo; }, 0);
    const costoPrincipal = Math.max((parseFloat(totalGeneral) || 0) - costoApoyos, 0);

    agregarComponenteTarifa(componentes, obtenerNombreUnidadPrincipalResultado(), costoPrincipal, totalGeneral, margen, true, false);
    agregarComponenteTarifa(componentes, "Camioneta escolta", sumarCostoItems(camioneta), totalGeneral, margen, ctx.cantidadEscoltas > 0, ctx.cantidadEscoltas > 0 && camioneta.length === 0);
    agregarComponenteTarifa(componentes, "Tracto de apoyo", sumarCostoItems(tractoApoyo), totalGeneral, margen, normalizarTextoResultado(ctx.tractoApoyo) === "si", normalizarTextoResultado(ctx.tractoApoyo) === "si" && tractoApoyo.length === 0);
    agregarComponenteTarifa(componentes, "Apoyo policial", sumarCostoItems(policial), totalGeneral, margen, ctx.cantidadApoyoPolicial > 0, ctx.cantidadApoyoPolicial > 0 && policial.length === 0);
    agregarComponenteTarifa(componentes, "Topografo", sumarCostoItems(topografo), totalGeneral, margen, ctx.cantidadTopografos > 0, ctx.cantidadTopografos > 0 && topografo.length === 0);

    return componentes;
}

function agregarComponenteTarifa(lista, nombre, costo, totalGeneral, margen, requerido, pendiente){
    lista.push({
        nombre: nombre,
        costo: costo,
        tarifa: costo > 0 ? costo / (1 - (margen / 100)) : 0,
        porcentaje: totalGeneral > 0 ? (costo / totalGeneral) * 100 : 0,
        estado: pendiente ? "Pendiente driver" : (requerido ? "Calculado" : "No requerido")
    });
}

function sumarCostoItems(items){
    return items.reduce(function(total, item){ return total + item.costo; }, 0);
}

function obtenerNombreUnidadPrincipalResultado(){
    const ctx = obtenerContextoResultado();
    const partes = [ctx.tipoVehiculo, ctx.configuracionPrincipal, ctx.tipoAcople, ctx.configuracionAcople].filter(Boolean);
    return partes.length > 0 ? partes.join(" + ") : "Tracto / camion principal";
}

function actualizarKpisResultado(total){
    const km = numeroCampoResultado("kmTotales");
    const margen = numeroCampoResultado("margenObjetivo") || 20;
    const tarifa = total > 0 ? total / (1 - (margen / 100)) : 0;
    const utilidad = tarifa - total;
    const rentabilidad = tarifa > 0 ? (utilidad / tarifa) * 100 : 0;
    escribirResultado("resCosto", formatoMoneda(total));
    escribirResultado("resCostoKm", km > 0 ? formatoMoneda(total / km) : "S/ 0.00");
    escribirResultado("resTarifa", formatoMoneda(tarifa));
    escribirResultado("resUtilidad", formatoMoneda(utilidad));
    escribirResultado("resRentabilidad", rentabilidad.toFixed(1) + "%");
    const objetivo = document.getElementById("tarifaObjetivoResultado");
    const cliente = document.getElementById("tarifaClienteResultado");
    if(objetivo){ objetivo.value = tarifa.toFixed(2); }
    if(cliente && !cliente.value){ cliente.value = valorCampoResultado("tarifaCliente") || "0"; }
}

function guardarCotizacionResultado(){
    recalcularResultado();
    const cotizacion = guardarCotizacion(false);
    limpiarCotizacion();
    limpiarResultado();
    mostrarPantalla("resumen");
    if(typeof actualizarResumenEjecutivo === "function"){
        actualizarResumenEjecutivo(cotizacion);
    }
}

function limpiarResultado(){
    resultadoExclusionesActuales = [];
    resultadoUltimoTotal = 0;
    escribirResultado("resCosto", "S/ 0.00");
    escribirResultado("resCostoKm", "S/ 0.00");
    escribirResultado("resTarifa", "S/ 0.00");
    escribirResultado("resUtilidad", "S/ 0.00");
    escribirResultado("resRentabilidad", "0 %");
    ["tarifaObjetivoResultado","tarifaClienteResultado","diferenciaTarifa","rentabilidadCalculada"].forEach(function(id){
        const elemento = document.getElementById(id);
        if(elemento){ elemento.value = id === "tarifaClienteResultado" || id === "tarifaObjetivoResultado" ? "0" : ""; }
    });
    const alerta = document.getElementById("alertaComercial");
    if(alerta){ alerta.className = "alerta-neutra"; alerta.innerHTML = "Sin evaluar"; }
    renderizarDesgloseCostos([]);
}

function escribirResultado(id, valor){
    const elemento = document.getElementById(id);
    if(elemento){ elemento.innerHTML = valor; }
}

function formatoMoneda(valor){
    return "S/ " + (parseFloat(valor) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escaparResultado(valor){
    return String(valor).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function validarTarifa(){
    const objetivo = numeroCampoResultado("tarifaObjetivoResultado");
    const cliente = numeroCampoResultado("tarifaClienteResultado");
    const costo = resultadoUltimoTotal;
    const diferencia = cliente - objetivo;
    const alerta = document.getElementById("alertaComercial");
    const diferenciaInput = document.getElementById("diferenciaTarifa");
    const rentabilidadInput = document.getElementById("rentabilidadCalculada");
    if(diferenciaInput){ diferenciaInput.value = formatoMoneda(diferencia); }
    const rentabilidad = cliente > 0 ? ((cliente - costo) / cliente) * 100 : 0;
    if(rentabilidadInput){ rentabilidadInput.value = rentabilidad.toFixed(1) + "%"; }
    if(!alerta){ return; }
    alerta.className = "";
    if(cliente >= objetivo){ alerta.innerHTML = "Tarifa dentro del objetivo"; alerta.classList.add("alerta-ok"); }
    else if(cliente >= objetivo * 0.90){ alerta.innerHTML = "Rentabilidad reducida"; alerta.classList.add("alerta-warning"); }
    else{ alerta.innerHTML = "Riesgo de perdida"; alerta.classList.add("alerta-danger"); }
}

function verDetalle(tipo){
    const fila = document.getElementById("detalle-" + tipo);
    if(!fila){ return; }
    fila.style.display = fila.style.display === "none" ? "table-row" : "none";
}
