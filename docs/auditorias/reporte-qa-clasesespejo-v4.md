# Auditoría de QA v4 — errores lógicos de flujo

**Proyecto:** ClasesEspejo (monorepo: `backend/` NestJS + Prisma + PostgreSQL, `frontend/` Angular, `docs/`)
**Fecha:** 2026-09-23 · **Commit auditado:** `63702a7` (`fix(catalogos): el tipo de documento es INE, no NIE`) · árbol de trabajo limpio
**Alcance:** 5.397 líneas TypeScript en `backend/src` (10 controladores, 62 endpoints, 26 DTO), 9.009 líneas en `frontend/src`, 26 modelos en `prisma/schema.prisma` y sus 12 migraciones, y los documentos de requisitos (`docs/diagramas/`, `docs/manual-de-usuario.md`, `docs/readme`, auditorías anteriores).
**Enfoque:** errores lógicos que rompen el flujo — permisos por tipo de usuario, contratos y tipos de datos, estados y transiciones, instrucciones confusas y casos borde. No se evalúa estética, rendimiento ni formato.

## Método y evidencia

| Comprobación | Cómo | Resultado |
|---|---|---|
| Estado del repositorio | `git log`, `git status --porcelain` | HEAD `63702a7`; sin cambios pendientes |
| Tipos reales de las columnas de fecha | `Select-String` sobre `backend/prisma/migrations/*/migration.sql` | `fecha_propuesta`, `fecha_inicio`, `fecha_fin`, `fecha_limite` son **`DATE`**; `fecha_hora` es `TIMESTAMP(3)` |
| Desfase de zona horaria | `node -e` con `TZ=America/Lima` sobre el instante que serializa el backend | `2026-03-15T00:00:00.000Z` → `getDate()` = **14** |
| Zona del entorno | `Get-TimeZone` | Central Standard Time (Mexico), UTC-6 (también negativa) |
| Frescura del build servido | mtimes de `backend/public` frente a `frontend/src` | Al día (14:42); `public/` está en `.gitignore` |
| Reproducción en runtime | **no ejecutada**: no se levantó la aplicación ni se atacó la API; tampoco se consultó la base viva (el cliente Prisma generado es TypeScript y la lectura directa no resolvió) | Todo hallazgo se apoya en código, DDL o simulación; los que dependen del despliegue van marcados como *no verificado* |

**No se modificó ningún archivo de código ni de datos.** Los hallazgos se obtuvieron con cinco auditorías paralelas (autorización, contratos, estados, frontend, vigencia de informes previos); **las afirmaciones de mayor impacto fueron verificadas una a una sobre el código antes de incluirlas aquí.**

---

# 1. Resumen ejecutivo

El proyecto está en un estado muy superior al que describen las auditorías anteriores: **12 de 12** hallazgos del primer informe, **9 de 9** del segundo y la mayor parte del tercero están corregidos. La **doble revisión** (origen → destino) existe y usa transiciones condicionales que impiden aprobar dos veces; la **autorización por pertenencia** es consistente en los 62 endpoints (no encontré ningún IDOR explotable sobre datos de terceros); el **JWT deja de servir** en cuanto se desactiva la cuenta; las invitaciones son de un solo uso y atómicas.

Lo que queda roto **no son permisos, sino fechas, atomicidad y reglas de cierre**:

1. **Todas las fechas de calendario se ven y se vuelven a guardar un día antes** (columnas `DATE` leídas como medianoche UTC e interpretadas con getters locales). Cada edición de una solicitud o del proyecto **resta un día al dato**.
2. **La aprobación del destino no es atómica con la creación del proyecto**: un fallo entre ambos pasos deja la solicitud `APROBADA` sin clase espejo y sin ninguna vía de recuperación por la API.
3. **Una solicitud propuesta con menos de ~8 días de antelación nace caducada**, y el plazo no se comprueba al aprobar: se puede aprobar fuera de plazo y crear un proyecto con fecha de inicio pasada.
4. **El motivo del rechazo nunca se muestra al docente**, aunque el agente está obligado a escribirlo y el manual promete verlo.
5. **El cierre se valida por conteos, no por conjuntos**: un acta confirmada de una sesión cancelada compensa a una sesión sin reporte, y se puede cerrar sin ninguna sesión.

| Severidad | Nº | Temas |
|---|---|---|
| 🔴 Crítico | 2 | Fechas `DATE` desfasadas (visualización + reescritura del dato) · aprobación no atómica |
| 🟠 Importante | 7 | Caducidad prematura y plazo no comprobado al aprobar · alta pública de agentes · evidencias sin autenticación · enlace de invitación manipulable · edición de una solicitud ya aprobada (TOCTOU) · cierre por conteos · motivo del rechazo invisible |
| 🟡 Menor | 19 | Estados y acciones que el usuario no puede alcanzar o que siempre fallan, avisos que no llegan, validaciones y límites desalineados, integridad del acta, restricciones solo en el cliente |
| 🟢 Sugerencia | 4 | Guardia de roles, higiene de contrato, endurecimiento de la base, mensajes del framework |

---

# 2. Hallazgos

## Área A — Fechas y datos

### QA-01 🔴 Las fechas de calendario se muestran y se reguardan un día antes

**Ubicación.** Esquema: `backend/prisma/schema.prisma:150` (`fechaPropuesta @db.Date`), `:184-185`, `:295` — confirmado en las migraciones (`"fecha_propuesta" DATE NOT NULL`). Cálculo del plazo: `backend/src/common/plazos.ts:17-21`, `:61-68`, `:71-75`. Lectura en cliente: `frontend/src/app/features/docente/docente.component.ts:547-553`, `agente.component.ts:995-1001`, `proyecto.component.ts:1051-1063`. Reescritura: `docente.component.ts:427` + `:459`; `proyecto.component.ts:377-378` + `:424-425`.

