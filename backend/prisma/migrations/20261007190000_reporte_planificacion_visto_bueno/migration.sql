-- AlterTable
ALTER TABLE "public"."REPORTE_PLANIFICACION" DROP COLUMN "actividades_acordadas",
DROP COLUMN "acuerdos",
DROP COLUMN "calendario",
ADD COLUMN     "observaciones" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "visto_bueno" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "REPORTE_PLANIFICACION_planificacion_id_key" ON "public"."REPORTE_PLANIFICACION"("planificacion_id" ASC);
