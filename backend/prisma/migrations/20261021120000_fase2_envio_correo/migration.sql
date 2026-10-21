-- Fase 2: cola de correo. Todo aditivo: no toca ninguna tabla existente.
--
-- Cada fila es un correo pendiente de salir. Los endpoints de envío encolan y
-- responden con un `lote_id`; el worker periódico los manda y reintenta los
-- fallos con espera creciente. El adjunto puede ir por ruta (certificados, que
-- ya viven en disco) o en base64 (el .ics del calendario, muy pequeño).

CREATE TABLE "ENVIO_CORREO" (
  "id" SERIAL NOT NULL,
  "lote_id" TEXT NOT NULL,
  "solicitado_por_usuario_id" INTEGER NOT NULL,
  "destinatario" TEXT NOT NULL,
  "asunto" TEXT NOT NULL,
  "cuerpo_texto" TEXT NOT NULL,
  "cuerpo_html" TEXT NOT NULL,
  "adjunto_nombre" TEXT,
  "adjunto_ruta" TEXT,
  "adjunto_base64" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "proximo_intento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimo_error" TEXT NOT NULL DEFAULT '',
  "enviado_en" TIMESTAMP(3),
  "fallido_en" TIMESTAMP(3),
  "certificado_id" INTEGER,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ENVIO_CORREO_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ENVIO_CORREO_estado_proximo_intento_idx"
  ON "ENVIO_CORREO"("estado", "proximo_intento");

CREATE INDEX "ENVIO_CORREO_lote_id_idx"
  ON "ENVIO_CORREO"("lote_id");

CREATE INDEX "ENVIO_CORREO_solicitado_por_usuario_id_idx"
  ON "ENVIO_CORREO"("solicitado_por_usuario_id");

ALTER TABLE "ENVIO_CORREO"
  ADD CONSTRAINT "ENVIO_CORREO_solicitado_por_usuario_id_fkey"
  FOREIGN KEY ("solicitado_por_usuario_id") REFERENCES "USUARIO"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ENVIO_CORREO"
  ADD CONSTRAINT "ENVIO_CORREO_certificado_id_fkey"
  FOREIGN KEY ("certificado_id") REFERENCES "CERTIFICADO"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
