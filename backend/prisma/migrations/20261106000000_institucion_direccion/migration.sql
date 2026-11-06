-- La dirección física sustituye al correo institucional como dato obligatorio
-- del registro. El correo se conserva para las instituciones que ya lo tenían.
ALTER TABLE "INSTITUCION"
  ADD COLUMN "direccion" TEXT NOT NULL DEFAULT '';

ALTER TABLE "INSTITUCION"
  ALTER COLUMN "correo_institucional" SET DEFAULT '';
