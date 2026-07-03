let usuarioActual = null;

async function inicializarSeguridad(){
    try{
        const respuesta = await apiUsuarioActual();
        aplicarUsuarioAutenticado(respuesta.user);
        return true;
    }catch(error){
        mostrarLogin();
        return false;
    }
}

async function iniciarSesionDesdeFormulario(event){
    event.preventDefault();
    const mensaje = document.getElementById("loginMensaje");
    const boton = event.target.querySelector("button");
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    if(mensaje){
        mensaje.textContent = "";
    }
    if(boton){
        boton.disabled = true;
        boton.textContent = "Ingresando...";
    }

    try{
        const respuesta = await apiLogin(email, password);
        aplicarUsuarioAutenticado(respuesta.user);
        if(typeof iniciarAplicacion === "function"){
            iniciarAplicacion();
        }
    }catch(error){
        if(mensaje){
            mensaje.textContent = "No se pudo iniciar sesion. Revisa correo y contrasena.";
        }
    }finally{
        if(boton){
            boton.disabled = false;
            boton.textContent = "Ingresar";
        }
    }
}

async function cerrarSesion(){
    try{
        await apiLogout();
    }catch(error){
        console.warn("No se pudo cerrar la sesion en el servidor:", error.message);
    }
    usuarioActual = null;
    mostrarLogin();
}

function manejarSesionExpirada(){
    usuarioActual = null;
    mostrarLogin();
}

function aplicarUsuarioAutenticado(user){
    usuarioActual = user;
    document.body.classList.add("autenticado");
    document.body.classList.remove("sin-sesion");

    const login = document.getElementById("loginPanel");
    if(login){
        login.style.display = "none";
    }

    escribirTextoAuth("usuarioNombre", user?.nombre || "-");
    escribirTextoAuth("usuarioRol", etiquetaRol(user?.rol));
    actualizarMenuPorRol();
}

function mostrarLogin(){
    document.body.classList.remove("autenticado");
    document.body.classList.add("sin-sesion");

    const login = document.getElementById("loginPanel");
    if(login){
        login.style.display = "grid";
    }

    document.querySelectorAll("[id^='pantalla-']").forEach(function(pantalla){
        pantalla.style.display = "none";
    });
}

function actualizarMenuPorRol(){
    document.querySelectorAll(".menu-item").forEach(function(item){
        const roles = (item.dataset.roles || "").split(",").map(function(rol){ return rol.trim(); });
        item.style.display = roles.includes(usuarioActual?.rol) ? "" : "none";
    });
}

function puedeVerPantalla(nombre){
    const item = document.querySelector('.menu-item[data-screen="' + nombre + '"]');
    if(!item){
        return true;
    }
    const roles = (item.dataset.roles || "").split(",").map(function(rol){ return rol.trim(); });
    return roles.includes(usuarioActual?.rol);
}

function primeraPantallaPermitida(){
    const item = Array.from(document.querySelectorAll(".menu-item")).find(function(menu){
        return menu.style.display !== "none";
    });
    return item ? item.dataset.screen : "resumen";
}

function etiquetaRol(rol){
    const etiquetas = {
        admin: "Administrador",
        comercial: "Comercial",
        consulta: "Consulta"
    };
    return etiquetas[rol] || rol || "-";
}

function escribirTextoAuth(id, valor){
    const elemento = document.getElementById(id);
    if(elemento){
        elemento.textContent = valor;
    }
}
