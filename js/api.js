const JWM_API_BASE = localStorage.getItem("jwm_api_base") || "http://localhost:3000/api";

async function apiRequest(path, options = {}){
    const respuesta = await fetch(JWM_API_BASE + path, Object.assign({
        headers: { "Content-Type": "application/json" }
    }, options));

    if(!respuesta.ok){
        const texto = await respuesta.text();
        throw new Error(texto || "No se pudo conectar con la API.");
    }

    return respuesta.json();
}

async function apiHealth(){
    return apiRequest("/health");
}

async function apiObtenerDriver(nombre){
    return apiRequest("/drivers/" + encodeURIComponent(nombre));
}

async function apiGuardarDriver(nombre, registros, etiqueta){
    return apiRequest("/drivers/" + encodeURIComponent(nombre), {
        method: "PUT",
        body: JSON.stringify({ records: registros || [], label: etiqueta || nombre })
    });
}

async function apiObtenerCotizaciones(){
    return apiRequest("/cotizaciones");
}

async function apiGuardarCotizacion(cotizacion){
    return apiRequest("/cotizaciones", {
        method: "POST",
        body: JSON.stringify(cotizacion)
    });
}
