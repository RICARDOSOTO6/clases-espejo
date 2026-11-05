-- La CACE puede apagar el QR mientras no tenga autorización para publicarlo.
-- El folio impreso sigue siendo suficiente para verificar.
ALTER TABLE "CONFIGURACION_CACE"
  ADD COLUMN "certificados_qr_habilitado" BOOLEAN NOT NULL DEFAULT false;

-- Copia histórica de las instituciones que participaban al emitir el
-- certificado. Evita que un cambio posterior de nombre o logo altere un
-- documento ya emitido.
ALTER TABLE "CERTIFICADO"
  ADD COLUMN "instituciones_snapshot" JSONB;
