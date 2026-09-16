# Respuesta a la auditoría de QA

> Informe original: [`reporte-qa-clasesespejo.md`](./reporte-qa-clasesespejo.md).
> Los 12 hallazgos se comprobaron contra el código antes de corregirlos: todos eran válidos.

## Decisiones tomadas

Las tres preguntas que el informe dejaba abiertas (los documentos se contradecían):

| Pregunta | Decisión |
| --- | --- |
| ¿La revisión de solicitudes es en una o dos etapas? | **Dos etapas**: primero el agente de la institución de origen y, si aprueba, el de destino. Se implementó y el readme se alineó. |
| ¿Se implementa el rol de Administrador? | **No**: se retiró el actor de los casos de uso. |
| ¿Se reutiliza un usuario existente al invitar como docente? | **No**: la invitación se rechaza con un mensaje claro. |

## Hallazgos y resolución

| # | Gravedad | Hallazgo | Resolución |
| --- | --- | --- | --- |
| 1 | Crítico | "Desactivar docente" no desactivaba nada | El campo `DocenteInstitucion.activo` se comprueba **al iniciar sesión y en cada petición** (`JwtAuthGuard`): un docente desactivado recibe 401. |
| 2 | Crítico | Se podía cerrar el proyecto sin cumplir las reglas | `UpdateProyectoDto` solo admite *En planificación* / *En curso*; el paso a *Finalizado* queda reservado a `POST /proyectos/:id/cerrar`, que valida evaluación y reportes. Se quitó la opción del formulario. |
| 3 | Importante | Invitar a un correo existente dejaba un enlace inservible | Si ya existe una cuenta con ese correo, la invitación se rechaza (409) con un mensaje claro; también se avisa si hay una invitación pendiente. |
| 4 | Importante | Faltaba la doble revisión que describe el diagrama | Implementada: `PENDIENTE` → (origen) → `APROBADA_POR_ORIGEN` → (destino) → `APROBADA`. El proyecto se crea solo en la 2.ª aprobación y cada etapa queda en `REVISION_SOLICITUD`. |
| 5 | Importante | Borrar docentes, asignaciones o sesiones con datos relacionados daba error 500 | Antes de borrar se cuentan las dependencias y se devuelve un mensaje claro (docentes, asignaciones y sesiones con evidencias o reporte). |
| 6 | Menor | Las evidencias no se podían unir a una sesión | `POST /proyectos/:id/evidencias` acepta `sesionId` (validando que sea del proyecto) y la lista muestra la sesión. |
| 7 | Menor | Estados sin acotar y literales que no coincidían | Todos los estados viven en `backend/src/common/estados.ts`; `CreateSesionDto` los valida y se retiró la etiqueta muerta "Cancelada" del frontend (cancelar borra el registro). |
| 8 | Menor | El mensaje de login engañaba al invitado sin activar | Si el correo tiene una invitación pendiente se responde "revisa tu correo para activar tu cuenta". El resto de comprobaciones (contraseña, cuenta desactivada) se hacen después de validar la contraseña. |
| 9 | Sugerencia | Condición siempre verdadera al quitar un docente | Eliminada; se conserva la regla real (el proyecto mantiene al menos un docente). |
| 10 | Sugerencia | Vencimiento de la invitación duplicado | Una sola fuente: se usa la misma duración (`INVITATION_EXPIRES_IN`) para el token y para la fecha guardada. |
| 11 | Menor | Se podían seguir añadiendo cosas a un proyecto finalizado | Un proyecto cerrado (*Finalizado* o *Cancelado*) no admite cambios: sesiones, actividades, evidencias, evaluaciones, planificación, reportes de clase, datos y docentes. |
| 12 | Importante | No existe el rol de "Administrador del sistema" | Retirado de `docs/diagramas/casos_de_uso.md`. "Gestionar instituciones" se reasignó al agente (edita la suya) y se retiraron los dos casos no implementados; los `linkStyle` se reajustaron. |

## Sobre el caso "pide evidencias pero solo acepta texto"

No se reproduce: la sección de evidencias usa un `<input type="file">` real y el backend guarda el archivo (máx. 10 MB). Ya estaba corregido antes de la auditoría.

## Cómo volver a comprobarlo

```powershell
# Con el backend levantado:
# 1) Un docente desactivado pierde el acceso
#    PATCH /agentes/docentes/:id/estado { "activo": false }  → el login responde 401
# 2) El cierre no se puede forzar
#    PATCH /proyectos/:id { "estado": "FINALIZADO" }         → 400
# 3) Doble revisión
#    POST /solicitudes                                      → PENDIENTE
#    POST /solicitudes/:id/revisar  (agente origen)         → APROBADA_POR_ORIGEN
#    POST /solicitudes/:id/revisar  (agente destino)        → APROBADA + proyecto
```

---

# Segunda revisión (QA + experiencia de usuario)

La segunda revisión confirmó los 12 arreglos anteriores y añadió 3 problemas
funcionales y 6 de experiencia de usuario. Todos resueltos.

## Problemas nuevos

| # | Gravedad | Problema | Resolución |
| --- | --- | --- | --- |
| 1 | Importante | Una solicitud rechazada quedaba atascada: no se podía editar, cancelar ni reenviar | `PATCH /solicitudes/:id` acepta pendientes **y rechazadas**: al corregirla vuelve a *Pendiente* y reaparece en la bandeja del agente de origen. También se puede cancelar una rechazada (se borran sus revisiones, que antes provocaban un error 500). El panel del docente muestra "Corregir y reenviar" / "Descartar". |
| 2 | Menor | Se podía confirmar la planificación en un proyecto cerrado | `confirmarParticipacion` comprueba el estado del proyecto. |
| 3 | Menor | El chat seguía abierto tras el cierre | **Decidido: solo lectura.** Se conserva todo el historial, pero no se puede escribir; el panel lo indica. |

## Experiencia de usuario

| # | Problema | Resolución |
| --- | --- | --- |
| UX-1 | En un proyecto finalizado se seguían viendo los formularios | Todos los formularios (datos, planificación, sesiones, actividades, evidencias, reportes y evaluación) se ocultan cuando la clase está cerrada, con un aviso de "solo lectura". |
| UX-2 | El doble clic duplicaba sesiones, actividades o evidencias | Cada botón que guarda se desactiva mientras la petición está en curso y muestra "Agregando…", "Subiendo…", etc. |
| UX-3 | Un 401 (cuenta desactivada) dejaba la pantalla a medias | `authInterceptor` detecta el 401 (salvo en el login), cierra la sesión y redirige al login. |
| UX-4 | El panel del agente usaba `alert`/`confirm` del navegador | Se sustituyeron por avisos en tarjeta y un modal de confirmación propio, igual que en el resto de la aplicación (también en los paneles de docente y proyecto). |
| UX-5 | No se validaban las fechas | El proyecto rechaza una fecha de fin anterior al inicio; la solicitud rechaza una fecha propuesta en el pasado (backend y frontend). |
| UX-6 | El "Enlace virtual" aceptaba cualquier texto | Se valida como URL `http(s)://` en el backend (`@IsUrl`) y en el formulario, con un aviso bajo el campo. |

