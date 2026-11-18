document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const error = document.getElementById("error");
    error.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const respuesta = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const datos = await respuesta.json();

        console.log("Respuesta:", respuesta.status, datos);

        if (!respuesta.ok) {
            error.textContent = datos.error || "Error al iniciar sesión";
            return;
        }

        // Guardar el token de autenticación
        sessionStorage.setItem("token", datos.token);

        // Guardar toda la información del usuario devuelta por el servidor
        sessionStorage.setItem("usuario", JSON.stringify(datos.usuario));

        // Guardar el correo utilizado para iniciar sesión
        sessionStorage.setItem("email", email);

        // Redirigir a la página de mensajes
        window.location.href = "/mensajes";

    } catch (err) {
        console.error("Error al iniciar sesión:", err);
        error.textContent = "Error de conexión con el servidor";
    }
});