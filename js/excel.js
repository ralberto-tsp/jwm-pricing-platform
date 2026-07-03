function excelDisponible(){
    if(typeof XLSX === "undefined"){
        alert("No se pudo cargar la libreria Excel. Recargue el sistema e intente nuevamente.");
        return false;
    }
    return true;
}

function importarDriver(){
    importarExcel();
}

function exportarDriver(){
    exportarExcel();
}

function importarExcel(){
    if(!driverActual || !estructuraDrivers[driverActual]){
        alert("Seleccione primero un Driver.");
        return;
    }

    if(!excelDisponible()){
        return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = leerArchivoDriver;
    input.click();
}

function leerArchivoDriver(event){
    const archivo = event.target.files[0];
    if(!archivo){ return; }

    const extension = archivo.name.split(".").pop().toLowerCase();

    if(extension === "csv"){
        leerCsvDriver(archivo);
        return;
    }

    leerXlsxDriver(archivo);
}

function leerXlsxDriver(archivo){
    const lector = new FileReader();
    lector.onload = function(e){
        const datos = new Uint8Array(e.target.result);
        const workbook = XLSX.read(datos, { type: "array" });
        const hoja = workbook.SheetNames[0];
        const filas = XLSX.utils.sheet_to_json(workbook.Sheets[hoja], { defval: "" });
        guardarFilasImportadas(filas);
    };
    lector.readAsArrayBuffer(archivo);
}

function leerCsvDriver(archivo){
    const lector = new FileReader();
    lector.onload = function(e){
        const workbook = XLSX.read(e.target.result, { type: "string" });
        const hoja = workbook.SheetNames[0];
        const filas = XLSX.utils.sheet_to_json(workbook.Sheets[hoja], { defval: "" });
        guardarFilasImportadas(filas);
    };
    lector.readAsText(archivo, "UTF-8");
}

function guardarFilasImportadas(filas){
    const columnas = estructuraDrivers[driverActual];
    const registros = filas.map(function(fila){
        const registro = {};
        columnas.forEach(function(columna){
            const clave = normalizarCampo(columna);
            registro[clave] = obtenerValorFilaImportada(fila, columna);
        });
        return registro;
    }).filter(function(registro){
        return Object.values(registro).some(function(valor){ return String(valor).trim() !== ""; });
    });

    if(registros.length === 0){
        alert("El archivo no contiene registros para importar.");
        return;
    }

    drivers[driverActual] = registros;
    localStorage.setItem("driver_" + driverActual, JSON.stringify(registros));
    if(typeof sincronizarDriverHaciaApi === "function"){
        sincronizarDriverHaciaApi(driverActual);
    }
    mostrarTablaDriver();
    alert("Driver importado: " + registros.length + " registros.");
}

function obtenerValorFilaImportada(fila, columna){
    if(fila[columna] !== undefined){ return fila[columna]; }

    const claveNormalizada = normalizarCampo(columna);
    const claveEncontrada = Object.keys(fila).find(function(clave){
        return normalizarCampo(clave) === claveNormalizada;
    });

    return claveEncontrada ? fila[claveEncontrada] : "";
}

function exportarExcel(){
    if(!driverActual || !estructuraDrivers[driverActual]){
        alert("Seleccione primero un Driver.");
        return;
    }

    if(!excelDisponible()){
        return;
    }

    const registros = drivers[driverActual] && drivers[driverActual].length > 0 ? drivers[driverActual] : obtenerDriverGuardado(driverActual);
    const filas = registros.length > 0 ? convertirRegistrosAFilas(registros) : [crearFilaPlantilla()];
    const hoja = XLSX.utils.json_to_sheet(filas, { header: estructuraDrivers[driverActual] });
    ajustarAnchoColumnas(hoja, estructuraDrivers[driverActual], filas);

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, nombreHojaExcel(driverActual));
    XLSX.writeFile(libro, "driver_" + driverActual + "_modelo.xlsx");
}

function obtenerDriverGuardado(nombre){
    try{
        return JSON.parse(localStorage.getItem("driver_" + nombre)) || [];
    }catch(error){
        return [];
    }
}

function convertirRegistrosAFilas(registros){
    const columnas = estructuraDrivers[driverActual];
    return registros.map(function(registro){
        const fila = {};
        columnas.forEach(function(columna){
            fila[columna] = registro[normalizarCampo(columna)] || "";
        });
        return fila;
    });
}

function crearFilaPlantilla(){
    const fila = {};
    estructuraDrivers[driverActual].forEach(function(columna){
        fila[columna] = "";
    });
    return fila;
}

function ajustarAnchoColumnas(hoja, columnas, filas){
    hoja["!cols"] = columnas.map(function(columna){
        const maximo = filas.reduce(function(max, fila){
            return Math.max(max, String(fila[columna] || "").length);
        }, columna.length);
        return { wch: Math.min(Math.max(maximo + 3, 14), 34) };
    });
}

function nombreHojaExcel(nombre){
    return obtenerNombreDriver(nombre).substring(0, 31).replace(/[\\/*?:\[\]]/g, " ");
}
