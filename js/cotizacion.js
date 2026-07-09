function escribirTexto(id, valor){
    const elemento = document.getElementById(id);

    if(elemento){
        elemento.innerHTML = valor;
    }
}

function inicializarCotizacion(){
    establecerFechaCotizacion();
    establecerNumeroCotizacionPendiente();
    cargarListasCotizacion();
    enlazarEventosCotizacion();
    renderizarCargasCotizacion();
    renderizarAccesoriosCotizacion();
    renderizarPersonalOperativo();
    actualizarCotizacionAutomatica();
}

function establecerFechaCotizacion(){
    const fecha = document.getElementById("fechaCotizacion");

    if(fecha && !fecha.value){
        fecha.value = new Date().toISOString().slice(0, 10);
    }

    const tipoCambio = document.getElementById("tipoCambio");

    if(tipoCambio && !tipoCambio.value){
        tipoCambio.value = obtenerTipoCambioDelDia().toFixed(3);
    }
}

function obtenerTipoCambioDelDia(){
    const guardado = parseFloat(localStorage.getItem("tipoCambioDelDia"));

    if(!Number.isNaN(guardado) && guardado > 0){
        return guardado;
    }

    return 3.750;
}

function cargarListasCotizacion(){
    cargarListaUbigeos();
    const serviciosMargen = obtenerValoresDriver("margenes", "tiposervicio");
    cargarSelectDesdeValores("tipoServicio", serviciosMargen.length > 0 ? serviciosMargen : obtenerValoresDriver("tipoServicio", "tiposervicio"));
    cargarSelectDesdeValores("tipoVehiculo", obtenerValoresDriver("flota", "tipo"));
    cargarSelectDesdeValores("configuracionPrincipal", obtenerValoresDriver("flota", "configuracion"));
    cargarSelectDesdeValores("tipoAcople", obtenerValoresDriver("acoples", "tipoacople"));
    cargarSelectDesdeValores("configuracionAcople", obtenerValoresDriver("acoples", "configuracion"));
    cargarSelectDesdeValores("tipoAccesorio", obtenerValoresDriver("accesorios", "tipo"));
    cargarSelectDesdeValores("categoriaConductor", obtenerValoresDriver("conductores", "categoria"));
    cargarSelectDesdeValores("tipoPersonalOperativo", obtenerValoresDriver("personal", "cargo"));

    asegurarOpcionesBase();
}

function cargarListaUbigeos(){
    const lista = document.getElementById("listaUbigeos");

    if(!lista){
        return;
    }

    const ubigeos = obtenerDriver("ubigeos");
    lista.innerHTML = "";

    ubigeos.forEach(function(item){
        if(item.distrito){
            const opcion = document.createElement("option");
            opcion.value = item.distrito;
            opcion.label = [item.provincia, item.departamento].filter(Boolean).join(" - ");
            lista.appendChild(opcion);
        }
    });
}

function asegurarOpcionesBase(){
    asegurarSelect("tipoServicio", ["Carga General", "MATPEL", "IQBF", "Sobredimensionado", "Extrapesado", "Especial"]);
    asegurarSelect("tipoVehiculo", ["Tracto", "Camion"]);
    asegurarSelect("configuracionPrincipal", ["T3S3", "T3S4", "T4S4", "T4S5"]);
    asegurarSelect("tipoAcople", ["Plataforma", "Cama Baja", "Modular"]);
    asegurarSelect("configuracionAcople", ["S2", "S3", "S4", "S5"]);
    asegurarSelect("tipoAccesorio", ["Rampa", "Cuna", "Palote"]);
    asegurarSelect("categoriaConductor", ["A4"]);
    asegurarSelect("tipoPersonalOperativo", ["Operador", "Rigger", "Mecanico", "Coordinador"]);
}

function asegurarSelect(id, opciones){
    const select = document.getElementById(id);

    if(!select || select.options.length > 0){
        return;
    }

    opciones.forEach(function(opcion){
        const option = document.createElement("option");
        option.value = opcion;
        option.textContent = opcion;
        select.appendChild(option);
    });
}

function cargarSelectDesdeValores(id, valores){
    const select = document.getElementById(id);

    if(!select){
        return;
    }

    select.innerHTML = "";

    valores.forEach(function(valor){
        const option = document.createElement("option");
        option.value = valor;
        option.textContent = valor;
        select.appendChild(option);
    });
}

function obtenerDriver(nombre){
    try{
        return JSON.parse(localStorage.getItem("driver_" + nombre)) || [];
    }catch(error){
        return [];
    }
}

function obtenerValoresDriver(driver, campo){
    const valores = obtenerDriver(driver)
        .map(function(item){ return item[campo]; })
        .filter(function(valor){ return valor !== undefined && String(valor).trim() !== ""; });

    return Array.from(new Set(valores));
}