**Evidencia.** Prisma devuelve una columna `DATE` como `Date` en **medianoche UTC** y NestJS la serializa así: `"fechaPropuesta": "2026-03-15T00:00:00.000Z"`. El cliente la lee con getters locales, que en cualquier huso negativo dan el día anterior:

```
$ node -e "process.env.TZ='America/Lima'; const d=new Date('2026-03-15T00:00:00.000Z'); …"
getDate() local    : 14
clave local        : 2026-03-14
toLocaleDateString : 14/3/2026
```

El comentario que acompaña al código cree haber resuelto esto (`"Fecha local: toISOString() es UTC y el input mostraba otro día"`, `proyecto.component.ts:1061`), pero el problema no era `toISOString()`: el arreglo **solo es correcto para `fechaHora`** (columna `TIMESTAMP(3)`, instante real) y es incorrecto para las cuatro columnas `DATE`. La auditoría v3 dio este punto por corregido (`m16`) y no lo está.

**Impacto.** Todo usuario de América ve **un día menos** en la fecha propuesta de cada solicitud (tres listados), en inicio y fin de cada clase espejo y en la fecha límite de cada actividad. Y **el dato se degrada**: `openEditar()` rellena el formulario con la fecha desfasada y `submitSolicitud()` la envía, así que **cada guardado de una solicitud rechazada o caducada la adelanta un día**; lo mismo al guardar "Datos del proyecto". En servidor, `fechaLimiteRevision` parte de ese día desplazado, de modo que el plazo real es de ~8 días y el corte de caducidad queda desalineado respecto al instante almacenado.

**Reproducción.** Crear una solicitud para el 15/03/2027 → el listado muestra 14/03/2027 → pulsar "Editar" (el campo ya dice 14) → guardar → la solicitud queda en 14/03/2027.

**Corrección.** Una única función de fecha que trate las columnas `DATE` como texto (`fecha.slice(0,10)`) para mostrar y para rellenar los `<input type="date">`, y que en servidor calcule los plazos con los getters UTC (`getUTCFullYear/…`) para operar en el mismo marco que la columna. Un `FechaPipe` (ya propuesto en v3) y un test que compruebe `2026-03-15` → `2026-03-15` en un huso negativo.

### QA-02 🟠 Una solicitud con poca antelación nace caducada, y el plazo no se comprueba al aprobar

**Ubicación.** `backend/src/solicitudes/solicitudes.service.ts:40-94` (no exige antelación), `:145-154` (caducidad), `:295-328` (`revisar`, no reaprovecha el vencimiento); `backend/src/common/plazos.ts:71-75`; en cliente `docente.component.ts:446-451`.

**Evidencia.** `crear` solo comprueba que la fecha no sea pasada. `corteCaducidad()` es *hoy + 7 días* en medianoche local, mientras `fechaPropuesta` es medianoche UTC: una propuesta para dentro de 2 días, de 7 días o de 7 días y unas horas cumple `fechaPropuesta < corteCaducidad()` y el siguiente listado la marca `CADUCADA` (`listarMias:99`, `listarEntrantes:273`, `recordatorios.service.ts:79` y el planificador cada 30 min). Además, `revisar()` **no** ejecuta `caducarVencidas()`, pero sí rechaza el estado `CADUCADA` (`:312-316`): en la ventana de hasta 30 minutos en que el reaper todavía no pasó —o indefinidamente si el proceso está caído— el agente puede **aprobar una solicitud vencida** y el proyecto se crea con `fechaInicio` ya pasada (`:472-474`).

**Impacto.** El docente crea una propuesta válida para la interfaz ("una fecha futura") y la ve "Caducada" al recargar, sin que nadie pudiera responder; la explicación del manual ("Pasó el plazo sin que ninguna institución respondiera", `manual-de-usuario.md:660-661`) es falsa en ese caso. Y el reenvío de una caducada sin cambiar la fecha la devuelve a `PENDIENTE` (`:236`) para volver a caducar. En el otro extremo, se puede aprobar con el plazo vencido.

**Corrección.** Decidir la regla y aplicarla en la puerta de entrada: si se exige antelación, rechazar en `crear`/`actualizar` con fecha mínima = hoy + `REVISION_DIAS_ANTELACION` (y reflejarlo en el formulario); y comprobar el plazo también en `revisar` (una sola función de vencimiento compartida).

---

## Área B — Permisos y autorización

Veredicto: **no existe ningún caso en el que un tipo de usuario pueda ejecutar por API una acción de otro rol.** El rol efectivo se resuelve consultando la base (`getAgente`/`getDocente`) y la pertenencia por recurso (`verificarAcceso`, `obtenerPropia`, `exigirDocenteParticipante`, `DocenteParticipanteGuard`), no confiando en el token. Los hallazgos de esta área son de **entrada**, de **binarios** y de **alcance de la información**.

### QA-03 🟠 El alta de agentes es pública, sin invitación y sin límite de intentos

`backend/src/auth/auth.controller.ts:12-15` (sin `@UseGuards`), `auth.service.ts:38-90` (crea `AgenteInternacionalizacion` en `:75`). Es el **único** punto que crea agentes, y la acción más privilegiada del sistema no figura como caso de uso en `docs/diagramas/casos_de_uso.md` (aunque `docs/readme:631` la describe como "FASE 1" intencional). Cualquier persona obtiene un principal `AGENTE` con su institución; y como `correo` y `dni` son únicos, puede **ocupar la identidad** de quien una institución pretende invitar (la invitación legítima fallará después con 409, `agentes.service.ts:61-68`). No da acceso a datos de terceros. **Corrección:** o `RateLimitGuard` + verificación de correo + estado "pendiente de aprobación", o invitación emitida por un administrador.

### QA-04 🟠 Las evidencias se sirven sin autenticación

