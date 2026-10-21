-- Fase 1: recuperación de contraseña, bloqueo por intentos y cierre de sesiones.
--
-- Todo es aditivo: no se borra ni se transforma ningún dato existente.
--   * USUARIO gana tres columnas: intentos fallidos, bloqueo temporal y la
--     marca de "sesiones válidas desde" (los tokens anteriores dejan de valer
--     al cambiar la contraseña).
--   * RECUPERACION_PASSWORD guarda el **hash** del token del enlace, su
--     caducidad y si ya se usó (un solo uso).

ALTER TABLE "USUARIO"
  ADD COLUMN "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bloqueado_hasta" TIMESTAMP(3),
  ADD COLUMN "sesiones_validas_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "RECUPERACION_PASSWORD" (
  "id" SERIAL NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expira" TIMESTAMP(3) NOT NULL,
  "usado_en" TIMESTAMP(3),
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RECUPERACION_PASSWORD_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RECUPERACION_PASSWORD_token_hash_key"
  ON "RECUPERACION_PASSWORD"("token_hash");

CREATE INDEX "RECUPERACION_PASSWORD_usuario_id_idx"
  ON "RECUPERACION_PASSWORD"("usuario_id");

ALTER TABLE "RECUPERACION_PASSWORD"
  ADD CONSTRAINT "RECUPERACION_PASSWORD_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "USUARIO"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