function enlazarEventosCotizacion(){
    const eventos = [
        "origen", "destino", "descripcionCarga", "cantidadCarga", "pesoUnitario", "largoCarga", "anchoCarga", "altoCarga",
        "tipoServicio", "tipoVehiculo", "configuracionPrincipal", "tipoAcople", "configuracionAcople",
        "tipoViaje", "diasAdicionales"
    ];

    eventos.forEach(function(id){
        const elemento = document.getElementById(id);

        if(elemento){
            elemento.addEventListener("input", actualizarCotizacionAutomatica);
            elemento.addEventListener("change", actualizarCotizacionAutomatica);
        }
    });

    const margen = document.getElementById("margenObjetivo");
    if(margen){
        margen.addEventListener("input", function(){
            margen.dataset.manual = "1";
        });
    }
}

function actualizarCotizacionAutomatica(){
    actualizarUbicacion("origen", "provinciaOrigen", "departamentoOrigen");
    actualizarUbicacion("destino", "provinciaDestino", "departamentoDestino");
    actualizarPesoTotal();
    actualizarClasificacionesYRecursos();
    actualizarDimensionesOperativas();
    actualizarConfiguracion();
    actualizarRutaYTiempos();
    actualizarMargenObjetivo();
}

function actualizarUbicacion(distritoId, provinciaId, departamentoId){
    const distrito = document.getElementById(distritoId)?.value.trim().toLowerCase();
    const ubigeo = obtenerDriver("ubigeos").find(function(item){
        return String(item.distrito || "").trim().toLowerCase() === distrito;
    });

    asignarValor(provinciaId, ubigeo?.provincia || "");
    asignarValor(departamentoId, ubigeo?.departamento || "");
}

function actualizarPesoTotal(){
    const resumen = obtenerResumenCargasCotizacion();

    asignarValor("pesoTotal", resumen.peso > 0 ? resumen.peso.toFixed(2) : "");
}

function actualizarClasificacionesYRecursos(){
    const servicio = buscarReglaTipoServicio();
    const resumen = obtenerResumenCargasCotizacion();
    const dimensiones = obtenerDimensionesOperativasCotizacion();
    const peso = resumen.peso;
    const largo = dimensiones.largoOperativo || resumen.largo;
    const ancho = dimensiones.anchoOperativo || resumen.ancho;
    const alto = dimensiones.altoOperativo || resumen.alto;

    const clasificacionPeso = servicio?.clasificacionpeso || clasificarPesoBase(peso);
    const clasificacionMedidas = servicio?.clasificacionmedidas || clasificarMedidasBase(largo, ancho, alto);

    asignarValor("clasificacionPeso", clasificacionPeso);
    asignarValor("clasificacionMedidas", clasificacionMedidas);
    sugerirValorSiVacio("cantidadEscoltas", servicio?.escoltas || calcularEscoltasBase(ancho, largo));
    sugerirValorSiVacio("cantidadApoyoPolicial", servicio?.apoyopolicial || 0);
    sugerirValorSiVacio("cantidadTopografos", servicio?.topografos || 0);
    asignarValor("tipoPermiso", servicio?.tipopermiso || permisoBase(peso, ancho, largo, alto));
}

function actualizarDimensionesOperativas(){
    const dimensiones = obtenerDimensionesOperativasCotizacion();
    asignarValor("largoOperativo", dimensiones.largoOperativo ? dimensiones.largoOperativo.toFixed(2) : "");
    asignarValor("anchoOperativo", dimensiones.anchoOperativo ? dimensiones.anchoOperativo.toFixed(2) : "");
    asignarValor("altoOperativo", dimensiones.altoOperativo ? dimensiones.altoOperativo.toFixed(2) : "");
}

function buscarReglaTipoServicio(){
    const tipo = document.getElementById("tipoServicio")?.value;
    const resumen = obtenerResumenCargasCotizacion();
    const dimensiones = obtenerDimensionesOperativasCotizacion();
    const peso = resumen.peso;
    const largo = dimensiones.largoOperativo || resumen.largo;
    const ancho = dimensiones.anchoOperativo || resumen.ancho;
    const alto = dimensiones.altoOperativo || resumen.alto;

    return obtenerDriver("tipoServicio").find(function(item){
        const coincideTipo = !item.tiposervicio || item.tiposervicio === tipo;
        const pesoDesde = parseFloat(item.pesodesde) || 0;
        const pesoHasta = parseFloat(item.pesohasta) || Infinity;
        const largoDesde = parseFloat(item.largodesde) || 0;
        const largoHasta = parseFloat(item.largohasta) || Infinity;
        const anchoDesde = parseFloat(item.anchodesde) || 0;
        const anchoHasta = parseFloat(item.anchohasta) || Infinity;
        const altoDesde = parseFloat(item.altodesde) || 0;
        const altoHasta = parseFloat(item.altohasta) || Infinity;

        return coincideTipo &&
            peso >= pesoDesde && peso <= pesoHasta &&
            largo >= largoDesde && largo <= largoHasta &&
            ancho >= anchoDesde && ancho <= anchoHasta &&
            alto >= altoDesde && alto <= altoHasta;
    });
}

