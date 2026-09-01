-- AlterTable
ALTER TABLE "USUARIO" ALTER COLUMN "activo" SET DEFAULT true;

-- AlterTable
ALTER TABLE "USUARIO"
    ADD COLUMN "token_invitacion" TEXT,
    ADD COLUMN "token_expiracion" TIMESTAMP(3),
    ADD COLUMN "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "USUARIO_correo_key" ON "USUARIO"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "USUARIO_token_invitacion_key" ON "USUARIO"("token_invitacion");