`backend/src/main.ts:60-72` (`app.useStaticAssets(uploadsDir, {prefix:'/uploads/'})`), `proyectos.service.ts:577` (`archivoUrl: /uploads/${filename}`), consumo con `<a [href]>` en `proyecto.component.html:542` (sin cabecera `Authorization`). El listado de evidencias sí exige JWT y pertenencia (`:539-545`): **dos controles distintos para el mismo recurso**. Quien obtenga la URL (chat, historial, logs de proxy) accede al documento sin sesión y de forma permanente; solo lo mitiga el nombre aleatorio (`proyectos.controller.ts:61`). **Corrección:** servir por endpoint autenticado que reutilice `verificarAcceso`, o URLs firmadas con caducidad.

### QA-05 🟠 El enlace de la invitación lo decide una cabecera que envía el cliente

`backend/src/common/url-publica.ts:67-91`; uso en `agentes.controller.ts:34-38`. Con `FRONTEND_URL = "http://localhost:4200"` (verificado en `backend/.env`) el camino activo toma el host de `X-Forwarded-Host` / `Origin` / `Referer` / `Host`, y `URLS_PERMITIDAS` no está definida, así que se acepta cualquier host válido (`:118-120`). Un agente autenticado (o quien robe su token) puede pedir la invitación con `X-Forwarded-Host: evil.example` y el correo que recibe el **docente** apuntará a ese dominio: el token de activación acaba en un servidor ajeno y la cuenta queda en manos del atacante (ver QA-08). **Corrección:** definir `URLS_PERMITIDAS`, o exigir `FRONTEND_URL` público y descartar el host de la petición.

### QA-06 🟡 `GET /instituciones/:id/materias` se resuelve sin identidad del llamante

`instituciones.controller.ts:30-33` y `instituciones.service.ts:53-66`: es el único handler que no recibe `@CurrentUser` y la consulta no usa al usuario. Cualquier autenticado enumera el catálogo de materias de cualquier institución publicada. El flujo lo necesita para elegir destino, así que procede **documentarlo como catálogo público** o acotarlo a instituciones con relación existente.

### QA-07 🟡 El límite de intentos cubre menos de lo que parece

`common/guards/rate-limit.guard.ts:26-52`: la clave es `${ip}|${correo}` y `ActivateAccountDto` **no tiene campo `correo`** (`activate-account.dto.ts:4-7`), luego en `POST /auth/activate` degenera a `"<ip>|"`; y `POST /auth/register` no lleva la guardia (QA-03). Contra la fuerza bruta de una cuenta concreta sí funciona (10/min).

### QA-08 🟡 El token de invitación no fija la identidad del docente

`auth.service.ts:216-227`, `:237-244`: la invitación solo fija `correo`, `numeroEmpleado` e `institucionId`; el **nombre y el DNI los elige quien posee el enlace**, así que la institución recibe un docente cuya identidad nunca verificó. El uso único y la caducidad sí funcionan.

### QA-09 🟡 El login revela si un correo tiene una invitación pendiente

`auth.service.ts:104-118`: el mensaje "Tienes una invitación pendiente…" distingue ese caso del genérico y expone la relación institución↔docente en curso a quien sondee correos.

---

## Área C — Flujo, estados y atomicidad

### QA-10 🔴 La aprobación del destino no es atómica con la creación del proyecto

**Ubicación.** `backend/src/solicitudes/solicitudes.service.ts:396-423` (`revisarDestino`), `:439-455` (`registrarRevision`), `:461-500` (`crearProyectoSiNoExiste`). Mismo patrón en `proyectos.service.ts:638-657` (upsert del acta y reinicio de firmas en transacciones separadas).

**Evidencia.**

```ts
const cambio = await this.prisma.solicitudClaseEspejo.updateMany({ … });   // 1. estado = APROBADA
if (cambio.count === 0) throw new BadRequestException('La solicitud ya fue revisada');
await this.registrarRevision(…);                                            // 2. historial
if (dto.decision === ESTADO_SOLICITUD_APROBADA) {
  await this.crearProyectoSiNoExiste(…);                                    // 3. proyecto + participantes
}
```

**Impacto.** Si falla el paso 3 (error de base, reinicio, corte de red — la ventana es de milisegundos pero real) la solicitud queda **`APROBADA` sin proyecto**: el docente no ve ninguna clase espejo y **no hay reintento posible**, porque `revisar` ya no acepta ese estado (`:318-327`) y `PATCH`/`DELETE /solicitudes/:id` tampoco (`:162-171`, `:246-254`). Solo se repara con SQL. Si falla el paso 2 queda una aprobación sin registro en `REVISION_SOLICITUD`. En el acta, un corte entre el `upsert` y el reinicio de firmas deja un reporte `CONFIRMADO` con un texto que nadie firmó, y ese estado habilita el cierre. **Corrección:** envolver cada secuencia en `prisma.$transaction` y añadir una reconciliación (crear el proyecto si el estado es `APROBADA` y `proyecto` es nulo).

### QA-11 🟠 El docente puede modificar una solicitud que el agente acaba de aprobar

**Ubicación.** `solicitudes.service.ts:156-171` (decide con el estado leído), `:214-239` (escribe con `where: { id }`, sin condición de estado).

**Evidencia.** `actualizar` lee la solicitud, comprueba que el estado sea editable y después escribe sin control optimista —justo el patrón que `revisar` sí usa (`:339-347`, `:396-405`)—:

```ts
return this.prisma.solicitudClaseEspejo.update({ where: { id }, data: { …titulo, objetivo, fechaPropuesta… } });
```

**Impacto.** Si el agente aprueba entre la lectura y la escritura, el docente modifica título, objetivo o **fecha** de una solicitud ya aprobada, sin invalidar la aprobación ni reiniciar la doble revisión: la clase espejo puede empezar con datos que ninguna institución autorizó. **Corrección:** añadir `estado: { in: editables }` al `where` y tratar `count === 0` como conflicto ("la solicitud cambió de estado, recarga").