function obtenerDimensionesOperativasCotizacion(){
    const resumen = obtenerResumenCargasCotizacion();
    const unidad = buscarUnidadPrincipalCotizacion();
    const acople = buscarAcopleCotizacion();
    const largoUnidad = numeroDriverCotizacion(unidad, "largo");
    const anchoUnidad = numeroDriverCotizacion(unidad, "ancho");
    const altoUnidad = numeroDriverCotizacion(unidad, "alto");
    const altoPlataformaUnidad = numeroDriverCotizacion(unidad, "altoplataforma");
    const largoAcople = numeroDriverCotizacion(acople, "largo");
    const anchoAcople = numeroDriverCotizacion(acople, "ancho");
    const altoPlataformaAcople = numeroDriverCotizacion(acople, "altoplataforma");
    const altoBaseCarga = altoPlataformaAcople || altoPlataformaUnidad || 0;

    return {
        largoOperativo: Math.max(resumen.largo, largoUnidad + largoAcople, largoAcople),
        anchoOperativo: Math.max(resumen.ancho, anchoUnidad, anchoAcople),
        altoOperativo: resumen.alto + altoBaseCarga,
        altoBaseCarga: altoBaseCarga,
        largoUnidad: largoUnidad,
        largoAcople: largoAcople,
        anchoUnidad: anchoUnidad,
        anchoAcople: anchoAcople,
        altoUnidad: altoUnidad
    };
}

function buscarUnidadPrincipalCotizacion(){
    const tipoVehiculo = document.getElementById("tipoVehiculo")?.value || "";
    const configuracion = document.getElementById("configuracionPrincipal")?.value || "";

    return obtenerDriver("flota").find(function(item){
        return coincideFlexibleCotizacion(item.tipo, tipoVehiculo) &&
            coincideFlexibleCotizacion(item.configuracion, configuracion);
    }) || {};
}

function buscarAcopleCotizacion(){
    const tipoAcople = document.getElementById("tipoAcople")?.value || "";
    const configuracion = document.getElementById("configuracionAcople")?.value || "";

    return obtenerDriver("acoples").find(function(item){
        return coincideFlexibleCotizacion(item.tipoacople, tipoAcople) &&
            coincideFlexibleCotizacion(item.configuracion, configuracion);
    }) || {};
}

function coincideFlexibleCotizacion(valorDriver, valorFormulario){
    if(!valorDriver || !valorFormulario){
        return true;
    }

    return String(valorDriver).trim().toLowerCase() === String(valorFormulario).trim().toLowerCase();
}

function numeroDriverCotizacion(registro, campo){
    const valor = registro && registro[campo] !== undefined ? registro[campo] : 0;
    const numero = parseFloat(String(valor).replace(",", "."));
    return Number.isNaN(numero) ? 0 : numero;
}

function clasificarPesoBase(peso){
    if(peso <= 0){ return ""; }
    if(peso <= 48){ return "Normal"; }
    if(peso <= 57){ return "Extrapesado - Permiso Simple"; }
    if(peso <= 60){ return "Extrapesado - Diagrama"; }
    return "Extrapesado - Estudio de Puentes";
}

function clasificarMedidasBase(largo, ancho, alto){
    if(largo <= 0 && ancho <= 0 && alto <= 0){ return ""; }
    if(ancho > 3 || alto > 4.8 || largo > 20.5){ return "Sobredimensionado"; }
    return "Normal";
}

function calcularEscoltasBase(ancho, largo){
    if(ancho > 4.5 || largo > 30){ return 2; }
    if(ancho > 3 || largo > 20.5){ return 1; }
    return 0;
}

function permisoBase(peso, ancho, largo, alto){
    if(peso > 60){ return "Permiso con Estudio de Puentes"; }
    if(peso > 57){ return "Permiso con Diagrama"; }
    if(peso > 48 || ancho > 3 || alto > 4.8 || largo > 20.5){ return "Permiso Simple"; }
    return "No Requiere";
}

function actualizarConfiguracion(){
    const principal = document.getElementById("configuracionPrincipal")?.value || "";
    const acople = document.getElementById("configuracionAcople")?.value || "";
    const configuracion = [principal, acople].filter(Boolean).join(" + ");

    asignarValor("configuracionFinal", configuracion);
}

