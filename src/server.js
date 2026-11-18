const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const { isIP } = require("node:net");

const prisma = require("./db");
const { autenticar, soloAdmin } = require("./auth");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const UPLOADS = path.join(__dirname, "..", "uploads");
// CONFIGURACIÓN DE PUG
app.set('view engine', 'pug');

app.set(
    'views',
    path.join(__dirname, '..', 'views')
);

// ARCHIVOS ESTÁTICOS
app.use(
    express.static(path.join(__dirname, '..', 'public'))
);

// FORMULARIOS HTML
app.use(express.urlencoded({ extended: true }));

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres.");
}

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const usuarioPublico = {
  id: true,
  nombre: true,
  apellidos: true,
  email: true,
  foto: true,
  rol: true,
  activo: true,
  creadoEn: true,
  grupoId: true,
  grupo: {
    select: {
      id: true,
      nombre: true
    }
  }
};

const participantePublico = {
  id: true,
  nombre: true,
  apellidos: true,
  foto: true
};

function fallo(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function idPositivo(valor, campo = "id") {
  if (!/^[1-9]\d*$/.test(String(valor))) {
    throw fallo(400, `${campo} debe ser un entero positivo.`);
  }

  const numero = Number(valor);

  if (!Number.isSafeInteger(numero)) {
    throw fallo(400, `${campo} no es válido.`);
  }

  return numero;
}

function texto(valor, campo, maximo) {
  if (typeof valor !== "string") {
    throw fallo(400, `${campo} es obligatorio.`);
  }

  const resultado = valor.trim();

  if (!resultado || resultado.length > maximo) {
    throw fallo(
      400,
      `${campo} debe tener entre 1 y ${maximo} caracteres.`
    );
  }

  return resultado;
}

function emailValido(valor) {
  const email = texto(valor, "email", 254).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw fallo(400, "El email no es válido.");
  }

  return email;
}

function urlFotoValida(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  if (typeof valor !== "string" || valor.trim().length > 2048) {
    throw fallo(400, "La foto debe ser una URL HTTPS válida.");
  }

  const foto = valor.trim();

  if (!foto) {
    return null;
  }

  let url;

  try {
    url = new URL(foto);
  } catch {
    throw fallo(400, "La foto debe ser una URL HTTPS válida.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    isIP(host)
  ) {
    throw fallo(400, "La foto debe ser una URL HTTPS pública.");
  }

  return url.href;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1
  }
});

// ESTADO DEL SERVICIO

app.get("/api/salud", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;

  res.json({
    estado: "OK",
    baseDeDatos: "Conectada"
  });
});

// LOGIN


app.post("/api/auth/login", async (req, res) => {
  try {
    console.log("1. Petición de login recibida");

    const email = emailValido(req.body?.email);
    const password = req.body?.password;

    console.log("2. Email recibido:", email);

    if (
      typeof password !== "string" ||
      !password ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw fallo(400, "Contraseña no válida.");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email }
    });

    console.log("3. Usuario encontrado:", !!usuario);

    if (!usuario || !usuario.activo) {
      throw fallo(401, "Credenciales incorrectas.");
    }

    console.log("4. Comprobando contraseña");

    const correcta = await bcrypt.compare(
      password,
      usuario.passwordHash
    );

    console.log("5. Contraseña correcta:", correcta);

    if (!correcta) {
      throw fallo(401, "Credenciales incorrectas.");
    }

    const token = jwt.sign(
      {},
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        subject: String(usuario.id),
        expiresIn: "2h"
      }
    );

    console.log("6. Login completado correctamente");

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        grupoId: usuario.grupoId
      }
    });

  } catch (error) {
    console.error("ERROR EN LOGIN:", error);
    throw error;
  }
});


// A partir de aquí se exige autenticación.

// REGISTRO PÚBLICO: cualquier persona puede crear una cuenta

app.post("/api/usuarios", async (req, res) => {
    const nombre = texto(req.body?.nombre, "nombre", 100);
    const apellidos = texto(req.body?.apellidos, "apellidos", 150);
    const email = emailValido(req.body?.email);
    const foto = urlFotoValida(req.body?.foto);
    const grupoId = idPositivo(req.body?.grupoId, "grupoId");
    const password = req.body?.password;

    if (
        typeof password !== "string" ||
        password.length < 12 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        throw fallo(
            400,
            "La contraseña debe tener al menos 12 caracteres y un máximo de 72 bytes."
        );
    }

    const grupo = await prisma.grupo.findUnique({
        where: { id: grupoId }
    });

    if (!grupo) {
        throw fallo(404, "El grupo indicado no existe.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const usuario = await prisma.usuario.create({
        data: {
            nombre,
            apellidos,
            email,
            passwordHash,
            foto,
            grupoId,
            rol: "USUARIO"
        },
        select: usuarioPublico
    });

    res.status(201).json(usuario);
});

app.use("/api", autenticar);

// PERFIL

