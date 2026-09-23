# Respuesta a la auditoría v4 — errores lógicos de flujo

**Auditoría:** `auditorias/auditoria-v4-errores-de-flujo` (32 hallazgos: 2 críticos,
7 importantes, 19 menores, 4 sugerencias)
**Commit auditado:** `63702a7`
**Estado de esta respuesta:** primera pasada — **2 críticos y 2 importantes
corregidos y verificados**; el resto queda clasificado abajo con la decisión que
necesita o el orden propuesto.

---

## 1. Lo corregido en esta pasada

### 🔴 QA-01 — Las fechas de calendario se veían y se reguardaban un día antes

**Confirmado.** Las columnas `DATE` las devuelve Prisma como medianoche UTC
(`2026-03-15T00:00:00.000Z`) y se leían con `setHours(0,0,0,0)` y `getDate()`
(locales): en cualquier huso negativo eso es el día 14. No era el problema que
creía haber resuelto la revisión anterior (el arreglo era correcto para
`fechaHora`, que es un `TIMESTAMP`, pero no para las columnas `DATE`).

**Corrección.** Un solo criterio en los dos lados:

| Lado | Archivo | Qué hace |
| --- | --- | --- |
| Backend | `src/common/plazos.ts` | `diaDeColumna()` lee el día por sus partes **UTC**; `diaLocal()` toma «hoy» del reloj local; `textoDeColumna()` devuelve `YYYY-MM-DD`; los plazos suman y restan con `setUTCDate()` |
| Frontend | `src/app/core/utils/fecha.util.ts` (nuevo) | `fechaTexto()` trata el día como texto (arregla el listado **y** el `<input type="date">`), `fechaLarga()` formatea al mediodía local, `claveLocal()`/`horaTexto()` quedan para los instantes |
| Frontend | `docente`, `agente`, `proyecto`, `agenda`, `calendario` | Los cinco helpers duplicados ahora delegan en el util; el calendario indexa los vencimientos (columna `DATE`) por texto y las sesiones (`TIMESTAMP`) por día local |
| Backend | `solicitudes.service.ts` | `crearProyectoSiNoExiste()` calcula `fechaFin` con `setUTCDate()` |

**Verificación.** Prueba de regresión con siete casos (día guardado, límite
`−7 días`, cambio de mes, días hasta una fecha futura y pasada, fecha mínima
proponible y «hoy») ejecutada en **cuatro husos**: `America/Lima`,
`America/Mexico_City`, `UTC` y `Asia/Tokyo` → **28 de 28 correctos**. Antes de la
corrección, los dos husos negativos devolvían el día anterior.

Además, comprobado contra la API real: una propuesta para dentro de 7 días se
guarda como `2026-09-30T00:00:00.000Z` (hoy era 23-sep) y el límite calculado es
exactamente la fecha propuesta menos 7 días.

### 🔴 QA-10 — La aprobación del destino no era atómica con la creación del proyecto

**Corrección.** El cambio de estado, el registro de la revisión y la creación del
proyecto (con sus docentes) van ahora en **una sola transacción**
(`prisma.$transaction`), igual que la revisión de origen. Como red de seguridad se
añadió `reconciliarProyectos()`, que crea la clase espejo de cualquier solicitud
que hubiera quedado `APROBADA` sin proyecto; se ejecuta junto al vencimiento de
plazos (`mantenimiento()`) antes de listar y desde el planificador, que además lo
registra en el log.

*No verificado en ejecución*: provocar un fallo a mitad de transacción requiere
instrumentar el código; se apoya en la revisión del cambio y en que ambos
proyectos compilan.

### 🟠 QA-02 — Una solicitud con poca antelación nacía caducada

**Corrección.** La regla se aplica en la puerta de entrada:

* `verificarFechaPropuesta()` (servidor) exige fecha futura **y** la antelación
  de `REVISION_DIAS_ANTELACION`; la usan `crear` y `actualizar`.
* El formulario del docente avisa antes de enviar, y el mínimo lo dicta el
  backend: `GET /recordatorios` devuelve `configuracion.diasAntelacionRevision`
  para no duplicar el número en el cliente.
* `revisar()` ejecuta el mantenimiento antes de decidir, así que una solicitud
  fuera de plazo ya no se puede aprobar en la ventana en que el planificador
  todavía no pasó.

**Verificado contra la API:** propuesta de ayer, de hoy y de dentro de 3 días →
`400`; de dentro de 7 días → aceptada (el límite es «al menos 7»). Las filas de
prueba se borraron después: la base quedó como estaba.

### 🟠 QA-17 — El recordatorio del agente desaparecía al pasar a «En curso»