function actualizarRutaYTiempos(){
    const destino = document.getElementById("destino")?.value.trim().toLowerCase();
    const ubigeo = obtenerDriver("ubigeos").find(function(item){
        return String(item.distrito || "").trim().toLowerCase() === destino;
    });

    const tipoViaje = document.getElementById("tipoViaje")?.value || "ida";
    const factor = tipoViaje === "ida-vuelta" ? 2 : 1;
    const kmIda = parseFloat(ubigeo?.kmida) || 0;
    const diasIda = parseFloat(ubigeo?.diasida) || 0;
    const diasAdicionales = numero("diasAdicionales");
    const kmTotales = kmIda * factor;
    const diasTransito = diasIda * factor;

    asignarValor("kmTotales", kmTotales > 0 ? kmTotales.toFixed(2) : "");
    asignarValor("diasTransito", diasTransito > 0 ? diasTransito.toFixed(2) : "");
    asignarValor("diasTotales", (diasTransito + diasAdicionales).toFixed(2));
}

function actualizarMargenObjetivo(){
    const destino = document.getElementById("destino")?.value || "";
    const configuracion = document.getElementById("configuracionPrincipal")?.value || "";
    const tipoServicio = document.getElementById("tipoServicio")?.value || "";
    const margenInput = document.getElementById("margenObjetivo");
    const llave = [destino, configuracion, tipoServicio].join("|");

    if(margenInput?.dataset.manual === "1" && margenInput.dataset.llaveMargen === llave){
        return;
    }

    const margen = obtenerDriver("margenes").find(function(item){
        return coincideFlexible(item.destino, destino) &&
        coincideFlexible(item.configuracion, configuracion) &&
        coincideFlexible(item.tiposervicio, tipoServicio);
    });

    asignarValor("margenObjetivo", margen?.margen || "");
    if(margenInput){
        margenInput.dataset.llaveMargen = llave;
        margenInput.dataset.manual = "0";
    }
}

function coincideFlexible(valorDriver, valorActual){
    if(!valorDriver){ return true; }
    return String(valorDriver).trim().toLowerCase() === String(valorActual).trim().toLowerCase();
}

function numero(id){
    return parseFloat(document.getElementById(id)?.value) || 0;
}

function asignarValor(id, valor){
    const elemento = document.getElementById(id);

    if(elemento){
        elemento.value = valor;
    }
}

function sugerirValorSiVacio(id, valor){
    const elemento = document.getElementById(id);

    if(!elemento){
        return;
    }

    if(elemento.value === "" || elemento.dataset.sugerido === "1"){
        elemento.value = valor;
        elemento.dataset.sugerido = "1";
    }
}

function obtenerPersonalOperativoCotizacion(){
    try{
        return JSON.parse(localStorage.getItem("cotizacion_personal_operativo")) || [];
    }catch(error){
        return [];
    }
}

function guardarPersonalOperativoCotizacion(lista){
    localStorage.setItem("cotizacion_personal_operativo", JSON.stringify(lista));
}

function obtenerCargasCotizacion(){
    try{
        return JSON.parse(localStorage.getItem("cotizacion_cargas")) || [];
    }catch(error){
        return [];
    }
}

function guardarCargasCotizacion(lista){
    localStorage.setItem("cotizacion_cargas", JSON.stringify(lista));
}

function obtenerAccesoriosCotizacion(){
    try{
        return JSON.parse(localStorage.getItem("cotizacion_accesorios")) || [];
    }catch(error){
        return [];
    }
}

function guardarAccesoriosCotizacion(lista){
    localStorage.setItem("cotizacion_accesorios", JSON.stringify(lista));
}

function obtenerCargaFormulario(){
    const descripcion = document.getElementById("descripcionCarga")?.value || "";
    const cantidad = numero("cantidadCarga");
    const pesoUnitario = numero("pesoUnitario");
    const largo = numero("largoCarga");
    const ancho = numero("anchoCarga");
    const alto = numero("altoCarga");

    if(!descripcion && pesoUnitario <= 0 && largo <= 0 && ancho <= 0 && alto <= 0){
        return null;
    }

    return {
        descripcion: descripcion,
        cantidad: cantidad || 1,
        pesoUnitario: pesoUnitario,
        pesoTotal: (cantidad || 1) * pesoUnitario,
        largo: largo,
        ancho: ancho,
        alto: alto
    };
}

function obtenerCargasParaCalculo(){
    const cargas = obtenerCargasCotizacion();
    const cargaFormulario = obtenerCargaFormulario();
    if(cargas.length > 0){
        return cargaFormulario ? cargas.concat([cargaFormulario]) : cargas;
    }
    return cargaFormulario ? [cargaFormulario] : [];
}

function obtenerResumenCargasCotizacion(){
    const cargas = obtenerCargasParaCalculo();
    return cargas.reduce(function(resumen, item){
        resumen.peso += parseFloat(item.pesoTotal) || ((parseFloat(item.cantidad) || 0) * (parseFloat(item.pesoUnitario) || 0));
        resumen.largo = Math.max(resumen.largo, parseFloat(item.largo) || 0);
        resumen.ancho = Math.max(resumen.ancho, parseFloat(item.ancho) || 0);
        resumen.alto = Math.max(resumen.alto, parseFloat(item.alto) || 0);
        return resumen;
    }, { peso: 0, largo: 0, ancho: 0, alto: 0 });
}

