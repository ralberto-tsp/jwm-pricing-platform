function generarPDF(){
    if(typeof actualizarResumenEjecutivo === "function"){
        actualizarResumenEjecutivo();
    }

    if(typeof mostrarPantalla === "function"){
        mostrarPantalla("resumen");
    }

    document.body.classList.add("printing-resumen");

    const limpiarModoImpresion = function(){
        document.body.classList.remove("printing-resumen");
        window.removeEventListener("afterprint", limpiarModoImpresion);
    };

    window.addEventListener("afterprint", limpiarModoImpresion);
    setTimeout(function(){
        window.print();
        setTimeout(limpiarModoImpresion, 1000);
    }, 120);
}
