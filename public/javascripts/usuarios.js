async function cargarUsuarios() {
    const token = sessionStorage.getItem('token');

    const respuesta = await fetch('/api/usuarios', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const usuarios = await respuesta.json();

    console.log(usuarios);
}

cargarUsuarios();