-- AlterTable
ALTER TABLE "INSTITUCION" ADD COLUMN     "estado_cace" TEXT NOT NULL DEFAULT 'APROBADA',
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "motivo_cace" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "revisada_en" TIMESTAMP(3),
ADD COLUMN     "revisada_por_usuario_id" INTEGER;

-- AddForeignKey
ALTER TABLE "INSTITUCION" ADD CONSTRAINT "INSTITUCION_revisada_por_usuario_id_fkey" FOREIGN KEY ("revisada_por_usuario_id") REFERENCES "USUARIO"("id") ON DELETE SET NULL ON UPDATE CASCADE;
