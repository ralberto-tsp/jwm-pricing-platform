let usuariosCache = [];

async function cargarUsuarios(){
    if(!usuarioActual || usuarioActual.rol !== "admin"){
        return;
    }

    const tabla = document.getElementById("tablaUsuarios");
    if(tabla){
        tabla.innerHTML = '<tr><td colspan="6">Cargando usuarios...</td></tr>';
    }

    try{
        usuariosCache = await apiObtenerUsuarios();
        renderizarUsuarios();
    }catch(error){
        if(tabla){
            tabla.innerHTML = '<tr><td colspan="6">No se pudieron cargar los usuarios.</td></tr>';
        }
    }
}

function renderizarUsuarios(){
    const tabla = document.getElementById("tablaUsuarios");
    if(!tabla){
        return;
    }

    if(!usuariosCache.length){
        tabla.innerHTML = '<tr><td colspan="6">Sin usuarios registrados.</td></tr>';
        return;
    }

    tabla.innerHTML = usuariosCache.map(function(usuario, index){
        return "<tr>" +
            "<td>" + escaparUsuario(usuario.nombre) + "</td>" +
            "<td>" + escaparUsuario(usuario.email) + "</td>" +
            "<td><span class='usuario-rol'>" + escaparUsuario(etiquetaRol(usuario.rol)) + "</span></td>" +
            "<td>" + (usuario.activo ? "<span class='estado-activo'>Activo</span>" : "<span class='estado-inactivo'>Inactivo</span>") + "</td>" +
            "<td>" + formatoFechaUsuario(usuario.ultimoAcceso) + "</td>" +
            "<td><button type='button' onclick='editarUsuario(" + index + ")'>Editar</button></td>" +
        "</tr>";
    }).join("");
}

function editarUsuario(index){
    const usuario = usuariosCache[index];
    if(!usuario){
        return;
    }

    setValorUsuario("usuarioId", usuario.id);
    setValorUsuario("usuarioNombreInput", usuario.nombre);
    setValorUsuario("usuarioEmailInput", usuario.email);
    setValorUsuario("usuarioRolInput", usuario.rol);
    setValorUsuario("usuarioPasswordInput", "");
    setValorUsuario("usuarioActivoInput", usuario.activo ? "1" : "0");
    escribirUsuario("usuarioFormTitulo", "Modificar usuario");
    escribirUsuario("usuarioFormMensaje", "Deja la contrasena vacia si no deseas cambiarla.");
}

async function guardarUsuarioDesdeFormulario(event){
    event.preventDefault();
    const id = document.getElementById("usuarioId")?.value || "";
    const password = document.getElementById("usuarioPasswordInput")?.value || "";
    const mensaje = document.getElementById("usuarioFormMensaje");

    const usuario = {
        id: id || undefined,
        nombre: document.getElementById("usuarioNombreInput")?.value || "",
        email: document.getElementById("usuarioEmailInput")?.value || "",
        rol: document.getElementById("usuarioRolInput")?.value || "consulta",
        activo: (document.getElementById("usuarioActivoInput")?.value || "1") === "1"
    };

    if(password){
        usuario.password = password;
    }

    if(!id && !password){
        escribirUsuario("usuarioFormMensaje", "Ingresa una contrasena inicial.");
        return;
    }

    try{
        await apiGuardarUsuario(usuario);
        if(mensaje){
            mensaje.textContent = "Usuario guardado correctamente.";
        }
        limpiarFormularioUsuario();
        await cargarUsuarios();
    }catch(error){
        if(mensaje){
            mensaje.textContent = "No se pudo guardar el usuario.";
        }
    }
}

function limpiarFormularioUsuario(){
    const form = document.getElementById("formUsuario");
    if(form){
        form.reset();
    }
    setValorUsuario("usuarioId", "");
    setValorUsuario("usuarioRolInput", "comercial");
    setValorUsuario("usuarioActivoInput", "1");
    escribirUsuario("usuarioFormTitulo", "Nuevo usuario");
    escribirUsuario("usuarioFormMensaje", "");
}

function formatoFechaUsuario(valor){
    if(!valor){
        return "-";
    }
    const fecha = new Date(valor);
    if(Number.isNaN(fecha.getTime())){
        return "-";
    }
    return fecha.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function setValorUsuario(id, valor){
    const elemento = document.getElementById(id);
    if(elemento){
        elemento.value = valor || "";
    }
}

function escribirUsuario(id, valor){
    const elemento = document.getElementById(id);
    if(elemento){
        elemento.textContent = valor || "";
    }
}

function escaparUsuario(valor){
    return String(valor || "").replace(/[&<>"']/g, function(caracter){
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[caracter];
    });
}
