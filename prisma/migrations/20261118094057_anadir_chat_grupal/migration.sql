-- AlterTable
ALTER TABLE "Mensaje" ADD COLUMN     "grupoId" INTEGER,
ALTER COLUMN "receptorId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Mensaje_grupoId_creadoEn_idx" ON "Mensaje"("grupoId", "creadoEn");

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
