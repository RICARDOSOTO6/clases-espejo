# 🔗 Trazabilidad: función → implementación → comprobación

Para cada función principal: **dónde está implementada**, con **qué endpoint**,
en **qué pantalla** se usa y **cómo se comprueba** hoy.

> **No existe una lista oficial de requisitos `RF-xx` en el repositorio.** Se
> buscó el patrón `RF-\d`, `RF\d\d` y «requisitos funcionales» en todos los
> `.md`, `.ts`, `.js` y `.html` del proyecto (excluyendo `node_modules`, `dist` y
> el cliente generado): **cero coincidencias**. Los únicos inventarios de
> funciones son `docs/README.md` (objetivos, roles y endpoints), los diagramas de
> `docs/producto/diagramas/` y `docs/producto/plan-de-accion.md`. Por eso esta
> tabla se organiza **por funciones**, y no por números de requisito. Si aparece
> una lista `RF-xx` (por ejemplo en la tesis), habrá que añadir su columna.

**Claves de la columna «Cómo se comprueba»**

| Clave | Qué es |
| --- | --- |
| `NAV` | `backend/scripts/verificar-navegador.js` — medida real del DOM en Chrome (CDP). |
| `EDIT` | `backend/scripts/probar-editor-certificado.js` — maneja el editor de la plantilla. |
| `DIS` | `backend/scripts/revisar-diseno-certificado.js` — mide el rediseño de la pantalla del certificado. |
| `CON` | `contraste-certificado.py` — contraste WCAG 2.1 de los tokens de color (25 pares × 4 temas). |
| `FLUJO` | `backend/scripts/verificar-flujo.js` — traza en la **base** un proyecto `FINALIZADO` (no es API). |
| `API–V4` | `docs/auditorias/respuesta-auditoria-v4.md` §4: pruebas de API con resultado. |
| `API–3` | `docs/auditorias/respuesta-auditoria.md` §«Verificación»: humo real contra el puerto 3001. |
| `INF10` | `docs/informes/informe-de-actividades.md` §10: 11 verificaciones con comando y resultado. |
| `AUD` | Hallazgo de auditoría que cubrió esa parte (documentos de `docs/auditorias/`). |
| `SEC` | Está descrito paso a paso en `diagrama_de_secuencias.md` (**documentado**, no ejecutado). |
| `N/V` | **No verificado**: no hay prueba automatizada ni constancia de una manual. |

---

## 1. Acceso, registro y aprobación de instituciones

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Registro del agente (buscar antes de crear) | `auth/auth.service.ts`, `instituciones/instituciones.service.ts` (`directorio`) | `POST /auth/register` · `GET /instituciones/directorio` | `/register` | `SEC` (fases 1 y 1b del diagrama de secuencias). **Sin prueba automatizada** del alta. |
| Unirse a una institución existente / crear una nueva | `auth/auth.service.ts` | `POST /auth/register` | `/register` | `SEC`. `N/V` del alta (no hay prueba automatizada ni manual registrada). |
| Institución rechazada o vetada no admite agentes nuevos | `auth/auth.service.ts`, `common/institucion-habilitada.ts` | `POST /auth/register` | `/register` | `SEC` y la decisión acordada en `plan-de-accion.md`. `N/V` en runtime. |
| Completar los datos de la institución (gate) | `instituciones/instituciones.service.ts` | `PATCH /instituciones/mia` · `POST/DELETE /instituciones/mia/logo` | `/agente` → «Mi institución» | `NAV` (el panel del agente se dibuja y su menú está completo). El guardado **no** se prueba. |
| Confirmación del alta de un agente | `agentes/agentes.service.ts` | `GET /agentes/confirmaciones` · `POST /agentes/confirmaciones/:id/confirmar` · `/rechazar` | `/agente` → «Confirmaciones de alta» | `SEC` (fase 1b). `N/V` en runtime. |
| Decisión de la presidencia (aprobar, rechazar, vetar, reactivar) | `cace/instituciones-cace.service.ts` | `GET /cace/instituciones` · `POST /cace/instituciones/:id/aprobar` · `/rechazar` · `/vetar` · `/reactivar` | `/cace` → «Instituciones» | `NAV` comprueba que la **campana avisa de las instituciones por aprobar** y que la sección **lista las 2 sembradas**; el flujo de decidir **no** está automatizado. `SEC` (fase 4). |
| Aviso por correo de la decisión | `cace/instituciones-cace.service.ts` (`avisarPorCorreo`) + `mail/mail.service.ts` | — | — | `N/V` (no hay envío verificado de extremo a extremo). |
| Aviso de posible duplicado | `cace/instituciones-cace.service.ts` (`seParecen`, `nombreSignificativo`) | `GET /cace/instituciones` | `/cace` → «Instituciones» | `N/V` (solo lectura del código). |
| Borrado definitivo (directo o autorizado) | `cace/instituciones-cace.service.ts` (`eliminar`) · `cace/solicitudes-borrado.service.ts` | `DELETE /cace/instituciones/:id` · `POST /cace/instituciones/:id/solicitud-borrado` · `PATCH /cace/solicitudes-borrado/:id` | `/cace` → «Instituciones» y «Solicitudes de borrado» | `SEC` (fase 4b). `N/V` en runtime. |