function agregarCargaCotizacion(){
    const carga = obtenerCargaFormulario();
    if(!carga || (!carga.descripcion && carga.pesoTotal <= 0)){
        alert("Ingrese la descripcion o el peso de la carga.");
        return;
    }

    const lista = obtenerCargasCotizacion();
    lista.push(carga);
    guardarCargasCotizacion(lista);
    limpiarFormularioCarga();
    renderizarCargasCotizacion();
    actualizarCotizacionAutomatica();
}

function eliminarCargaCotizacion(index){
    const lista = obtenerCargasCotizacion();
    lista.splice(index, 1);
    guardarCargasCotizacion(lista);
    renderizarCargasCotizacion();
    actualizarCotizacionAutomatica();
}

function limpiarFormularioCarga(){
    ["descripcionCarga", "pesoUnitario", "largoCarga", "anchoCarga", "altoCarga"].forEach(function(id){
        asignarValor(id, "");
    });
    asignarValor("cantidadCarga", 1);
}

function renderizarCargasCotizacion(){
    const contenedor = document.getElementById("listaCargasCotizacion");
    if(!contenedor){ return; }

    const lista = obtenerCargasCotizacion();
    if(lista.length === 0){
        contenedor.innerHTML = '<span class="muted">Sin cargas agregadas. Si solo hay una carga, puedes llenar los campos sin agregarla a la lista.</span>';
        return;
    }

    contenedor.innerHTML = lista.map(function(item, index){
        const peso = parseFloat(item.pesoTotal) || ((parseFloat(item.cantidad) || 0) * (parseFloat(item.pesoUnitario) || 0));
        const medidas = [item.largo, item.ancho, item.alto].filter(function(valor){ return parseFloat(valor) > 0; }).join(" x ");
        return '<div class="carga-chip">' +
            '<span><strong>' + escaparCotizacion(item.descripcion || "Carga " + (index + 1)) + '</strong> x ' + (item.cantidad || 1) + '</span>' +
            '<small>' + peso.toFixed(2) + ' TN' + (medidas ? ' / ' + medidas + ' m' : '') + '</small>' +
            '<button type="button" onclick="eliminarCargaCotizacion(' + index + ')">Quitar</button>' +
        '</div>';
    }).join("");
}

function agregarAccesorioCotizacion(){
    const tipo = document.getElementById("tipoAccesorio")?.value || "";
    if(!tipo){
        alert("Seleccione un accesorio.");
        return;
    }

    const driverAccesorio = obtenerDriver("accesorios").find(function(item){
        return String(item.tipo || "").trim().toLowerCase() === tipo.trim().toLowerCase();
    }) || {};

    const lista = obtenerAccesoriosCotizacion();
    lista.push({
        tipo: tipo,
        peso: driverAccesorio.peso || "",
        precio: driverAccesorio.precio || "",
        porcentajedepreciacion: driverAccesorio.porcentajedepreciacion || "",
        vidautil: driverAccesorio.vidautil || ""
    });

    guardarAccesoriosCotizacion(lista);
    renderizarAccesoriosCotizacion();
    actualizarCotizacionAutomatica();
}

function eliminarAccesorioCotizacion(index){
    const lista = obtenerAccesoriosCotizacion();
    lista.splice(index, 1);
    guardarAccesoriosCotizacion(lista);
    renderizarAccesoriosCotizacion();
    actualizarCotizacionAutomatica();
}

function obtenerPesoAccesoriosCotizacion(){
    return obtenerAccesoriosCotizacion().reduce(function(total, item){
        return total + (parseFloat(item.peso) || 0);
    }, 0);
}

function renderizarAccesoriosCotizacion(){
    const contenedor = document.getElementById("listaAccesoriosCotizacion");
    if(!contenedor){ return; }

    const lista = obtenerAccesoriosCotizacion();
    if(lista.length === 0){
        contenedor.innerHTML = '<span class="muted">Sin accesorios agregados.</span>';
        return;
    }

    contenedor.innerHTML = lista.map(function(item, index){
        const peso = parseFloat(item.peso) || 0;
        const precio = parseFloat(item.precio) || 0;
        return '<div class="accesorio-chip"><span><strong>' + escaparCotizacion(item.tipo) + '</strong></span>' +
            '<small>' + peso.toFixed(2) + ' TN / S/ ' + precio.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</small>' +
            '<button type="button" onclick="eliminarAccesorioCotizacion(' + index + ')">Quitar</button></div>';
    }).join("");
}

function agregarPersonalOperativo(){
    const cargo = document.getElementById("tipoPersonalOperativo")?.value || "";
    const cantidad = numero("cantidadPersonalOperativo") || 1;

    if(!cargo){
        alert("Seleccione un tipo de personal operativo.");
        return;
    }

    const driverPersonal = obtenerDriver("personal").find(function(item){
        return String(item.cargo || "").trim().toLowerCase() === cargo.trim().toLowerCase();
    }) || {};

    const lista = obtenerPersonalOperativoCotizacion();
    lista.push({
        cargo: cargo,
        cantidad: cantidad,
        costodiario: driverPersonal.costodiario || "",
        costoempresa: driverPersonal.costoempresa || "",
        sueldo: driverPersonal.sueldo || ""
    });

    guardarPersonalOperativoCotizacion(lista);
    renderizarPersonalOperativo();
}

