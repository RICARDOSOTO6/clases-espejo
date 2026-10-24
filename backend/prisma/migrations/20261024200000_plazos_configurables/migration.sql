-- Plazos configurables por la presidencia (24-oct-2026).
--
-- Aditiva: las filas existentes reciben los valores acordados (8 días para
-- proponer y 7 para revisar). No se modifica ningún otro dato.

ALTER TABLE "CONFIGURACION_CACE"
  ADD COLUMN "dias_minimos_propuesta" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "dias_revision" INTEGER NOT NULL DEFAULT 7;