---

## 2. Invitación y activación de docentes

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Invitar a un docente | `agentes/agentes.service.ts` + `mail/mail.service.ts` | `POST /agentes/invitar-docente` | `/agente` → «Docentes» | `SEC` (fase 2). `INF10` §10.1 nº 11: **13 casos de la URL pública del enlace** (túnel, proxy, `Origin`, host manipulado). |
| Listar, activar, desactivar y eliminar docentes | `agentes/agentes.service.ts` | `GET /agentes/docentes` · `PATCH /agentes/docentes/:id/estado` · `DELETE /agentes/docentes/:id` · `GET /agentes/docentes/:id/historial` | `/agente` → «Docentes» | `API–3`: un docente **desactivado pierde el acceso** (el login responde 401) y quitar un docente con mensajes da **400** (antes 500). |
| Activar la cuenta por invitación | `auth/auth.service.ts` (`validarTokenInvitacion`, `activarCuenta`) | `GET /auth/activate` · `POST /auth/activate` | `/activate` | `SEC` (fase 3). `API–3`: el login aguanta 10 intentos y el 11.º responde 429. `AUD` (QA 1 nº 3 y QA 4 §3: invitación de un solo uso y atómica). |
| Materias y asignaciones docente ↔ materia (de apoyo a todo lo demás) | `materias/materias.service.ts`, `asignaciones/asignaciones.service.ts` | `GET/POST/PATCH/DELETE /materias` · `GET/POST/DELETE /asignaciones` · `GET /asignaciones/mias` | `/agente` → «Materias» y «Asignaciones» | `NAV` (panel y menú del agente). El CRUD **no** está automatizado. |

---

## 3. Propuesta y aceptación de una clase espejo (doble revisión)

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Crear, editar y cancelar la solicitud | `solicitudes/solicitudes.service.ts` | `POST /solicitudes` · `GET /solicitudes/mias` · `PATCH /solicitudes/:id` · `DELETE /solicitudes/:id` | `/docente` → «Nueva solicitud» y «Mis solicitudes» | `API–V4` §4 nº 4: **antelación mínima** (400 con −1, 0 y +3 días; acepta desde +7). `API–V4` §4 nº 2: la fecha propuesta se guarda igual a la enviada. |
| Doble revisión (origen y destino) | `solicitudes/solicitudes.service.ts` (`revisar`) | `GET /solicitudes/entrantes` · `POST /solicitudes/:id/revisar` | `/agente` → «Solicitudes» | `API–3`: la secuencia completa `PENDIENTE` → `APROBADA_POR_ORIGEN` → `APROBADA` + proyecto. `AUD` (QA 1, hallazgo de la doble revisión) y `API–V4` §4 nº 3 (límite de revisión). |
| Caducidad automática | `solicitudes/solicitudes.service.ts`, `common/plazos.ts`, `recordatorios/recordatorios.scheduler.ts` | (trabajo programado) | — | `API–V4` §4 nº 3. `AUD` (QA 4: una solicitud nacía caducada con poca antelación). |
| Motivo del rechazo visible para el docente | `solicitudes/solicitudes.service.ts` | `GET /solicitudes/mias` | `/docente` → «Mis solicitudes» | `AUD` (QA 4, hallazgo del motivo invisible). `N/V` en pantalla. |
| Recordatorios y agenda (de apoyo) | `recordatorios/recordatorios.service.ts` | `GET /recordatorios` | Campana y calendario, en los tres paneles | `INF10` §10.1 nº 9: `GET /recordatorios` con datos reales (resumen, plazos, clases y tareas). `NAV` comprueba la campana de la CACE. |

---