function eliminarPersonalOperativo(index){
    const lista = obtenerPersonalOperativoCotizacion();
    lista.splice(index, 1);
    guardarPersonalOperativoCotizacion(lista);
    renderizarPersonalOperativo();
}

function renderizarPersonalOperativo(){
    const contenedor = document.getElementById("listaPersonalOperativo");
    if(!contenedor){ return; }

    const lista = obtenerPersonalOperativoCotizacion();
    if(lista.length === 0){
        contenedor.innerHTML = '<span class="muted">Sin personal operativo agregado.</span>';
        return;
    }

    contenedor.innerHTML = lista.map(function(item, index){
        const costo = item.costodiario ? "S/ " + item.costodiario + " diario" : "Sin costo driver";
        return '<div class="personal-chip"><span><strong>' + escaparCotizacion(item.cargo) + '</strong> x ' + item.cantidad + '</span><small>' + costo + '</small><button type="button" onclick="eliminarPersonalOperativo(' + index + ')">Quitar</button></div>';
    }).join("");
}

function obtenerDatosCotizacion(){
    const cargas = obtenerCargasParaCalculo();
    const resumenCargas = obtenerResumenCargasCotizacion();
    const descripcionCargas = cargas.map(function(item){ return item.descripcion; }).filter(Boolean).join(" / ");
    const accesorios = obtenerAccesoriosCotizacion();
    const pesoAccesorios = obtenerPesoAccesoriosCotizacion();
    const dimensionesOperativas = obtenerDimensionesOperativasCotizacion();

    return {
        numero: document.getElementById("numeroCotizacion")?.value || "",
        fecha: document.getElementById("fechaCotizacion")?.value || "",
        cliente: document.getElementById("cliente")?.value || "",
        comercial: document.getElementById("comercial")?.value || "",
        origen: document.getElementById("origen")?.value || "",
        destino: document.getElementById("destino")?.value || "",
        provinciaOrigen: document.getElementById("provinciaOrigen")?.value || "",
        departamentoOrigen: document.getElementById("departamentoOrigen")?.value || "",
        provinciaDestino: document.getElementById("provinciaDestino")?.value || "",
        departamentoDestino: document.getElementById("departamentoDestino")?.value || "",
        tipoCarga: document.getElementById("tipoServicio")?.value || "",
        cargas: cargas,
        descripcionCarga: descripcionCargas || document.getElementById("descripcionCarga")?.value || "",
        cantidadCarga: cargas.length > 0 ? cargas.reduce(function(total, item){ return total + (parseFloat(item.cantidad) || 0); }, 0) : document.getElementById("cantidadCarga")?.value || "",
        pesoUnitario: cargas.length === 1 ? cargas[0].pesoUnitario : "",
        peso: resumenCargas.peso > 0 ? resumenCargas.peso.toFixed(2) : document.getElementById("pesoTotal")?.value || "",
        largoCarga: resumenCargas.largo > 0 ? resumenCargas.largo.toFixed(2) : document.getElementById("largoCarga")?.value || "",
        anchoCarga: resumenCargas.ancho > 0 ? resumenCargas.ancho.toFixed(2) : document.getElementById("anchoCarga")?.value || "",
        altoCarga: resumenCargas.alto > 0 ? resumenCargas.alto.toFixed(2) : document.getElementById("altoCarga")?.value || "",
        largoOperativo: dimensionesOperativas.largoOperativo ? dimensionesOperativas.largoOperativo.toFixed(2) : "",
        anchoOperativo: dimensionesOperativas.anchoOperativo ? dimensionesOperativas.anchoOperativo.toFixed(2) : "",
        altoOperativo: dimensionesOperativas.altoOperativo ? dimensionesOperativas.altoOperativo.toFixed(2) : "",
        altoBaseCarga: dimensionesOperativas.altoBaseCarga ? dimensionesOperativas.altoBaseCarga.toFixed(2) : "",
        clasificacionPeso: document.getElementById("clasificacionPeso")?.value || "",
        clasificacionMedidas: document.getElementById("clasificacionMedidas")?.value || "",
        tipoServicio: document.getElementById("tipoServicio")?.value || "",
        tipoVehiculo: document.getElementById("tipoVehiculo")?.value || "",
        configuracionPrincipal: document.getElementById("configuracionPrincipal")?.value || "",
        tractoApoyo: document.getElementById("tractoApoyo")?.value || "No",
        tipoAcople: document.getElementById("tipoAcople")?.value || "",
        configuracionAcople: document.getElementById("configuracionAcople")?.value || "",
        configuracion: document.getElementById("configuracionFinal")?.value || "",
        accesorios: accesorios,
        pesoAccesorios: pesoAccesorios.toFixed(2),
        categoriaConductor: document.getElementById("categoriaConductor")?.value || "",
        cantidadConductores: document.getElementById("cantidadConductores")?.value || "",
        personalOperativo: obtenerPersonalOperativoCotizacion(),
        cantidadEscoltas: document.getElementById("cantidadEscoltas")?.value || "0",
        cantidadApoyoPolicial: document.getElementById("cantidadApoyoPolicial")?.value || "0",
        cantidadTopografos: document.getElementById("cantidadTopografos")?.value || "0",
        tipoPermiso: document.getElementById("tipoPermiso")?.value || "",
        tipoViaje: document.getElementById("tipoViaje")?.value || "ida",
        kmTotales: document.getElementById("kmTotales")?.value || "",
        diasTransito: document.getElementById("diasTransito")?.value || "",
        diasAdicionales: document.getElementById("diasAdicionales")?.value || "0",
        diasTotales: document.getElementById("diasTotales")?.value || "",
        formaPago: document.getElementById("formaPago")?.value || "",
        diasPago: document.getElementById("diasPago")?.value || "0",
        porcentajeFactoring: document.getElementById("porcentajeFactoring")?.value || "0",
        tipoCambio: document.getElementById("tipoCambio")?.value || "",
        margenObjetivo: document.getElementById("margenObjetivo")?.value || "",
        tarifa: document.getElementById("tarifaCliente")?.value || ""
    };
}

