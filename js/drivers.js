let driverActual = "";
let filtroDriver = "";
let indiceRegistroModal = null;

const drivers = {
    flota: [], acoples: [], accesorios: [], unidadesApoyo: [], flotaProrrateo: [], ubigeos: [], combustible: [], rendimiento: [], tipoServicio: [], personal: [], conductores: [],
    peajes: [], mantenimiento: [], neumaticos: [], seguros: [], operativos: [],
    viaje: [], administrativos: [], financieros: [], permisos: [], margenes: []
};

const estructuraDrivers = {
    flota: ["Tipo", "Configuracion", "Ejes", "Llantas Direccionales", "Llantas Traccion", "Largo", "Ancho", "Alto", "Alto Plataforma", "Peso Neto", "Peso Bruto", "PBV Legal", "Capacidad", "Precio", "% Depreciacion", "Vida Util", "Combustible"],
    acoples: ["Tipo Acople", "Configuracion", "Ejes", "Llantas", "Largo", "Ancho", "Alto Plataforma", "Capacidad", "Peso Tara", "PBV Legal", "Precio", "% Depreciacion", "Vida Util"],
    accesorios: ["Tipo", "Peso", "Precio", "% Depreciacion", "Vida Util"],
    unidadesApoyo: ["Tipo Unidad", "Configuracion", "Ejes", "Llantas", "Capacidad", "Precio", "% Depreciacion", "Vida Util", "Combustible", "Aplica A"],
    flotaProrrateo: ["Tipo Unidad", "Cantidad", "Aplica Prorrateo"],
    ubigeos: ["Zona", "Departamento", "Provincia", "Distrito", "Km Ida", "Dias Ida"],
    combustible: ["Proveedor", "Tipo", "UM", "Precio Sin IGV"],
    rendimiento: ["Zona", "Configuracion", "Tipo Carga", "Vacio", "50% Peso", "100% Peso"],
    tipoServicio: ["Tipo Servicio", "Peso Desde", "Peso Hasta", "Largo Desde", "Largo Hasta", "Ancho Desde", "Ancho Hasta", "Alto Desde", "Alto Hasta", "Clasificacion Peso", "Clasificacion Medidas", "Escoltas", "Apoyo Policial", "Topografos", "Tipo Permiso", "Requiere Estudio Ruta", "Requiere Estudio Puentes", "Requiere Senalizacion", "Horario Restringido", "Observacion"],
    personal: ["Tipo Costo", "Area", "Cargo", "Cantidad", "Sueldo", "Costo Empresa", "Costo Diario", "Aplica Viatico", "Aplica Hospedaje", "Aplica Prorrateo"],
    conductores: ["Categoria", "Tipo Carga", "Habilitacion", "Costo Empresa", "Costo Diario"],
    peajes: ["Ruta", "Tramo", "Peaje", "Departamento", "Costo Eje", "Sentido", "Ejes Aplicables"],
    mantenimiento: ["Tipo Unidad", "Tipo", "Configuracion", "MP1", "MP2", "MP3", "Correctivo", "Factor Km"],
    neumaticos: ["Tipo Unidad", "Configuracion", "Tipo Llanta", "Modelo", "Cantidad Llantas", "Precio Llanta", "Km Duracion", "Costo Km"],
    seguros: ["Tipo", "Tipo Unidad", "Configuracion", "Forma Pago", "Prima", "Aseguradora", "Factor Diario"],
    operativos: ["Grupo", "Concepto", "Cantidad", "Costo", "Periodicidad", "Tipo Calculo"],
    viaje: ["Grupo", "Concepto", "Cantidad", "Costo Servicio", "Tipo Calculo"],
    administrativos: ["Area", "Concepto", "Cantidad", "Costo", "Periodicidad", "Aplica Prorrateo"],
    financieros: ["Concepto", "Cantidad", "Costo", "Periodicidad", "Aplica Prorrateo"],
    permisos: ["Tipo Permiso", "Peso Desde", "Peso Hasta", "Ancho Desde", "Ancho Hasta", "Requisito", "Costo"],
    margenes: ["Tipo Servicio", "Configuracion", "Destino", "Margen"]
};

