
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const error = document.getElementById("error");
    error.textContent = "";

    const email = document.getElementById("email").value;
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

        sessionStorage.setItem("token", datos.token);
        sessionStorage.setItem("usuario", JSON.stringify(datos.usuario));

        window.location.href = "/mensajes";

    } catch (err) {
        console.error("Error al iniciar sesión:", err);
        error.textContent = "Error de conexión con el servidor";
    }
});
