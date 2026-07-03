async function cargarVistas(){
    const contenedores = document.querySelectorAll("[data-view]");

    for(const contenedor of contenedores){
        const respuesta = await fetch(contenedor.dataset.view + "?v=" + Date.now());

        if(!respuesta.ok){
            throw new Error("No se pudo cargar " + contenedor.dataset.view);
        }

        contenedor.outerHTML = await respuesta.text();
    }
}

function iniciarAplicacion(){
    if(typeof inicializarCotizacion === "function"){
        inicializarCotizacion();
    }

    if(typeof inicializarResultado === "function"){
        inicializarResultado();
    }

    if(typeof inicializarResumen === "function"){
        inicializarResumen();
    }

    cargarHistorial();
    mostrarPantalla("cotizacion");
}

function mostrarPantalla(nombre){
    const pantallas = ["cotizacion", "resultado", "historial", "drivers", "resumen"];

    pantallas.forEach(function(pantalla){
        const elemento = document.getElementById("pantalla-" + pantalla);

        if(elemento){
            elemento.style.display = "none";
        }
    });

    const pantallaActiva = document.getElementById("pantalla-" + nombre);

    if(pantallaActiva){
        pantallaActiva.style.display = "block";
    }

    document.querySelectorAll(".menu-item").forEach(function(item){
        const onclick = item.getAttribute("onclick") || "";
        item.classList.toggle("active", onclick.indexOf("'" + nombre + "'") >= 0);
    });

    if(nombre === "resultado" && typeof inicializarResultado === "function"){
        inicializarResultado();
    }

    if(nombre === "historial" && typeof cargarHistorial === "function"){
        cargarHistorial();
    }

    if(nombre === "resumen" && typeof actualizarResumenEjecutivo === "function"){
        actualizarResumenEjecutivo();
    }
}

window.onload = async function(){
    try{
        await cargarVistas();
        iniciarAplicacion();
    }catch(error){
        console.error(error);
        alert("No se pudieron cargar las vistas del sistema.");
    }
};


