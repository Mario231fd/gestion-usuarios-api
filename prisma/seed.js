const bcrypt = require("bcryptjs");
const prisma = require("../src/db");

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error(
      "Configura ADMIN_EMAIL y ADMIN_PASSWORD de al menos 12 caracteres."
    );
  }
  // Crear los 4 grupos iniciales
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

  console.log("Grupos iniciales creados correctamente.");
  const grupo = await prisma.grupo.upsert({
    where: { nombre: "Administración" },
    update: {},
    create: { nombre: "Administración" }
  });

  const existente = await prisma.usuario.findUnique({
    where: { email }
  });

  if (existente) {
    console.log("La cuenta inicial ya existe. No se ha modificado.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.usuario.create({
    data: {
      nombre: "Administrador",
      apellidos: "Inicial",
      email:"admin@local.test",
      passwordHash,
      rol: "ADMIN",
      grupoId: grupo.id
    }
  });

  console.log("Administrador creado:", email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });