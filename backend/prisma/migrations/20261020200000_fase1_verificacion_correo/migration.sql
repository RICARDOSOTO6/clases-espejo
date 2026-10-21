-- Fase 1: verificación de correo al registrarse y en los cambios de correo.
--
-- Todo es aditivo. Las cuentas que ya existían quedan con `correo_verificado`
-- en verdadero (no se deja fuera a nadie de la demo); los registros nuevos lo
-- ponen en falso hasta abrir el enlace del correo.

ALTER TABLE "USUARIO"
  ADD COLUMN "correo_verificado" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "VERIFICACION_CORREO" (
  "id" SERIAL NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "correo" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expira" TIMESTAMP(3) NOT NULL,
  "usado_en" TIMESTAMP(3),
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VERIFICACION_CORREO_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VERIFICACION_CORREO_token_hash_key"
  ON "VERIFICACION_CORREO"("token_hash");

CREATE INDEX "VERIFICACION_CORREO_usuario_id_idx"
  ON "VERIFICACION_CORREO"("usuario_id");

CREATE INDEX "VERIFICACION_CORREO_correo_idx"
  ON "VERIFICACION_CORREO"("correo");

ALTER TABLE "VERIFICACION_CORREO"
  ADD CONSTRAINT "VERIFICACION_CORREO_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "USUARIO"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
