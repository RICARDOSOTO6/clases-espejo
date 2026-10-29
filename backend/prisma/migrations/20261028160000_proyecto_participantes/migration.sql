-- Participantes por proyecto: base para clases con más de dos instituciones
-- y para observadoras de solo lectura después del cierre.

CREATE TABLE "PROYECTO_PARTICIPANTE" (
    "id" SERIAL NOT NULL,
    "proyecto_id" INTEGER NOT NULL,
    "institucion_id" INTEGER NOT NULL,
    "docente_institucion_id" INTEGER,
    "rol" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "congelado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROYECTO_PARTICIPANTE_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proyecto_participante_institucion_unica"
    ON "PROYECTO_PARTICIPANTE"("proyecto_id", "institucion_id");

CREATE INDEX "PROYECTO_PARTICIPANTE_institucion_id_idx"
    ON "PROYECTO_PARTICIPANTE"("institucion_id");

CREATE INDEX "PROYECTO_PARTICIPANTE_docente_institucion_id_idx"
    ON "PROYECTO_PARTICIPANTE"("docente_institucion_id");

CREATE INDEX "PROYECTO_PARTICIPANTE_proyecto_id_rol_estado_idx"
    ON "PROYECTO_PARTICIPANTE"("proyecto_id", "rol", "estado");

ALTER TABLE "PROYECTO_PARTICIPANTE"
    ADD CONSTRAINT "PROYECTO_PARTICIPANTE_proyecto_id_fkey"
    FOREIGN KEY ("proyecto_id") REFERENCES "PROYECTO_CLASE_ESPEJO"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PROYECTO_PARTICIPANTE"
    ADD CONSTRAINT "PROYECTO_PARTICIPANTE_institucion_id_fkey"
    FOREIGN KEY ("institucion_id") REFERENCES "INSTITUCION"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PROYECTO_PARTICIPANTE"
    ADD CONSTRAINT "PROYECTO_PARTICIPANTE_docente_institucion_id_fkey"
    FOREIGN KEY ("docente_institucion_id") REFERENCES "DOCENTE_INSTITUCION"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Las clases que ya existen se conservan como dos participantes aprobadas.
-- Se toma la institución de cada docente del proyecto; si dos docentes de la
-- misma institución coinciden, la restricción única deja una sola fila.
INSERT INTO "PROYECTO_PARTICIPANTE" (
    "proyecto_id",
    "institucion_id",
    "docente_institucion_id",
    "rol",
    "estado"
)
SELECT DISTINCT
    pd."proyecto_id",
    di."institucion_id",
    di."id",
    CASE pd."rol"
        WHEN 'ORIGEN' THEN 'ORIGEN'
        WHEN 'DESTINO' THEN 'DESTINO'
        ELSE 'COLABORADORA'
    END,
    'APROBADA'
FROM "PROYECTO_DOCENTE" pd
JOIN "ASIGNACION_DOCENTE" ad ON ad."id" = pd."asignacion_docente_id"
JOIN "DOCENTE_INSTITUCION" di ON di."id" = ad."docente_institucion_id"
ON CONFLICT ("proyecto_id", "institucion_id") DO NOTHING;
