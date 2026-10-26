-- Invitación de agente fundador creada por la presidencia (25-oct-2026).
-- Solo enlace: no guarda correo ni institución; el cuestionario las completa.

CREATE TABLE "INVITACION_AGENTE" (
  "id" SERIAL NOT NULL,
  "creada_por_usuario_id" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "expiracion" TIMESTAMP(3) NOT NULL,
  "usada_en" TIMESTAMP(3),
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "INVITACION_AGENTE_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "INVITACION_AGENTE_token_key"
  ON "INVITACION_AGENTE"("token");
CREATE INDEX "INVITACION_AGENTE_creada_por_usuario_id_idx"
  ON "INVITACION_AGENTE"("creada_por_usuario_id");

ALTER TABLE "INVITACION_AGENTE"
  ADD CONSTRAINT "INVITACION_AGENTE_creada_por_usuario_id_fkey"
  FOREIGN KEY ("creada_por_usuario_id") REFERENCES "USUARIO"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
