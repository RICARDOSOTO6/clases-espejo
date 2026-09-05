-- DropIndex
DROP INDEX "USUARIO_token_invitacion_key";

-- AlterTable
ALTER TABLE "USUARIO" DROP COLUMN "apellidos",
DROP COLUMN "token_expiracion",
DROP COLUMN "token_invitacion",
ADD COLUMN     "apellido_materno" TEXT NOT NULL,
ADD COLUMN     "apellido_paterno" TEXT NOT NULL,
ADD COLUMN     "dni" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "INVITACION" (
    "id" SERIAL NOT NULL,
    "correo" TEXT NOT NULL,
    "numero_empleado" TEXT NOT NULL,
    "institucion_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiracion" TIMESTAMP(3) NOT NULL,
    "usada_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "INVITACION_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "INVITACION_token_key" ON "INVITACION"("token");

-- CreateIndex
CREATE UNIQUE INDEX "USUARIO_dni_key" ON "USUARIO"("dni");

-- AddForeignKey
ALTER TABLE "INVITACION" ADD CONSTRAINT "INVITACION_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "INSTITUCION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