### QA-12 🟠 El cierre se valida por conteos, no por conjuntos

**Ubicación.** `proyectos.service.ts:743-781`.

**Evidencia.**

```ts
const sesiones = await this.prisma.sesion.count({ where: { proyectoId: id, estado: { not: ESTADO_SESION_CANCELADA } } });
const reportesConfirmados = await this.prisma.reporteClaseConjunta.count({ where: { sesion: { proyectoId: id }, estado: ESTADO_REPORTE_CONFIRMADO } });
if (sesiones > reportesConfirmados) throw new BadRequestException(…);
```

**Impacto.** Se comparan dos conjuntos distintos: el acta confirmada de una sesión **cancelada** cuenta como si fuera de una sesión activa, así que una sesión sin reporte puede colarse. Con **cero sesiones** y una evaluación, `0 > 0` es falso y la clase espejo se finaliza sin haber tenido clase. Tampoco se exige que la **planificación** esté aprobada (el flujo documentado pone la planeación conjunta antes de la clase, `diagrama de flujo.md:49-57`), y una vez `FINALIZADO` el estado es terminal: el error queda congelado. **Corrección:** validar por conjuntos (toda sesión no cancelada debe tener su acta confirmada, y debe existir al menos una sesión) y exigir la planificación en `APROBADA` si esa es la regla.

### QA-13 🟡 Los estados de sesión documentados no se pueden alcanzar

`backend/src/common/estados.ts:64-69` define `PROGRAMADA / EN_CURSO / FINALIZADA / CANCELADA` y `update-sesion.dto.ts:23-26` los valida, pero el cliente **no expone ninguna llamada de actualización de sesión** (`frontend/src/app/core/services/proyectos.service.ts:105-143` solo tiene listar, crear y eliminar — verificado) y ninguna plantilla ofrece cambiar el estado. El ciclo real de una sesión es "creada = PROGRAMADA" y, si no se celebró, "borrada". Consecuencia: los estados `EN_CURSO`, `FINALIZADA` y `CANCELADA` nunca se escriben desde la aplicación, y para poder cerrar hay que borrar la sesión o conseguir las firmas de su acta.

### QA-14 🟡 La aprobación de la planificación queda autocertificada por el docente

`save-planificacion.dto.ts:21-24` deja que el docente participante fije el estado `APROBADA` de la planificación conjunta, y `PUT /proyectos/:id/planificacion` exige ser docente participante (`proyectos.service.ts:256`). Nadie más aprueba ni rechaza: `EN_REVISION` no lo compara ningún flujo salvo el recordatorio del agente (`recordatorios.service.ts:394`), y el cierre no lo exige (QA-12). A la vez, `casos_de_uso.md:78` asigna UC19 al agente y `recordatorios.service.ts:399-401` le genera una tarea que **no puede ejecutar** (ver QA-17). O el diagrama se corrige, o falta la aprobación del agente.

### QA-15 🟡 Un acta confirmada se puede volver a firmar sin invalidar las firmas ajenas

`proyectos.service.ts:667-713`: `confirmarReporteClase` actualiza `observaciones` y `confirmadoEn` sin mirar `reporte.estado` ni si ya estaba confirmada; el reporte sigue `CONFIRMADO` y las firmas de los demás no se invalidan. No es idempotente (cada llamada reescribe `confirmadoEn`) y el contenido firmado puede cambiar después de la confirmación. El reinicio de firmas **sí** funciona cuando cambia el texto del acta (`:644-657`).

### QA-16 🟡 El estado `CANCELADO` de un proyecto es inalcanzable

`common/estados.ts:41,45`; `proyectos.service.ts:24,955-964`; `update-proyecto.dto.ts:10` (solo admite `EN_PLANIFICACION` y `EN_CURSO`). Ningún endpoint lo escribe —la única fuente real es `backend/scripts/seed-demo-clases.js`— pero se compara en `verificarProyectoAbierto` y el frontend tiene una pestaña "Canceladas" que siempre estará vacía.

### QA-17 🟡 El recordatorio del agente desaparece al pasar el proyecto a "En curso"

`recordatorios.service.ts:377` filtra por la **cadena literal** `'EN_PLANIFICACION'`, mientras el docente usa `ESTADOS_PROYECTO_EDITABLES` (que incluye `EN_CURSO`) en `:337`. En cuanto el proyecto avanza a `EN_CURSO`, el agente deja de ver la tarea "la planificación no está aprobada" aunque siga en borrador; y como la agenda es el único canal (no hay correo, QA-31), el aviso se pierde.

### QA-18 🟡 El agente de destino ve la solicitud antes de que la apruebe el origen

`recordatorios`/`solicitudes.service.ts:274-289`: `listarEntrantes` incluye las solicitudes donde su institución es destino **en cualquier estado**, incluidas las `PENDIENTE`. El flujo documentado solo la envía al destino **después** de la aprobación del origen (`diagrama de flujo.md:37-40`). El turno sí se respeta (`meToca`, `revisar` rechaza la etapa equivocada con un mensaje claro), pero la institución destino conoce la propuesta y la identidad del docente de origen antes de que se autorice. Si es intencional, conviene reflejarlo en el diagrama.

### QA-19 🟡 El rol `ORIGEN`/`DESTINO` de un participante no se valida contra el lado del agente

`proyectos.service.ts:156-175`: se comprueba la institución del docente, pero no que el `rol` declarado corresponda al lado que representa el agente (`create-proyecto-docente.dto.ts:7-9`). El campo solo se escribe, nunca autoriza: es integridad semántica.

---

## Área D — Interfaz, mensajes e instrucciones

### QA-20 🟠 El motivo del rechazo nunca llega al docente