function generarResumen(){
    if(!document.getElementById("numeroCotizacion")?.value){
        crearCotizacion(false);
    }

    actualizarCotizacionAutomatica();
    if(typeof inicializarResultado === "function"){
        inicializarResultado();
    }
    mostrarPantalla("resultado");
}

function escribirCampoResumen(datos){
    asignarValor("resFecha", datos.fecha);
    asignarValor("resCliente", datos.cliente);
    asignarValor("resComercial", datos.comercial);
    escribirTexto("resumenOrigen", datos.origen || "-");
    escribirTexto("resumenDestino", datos.destino || "-");
    escribirTexto("resumenCarga", datos.descripcionCarga || datos.tipoCarga || "-");
    escribirTexto("resumenPeso", datos.peso ? datos.peso + " TN" : "-");
    escribirTexto("resumenConfig", datos.configuracion || "-");
}

function guardarCotizacion(mostrarMensaje = true){
    const historial = JSON.parse(localStorage.getItem("cotizaciones")) || [];
    const datos = obtenerDatosCotizacion();
    const indexEdicion = localStorage.getItem("cotizacionEditandoIndex");
    const numero = datos.numero || crearCotizacion(false);

    const cotizacion = Object.assign({}, datos, {
        numero: numero,
        tarifa: document.getElementById("tarifaClienteResultado")?.value || datos.tarifa,
        tarifaObjetivo: document.getElementById("tarifaObjetivoResultado")?.value || "",
        costoIntegral: document.getElementById("resCosto")?.textContent || ""
    });

    if(indexEdicion !== null && historial[indexEdicion]){
        historial[indexEdicion] = cotizacion;
        localStorage.removeItem("cotizacionEditandoIndex");
    localStorage.removeItem("cotizacionEditandoNumero");
    }else{
        const existente = historial.findIndex(function(item){ return item.numero === numero; });
        if(existente >= 0){ historial[existente] = cotizacion; }
        else{ historial.push(cotizacion); }
    }

    localStorage.setItem("cotizaciones", JSON.stringify(historial));
    localStorage.setItem("ultimaCotizacionResumen", JSON.stringify(cotizacion));
    if(typeof apiGuardarCotizacion === "function"){
        apiGuardarCotizacion(cotizacion).catch(function(error){
            console.warn("No se pudo sincronizar cotizacion con SQL:", error.message);
        });
    }
    if(typeof cargarHistorial === "function"){ cargarHistorial(); }
    if(mostrarMensaje){ alert("Cotizacion guardada."); }
    return cotizacion;
}

