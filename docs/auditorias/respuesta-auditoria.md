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

---

# Tercera revisión (código + diseño)

Detalle del informe: [`auditoria-v3-y-analisis-de-diseno.md`](./auditoria-v3-y-analisis-de-diseno.md).
Se corrigió todo lo que el informe marcó como **problema**.

## Críticos

| # | Problema | Resolución |
| --- | --- | --- |
| C1 | `passwordHash` viajaba en casi todas las respuestas | `PrismaClient` con `omit: { usuario: { passwordHash: true } }`; el login lo pide con `omit: { passwordHash: false }` porque lo necesita para comparar. |
| C2 | Evidencias sin filtrar el tipo y `/uploads` público (XSS almacenado + robo del JWT) | Lista blanca de extensiones (`.html`/`.svg`/`.js` rechazados), guard que autoriza **antes** de que se escriba el archivo, y `/uploads` con `Content-Disposition: attachment`, `nosniff` y CSP. |

## Importantes

| # | Problema | Resolución |
| --- | --- | --- |
| I1 | `quitarDocente` daba 500 con participaciones o mensajes | Se cuentan las tres dependencias y se responde 400 explicativo. |
| I2 | Editar el reporte de clase no invalidaba las firmas | Si el contenido cambia, se limpian los `confirmadoEn` y vuelve a `BORRADOR` (en transacción). |
| I3 | Una sesión `CANCELADA` hacía imposible cerrar el proyecto | El cierre excluye las sesiones canceladas. |
| I4 | Editar una solicitud borraba la materia destino | La recarga conserva la selección y solo la limpia si ya no pertenece a la institución. |
| I5 | El chat hacía polling siempre y no frenaba ante errores | Sondeo solo con el chat abierto, cerrojo anti-solapamiento, tope de 5 fallos y error de envío visible en el modal. |
| I6 | `rolDeInstitucion()` caía a DESTINO si fallaba `obtenerMia()` | Se bloquea el alta sin institución conocida y se muestra el error. |
| I7 | Errores de carga silenciados → estados vacíos falsos | Los paneles avisan del error y ofrecen "Reintentar". |
| I8 | Modal sin foco inicial, sin `Escape`, sin trampa de foco e id fijo | `ModalComponent` con foco inicial, ciclo de tabulación, `Escape`, retorno del foco, id único y cierre por fondo desactivable. |
| I9 | El comentario de rechazo no se validaba en cliente | Se valida antes de enviar. |
| I10 | Si fallaba el correo, la invitación quedaba huérfana | Se compensa borrándola y se responde 503 con mensaje claro. |
| I11 | `JWT_SECRET` con valor por defecto hardcodeado | El arranque falla si falta o es demasiado corto. |
| I12 | Consumo de la invitación no atómico | `updateMany` condicionado dentro de la transacción. |

## Menores corregidos

| # | Resolución |
| --- | --- |
| m1 | Las dos etapas de revisión usan `updateMany` condicionado: el proyecto se crea una sola vez |
| m2 | `PrismaExceptionFilter` global (P2002→409, P2003→400, P2025→404) |
| m3 | Borrar una materia usada como destino comprueba también las solicitudes |
| m4 | Si cambia la institución destino y no se reenvía la materia, se limpia |
| m5 | `GET /auth/activate` sin token → 400 con mensaje claro |
| m6 | `GET /instituciones/:id/materias` valida que la institución esté activa y completa |
| m8 | CORS restringido a `FRONTEND_URL` y `localhost:4200` |
| m9 | `RateLimitGuard` (10 intentos/min por IP+correo) en login y activación |
| m10 | Los prefijos de la API se derivan del router (la lista conocida queda como red de seguridad) |
| m11 | Se unen todos los mensajes de validación |
| m12 | `role="alert"` en los 8 avisos de error que no lo tenían |
| m13 | Recargas por recurso: cada acción ya no recarga las seis fuentes |
| m16 | Las fechas se extraen en hora local (antes `toISOString()`, que es UTC) |
| m21 | `::file-selector-button` para el input de archivo en Firefox |

## Diseño

| Problema | Resolución |
| --- | --- |
| El botón "Cerrar" de los avisos era invisible (1.13:1) | Usa `btn-secondary`, con regla de seguridad `.alert .btn-outline` y botón "Reintentar". |
| El contador del chat era ilegible (1.47:1) | Fondo `--accent-deep` con texto blanco. |
| `[class.aprobada]` no tenía regla | Definida (azul de marca); `CANCELADO` usa `.cancelada` (gris neutro) en vez del rojo de rechazo. |
| Contrastes AA incumplidos | `--success` a `#0f6b41` (4.00→5.80), `--text-muted` a `#5b6675`, bordes de control con `--border-strong` (1.33→3.46) y foco con `outline` de 2 px. |
| `--secondary` era idéntico a `--accent` | Recupera un tono propio (teal `#0d7a6f`). |
| `.form-grid-actions` sin reglas | Fila con separación y botones de ancho automático. |
| Sombra con el azul anterior al rebrand | Corregida; ámbar unificado en `--warning-text`. |
| Objetivos táctiles pequeños | `min-height` en los botones de lista y padding en `.link-button`. |

## Pendiente

| # | Motivo |
| --- | --- |
| m7 (`@@unique` en asignaciones, vínculo docente-institución y materia) | Necesita una migración de base de datos; conviene hacerla con la base respaldada. |
| m14 (métodos O(n²) en plantilla → `computed()`) | Mejora de rendimiento, no un fallo funcional. |
| m15, m17, m18, m19, m20 | Menores de coherencia (señal sin usar, rol nulo, banner de registro, confirmación de contraseña y `API_URL` duplicada). |
| Propuestas de diseño (iconos, calendario, gráficos, stepper, tabs, toasts, skeletons) | Son mejoras sugeridas, no problemas. El **modo oscuro queda fuera por decisión del proyecto**. |

## Verificación

Probado contra una instancia propia en el puerto 3001 (sin tocar la del usuario): los hashes ya no
salen en ninguna respuesta; un `.html` se rechaza con 400 y un `.pdf` se acepta; el agente recibe 403
**antes** de que se escriba el archivo; quitar un docente con mensajes da 400 (antes 500); el
proyecto cierra con una sesión cancelada; el login aguanta 10 intentos y el 11.º responde 429; CORS
solo contesta al origen propio; y `/uploads` fuerza la descarga con `nosniff`. Los datos de prueba se
borraron y el proyecto #4 quedó como estaba.

> **El smoke test encontró un fallo que la auditoría no vio**: al omitir `passwordHash` en todo el
> cliente de Prisma, el **login dejó de funcionar** (nadie podía entrar). Corregido pidiendo el hash
> explícitamente solo en esa consulta.