El backend lo envía (`solicitudes.service.ts:570`, `revisiones: true`), el modelo del cliente lo declara (`solicitud.models.ts:28-34,55`) y **ninguna plantilla lo pinta** (`docente.component.html:160-190`): solo se ven el estado y los botones "Corregir y reenviar" / "Reenviar con fecha nueva". El agente está **obligado** a escribir el motivo (`solicitudes.service.ts:431-437`) y el manual promete mostrarlo (`manual-de-usuario.md:566`: "Rechazada | Rechazada en alguna etapa; **muestra el motivo**"). El dato de `etapa` (`REVISION_ORIGEN`/`REVISION_DESTINO`) tampoco llega a la interfaz, así que el docente no sabe **en qué etapa** falló ni qué corregir. **Corrección:** mostrar `revisiones` (etapa, decisión, comentario, fecha) en la ficha de la solicitud.

### QA-21 🟡 Acciones del agente que siempre fallan

`proyecto.component.html:159-163` pinta "Quitar" en **todas** las filas de docentes cuando el usuario es agente, sin filtrar por institución, mientras el backend solo permite retirar los de la propia (`proyectos.service.ts:208-215`: 403 "Solo puedes gestionar docentes de tu institución"). Además, los bloques "Quitar" y "Agregar docente" (`:170-193`) se muestran en proyectos **cerrados**, donde el backend responde 400 ("La clase espejo ya está cerrada"), y el agente sí puede abrir proyectos finalizados (`agente.component.html:536`). El resto de formularios sí respetan `proyectoAbierto()`; estos dos quedaron fuera. Es exactamente el desajuste entre permisos aparentes y reales que motiva esta auditoría (sin riesgo de datos).

### QA-22 🟡 "Cargando la agenda…" se queda para siempre cuando la agenda falla

`agente.component.ts:285-292` y `docente.component.ts:230-238` hacen `error: () => this.agenda.set(null)` y la plantilla muestra "Cargando la agenda…" mientras `!agenda()` (`agente.component.html:162-163`). Un fallo de red deja la sección así indefinidamente, sin mensaje ni reintento, contra lo que promete el manual (`manual-de-usuario.md:702-704`). El mismo patrón silencia errores de carga en `docente.component.ts:180-198` (el modal "Nueva solicitud" queda con los desplegables vacíos, como si el docente no tuviera asignaciones), `layout.component.ts:490-493` (perfil y foto) y `proyecto.component.ts:311-317` (el sondeo del chat se detiene sin avisar).

### QA-23 🟡 Un fallo al cargar la institución convierte el panel del agente en un formulario vacío

`agente.component.ts:484-488` pone `institucion = null` y `institucionCargada = true`; la plantilla (`agente.component.html:29-39`) evalúa `!institucionCompleta()` y renderiza el formulario de bienvenida **"Completa el registro de tu institución" con los campos vacíos**. Ese formulario hace `PATCH /instituciones/mia`, que sobrescribe todos los campos y fija `registroCompleto: true` (`instituciones.service.ts:38-49`): rellenarlo y guardarlo sustituye los datos reales de la institución. El aviso de error sí se muestra, pero el formulario invita a actuar.

### QA-24 🟡 Las marcas rojas de "Vencida" no pueden aparecer

`recordatorios.service.ts:79` caduca todo lo vencido y después filtra solo las que siguen `enRevision` (`:101`, `:119`, `:150`); como `VENCIDA` se calcula sobre ese mismo subconjunto, **`resumen.vencidas` es siempre 0** y el filtro "CRITICA || VENCIDA" (`agente.component.ts:324-326`) y su tono rojo son código muerto. El texto de `avisoUrgencia('VENCIDA')` ("El plazo terminó: la solicitud se cancela sola…") usa futuro para algo ya cancelado. El manual documenta una marca "**Vencida** (rojo)" (`manual-de-usuario.md:681`) que el usuario nunca verá: lo que ve es "Caducada".

### QA-25 🟡 Límites y catálogos que cliente y servidor no comparten

| # | Qué | Cliente | Servidor | Efecto |
|---|---|---|---|---|
| a | Evidencias | "Solo archivos · máx. 10 MB", input **sin** `accept` (`proyecto.component.html:569-570`) | lista blanca de 15 extensiones (`proyectos.controller.ts:39-80`) | el usuario descubre los formatos válidos solo tras el rechazo; la práctica de `docs/practica-en-maquina-virtual.md:611-614` no llega a producir petición (el cliente corta antes) |
| b | Foto de perfil | máximo **12 MB** (`layout.component.ts:415`) | máximo **2 MB** (`usuarios.controller.ts:22`) | una foto de 2–12 MB cuyo recorte falle (`imagen.util.ts:24,44` devuelven el original) recibe un 413 con el texto crudo de multer, en inglés. Los documentos se contradicen entre sí (`informe-de-actividades.md:324` dice 2 MB; `manual-de-usuario.md:695`, 12 MB) |
| c | Catálogos (tipo de documento, cargo, grado, programa, **periodo escolar**) | único lugar donde existen (`catalogos.ts:210-265`) | `@IsString()` libre en los DTO; sin `ENUM`/`CHECK` en la base | cualquier valor entra por la API y la interfaz no tiene etiqueta para él. `PERIODOS_ESCOLARES` termina en `2026-2`: desde 2027-1 el select de "Asignar docente" queda sin opciones |
| d | Asistentes de una sesión | `min(0)`, sin validación de entero | `@IsInt() @Min(0)` (`save-reporte-clase.dto.ts:8-10`) | un decimal (5.5) responde "totalAsistentes must be an integer number", en inglés y sin decir cómo corregir |

### QA-26 🟡 La sesión caducada expulsa al usuario sin explicar por qué

`auth.interceptor.ts:22-30`: ante un 401 cierra la sesión y navega al login descartando el mensaje real del servidor ("Tu cuenta está desactivada. Contacta a tu institución.", `jwt-auth.guard.ts:60-64`). El usuario pierde lo escrito y no sabe si el fallo fue suyo.

### QA-27 🟡 Validaciones asimétricas entre formulario y API

