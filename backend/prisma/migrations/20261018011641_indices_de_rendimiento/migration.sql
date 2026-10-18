-- CreateIndex
CREATE INDEX "ACTIVIDAD_proyecto_id_fecha_limite_idx" ON "ACTIVIDAD"("proyecto_id", "fecha_limite");

-- CreateIndex
CREATE INDEX "ACTIVIDAD_fecha_limite_idx" ON "ACTIVIDAD"("fecha_limite");

-- CreateIndex
CREATE INDEX "AGENTE_INTERNACIONALIZACION_institucion_id_idx" ON "AGENTE_INTERNACIONALIZACION"("institucion_id");

-- CreateIndex
CREATE INDEX "ALUMNO_lista_id_idx" ON "ALUMNO"("lista_id");

-- CreateIndex
CREATE INDEX "ASIGNACION_DOCENTE_docente_institucion_id_idx" ON "ASIGNACION_DOCENTE"("docente_institucion_id");

-- CreateIndex
CREATE INDEX "ASIGNACION_DOCENTE_materia_id_idx" ON "ASIGNACION_DOCENTE"("materia_id");

-- CreateIndex
CREATE INDEX "CERTIFICADO_proyecto_id_estado_idx" ON "CERTIFICADO"("proyecto_id", "estado");

-- CreateIndex
CREATE INDEX "CERTIFICADO_alumno_id_idx" ON "CERTIFICADO"("alumno_id");

-- CreateIndex
CREATE INDEX "CERTIFICADO_plantilla_id_idx" ON "CERTIFICADO"("plantilla_id");

-- CreateIndex
CREATE INDEX "DOCENTE_INSTITUCION_docente_id_idx" ON "DOCENTE_INSTITUCION"("docente_id");

-- CreateIndex
CREATE INDEX "DOCENTE_INSTITUCION_institucion_id_idx" ON "DOCENTE_INSTITUCION"("institucion_id");

-- CreateIndex
CREATE INDEX "EVALUACION_proyecto_id_idx" ON "EVALUACION"("proyecto_id");

-- CreateIndex
CREATE INDEX "EVIDENCIA_proyecto_id_idx" ON "EVIDENCIA"("proyecto_id");

-- CreateIndex
CREATE INDEX "EVIDENCIA_sesion_id_idx" ON "EVIDENCIA"("sesion_id");

-- CreateIndex
CREATE INDEX "INSTITUCION_estado_cace_idx" ON "INSTITUCION"("estado_cace");

-- CreateIndex
CREATE INDEX "INVITACION_institucion_id_idx" ON "INVITACION"("institucion_id");

-- CreateIndex
CREATE INDEX "INVITACION_correo_idx" ON "INVITACION"("correo");

-- CreateIndex
CREATE INDEX "LISTA_ALUMNOS_subida_por_usuario_id_idx" ON "LISTA_ALUMNOS"("subida_por_usuario_id");

-- CreateIndex
CREATE INDEX "MATERIA_institucion_id_idx" ON "MATERIA"("institucion_id");

-- CreateIndex
CREATE INDEX "MENSAJE_proyecto_id_creado_en_idx" ON "MENSAJE"("proyecto_id", "creado_en");

-- CreateIndex
CREATE INDEX "MENSAJE_proyecto_docente_id_idx" ON "MENSAJE"("proyecto_docente_id");

-- CreateIndex
CREATE INDEX "PARTICIPACION_PLANIFICACION_planificacion_id_idx" ON "PARTICIPACION_PLANIFICACION"("planificacion_id");

-- CreateIndex
CREATE INDEX "PARTICIPACION_PLANIFICACION_proyecto_docente_id_idx" ON "PARTICIPACION_PLANIFICACION"("proyecto_docente_id");

-- CreateIndex
CREATE INDEX "PARTICIPACION_REPORTE_reporte_clase_id_idx" ON "PARTICIPACION_REPORTE"("reporte_clase_id");

-- CreateIndex
CREATE INDEX "PARTICIPACION_REPORTE_proyecto_docente_id_idx" ON "PARTICIPACION_REPORTE"("proyecto_docente_id");

-- CreateIndex
CREATE INDEX "PREMIO_institucion_id_idx" ON "PREMIO"("institucion_id");

-- CreateIndex
CREATE INDEX "PREMIO_publicado_idx" ON "PREMIO"("publicado");

-- CreateIndex
CREATE INDEX "PROYECTO_CLASE_ESPEJO_estado_idx" ON "PROYECTO_CLASE_ESPEJO"("estado");

-- CreateIndex
CREATE INDEX "PROYECTO_DOCENTE_proyecto_id_idx" ON "PROYECTO_DOCENTE"("proyecto_id");

-- CreateIndex
CREATE INDEX "PROYECTO_DOCENTE_asignacion_docente_id_idx" ON "PROYECTO_DOCENTE"("asignacion_docente_id");

-- CreateIndex
CREATE INDEX "REVISION_SOLICITUD_solicitud_id_idx" ON "REVISION_SOLICITUD"("solicitud_id");

-- CreateIndex
CREATE INDEX "REVISION_SOLICITUD_agente_id_idx" ON "REVISION_SOLICITUD"("agente_id");

-- CreateIndex
CREATE INDEX "SESION_proyecto_id_fecha_hora_idx" ON "SESION"("proyecto_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "SESION_fecha_hora_idx" ON "SESION"("fecha_hora");

-- CreateIndex
CREATE INDEX "SOLICITUD_BORRADO_INSTITUCION_institucion_id_idx" ON "SOLICITUD_BORRADO_INSTITUCION"("institucion_id");

-- CreateIndex
CREATE INDEX "SOLICITUD_BORRADO_INSTITUCION_estado_idx" ON "SOLICITUD_BORRADO_INSTITUCION"("estado");

-- CreateIndex
CREATE INDEX "SOLICITUD_CLASE_ESPEJO_institucion_destino_id_estado_idx" ON "SOLICITUD_CLASE_ESPEJO"("institucion_destino_id", "estado");

-- CreateIndex
CREATE INDEX "SOLICITUD_CLASE_ESPEJO_asignacion_origen_id_idx" ON "SOLICITUD_CLASE_ESPEJO"("asignacion_origen_id");

-- CreateIndex
CREATE INDEX "SOLICITUD_CLASE_ESPEJO_asignacion_destino_id_idx" ON "SOLICITUD_CLASE_ESPEJO"("asignacion_destino_id");

-- CreateIndex
CREATE INDEX "SOLICITUD_CLASE_ESPEJO_materia_destino_id_idx" ON "SOLICITUD_CLASE_ESPEJO"("materia_destino_id");

-- CreateIndex
CREATE INDEX "SOLICITUD_CLASE_ESPEJO_fecha_propuesta_idx" ON "SOLICITUD_CLASE_ESPEJO"("fecha_propuesta");