async function cargarDriver(nombre){
    driverActual = nombre;
    filtroDriver = "";

    const tituloDriver = document.getElementById("tituloDriver");
    if(tituloDriver){
        tituloDriver.innerHTML = "Driver : " + obtenerNombreDriver(nombre).toUpperCase();
    }

    const guardado = localStorage.getItem("driver_" + nombre);
    if(guardado !== null){
        drivers[nombre] = JSON.parse(guardado);
    }

    marcarDriverActivo(nombre);
    mostrarTablaDriver();
    await sincronizarDriverDesdeApi(nombre);
}

function obtenerNombreDriver(nombre){
    const nombres = {
        flota: "Tractos y Camiones",
        accesorios: "Accesorios",
        unidadesApoyo: "Camionetas y Apoyos",
        flotaProrrateo: "Flota Prorrateo",
        tipoServicio: "Tipo de Servicio",
        conductores: "Conductores"
    };
    return nombres[nombre] || nombre;
}

function marcarDriverActivo(nombre){
    document.querySelectorAll(".drivers-menu li").forEach(function(item){
        const onclick = item.getAttribute("onclick") || "";
        item.classList.toggle("active", onclick.indexOf("'" + nombre + "'") >= 0);
    });
}

function mostrarTablaDriver(){
    const tabla = document.getElementById("tablaDriver");
    const cabecera = document.getElementById("cabeceraDriver");

    if(!tabla || !cabecera){
        return;
    }

    if(!driverActual || !estructuraDrivers[driverActual]){
        cabecera.innerHTML = "<tr><th>Seleccione un Driver</th></tr>";
        tabla.innerHTML = '<tr><td style="text-align:center;">Seleccione un Driver</td></tr>';
        return;
    }

    const columnas = estructuraDrivers[driverActual];
    cabecera.innerHTML = construirCabecera(columnas);

    drivers[driverActual] = limpiarRegistrosDriver(driverActual, drivers[driverActual] || []);
    const registros = obtenerRegistrosFiltrados(drivers[driverActual]);
    if(registros.length === 0){
        tabla.innerHTML = construirFilaVacia(columnas);
        return;
    }

    tabla.innerHTML = registros.map(function(registro){
        return construirFilaDriver(registro.item, registro.index, columnas);
    }).join("");
}

function construirCabecera(columnas){
    const encabezados = columnas.map(function(columna){
        return "<th>" + columna + "</th>";
    }).join("");
    return "<tr>" + encabezados + '<th class="col-acciones">Acciones</th></tr>';
}

function construirFilaVacia(columnas){
    return '<tr><td class="driver-empty-cell driver-empty-row" colspan="' + (columnas.length + 1) + '">Sin registros cargados.</td></tr>';
}

function construirFilaDriver(item, index, columnas){
    const celdas = columnas.map(function(columna){
        const clave = normalizarCampo(columna);
        const valor = item[clave] || "";
        return "<td>" + (valor ? escaparHTML(valor) : '<span class="driver-muted">-</span>') + "</td>";
    }).join("");

    return "<tr>" + celdas +
        '<td class="col-acciones"><button type="button" onclick="abrirModalDriver(' + index + ')">Modificar</button>' +
        '<button type="button" class="btn-danger" onclick="eliminarRegistro(' + index + ')">Eliminar</button></td></tr>';
}

function obtenerRegistrosFiltrados(lista){
    return lista.map(function(item, index){
        return { item: item, index: index };
    }).filter(function(registro){
        if(filtroDriver === ""){
            return true;
        }
        return Object.values(registro.item).join(" ").toLowerCase().indexOf(filtroDriver) >= 0;
    });
}

function nuevoRegistro(){
    if(driverActual === ""){
        alert("Seleccione primero un Driver.");
        return;
    }
    abrirModalDriver(null);
}

function eliminarRegistro(index){
    if(driverActual === ""){
        alert("Seleccione primero un Driver.");
        return;
    }
    if(typeof index !== "number" || !drivers[driverActual][index]){
        return;
    }
    if(!confirm("Eliminar este registro del driver?")){
        return;
    }
    drivers[driverActual].splice(index, 1);
    guardarDriver(false);
    mostrarTablaDriver();
}