| Caso | Cliente | Servidor | Efecto |
|---|---|---|---|
| "Mi institución" | `nombre`, `estado`, `ciudad` solo con `Validators.required` (`agente.component.ts:150-157`) | `@EsTextoValido()` en los tres (`update-institucion.dto.ts:5-26`) | un nombre con dígitos, paréntesis o coma pasa el formulario y el `PATCH` responde 400; si la institución **ya** tiene una coma o un paréntesis en el nombre, el agente no puede guardar nunca (el formulario lo precarga, `:511-524`) |
| Correo | `Validators.email` de Angular acepta dominio sin punto (`a@b`) | `@IsEmail()` (validator.js) lo rechaza (`register.dto.ts:33,67`, `login.dto.ts`, `invite-docente.dto.ts`) | Registro, Activación, Login e Invitar docente dejan pasar `docente@campus` y el backend responde "correo must be an email", en inglés |
| Fecha propuesta | Cliente compara con el reloj y la zona del navegador (`docente.component.ts:446-451`) | Servidor compara con los suyos (`solicitudes.service.ts:503-511`) | en la franja en que difieren los días locales, "hoy" se acepta en el formulario y el backend responde "La fecha propuesta no puede estar en el pasado" |
| Fechas imposibles | `input type="date"` no las produce | `@IsDateString()` acepta `2026-02-30` (7 DTO) | no alcanzable desde la interfaz, pero la API guarda una fecha distinta de la enviada (`new Date('2026-02-30')` → 2 de marzo) |

### QA-28 🟢 Higiene de contrato (menor, sin impacto actual)

`POST /solicitudes/:id/revisar` responde sin los campos de plazo que sí añaden los listados (`solicitudes.service.ts:359-362`, `:425-428` frente a `:107`, `:288`): cualquier consumidor que reutilice el patrón `if (!s.enRevision)` vería `undefined`. `/instituciones/mia` y `/usuarios/me` devuelven campos fuera del modelo del cliente (`instituciones.service.ts:31-33`, `usuarios.service.ts:47,70-102`). `API_URL` está duplicada en 7 servicios y se calcula con `window` en ámbito de módulo (`auth.service.ts:13-16` y seis más), lo que rompe el renderizado en servidor que el proyecto mantiene en `app.config.server.ts`/`server.ts`.

---

## Área E — Estructura y endurecimiento

### QA-29 🟡 La base de datos no refuerza ninguna regla de estados ni de unicidad

Las 12 migraciones solo contienen `CREATE TABLE`, `ALTER TABLE`, claves foráneas e índices únicos: **cero `ENUM` y cero `CHECK`**. `SolicitudClaseEspejo.estado`, `ProyectoClaseEspejo.estado`, `Sesion.estado`, `ReporteClaseConjunta.estado`, `PlanificacionConjunta.estado` y `ProyectoDocente.rol` son texto libre. El código los acota con `@IsIn` (bien), pero la base acepta cualquier valor escrito por un script o por un bug futuro. Tampoco hay unicidad compuesta en `ProyectoDocente (proyectoId, asignacionDocenteId)`, `RevisionSolicitud (solicitudId, etapa)`, `AsignacionDocente (docenteInstitucionId, materiaId, periodoEscolar)` ni `DocenteInstitucion.numeroEmpleado`: las comprobaciones existen en los servicios (`findFirst` antes de `create`), así que dos peticiones simultáneas pueden duplicar filas. El caso grave: `sincronizarParticipaciones` (`proyectos.service.ts:801-847`) crea participaciones sin transacción; un duplicado hace que `confirmarParticipacion` actualice solo la primera y que `every()` nunca se cumpla (`:850-866`), con lo que el acta nunca llega a `CONFIRMADO` y **el cierre se vuelve imposible**. `ProyectoClaseEspejo.solicitudId` sí es único, lo que protege la transición más importante. (Ya figuraba como pendiente `m7` en `respuesta-auditoria.md:144`.)

### QA-30 🟢 No existe guardia de roles: la defensa depende de que cada servicio recuerde comprobarlo

No hay `@Roles` ni `APP_GUARD` global; el rol se comprueba repitiendo `getAgente`/`getDocente` en 6 servicios. Hoy **todos** lo hacen —por eso no hay IDOR—, pero un endpoint futuro que olvide la llamada queda abierto. Un `RolesGuard` declarativo sería defensa en profundidad, no sustitución: la pertenencia seguiría siendo por recurso.

### QA-31 🟢 Las notificaciones de cambio de estado son solo internas

`diagrama de flujo.md:31,43` ("Notificar al docente") y `casos_de_uso.md:49,58` (UC18/UC23) se resuelven hoy con la agenda y la insignia de la campana; `mail.service.ts:26-44` **solo envía invitaciones** y `solicitudes.module.ts` no importa el módulo de correo. El docente se entera de una aprobación, un rechazo o una caducidad la próxima vez que entra. Conviene decidir si la agenda satisface el requisito.

### QA-32 🟢 Los mensajes del framework llegan en inglés

`extraerMensajeError` (`http-error.util.ts:7-12`) prioriza el mensaje del servidor —correcto para los mensajes propios— y no traduce los de `class-validator` ni los de multer ("totalAsistentes must be an integer number", "File too large", "correo must be an email").

---

# 3. Matrices

## 3.1 Permisos por rol y recurso

