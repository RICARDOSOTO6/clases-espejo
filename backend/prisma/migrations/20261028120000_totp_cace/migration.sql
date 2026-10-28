-- Segundo factor TOTP para las cuentas de la CACE (28-oct-2026).
-- El secreto se guarda mientras se configura y se exige solo cuando la cuenta
-- confirma el primer código. Las cuentas existentes quedan deshabilitadas.

ALTER TABLE "USUARIO"
  ADD COLUMN "totp_secret" TEXT,
  ADD COLUMN "totp_habilitado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totp_ultimo_paso" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totp_codigos_recuperacion" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "totp_confirmado_en" TIMESTAMP(3);
