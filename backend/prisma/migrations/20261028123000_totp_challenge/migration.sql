-- Reto temporal de login TOTP de un solo uso (28-oct-2026).
ALTER TABLE "USUARIO"
  ADD COLUMN "totp_challenge_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "totp_challenge_expira" TIMESTAMP(3);
