const token = sessionStorage.getItem("token");
const usuarioActual = JSON.parse(
    sessionStorage.getItem("usuario") || "null"
);

const listaMensajes = document.getElementById("listaMensajes");
const mensajeForm = document.getElementById("mensajeForm");
const contenidoInput = document.getElementById("contenido");
const error = document.getElementById("error");

const administracionPanel = document.getElementById("administracionPanel");
const tablaUsuariosBody = document.getElementById("tablaUsuariosBody");
const editarUsuarioPanel = document.getElementById("editarUsuarioPanel");
const editarUsuarioForm = document.getElementById("editarUsuarioForm");

let ultimoMensajeId = null;
let intervaloMensajes = null;
let gruposDisponibles = [];

if (!token || !usuarioActual) {
    window.location.href = "/login";
}

// ======================================
// PETICIONES A LA API
// ======================================

async function peticionAPI(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        headers: {
            ...opciones.headers,
            Authorization: `Bearer ${token}`
        }
    });

    if (respuesta.status === 401) {
        sessionStorage.clear();
        window.location.href = "/login";
        throw new Error("Sesión caducada.");
    }

    const datos = respuesta.status === 204
        ? null
        : await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(datos?.error || "Error en la petición.");
    }

    return datos;
}

// ======================================
// MENSAJES DE ERROR DEL CHAT
// ======================================

function mostrarError(mensaje) {
    if (error) {
        error.textContent = mensaje;
    }
}

// ======================================
// CARGAR MENSAJES
// ======================================

async function cargarMensajes() {
    try {
        const mensajes = await peticionAPI("/api/mensajes");

        const nuevoUltimoId = mensajes.length
            ? mensajes[mensajes.length - 1].id
            : null;

        if (nuevoUltimoId === ultimoMensajeId) return;

        ultimoMensajeId = nuevoUltimoId;
        mostrarMensajes(mensajes);

    } catch (err) {
        mostrarError(err.message);
    }
}

// ======================================
// PINTAR MENSAJES
// ======================================

function mostrarMensajes(mensajes) {
    listaMensajes.replaceChildren();

    if (mensajes.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "sin-mensajes";
        vacio.textContent =
            "Todavía no hay mensajes en el grupo. ¡Escribe el primero!";

        listaMensajes.appendChild(vacio);
        return;
    }

    mensajes.forEach(mensaje => {
        const esMio = mensaje.emisorId === usuarioActual.id;
        const emisor = mensaje.emisor || {};

        const fila = document.createElement("div");
        fila.className = esMio
            ? "mensaje-fila mensaje-fila-propio"
            : "mensaje-fila mensaje-fila-recibido";

        const avatar = document.createElement("div");
        avatar.className = "mensaje-avatar";
        avatar.setAttribute("aria-hidden", "true");

        const iniciales = document.createElement("span");
        iniciales.textContent = `${emisor.nombre?.charAt(0) || ""}${emisor.apellidos?.charAt(0) || ""}`.toUpperCase() || "?";
        avatar.appendChild(iniciales);

        if (typeof emisor.foto === "string") {
            try {
                const urlFoto = new URL(emisor.foto);

                if (
                    urlFoto.protocol === "https:" &&
                    !urlFoto.username &&
                    !urlFoto.password
                ) {
                    const foto = document.createElement("img");
                    foto.src = urlFoto.href;
                    foto.alt = "";
                    foto.loading = "lazy";
                    foto.referrerPolicy = "no-referrer";
                    foto.addEventListener("load", () => {
                        iniciales.hidden = true;
                        foto.hidden = false;
                    });
                    foto.addEventListener("error", () => foto.remove());
                    foto.hidden = true;
                    avatar.appendChild(foto);
                }
            } catch {
                // Las fotos ausentes o URL antiguas se representan con iniciales.
            }
        }

        const burbuja = document.createElement("div");
        burbuja.className = esMio
            ? "mensaje mensaje-propio"
            : "mensaje mensaje-recibido";

        const autor = document.createElement("strong");
        autor.textContent = esMio
            ? "Tú"
            : `${emisor.nombre || "Usuario"} ${emisor.apellidos || ""}`;

        const texto = document.createElement("p");
        texto.textContent = mensaje.contenido;

        const fecha = document.createElement("small");
        fecha.textContent = new Date(mensaje.creadoEn).toLocaleString("es-ES");

        burbuja.append(autor, texto, fecha);
        fila.append(avatar, burbuja);
        listaMensajes.appendChild(fila);
    });

    listaMensajes.scrollTop = listaMensajes.scrollHeight;
}