function abrirModalDriver(index){
    if(driverActual === ""){
        alert("Seleccione primero un Driver.");
        return;
    }

    indiceRegistroModal = typeof index === "number" ? index : null;
    const modal = document.getElementById("modalDriver");
    const titulo = document.getElementById("modalDriverTitulo");
    const campos = document.getElementById("modalDriverCampos");
    const registro = indiceRegistroModal === null ? {} : drivers[driverActual][indiceRegistroModal] || {};

    if(titulo){
        titulo.innerHTML = (indiceRegistroModal === null ? "Nuevo " : "Modificar ") + obtenerNombreDriver(driverActual);
    }
    if(campos){
        campos.innerHTML = estructuraDrivers[driverActual].map(function(columna){
            const clave = normalizarCampo(columna);
            const valor = registro[clave] || "";
            return '<div><label>' + escaparHTML(columna) + '</label><input value="' + escaparHTML(valor) + '" data-modal-campo="' + clave + '"></div>';
        }).join("");
    }
    if(modal){
        modal.style.display = "flex";
    }
}

function cerrarModalDriver(){
    const modal = document.getElementById("modalDriver");
    if(modal){
        modal.style.display = "none";
    }
    indiceRegistroModal = null;
}

function guardarRegistroModal(){
    if(driverActual === ""){
        return;
    }

    const registro = {};
    document.querySelectorAll("#modalDriverCampos input[data-modal-campo]").forEach(function(input){
        registro[input.dataset.modalCampo] = input.value;
    });

    if(indiceRegistroModal === null){
        drivers[driverActual].push(registro);
    }else{
        drivers[driverActual][indiceRegistroModal] = registro;
    }

    filtroDriver = "";
    guardarDriver(false);
    cerrarModalDriver();
    mostrarTablaDriver();
}

function buscarRegistro(){
    if(driverActual === ""){
        alert("Seleccione primero un Driver.");
        return;
    }

    const texto = prompt("Buscar registro");
    if(texto === null){
        return;
    }

    filtroDriver = texto.toLowerCase().trim();
    mostrarTablaDriver();
}

async function guardarDriver(mostrarMensaje = true){
    if(driverActual === ""){
        return;
    }

    drivers[driverActual] = limpiarRegistrosDriver(driverActual, drivers[driverActual] || []);
    localStorage.setItem("driver_" + driverActual, JSON.stringify(drivers[driverActual]));
    await sincronizarDriverHaciaApi(driverActual);
    if(mostrarMensaje){
        alert("Driver guardado.");
    }
}

async function sincronizarDriverDesdeApi(nombre){
    if(typeof apiObtenerDriver !== "function"){
        return;
    }

    try{
        const registros = await apiObtenerDriver(nombre);
        if(Array.isArray(registros) && registros.length > 0){
            drivers[nombre] = registros;
            localStorage.setItem("driver_" + nombre, JSON.stringify(registros));
            if(driverActual === nombre){
                mostrarTablaDriver();
            }
        }
    }catch(error){
        console.warn("Driver en modo local:", error.message);
    }
}

async function sincronizarDriverHaciaApi(nombre){
    if(typeof apiGuardarDriver !== "function"){
        return;
    }

    try{
        await apiGuardarDriver(nombre, drivers[nombre] || [], obtenerNombreDriver(nombre));
    }catch(error){
        console.warn("No se pudo sincronizar driver con SQL:", error.message);
    }
}

function limpiarRegistrosDriver(nombre, registros){
    const columnas = estructuraDrivers[nombre] || [];
    return (registros || []).filter(function(registro){
        if(!registro || typeof registro !== "object"){
            return false;
        }
        if(esFilaCabeceraDriver(registro, columnas)){
            return false;
        }
        return Object.values(registro).some(function(valor){
            return String(valor || "").trim() !== "";
        });
    });
}

function esFilaCabeceraDriver(registro, columnas){
    if(!columnas.length){
        return false;
    }

    const columnasNormalizadas = columnas.map(normalizarTextoComparacion);
    const valores = columnas.map(function(columna){
        const clave = normalizarCampo(columna);
        return normalizarTextoComparacion(registro[clave]);
    }).filter(Boolean);

    if(valores.length === 0){
        return false;
    }

    const coincidencias = valores.filter(function(valor){
        return columnasNormalizadas.includes(valor);
    }).length;

    return coincidencias >= Math.min(3, columnas.length);
}

function normalizarTextoComparacion(valor){
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
}

function normalizarCampo(texto){
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/%/g, "porcentaje")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
}

function escaparHTML(valor){
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
