const jwt = require("jsonwebtoken");
const prisma = require("./db");

async function autenticar(req, res, next) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Debes iniciar sesión."
    });
  }

  const token = authorization.slice(7);

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });
  } catch {
    return res.status(401).json({
      error: "Token inválido o caducado."
    });
  }

  const id = Number(payload.sub);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(401).json({ error: "Token inválido." });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        grupoId: true
      }
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({
        error: "La cuenta no está disponible."
      });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario.rol !== "ADMIN") {
    return res.status(403).json({
      error: "Operación reservada al administrador."
    });
  }

  next();
}

module.exports = { autenticar, soloAdmin };