-- Declaración de consentimiento al cargar la lista de alumnos (25-oct-2026).
--
-- La lista contiene nombre, matrícula y correo de alumnos. Quien la guarda debe
-- declarar que cuenta con base legal o consentimiento; se guarda la versión y
-- el momento. Las listas anteriores quedan sin declaración (vacío/null).

ALTER TABLE "LISTA_ALUMNOS"
  ADD COLUMN "consentimiento_version" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "consentimiento_en" TIMESTAMP(3);
