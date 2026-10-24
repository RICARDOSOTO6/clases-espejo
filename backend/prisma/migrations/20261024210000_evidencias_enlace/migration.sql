-- Evidencias por enlace (24-oct-2026).
--
-- El archivo deja de ser obligatorio; una evidencia debe tener archivo o un
-- enlace de la lista blanca. La comprobación de la lista se hace en el
-- servicio; la base solo garantiza que no queden evidencias vacías.

ALTER TABLE "EVIDENCIA"
  ALTER COLUMN "archivo_url" DROP NOT NULL;

ALTER TABLE "EVIDENCIA"
  ADD COLUMN "enlace_url" TEXT;

ALTER TABLE "EVIDENCIA"
  ADD CONSTRAINT "EVIDENCIA_archivo_o_enlace_check"
  CHECK ("archivo_url" IS NOT NULL OR "enlace_url" IS NOT NULL);
