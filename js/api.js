const JWM_API_BASE = obtenerApiBase();

function obtenerApiBase(){
    const hostLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if(hostLocal && window.location.port && window.location.port !== "3000"){
        return "http://localhost:3000/api";
    }
    return "/api";
}

async function apiRequest(path, options = {}){
    const config = Object.assign({
        credentials: "include",
        headers: { "Content-Type": "application/json" }
    }, options);

    config.headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});

    const respuesta = await fetch(JWM_API_BASE + path, config);

    if(!respuesta.ok){
        const texto = await respuesta.text();
        if(respuesta.status === 401 && typeof manejarSesionExpirada === "function"){
            manejarSesionExpirada();
        }
        throw new Error(texto || "No se pudo conectar con la API.");
    }

    return respuesta.json();
}

async function apiHealth(){
    return apiRequest("/health");
}

async function apiLogin(email, password){
    return apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password })
    });
}

async function apiLogout(){
    return apiRequest("/auth/logout", { method: "POST" });
}

async function apiUsuarioActual(){
    return apiRequest("/auth/me");
}

async function apiObtenerUsuarios(){
    return apiRequest("/usuarios");
}

async function apiGuardarUsuario(usuario){
    return apiRequest("/usuarios", {
        method: "POST",
        body: JSON.stringify(usuario)
    });
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