// ======================================
// ENVIAR MENSAJE
// ======================================

mensajeForm.addEventListener("submit", async event => {
    event.preventDefault();
    mostrarError("");

    const contenido = contenidoInput.value.trim();

    if (!contenido) return;

    const boton = mensajeForm.querySelector('button[type="submit"]');
    boton.disabled = true;

    try {
        await peticionAPI("/api/mensajes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contenido })
        });

        contenidoInput.value = "";
        await cargarMensajes();

    } catch (err) {
        mostrarError(err.message);

    } finally {
        boton.disabled = false;
    }
});

// ======================================
// ADMINISTRACIÓN DE USUARIOS
// ======================================

function mostrarErrorAdmin(mensaje) {
    document.getElementById("adminError").textContent = mensaje;
    document.getElementById("adminExito").textContent = "";
}

function mostrarExitoAdmin(mensaje) {
    document.getElementById("adminExito").textContent = mensaje;
    document.getElementById("adminError").textContent = "";
}

// ======================================
// CREAR CELDA DE TABLA
// ======================================

function crearCelda(texto) {
    const celda = document.createElement("td");
    celda.textContent = texto ?? "";
    return celda;
}

// ======================================
// CARGAR USUARIOS
// ======================================

async function cargarUsuariosAdmin() {
    try {
        const usuarios = await peticionAPI("/api/usuarios");

        tablaUsuariosBody.replaceChildren();

        if (usuarios.length === 0) {
            const fila = document.createElement("tr");
            const celda = crearCelda("No hay usuarios registrados.");

            celda.colSpan = 8;
            fila.appendChild(celda);
            tablaUsuariosBody.appendChild(fila);

            return;
        }

        usuarios.forEach(usuario => {
            const fila = document.createElement("tr");

            fila.append(
                crearCelda(usuario.id),
                crearCelda(usuario.nombre),
                crearCelda(usuario.apellidos),
                crearCelda(usuario.email),
                crearCelda(usuario.grupo?.nombre || "Sin grupo"),
                crearCelda(usuario.rol),
                crearCelda(usuario.activo ? "Activo" : "Inactivo")
            );

            const acciones = document.createElement("td");

            // BOTÓN EDITAR
            const botonEditar = document.createElement("button");
            botonEditar.type = "button";
            botonEditar.textContent = "Editar";

            botonEditar.addEventListener("click", () => {
                abrirEdicionUsuario(usuario);
            });

            // BOTÓN ACTIVAR / DESACTIVAR
            const botonEstado = document.createElement("button");
            botonEstado.type = "button";
            botonEstado.textContent = usuario.activo
                ? "Desactivar"
                : "Activar";

            botonEstado.disabled = usuario.id === usuarioActual.id;

            botonEstado.addEventListener("click", () => {
                cambiarEstadoUsuario(usuario);
            });

            // BOTÓN ELIMINAR
            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.textContent = "Eliminar";
            botonEliminar.className = "btn-eliminar";

            botonEliminar.disabled = usuario.id === usuarioActual.id;

            botonEliminar.addEventListener("click", () => {
                eliminarUsuario(usuario);
            });

            // AÑADIR LOS TRES BOTONES UNA SOLA VEZ
            acciones.append(
                botonEditar,
                botonEstado,
                botonEliminar
            );

            fila.appendChild(acciones);
            tablaUsuariosBody.appendChild(fila);
        });

    } catch (err) {
        mostrarErrorAdmin(err.message);
    }
}

// ======================================
// CARGAR GRUPOS PARA EL SELECT
// ======================================

async function cargarGruposAdmin() {
    gruposDisponibles = await peticionAPI("/api/grupos");

    const selector = document.getElementById("editarGrupo");
    selector.replaceChildren();

    gruposDisponibles.forEach(grupo => {
        const opcion = document.createElement("option");

        opcion.value = grupo.id;
        opcion.textContent = grupo.nombre;

        selector.appendChild(opcion);
    });
}