| Acción | Docente | Agente de la institución | Agente de la otra | Sin rol | Dónde se comprueba |
|---|---|---|---|---|---|
| Crear/editar/cancelar solicitud propia | ✅ | 401 | 401 | 401 | `obtenerPropia` (`solicitudes.service.ts:513-521`) |
| Revisar en la etapa de origen | 401 | ✅ | 404 | 401 | `revisar` (`:295-328`) |
| Revisar en la etapa de destino | 401 | 404 | ✅ | 401 | `revisarDestino` (`:366-429`) |
| Ver un proyecto | ✅ si participa | ✅ si su institución participa | 403 | 401 | `verificarAcceso` (`proyectos.service.ts:878-905`) |
| Modificar la clase conjunta (planificación, sesiones, actividades, evidencias, acta, evaluación, cierre, chat) | ✅ si participa | 403 | 403 | 401 | `exigirDocenteParticipante` (`:932-952`) |
| Sumar/quitar docentes del proyecto | 403 | ✅ solo los suyos | 403 | 401 | `exigirAgenteInvolucrado` + filtro (`:145-160`, `:196-215`) |
| Generar reporte de planificación | 403 | ✅ | 403 | 401 | `:348` |
| Gestionar docentes, materias, asignaciones, institución | 401 | ✅ de su institución | 401 | 401 | `getAgente` en cada servicio |
| Perfil y foto propios | ✅ | ✅ | ✅ | 401 | `usuarios.service.ts` (id del token) |
| Catálogo de instituciones y sus materias | ✅ | ✅ | ✅ | 401 | **sin relación con el llamante** (QA-06) |
| Cuenta desactivada con token vigente | 401 | 401 | 401 | 401 | `jwt-auth.guard.ts:60-71`, en cada petición |

## 3.2 Estados: real frente a documentado

| Entidad | Documentado (`diagrama de flujo.md`) | Implementado | Diferencia |
|---|---|---|---|
| Solicitud | `Pendiente → Aprobada por origen → Aprobada`, con `Rechazada` en cada etapa | Igual con `updateMany` condicional, **+ `CADUCADA`** | ✅ Doble revisión real y sin doble aprobación. ⚠️ `CADUCADA` no está en el diagrama (QA-02). ⚠️ Las dos etapas escriben el mismo `RECHAZADA`: solo `RevisionSolicitud.etapa` las distingue (el diagrama dibuja "Rechazada por destino" como estado aparte, y esa diferencia no llega a la interfaz: QA-20). ⚠️ La creación del proyecto no es atómica (QA-10) |
| Proyecto | `En planeación → (sesiones) → Finalizada` | `EN_PLANIFICACION → EN_CURSO → FINALIZADO`, más `CANCELADO` | ⚠️ `CANCELADO` inalcanzable (QA-16). ⚠️ Cierre por conteos, sin compuerta de planificación y posible sin sesiones (QA-12) |
| Planificación | "Planeación conjunta" (sin estados) | `BORRADOR / EN_REVISION / APROBADA`, libres e intercambiables | ⚠️ Sin máquina de estados: `APROBADA` sin confirmaciones ni retroceso validado (QA-14) |
| Sesión | — | `PROGRAMADA / EN_CURSO / FINALIZADA / CANCELADA` validados en el DTO | ⚠️ Sin interfaz que los cambie: solo `PROGRAMADA` (QA-13) |
| Acta de clase | Se guarda al terminar cada sesión | `BORRADOR → EN_REVISION → CONFIRMADO`; el texto cambiado reinicia firmas | ✅ Bien, salvo la re-firma posterior (QA-15) y el reinicio no atómico (QA-10) |
| Reporte de planificación | — | `EN_REVISION` se escribe pero nadie lo compara | 🟢 Estado decorativo |

---

# 4. Estado de las auditorías anteriores

Revisión de vigencia de los cuatro informes de `docs/auditorias/` contra el código actual:

| Informe | Resultado |
|---|---|
| `reporte-qa-clasesespejo.md` (12 hallazgos) | **12/12 corregidos** (desactivar docente, reglas de cierre, invitación duplicada, doble revisión, borrados con dependencias, evidencias sin sesión, login del invitado, condición siempre verdadera, vencimiento duplicado, proyecto cerrado, rol Administrador) |
| `reporte-qa-clasesespejo-v2.md` (9 + 6 UX) | **9/9 y 6/6 corregidos** (rechazada atascada, chat tras cierre, doble clic, 401, `alert/confirm`, validación de fechas, enlace virtual) |
| `auditoria-v3-y-analisis-de-diseno.md` (C1-C2, I1-I12, m1-m21, diseño) | **Críticos y los 12 importantes, corregidos**; 16 de 21 menores corregidos. **Siguen abiertos** los que se indican abajo |
| `respuesta-auditoria.md` (bloque "Pendiente") | `m17` corregido; `m7`, `m14`, `m15`, `m18`, `m19`, `m20` vigentes; las propuestas de diseño, en su mayoría no aplicadas |

**Hallazgos previos que siguen abiertos** (no se reabren aquí; se listan para que el equipo los cierre):

| Id | Qué | Evidencia actual |
|---|---|---|
| m7 | Sin `@@unique` en asignaciones, vínculos y participaciones | `schema.prisma:92-140` (ver QA-29) |
| m8 | CORS acotado pero sin `helmet` | `main.ts:47-54`; `backend/package.json` |
| m14 | Recorrido O(n·m) en la plantilla de materias (doble búsqueda por fila) | `agente.component.ts:967-969`; `agente.component.html:335,337` |
| m15 | El número de empleado de la invitación nunca se muestra al docente | `activate.component.ts:60-64` |
| m16 | Cuatro formatos de fecha distintos, sin `FechaPipe` | `agente.component.ts:1000`; `proyecto.component.ts:1054`; `agenda.component.ts:123-127` |
| m18 | El banner "Cuenta creada" sobrevive a un login fallido | `login.component.ts:35,75-79` |
| m19 | El registro no pide confirmar contraseña ni valida formato de DNI/teléfono | `register.component.ts:48-63` |
| m20 | `API_URL` duplicada 7 veces y `window` en ámbito de módulo | ver QA-28 |
| I7 | Errores de carga silenciados en el panel docente | ver QA-22 |
| R1-7 | Estados como texto libre en la base | ver QA-29 |
| Diseño | D3, D4, D7, D8 (sin `@media print`), D11, espaciado, componentes, `aria-live`, color como único canal | `styles.css` |

