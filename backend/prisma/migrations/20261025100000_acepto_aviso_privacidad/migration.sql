-- Aceptación del aviso de privacidad (25-oct-2026).
--
-- Aditiva: las cuentas existentes quedan con versión vacía para que la
-- aceptación se pueda pedir de forma explícita cuando corresponda.

ALTER TABLE "USUARIO"
  ADD COLUMN "acepto_aviso_version" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "acepto_aviso_en" TIMESTAMP(3);
