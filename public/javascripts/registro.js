
document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const error = document.getElementById('error');
    error.textContent = '';

    const usuario = {
        nombre: document.getElementById('nombre').value,
        apellidos: document.getElementById('apellidos').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        foto: document.getElementById('foto').value.trim() || null,
        grupoId: Number(document.getElementById('grupoId').value)
    };

    try {
        const respuesta = await fetch('/api/usuarios', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(usuario)
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            error.textContent = datos.error || 'Error al registrar usuario';
            return;
        }

        alert('Usuario registrado correctamente');
        window.location.href = '/login';

    } catch (err) {
        console.error('Error al registrar:', err);
        error.textContent = 'Error de conexión con el servidor';
    }
});