app.get("/api/auth/me", async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: usuarioPublico
  });

  res.json(usuario);
});

// GRUPOS

app.get("/api/grupos", soloAdmin, async (req, res) => {
  const grupos = await prisma.grupo.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: {
        select: { usuarios: true }
      }
    }
  });

  res.json(grupos);
});

app.post("/api/grupos", soloAdmin, async (req, res) => {
  const nombre = texto(req.body?.nombre, "nombre", 100);

  const grupo = await prisma.grupo.create({
    data: { nombre }
  });

  res.status(201).json(grupo);
});

app.delete("/api/grupos/:id", soloAdmin, async (req, res) => {
  const id = idPositivo(req.params.id);

  const grupo = await prisma.grupo.findUnique({
    where: { id },
    include: {
      _count: {
        select: { usuarios: true }
      }
    }
  });

  if (!grupo) {
    throw fallo(404, "Grupo no encontrado.");
  }

  if (grupo._count.usuarios > 0) {
    throw fallo(
      409,
      "No puedes eliminar un grupo que tiene usuarios."
    );
  }

  await prisma.grupo.delete({ where: { id } });

  res.status(204).end();
});

// USUARIOS

app.get("/api/usuarios", async (req, res) => {
  const esAdmin = req.usuario.rol === "ADMIN";

  const usuarios = await prisma.usuario.findMany({
    where: esAdmin
      ? {}
      : {
          activo: true,
          grupoId: req.usuario.grupoId
        },
    select: usuarioPublico,
    orderBy: { id: "asc" }
  });

  res.json(usuarios);
});

// EDITAR USUARIOS: solamente administradores
app.put("/api/usuarios/:id", soloAdmin, async (req, res) => {
    const id = idPositivo(req.params.id);

    const nombre = texto(req.body?.nombre, "nombre", 100);
    const apellidos = texto(req.body?.apellidos, "apellidos", 150);
    const email = emailValido(req.body?.email);
    const grupoId = idPositivo(req.body?.grupoId, "grupoId");
    const rol = req.body?.rol;
    const activo = req.body?.activo;

    if (!["ADMIN", "USUARIO"].includes(rol)) {
        throw fallo(400, "El rol indicado no es válido.");
    }

    if (typeof activo !== "boolean") {
        throw fallo(400, "El estado activo debe ser verdadero o falso.");
    }

    // Evitar que el administrador se quite sus propios permisos
    // o desactive su propia cuenta accidentalmente.
    if (id === req.usuario.id && (rol !== "ADMIN" || activo !== true)) {
        throw fallo(
            400,
            "No puedes quitarte tus permisos de administrador ni desactivar tu cuenta."
        );
    }

    const grupo = await prisma.grupo.findUnique({
        where: { id: grupoId }
    });

    if (!grupo) {
        throw fallo(404, "El grupo indicado no existe.");
    }

    const usuarioExistente = await prisma.usuario.findUnique({
        where: { id }
    });

    if (!usuarioExistente) {
        throw fallo(404, "Usuario no encontrado.");
    }

    const actualizado = await prisma.usuario.update({
        where: { id },
        data: {
            nombre,
            apellidos,
            email,
            grupoId,
            rol,
            activo
        },
        select: usuarioPublico
    });

    res.json(actualizado);
});



// ELIMINAR USUARIOS: solamente administradores
app.delete("/api/usuarios/:id", soloAdmin, async (req, res) => {
    const id = idPositivo(req.params.id, "id");

    // Impedir que el administrador se elimine a sí mismo
    if (id === req.usuario.id) {
        throw fallo(400, "No puedes eliminar tu propia cuenta.");
    }

    const usuario = await prisma.usuario.findUnique({
        where: { id }
    });

    if (!usuario) {
        throw fallo(404, "Usuario no encontrado.");
    }

    // Impedir eliminar a otros administradores
    if (usuario.rol === "ADMIN") {
        throw fallo(400, "No puedes eliminar a otro administrador.");
    }

    // Eliminar mensajes relacionados y después el usuario
    await prisma.$transaction(async (tx) => {
        await tx.mensaje.deleteMany({
            where: { emisorId: id }
        });

        await tx.mensaje.updateMany({
            where: { receptorId: id },
            data: { receptorId: null }
        });

        await tx.usuario.delete({
            where: { id }
        });
    });

    res.json({
        mensaje: "Usuario eliminado correctamente."
    });
});
// FOTO: el administrador la sube para el usuario indicado.