// ======================================
// ABRIR FORMULARIO DE EDICIÓN
// ======================================

function abrirEdicionUsuario(usuario) {
    editarUsuarioPanel.hidden = false;

    document.getElementById("editarUsuarioId").value = usuario.id;
    document.getElementById("editarNombre").value = usuario.nombre;
    document.getElementById("editarApellidos").value = usuario.apellidos;
    document.getElementById("editarEmail").value = usuario.email;
    document.getElementById("editarGrupo").value = usuario.grupoId;
    document.getElementById("editarRol").value = usuario.rol;
    document.getElementById("editarActivo").value = String(usuario.activo);

    mostrarErrorAdmin("");
    document.getElementById("adminExito").textContent = "";

    editarUsuarioPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ======================================
// GUARDAR CAMBIOS DEL USUARIO
// ======================================

editarUsuarioForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("editarUsuarioId").value;

    const datos = {
        nombre: document.getElementById("editarNombre").value.trim(),
        apellidos: document.getElementById("editarApellidos").value.trim(),
        email: document.getElementById("editarEmail").value.trim(),
        grupoId: Number(document.getElementById("editarGrupo").value),
        rol: document.getElementById("editarRol").value,
        activo: document.getElementById("editarActivo").value === "true"
    };

    const botonGuardar = editarUsuarioForm.querySelector(
        'button[type="submit"]'
    );

    botonGuardar.disabled = true;

    try {
        await peticionAPI(`/api/usuarios/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });

        editarUsuarioPanel.hidden = true;

        mostrarExitoAdmin("Usuario actualizado correctamente.");

        await cargarUsuariosAdmin();

    } catch (err) {
        mostrarErrorAdmin(err.message);

    } finally {
        botonGuardar.disabled = false;
    }
});

// ======================================
// ACTIVAR O DESACTIVAR USUARIO
// ======================================

async function cambiarEstadoUsuario(usuario) {
    const nuevoEstado = !usuario.activo;

    const confirmado = confirm(
        `¿Quieres ${nuevoEstado ? "activar" : "desactivar"} a ${usuario.nombre} ${usuario.apellidos}?`
    );

    if (!confirmado) return;

    try {
        await peticionAPI(`/api/usuarios/${usuario.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombre: usuario.nombre,
                apellidos: usuario.apellidos,
                email: usuario.email,
                grupoId: usuario.grupoId,
                rol: usuario.rol,
                activo: nuevoEstado
            })
        });

        mostrarExitoAdmin("Estado del usuario actualizado.");

        await cargarUsuariosAdmin();

    } catch (err) {
        mostrarErrorAdmin(err.message);
    }
}

// ======================================
// ELIMINAR USUARIO DEFINITIVAMENTE
// ======================================

async function eliminarUsuario(usuario) {
    const confirmado = confirm(
        `¿Seguro que quieres eliminar definitivamente a ${usuario.nombre} ${usuario.apellidos}? Esta acción no se puede deshacer.`
    );

    if (!confirmado) return;

    try {
        await peticionAPI(`/api/usuarios/${usuario.id}`, {
            method: "DELETE"
        });

        editarUsuarioPanel.hidden = true;

        mostrarExitoAdmin("Usuario eliminado correctamente.");

        await cargarUsuariosAdmin();

    } catch (err) {
        mostrarErrorAdmin(err.message);
    }
}

// ======================================
// CANCELAR EDICIÓN
// ======================================

document.getElementById("cancelarEdicion").addEventListener("click", () => {
    editarUsuarioPanel.hidden = true;
});

// ======================================
// INICIAR ADMINISTRACIÓN SOLO SI ES ADMIN
// ======================================

async function iniciarAdministracion() {
    if (usuarioActual.rol !== "ADMIN" || !administracionPanel) {
        return;
    }

    administracionPanel.hidden = false;

    try {
        await cargarGruposAdmin();
        await cargarUsuariosAdmin();

    } catch (err) {
        mostrarErrorAdmin(err.message);
    }
}

// ======================================
// INICIAR CHAT
// ======================================

async function iniciarChat() {
    await iniciarAdministracion();
    await cargarMensajes();

    intervaloMensajes = setInterval(() => {
        cargarMensajes();
    }, 3000);
}

iniciarChat();