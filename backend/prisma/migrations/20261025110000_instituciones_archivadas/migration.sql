-- Baja con historial (25-oct-2026).
--
-- Una institución rechazada que ya participó en clases no se borra: pasa a
-- ARCHIVADA, deja de operar y conserva todo su historial. Las columnas guardan
-- quién la dio de baja, cuándo y por qué.

ALTER TABLE "INSTITUCION"
  ADD COLUMN "archivada_en" TIMESTAMP(3),
  ADD COLUMN "archivada_por_usuario_id" INTEGER,
  ADD COLUMN "motivo_archivo" TEXT NOT NULL DEFAULT '';