## 4. Proyecto, planificación y ejecución

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Creación del proyecto al aprobar el destino | `solicitudes/solicitudes.service.ts` | `POST /solicitudes/:id/revisar` | — | `API–3` (la secuencia termina en «+ proyecto») y `API–V4` §4 nº 10 corregido: la aprobación es **atómica** con la creación del proyecto. |
| Datos del proyecto y docentes participantes | `proyectos/proyectos.service.ts` | `GET /proyectos/mios` · `GET /proyectos/institucion` · `GET/PATCH /proyectos/:id` · `POST /proyectos/:id/docentes` · `DELETE /proyectos/:id/docentes/:proyectoDocenteId` | `/proyectos/:id` → «Datos» y «Docentes» | `NAV`: la pantalla carga y **las dos columnas están equilibradas** (diferencia ≤ 150 px) y ninguna tarjeta desborda. |
| Planificación conjunta y confirmación de cada docente | `proyectos/proyectos.service.ts` | `PUT /proyectos/:id/planificacion` · `POST /proyectos/:id/planificacion/confirmar` · `GET/POST /proyectos/:id/reportes` | `/proyectos/:id` → «Planificación» | `FLUJO`: imprime el estado de la planificación, los objetivos, los temas y el estatus de cada participación de un proyecto `FINALIZADO`. `AUD` (QA 4: la aprobación de la planificación quedaba autocertificada). |
| Chat del proyecto | `proyectos/proyectos.service.ts` | `GET/POST /proyectos/:id/mensajes` | `/proyectos/:id` → «Chat» | `AUD` (QA 2: se podía escribir después del cierre). `N/V` en runtime. |
| Sesiones | `proyectos/proyectos.service.ts` | `GET/POST /proyectos/:id/sesiones` · `PATCH/DELETE /proyectos/:id/sesiones/:sesionId` | `/proyectos/:id` → «Sesiones» | `NAV`: la tarjeta de sesiones y su lista **no desbordan** y ningún botón se sale de la tarjeta. `FLUJO`: recorre las sesiones de un proyecto terminado. |
| Actividades | `proyectos/proyectos.service.ts` | `GET/POST /proyectos/:id/actividades` · `PATCH/DELETE /proyectos/:id/actividades/:actividadId` | `/proyectos/:id` → «Actividades» | `FLUJO`: lista las actividades con su fecha límite. |
| Evidencias | `proyectos/proyectos.service.ts` | `GET/POST /proyectos/:id/evidencias` | `/proyectos/:id` → «Evidencias» | `API–3`: se rechaza un `.html` con **400**, se acepta un `.pdf`, el agente recibe **403 antes** de escribir en disco y `/uploads` fuerza la descarga con `nosniff`. `FLUJO`: lista las evidencias con su tipo y su ruta. |
| Reporte de clase por sesión y firmas | `proyectos/proyectos.service.ts` | `GET /proyectos/:id/reportes-clase` · `GET/PUT /proyectos/:id/sesiones/:sesionId/reporte` · `POST /proyectos/:id/reportes-clase/:reporteId/confirmar` | `/proyectos/:id` → «Sesiones» (reportes plegables) | `NAV`: los reportes **están plegados al entrar** y al abrirlos **se ve su contenido**; `FLUJO`: estado del reporte y **firmas/2** por sesión. `AUD` (QA 4: cambiar el contenido reinicia las firmas). |
| Evaluación final | `proyectos/proyectos.service.ts` | `GET/POST /proyectos/:id/evaluaciones` | `/proyectos/:id` → «Evaluación final» | `FLUJO`: lista los instrumentos, resultados y observaciones de un proyecto terminado. |

---

## 5. Cierre de la clase espejo

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Cerrar la clase (valida requisitos) | `proyectos/proyectos.service.ts` (`cerrarProyecto`) | `POST /proyectos/:id/cerrar` | `/proyectos/:id` → «Cierre» | `API–3`: **no se puede forzar** el cierre (`PATCH /proyectos/:id` con `FINALIZADO` → 400) y el proyecto cierra con una sesión cancelada. `FLUJO`: un proyecto `FINALIZADO` con todo consistente. `AUD` (QA 1 y QA 4: el cierre se validaba por conteos). |
| Resumen de la clase en PDF | `proyectos/resumen-pdf.service.ts` | `GET /proyectos/:id/resumen-pdf` | `/proyectos/:id` | `N/V` (no hay comprobación automatizada del PDF). |

---