app.post(
  "/api/usuarios/:id/foto",
  soloAdmin,
  upload.single("foto"),
  async (req, res) => {
    const id = idPositivo(req.params.id);

    const usuario = await prisma.usuario.findUnique({
      where: { id }
    });

    if (!usuario) {
      throw fallo(404, "Usuario no encontrado.");
    }

    if (!req.file) {
      throw fallo(400, "Debes enviar el archivo en el campo foto.");
    }

    let imagen;

    try {
      imagen = await sharp(req.file.buffer, {
        limitInputPixels: 20000000
      })
        .rotate()
        .resize({
          width: 800,
          height: 800,
          fit: "inside",
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw fallo(
        400,
        "El archivo no es una imagen válida o es demasiado grande."
      );
    }

    const nombreArchivo = `${randomUUID()}.jpg`;
    const ruta = path.join(UPLOADS, nombreArchivo);

    await fs.writeFile(ruta, imagen);

    let actualizado;

    try {
      actualizado = await prisma.usuario.update({
        where: { id },
        data: { foto: nombreArchivo },
        select: usuarioPublico
      });
    } catch (error) {
      await fs.unlink(ruta).catch(() => {});
      throw error;
    }

    if (usuario.foto) {
      await fs
        .unlink(path.join(UPLOADS, usuario.foto))
        .catch(() => {});
    }

    res.json(actualizado);
  }
);

// La foto también requiere autenticación.

app.get("/api/usuarios/:id/foto", async (req, res) => {
  const id = idPositivo(req.params.id);

  const usuario = await prisma.usuario.findUnique({
    where: { id }
  });

  if (!usuario) {
    throw fallo(404, "Usuario no encontrado.");
  }

  const permitido =
    req.usuario.rol === "ADMIN" ||
    (
      usuario.activo &&
      usuario.grupoId === req.usuario.grupoId
    );

  if (!permitido) {
    throw fallo(403, "No puedes consultar esta foto.");
  }

  if (!usuario.foto) {
    throw fallo(404, "El usuario no tiene foto.");
  }

  res.set("Cache-Control", "no-store");

  res.sendFile(
    path.join(UPLOADS, usuario.foto),
    (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({
          error: "Archivo de foto no encontrado."
        });
      }
    }
  );
});


// MENSAJES DEL GRUPO

// Enviar mensaje al grupo del usuario conectado
app.post("/api/mensajes", async (req, res) => {
    const contenido = texto(
        req.body?.contenido,
        "contenido",
        2000
    );

    const mensaje = await prisma.mensaje.create({
        data: {
            contenido,
            emisorId: req.usuario.id,
            grupoId: req.usuario.grupoId
        },
        include: {
            emisor: {
                select: participantePublico
            }
        }
    });

    res.status(201).json(mensaje);
});


// Obtener los mensajes del grupo del usuario conectado
app.get("/api/mensajes", async (req, res) => {
    const mensajes = await prisma.mensaje.findMany({
        where: {
            grupoId: req.usuario.grupoId
        },
        include: {
            emisor: {
                select: participantePublico
            }
        },
        orderBy: [
            { creadoEn: "asc" },
            { id: "asc" }
        ],
        take: 200
    });

    res.json(mensajes);
});


// RUTAS NO ENCONTRADAS

// PÁGINAS PUG

// Mostrar formulario de registro y cargar grupos desde PostgreSQL
app.get('/registro', async (req, res, next) => {
    try {
        const grupos = await prisma.grupo.findMany({
            orderBy: {
                id: 'asc'
            }
        });

        res.render('registro', {
            title: 'Crear una cuenta',
            grupos: grupos
        });

    } catch (error) {
        console.error('Error al cargar los grupos:', error);
        next(error);
    }
});

// Página principal
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Página de login
app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Iniciar sesión'
    });
});
// pagina de mensajes
app.get("/mensajes", (req, res) => {
    res.render("mensajes", { title: "Mensajes" });
});

// RUTAS NO ENCONTRADAS
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada.'
    });
});


// GESTIÓN CENTRALIZADA DE ERRORES

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: "Subida no válida. Envía una sola foto de hasta 2 MB."
    });
  }

  if (error.code === "P2002") {
    return res.status(409).json({
      error: "Ya existe un registro con ese email o nombre único."
    });
  }

  if (error.code === "P2003") {
    return res.status(409).json({
      error: "La operación entra en conflicto con registros relacionados."
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({
      error: "Registro no encontrado."
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "El cuerpo JSON no es válido."
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: "El cuerpo de la petición es demasiado grande."
    });
  }

  const status = error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error: status >= 500
      ? "Error interno del servidor."
      : error.message
  });
});

// ARRANQUE


async function iniciar() {
  await fs.mkdir(UPLOADS, { recursive: true });
  await prisma.$connect();

  // CREAR GRUPOS INICIALES AUTOMÁTICAMENTE
  const nombresGrupos = [
    "Orden de los Cefalópodos Cuánticos",
    "República Autónoma del Calcetín Perdido",
    "Hermandad del Pepinillo Cósmico",
    "Consejo Supremo de las Patatas Interdimensionales"
  ];

  for (const nombre of nombresGrupos) {
    await prisma.grupo.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
  }

  console.log("Grupos iniciales comprobados correctamente.");

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`API disponible en http://localhost:${PORT}`);
  });
}

iniciar().catch(async (error) => {
  console.error("No se pudo iniciar el servidor:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
