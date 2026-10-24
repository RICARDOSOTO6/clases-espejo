-- Unicidad de negocio (24-oct-2026).
--
-- Antes de aplicar esta migración se comprobó que no hay duplicados en la base
-- de demostración ni en la de pruebas. Si en otra instalación los hay, el
-- CREATE UNIQUE INDEX falla y hay que resolverlos a mano: no se borra nada
-- automáticamente.
--
--   * DOCENTE_INSTITUCION: una fila por docente e institución.
--   * MATERIA: una clave por institución.
--   * ASIGNACION_DOCENTE: una asignación por docente, materia y periodo.

CREATE UNIQUE INDEX "docente_institucion_unico"
  ON "DOCENTE_INSTITUCION"("docente_id", "institucion_id");

CREATE UNIQUE INDEX "materia_institucion_clave_unica"
  ON "MATERIA"("institucion_id", "clave");

CREATE UNIQUE INDEX "asignacion_docente_periodo_unica"
  ON "ASIGNACION_DOCENTE"(
    "docente_institucion_id",
    "materia_id",
    "periodo_escolar"
  );