## 6. Lista de alumnos

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Subir la lista (Excel, CSV o pegado) y previsualizarla | `proyectos/listas-alumnos.service.ts` | `POST /proyectos/:id/listas-alumnos/previsualizar` · `PUT /proyectos/:id/listas-alumnos` · `GET /proyectos/:id/listas-alumnos` | `/proyectos/:id` → «Alumnos» | Lectura del esquema: la lista es **única por (proyecto, institución)** (`@@unique`). `N/V` del parseo de Excel/CSV. |
| Incluir o excluir a un alumno | `proyectos/listas-alumnos.service.ts` | `PATCH/DELETE /proyectos/:id/listas-alumnos/alumnos/:alumnoId` | `/proyectos/:id` → «Alumnos» | `N/V`. Su efecto se ve en la emisión (`incluido`). |
| Plantilla descargable de la lista | `backend/plantillas/` servido por `main.ts` | `GET /plantillas/…` | `/proyectos/:id` → «Alumnos» | `NAV`: el botón **existe**, se ve sin pasar el cursor (> 40 × 20 px) y su **contraste ≥ 4,5:1**. |

---

## 7. Certificados y su verificación

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Diseñar y versionar la plantilla | `certificados/plantillas.service.ts` | `GET/POST /cace/certificados/plantilla` · `POST /cace/certificados/plantilla/fondo` · `PATCH /cace/certificados/plantilla/:id/activar` · `DELETE /cace/certificados/plantilla/:id` · `GET /cace/certificados/plantilla/qr` | `/cace/certificado` | `EDIT`: lienzo con **proporción A4 horizontal** (1,414 ± 0,06), ≥ 5 campos, **arrastrar** mueve el campo, **deshacer** lo devuelve, barra de herramientas completa y consola limpia. `DIS`: tres columnas, lienzo al 55–72 %, tres huecos con radio ≥ 4 px y borde ≥ 2 px, tabla de versiones. |
| Legibilidad del panel del certificado | `frontend/src/styles.css` (tokens) | — | `/cace/certificado` | `CON`: **25 pares** de color × **4 temas** con mínimo **4,5:1**. `DIS`: mesa gris, hoja con sombra, ayuda plegada, zoom y jerarquía de botones. |
| Emitir (uno o todos) con folio, PDF y hash | `certificados/certificados.service.ts` · `certificado-pdf.service.ts` | `POST /proyectos/:id/certificados/emitir` · `GET /proyectos/:id/certificados` | `/proyectos/:id` → «Certificados» | `N/V`: no hay prueba automatizada de la emisión. Lo verificado es la **pantalla del editor** (`EDIT`, `DIS`) y que las reglas están en el código. |
| Reemitir (anula el anterior) | `certificados/certificados.service.ts` (`emitir` + `reemitir`) | `POST /proyectos/:id/certificados/emitir` | `/proyectos/:id` → «Certificados» | `N/V`. |
| Descargar el PDF o el ZIP | `certificados/certificados.service.ts` | `GET /proyectos/:id/certificados/:certificadoId/pdf` · `GET /proyectos/:id/certificados/zip` | `/proyectos/:id` → «Certificados» | `AUD` (QA 3, crítico C2: `/uploads` público y sin filtrar el tipo) · lectura de `main.ts`: la ruta `/uploads/certificados/` responde **404** y el PDF solo se baja con sesión. `N/V` de la descarga real. |
| Enviar por correo al alumno | `certificados/certificados.service.ts` (`enviar`, `enviarUno`) + `mail/mail.service.ts` | `POST /proyectos/:id/certificados/enviar` · `POST /proyectos/:id/certificados/:certificadoId/enviar` | `/proyectos/:id` → «Certificados» | `N/V` (no hay envío de correo verificado, ni con adjunto). |
| Anular con motivo | `certificados/certificados.service.ts` (`anular`: con `proyectoId` lo llama el docente, sin él la presidencia) | `POST /proyectos/:id/certificados/:certificadoId/anular` · `POST /cace/certificados/:certificadoId/anular` | `/proyectos/:id` → «Certificados» y `/cace/certificado` | `SEC` (fase 6 del diagrama de secuencias). `N/V` en runtime. |
| Verificación pública por QR | `certificados/verificacion.service.ts` · `codigo-verificacion.ts` | `GET /verificar/:folio?c=<código>` | `/verificar/:folio` (sin sesión) | `SEC` (fase 7, con los cuatro desenlaces). **`N/V`: ninguna herramienta abre la página.** |

---

