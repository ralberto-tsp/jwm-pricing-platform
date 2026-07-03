async function cargarHistorial(){
    let historial = JSON.parse(localStorage.getItem("cotizaciones")) || [];
    const tabla = document.getElementById("tablaHistorial");

    if(!tabla){
        return;
    }

    if(typeof apiObtenerCotizaciones === "function"){
        try{
            const remoto = await apiObtenerCotizaciones();
            if(Array.isArray(remoto)){
                historial = remoto;
                localStorage.setItem("cotizaciones", JSON.stringify(remoto));
            }
        }catch(error){
            console.warn("Historial en modo local:", error.message);
        }
    }

    const registros = filtrarHistorial(historial);

    if(registros.length === 0){
        tabla.innerHTML = '<tr><td colspan="9" class="historial-vacio">Sin cotizaciones guardadas.</td></tr>';
        return;
    }

    tabla.innerHTML = registros.map(function(registro){
        const item = registro.item;
        const index = registro.index;
        return '<tr>' +
            '<td>' + escaparHistorial(item.numero || '-') + '</td>' +
            '<td>' + escaparHistorial(item.fecha || '-') + '</td>' +
            '<td>' + escaparHistorial(item.cliente || '-') + '</td>' +
            '<td>' + escaparHistorial(item.origen || '-') + '</td>' +
            '<td>' + escaparHistorial(item.destino || '-') + '</td>' +
            '<td>' + escaparHistorial(item.tipoServicio || item.carga || '-') + '</td>' +
            '<td>' + escaparHistorial(item.configuracion || '-') + '</td>' +
            '<td>' + formatoTarifaHistorial(item.tarifa) + '</td>' +
            '<td class="historial-actions">' +
                '<button type="button" onclick="verResumenHistorial(' + index + ')">PDF</button>' +
                '<button type="button" onclick="verResultadoHistorial(' + index + ')">Resultado</button>' +
                '<button type="button" onclick="modificarCotizacionHistorial(' + index + ')">Modificar</button>' +
            '</td>' +
        '</tr>';
    }).join("");
}

function filtrarHistorial(historial){
    const numero = (document.getElementById("buscarCotizacion")?.value || "").trim().toLowerCase();
    const cliente = (document.getElementById("buscarCliente")?.value || "").trim().toLowerCase();
    const fecha = document.getElementById("buscarFecha")?.value || "";

    return historial.map(function(item, index){
        return { item: item, index: index };
    }).filter(function(registro){
        const item = registro.item;
        const coincideNumero = !numero || String(item.numero || "").toLowerCase().includes(numero);
        const coincideCliente = !cliente || String(item.cliente || "").toLowerCase().includes(cliente);
        const coincideFecha = !fecha || item.fecha === fecha;
        return coincideNumero && coincideCliente && coincideFecha;
    });
}

function modificarCotizacionHistorial(index){
    if(typeof cargarCotizacionEnFormulario === "function"){
        cargarCotizacionEnFormulario(index);
    }
    mostrarPantalla("cotizacion");
}

function verResultadoHistorial(index){
    modificarCotizacionHistorial(index);
    mostrarPantalla("resultado");
    if(typeof inicializarResultado === "function"){
        inicializarResultado();
    }
}

function verResumenHistorial(index){
    if(typeof cargarCotizacionEnFormulario === "function"){
        cargarCotizacionEnFormulario(index);
    }
    if(typeof escribirCampoResumen === "function"){
        escribirCampoResumen(obtenerDatosCotizacion());
    }
    mostrarPantalla("resumen");
    setTimeout(function(){
        if(typeof generarPDF === "function"){
            generarPDF();
        }
    }, 150);
}

function abrirCotizacion(index){
    modificarCotizacionHistorial(index);
}

function buscarCliente(){
    cargarHistorial();
}

function formatoTarifaHistorial(valor){
    const numero = parseFloat(valor);
    if(Number.isNaN(numero) || numero <= 0){
        return "-";
    }
    return "S/ " + numero.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escaparHistorial(valor){
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