> **Nota sobre `m16`:** la auditoría v3 consideró corregido el "bug UTC" de las fechas. El arreglo aplicado es correcto para `fechaHora` (`TIMESTAMP(3)`) pero **no** para las columnas `DATE`, que siguen desplazándose un día y degradándose al guardar (QA-01). Es el malentendido que conviene dejar cerrado con una prueba automatizada.

---

# 5. Lo que está bien (verificado, para no reabrirlo)

- **Doble revisión real y segura frente a carreras**: `PENDIENTE → APROBADA_POR_ORIGEN → APROBADA` con `updateMany` condicional y `count === 0` (`solicitudes.service.ts:339-350`, `:396-408`); el proyecto no se crea dos veces (`solicitudId` único, `schema.prisma:182`).
- **Autorización por pertenencia consistente en los 62 endpoints**, sin ningún IDOR explotable sobre datos de terceros, y **ninguna guardia definida sin usar** (las tres que hay están aplicadas).
- **`FINALIZADO` es realmente terminal**: todas las mutaciones pasan por `verificarProyectoAbierto` (`proyectos.service.ts:914`, `:945`, `:954-964`).
- **Cuenta desactivada**: el JWT deja de servir de inmediato porque el guardia consulta la base en cada petición; también detecta al docente sin vínculo institucional activo.
- **Invitaciones**: un solo uso con consumo atómico, caducidad comprobada, duplicados bloqueados y borrado si el correo falla; el token de invitación **no** sirve como token de sesión (no lleva `sub`).
- **Borrados con dependencias**: se detectan antes y devuelven un mensaje claro en lugar de un 500, con `PrismaExceptionFilter` como red.
- **Contratos**: **no hay ninguna discrepancia** por `@map` en snake_case (no existe `$queryRaw`), los **45** `@Param` llevan `ParseIntPipe`, ningún `@IsInt()` recibe texto, ningún booleano viaja como texto, y el único número que viaja en `FormData` (`sesionId`) se convierte con `@Transform`. Los literales de estado y de urgencia coinciden entre backend y frontend (salvo los señalados).
- **Sin superficies XSS**: no hay `innerHTML`, `bypassSecurityTrust` ni `DomSanitizer`; extensiones en lista blanca y estáticos con `nosniff` + `Content-Disposition: attachment`.
- **Validación de entrada "humana"** replicada idénticamente entre `es-texto-valido.ts` y `validators.ts` (la única asimetría es la de QA-27).
- **Build servido al día** (`backend/public` posterior al último cambio de fuente) y ayuda en pantalla (`layout.component.html:428-464`) coherente con el flujo real.

---

# 6. No verificado y decisiones pendientes

| Punto | Por qué | Cómo comprobarlo |
|---|---|---|
| Comportamiento de la base viva | No se consultó (sin acceso desde esta sesión) | `SELECT fecha_propuesta FROM "SOLICITUD_CLASE_ESPEJO" LIMIT 1;` y comparar con lo que muestra la interfaz para esa misma solicitud |
| Zona horaria del despliegue | `backend/.env` no define `TZ` y la guía no lo menciona; la máquina local es UTC-6 | `date` en el host. Las columnas `DATE` (QA-01) se desplazan **siempre** en husos negativos; `fechaHora` (sesiones) solo si el servidor y el usuario están en husos distintos |
| Duplicados históricos | Requiere datos | Contar duplicados en `PROYECTO_DOCENTE`, `ASIGNACION_DOCENTE` y `DOCENTE_INSTITUCION` |
| Usuarios sin rol (`rol: null`) | Requiere datos | `SELECT id FROM "USUARIO" u LEFT JOIN "AGENTE_INTERNACIONALIZACION" a ON a.usuario_id=u.id LEFT JOIN "DOCENTE" d ON d.usuario_id=u.id WHERE a.id IS NULL AND d.id IS NULL;` |
| Prueba de extremo a extremo | No se levantó la aplicación | Sigue pendiente en `docs/readme:1201` |

**Decisiones que corresponden al equipo (cambian el código):**
1. ¿El alta de agentes sigue siendo pública? (QA-03)
2. ¿Se exige antelación mínima para proponer, o la caducidad se mide contra el día de la clase? (QA-02)
3. ¿El cierre exige planificación aprobada y al menos una sesión? (QA-12)
4. ¿La planificación la aprueba el agente o el docente? (QA-14, QA-17)
5. ¿La agenda interna satisface "recibir notificaciones" o hace falta correo? (QA-31)
6. ¿El catálogo de materias de otra institución es público para cualquier autenticado? (QA-06)

---

# 7. Orden de corrección recomendado

1. **QA-01** (fechas `DATE`): mientras no se corrija, **cada edición sigue dañando datos**. Un helper compartido + un test.
2. **QA-10** (transacción de la aprobación y del acta) y **QA-02** (antelación / vencimiento al aprobar): son las formas en que el flujo se rompe solo y sin recuperación.
3. **QA-11** (condición de estado al editar) y **QA-12** (cierre por conjuntos): cierran huecos de integridad en las dos transiciones clave.
4. **QA-20** (motivo del rechazo visible): la corrección más barata con más efecto para el usuario final.
5. **QA-04** y **QA-05** (evidencias autenticadas y `URLS_PERMITIDAS`): cierran las dos vías de acceso indebido.
6. **QA-03** (entrada de agentes), tras decidir el modelo de alta.
7. **QA-13 a QA-28** (interfaz y mensajes) como bloque de pulido, y **QA-29/QA-30** (enums, unicidad y guardia de roles) como endurecimiento estructural.

---

*Informe generado por auditoría de código sobre el commit `63702a7`. Cada hallazgo cita archivo y línea del estado auditado; los que dependen del entorno de despliegue o de datos reales están marcados como no verificados.*