## 8. Identidad de la CACE y premios

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Personalizar la CACE (lema, descripción, logo, tema) | `cace/identidad-cace.service.ts`, `common/temas-cace.ts` | `GET/PATCH /cace/configuracion` · `POST/DELETE /cace/configuracion/logo` | `/cace/personalizacion` | `CON`: los temas del CSS llegan a 4,5:1. `N/V` del guardado. |
| Países de la comunidad | `cace/identidad-cace.service.ts` | `GET/POST /cace/paises` · `PATCH/DELETE /cace/paises/:id` | `/cace/personalizacion` → «Comunidad» | `N/V`. |
| Premios y reconocimientos | `cace/identidad-cace.service.ts` | `GET/POST /cace/premios` · `PATCH/DELETE /cace/premios/:id` · `POST/DELETE /cace/premios/:id/imagen` | `/cace` → «Premios» | `N/V`. |
| Lectura pública de la identidad y los premios | `cace/identidad-cace.service.ts` | `GET /cace/publico` · `GET /cace/premios-publicos` | Pantalla de acceso y «Comunidad» (agente, docente y CACE) | `NAV`: la pantalla de acceso **carga y se dibuja** (lo que incluye el lema, el logo y el tema). |

---

## 9. Secretarías y transmisión de la presidencia

| Función | Implementación | Endpoint | Pantalla | Cómo se comprueba |
| --- | --- | --- | --- | --- |
| Alta automática de la presidencia al arrancar | `cace/cace.service.ts` (`OnApplicationBootstrap`) + `mail/mail.service.ts` | — (ocurre al arrancar) | `/cace` (primer acceso pide cambiar la contraseña) | `N/V`: no hay prueba automatizada. `NAV` avisa si el presidente entra con contraseña provisional, y `SEC` describe el arranque. |
| Crear, activar y desactivar secretarías | `cace/miembros-cace.service.ts` | `GET/POST /cace/miembros` · `PATCH /cace/miembros/:id` | `/cace` → «Miembros de la CACE» | `N/V`. El reparto de permisos que lo sostiene sí está cubierto por `AUD` (QA 4, QA-30: no existía guardia de roles). |
| Transmitir la presidencia | `cace/presidencia-cace.service.ts` | `POST /cace/presidencia/cambiar` | `/cace` → «Presidencia» | `N/V` en runtime; el comportamiento está leído del código (transacción, suplente, `CAMBIO_PRESIDENCIA`). |
| Historial de cambios de presidencia | `cace/presidencia-cace.service.ts` | `GET /cace/presidencia/historial` | `/cace` → «Presidencia» | `N/V`. |
| Capacidades del usuario que está dentro | `cace/capacidades-cace.controller.ts`, `common/capacidades.ts` | `GET /cace/capacidades` | Todos los paneles (menúes que se esconden) | `AUD` (QA 4, QA-30) y `plan-de-accion.md` (fase 6: era el 403 de «Instituciones» para la secretaría). `N/V` en pantalla: no hay prueba de qué ve cada rol. |

---

## 10. Cierre del mapa: qué está cubierto y qué no

| Cobertura | Funciones |
| --- | --- |
| **Con verificación automatizada o prueba documentada con resultado** | Invitación (URL pública, 13 casos) · docentes (desactivación, borrado con dependencias) · solicitud (antelación, fecha, doble revisión, límite de revisión) · caducidad · proyecto (columnas y desbordes) · sesiones (desbordes) · evidencias (tipos y permisos) · reportes de clase (plegados y contenido) · cierre (no se puede forzar) · lista de alumnos (botón de la plantilla y contraste) · plantilla del certificado (editor y diseño) · contraseña provisional de la presidencia (aviso) · foto de perfil · recordatorios. |
| **Solo documentado (diagrama de secuencias), sin ejecución registrada** | Registro y aprobación de instituciones · confirmación del alta de agentes · activación de la cuenta del docente · anulación de certificados · verificación pública. |
| **Sin ninguna comprobación (ni automatizada ni documentada)** | Emisión y reemisión de certificados · envío de certificados por correo · descarga del PDF y del ZIP · resumen de la clase en PDF · guardado de la personalización, países y premios · altas y activación de secretarías · transmisión de la presidencia y su historial · avisos por correo en general. |

> **Lo que este documento no puede afirmar.** No hay una lista de requisitos
> numerados en el repositorio, así que la trazabilidad está hecha **por
> funciones** y no se puede demostrar que cada requisito del pliego esté cubierto:
> solo que cada función que el sistema **dice** tener está localizada en el código
> y tiene (o no) una comprobación asociada.