function cargarCotizacionEnFormulario(index){
    const historial = JSON.parse(localStorage.getItem("cotizaciones")) || [];
    const c = historial[index];
    if(!c){ return; }

    localStorage.setItem("cotizacionEditandoIndex", String(index));
    guardarPersonalOperativoCotizacion(c.personalOperativo || []);
    guardarAccesoriosCotizacion(c.accesorios || []);

    asignarValor("numeroCotizacion", c.numero || "");

    asignarValor("fechaCotizacion", c.fecha);
    asignarValor("cliente", c.cliente);
    asignarValor("comercial", c.comercial);
    asignarValor("origen", c.origen);
    asignarValor("destino", c.destino);
    asignarValor("tipoServicio", c.tipoServicio);
    guardarCargasCotizacion(c.cargas || []);
    if(!c.cargas || c.cargas.length === 0){
        asignarValor("descripcionCarga", c.descripcionCarga);
        asignarValor("cantidadCarga", c.cantidadCarga || 1);
        asignarValor("pesoUnitario", c.pesoUnitario);
        asignarValor("largoCarga", c.largoCarga);
        asignarValor("anchoCarga", c.anchoCarga);
        asignarValor("altoCarga", c.altoCarga);
    }else{
        limpiarFormularioCarga();
    }
    asignarValor("tipoVehiculo", c.tipoVehiculo);
    asignarValor("configuracionPrincipal", c.configuracionPrincipal);
    asignarValor("tractoApoyo", c.tractoApoyo || "No");
    asignarValor("tipoAcople", c.tipoAcople);
    asignarValor("configuracionAcople", c.configuracionAcople);
    asignarValor("categoriaConductor", c.categoriaConductor);
    asignarValor("cantidadConductores", c.cantidadConductores || 1);
    asignarValor("cantidadEscoltas", c.cantidadEscoltas || 0);
    asignarValor("cantidadApoyoPolicial", c.cantidadApoyoPolicial || 0);
    asignarValor("cantidadTopografos", c.cantidadTopografos || 0);
    asignarValor("tipoViaje", c.tipoViaje || "ida");
    asignarValor("diasAdicionales", c.diasAdicionales || 0);
    asignarValor("formaPago", c.formaPago);
    asignarValor("diasPago", c.diasPago || 0);
    asignarValor("porcentajeFactoring", c.porcentajeFactoring || 0);
    asignarValor("margenObjetivo", c.margenObjetivo || "");
    const margenInput = document.getElementById("margenObjetivo");
    if(margenInput && c.margenObjetivo){
        margenInput.dataset.manual = "1";
        margenInput.dataset.llaveMargen = [c.destino || "", c.configuracionPrincipal || "", c.tipoServicio || ""].join("|");
    }
    asignarValor("tarifaCliente", c.tarifa || "");

    renderizarCargasCotizacion();
    renderizarAccesoriosCotizacion();
    renderizarPersonalOperativo();
    actualizarCotizacionAutomatica();
}

function limpiarCotizacion(){
    document.querySelectorAll("#pantalla-cotizacion input, #pantalla-cotizacion select").forEach(function(elemento){
        if(elemento.readOnly){
            elemento.value = "";
            return;
        }

        if(elemento.tagName === "SELECT"){
            elemento.selectedIndex = 0;
            return;
        }

        elemento.value = "";
    });

    localStorage.removeItem("cotizacionEditandoIndex");
    localStorage.removeItem("cotizacionEditandoNumero");
    guardarCargasCotizacion([]);
    guardarAccesoriosCotizacion([]);
    guardarPersonalOperativoCotizacion([]);
    const margenInput = document.getElementById("margenObjetivo");
    if(margenInput){
        margenInput.dataset.manual = "0";
        margenInput.dataset.llaveMargen = "";
    }
    establecerFechaCotizacion();
    asignarValor("cantidadCarga", 1);
    asignarValor("cantidadConductores", 1);
    asignarValor("cantidadPersonalOperativo", 1);
    asignarValor("cantidadTopografos", 0);
    asignarValor("diasAdicionales", 0);
    renderizarCargasCotizacion();
    renderizarAccesoriosCotizacion();
    renderizarPersonalOperativo();
    actualizarCotizacionAutomatica();
}


function establecerNumeroCotizacionPendiente(){
    const numero = document.getElementById("numeroCotizacion");
    if(!numero){ return; }

    const numeroEdicion = localStorage.getItem("cotizacionEditandoNumero");
    if(numeroEdicion && !numero.value){
        numero.value = numeroEdicion;
    }
}

function crearCotizacion(mostrarMensaje = true){
    const campo = document.getElementById("numeroCotizacion");
    if(!campo){ return ""; }

    if(!campo.value){
        campo.value = obtenerSiguienteNumeroCotizacion();
        localStorage.setItem("cotizacionEditandoNumero", campo.value);
    }

    if(mostrarMensaje){
        alert("Cotizacion creada: " + campo.value);
    }

    return campo.value;
}

function obtenerSiguienteNumeroCotizacion(){
    const historial = JSON.parse(localStorage.getItem("cotizaciones")) || [];
    const maximo = historial.reduce(function(max, item){
        const numero = parseInt(String(item.numero || "").replace(/\D/g, ""), 10);
        return Number.isNaN(numero) ? max : Math.max(max, numero);
    }, 0);
    return "COT-" + String(maximo + 1).padStart(4, "0");
}

function cerrarYPrepararNuevaCotizacion(){
    limpiarCotizacion();
    if(typeof limpiarResultado === "function"){
        limpiarResultado();
    }
    mostrarPantalla("cotizacion");
}
function escaparCotizacion(valor){
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}