**Corrección.** El filtro usaba la cadena `'EN_PLANIFICACION'` mientras el
docente usaba `ESTADOS_PROYECTO_EDITABLES`; ahora los dos usan la constante, así
que el aviso sigue mientras la clase esté abierta.

---

## 2. Estado del resto (no corregido todavía)

### Decisiones que corresponden al equipo

Estas cambian el comportamiento del sistema, así que no se aplicaron sin
confirmación:

| # | Hallazgo | Decisión necesaria | Mi recomendación |
| --- | --- | --- | --- |
| QA-03 | El alta de agentes es pública | ¿Se mantiene abierta, se exige verificación de correo o pasa a invitación de un administrador? | Mantenerla (es la FASE 1 del flujo) **con límite de intentos**, y añadir verificación de correo |
| QA-12 | El cierre no exige planificación aprobada | ¿La planificación debe estar aprobada para cerrar? | Sí exigirla, una vez resuelto QA-14 |
| QA-14 | La planificación la aprueba el propio docente | ¿Aprueba el docente o el agente? | Que el agente la valide (el diagrama le asigna UC19) |
| QA-16 | `CANCELADO` es inalcanzable | ¿Se permite cancelar una clase espejo? | Sí, con acción explícita de los docentes y confirmación |
| QA-18 | El destino ve la solicitud antes de que el origen la apruebe | ¿Es intencional? | Dejarlo (permite prever carga) y corregir el diagrama |
| QA-31 | Las notificaciones son solo internas | ¿La agenda basta o hace falta correo? | Mantener la agenda en esta etapa y documentarlo |

### Importantes pendientes (QA-04, QA-05, QA-11, QA-12, QA-20)

| # | Qué | Corrección propuesta |
| --- | --- | --- |
| QA-04 | Las evidencias se sirven sin autenticación | Endpoint autenticado que valide pertenencia y entregue el archivo (`sendFile`), y descarga por `HttpClient` con el token |
| QA-05 | El enlace de invitación lo decide una cabecera del cliente | Exigir `URLS_PERMITIDAS` (con comodín para el túnel) en vez de aceptar cualquier host |
| QA-11 | El docente puede editar una solicitud recién aprobada | `update` con condición de estado (control optimista) y error de conflicto |
| QA-12 | El cierre se valida por conteos | Validar por conjuntos: toda sesión no cancelada con su acta confirmada, y al menos una sesión |
| QA-20 | El motivo del rechazo no llega al docente | Pintar las revisiones (etapa, decisión, comentario, fecha) en la ficha de la solicitud: es la corrección más barata con más efecto |

### Menores (19) y sugerencias (4)

Se aceptan todos; la mayoría son de una línea o de plantilla. Los más rápidos y
visibles, por si se quiere un bloque de pulido: **QA-22** (la agenda se queda en
«Cargando…» si falla), **QA-23** (un fallo al cargar la institución muestra el
formulario vacío y guardarlo sobrescribe los datos), **QA-21** (acciones del
agente que siempre fallan), **QA-24** (las marcas rojas «Vencida» no pueden
aparecer), **QA-25** (límites y catálogos desalineados), **QA-32** (mensajes del
framework en inglés) y **QA-15** (un acta se puede volver a firmar sin invalidar
las firmas ajenas).

Los de endurecimiento estructural —**QA-29** (sin `ENUM`/`CHECK` ni unicidad
compuesta en la base) y **QA-30** (guardia de roles declarativa)— conviene
hacerlos juntos, con su migración, después de comprobar que no hay duplicados
históricos.

---

## 3. Lo que la auditoría confirma que está bien

Se mantiene tal cual, sin reabrirlo: la doble revisión con transiciones
condicionales, la autorización por pertenencia en los 62 endpoints sin ningún
IDOR, el cierre terminal de `FINALIZADO`, la desactivación de cuenta efectiva en
cada petición, las invitaciones de un solo uso, los borrados con dependencias
comprobadas y la ausencia de superficies XSS.

---

## 4. Verificaciones ejecutadas en esta pasada

| # | Qué | Resultado |
| --- | --- | --- |
| 1 | Regresión de fechas en 4 husos (28 casos) | ✅ 28/28 |
| 2 | Fecha propuesta guardada igual a la enviada (API real) | ✅ 2026-09-30 → `2026-09-30T00:00:00.000Z` |
| 3 | Límite de revisión = propuesta − 7 días | ✅ 2026-10-13 → límite 2026-10-06 |
| 4 | Antelación mínima en `POST /solicitudes` | ✅ 400 con −1, 0 y +3 días; acepta desde +7 |
| 5 | Backend y frontend compilan | ✅ `nest build` y `ng build` |
| 6 | Datos de demostración intactos tras las pruebas | ✅ 6 → 4 solicitudes (se borraron las de prueba) |
