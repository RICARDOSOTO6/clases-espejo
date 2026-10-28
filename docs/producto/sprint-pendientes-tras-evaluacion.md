# Sprint: lo que falta tras la evaluación

> **Verificado contra el repositorio el 28 de octubre de 2026** — 163 confirmaciones, 156 rutas,
> 30 controladores, 17 módulos, 38 tablas, 35 migraciones y 230 casos de prueba
> (160 e2e, 41 unitarias y 29 de frontend).
> Cada partida lleva **criterio de aceptación**: si no se puede comprobar, no entra en el sprint.

> **Actualización del 28-oct:** este documento recoge también los pendientes que quedaron
> **sin terminar** en la revisión del informe técnico (`revision-informe-tecnico-v7.md`) y en la
> respuesta a la evaluación (`respuesta-a-la-evaluacion-2026-10-28.md`). No se duplican tareas:
> cuando una partida de la revisión ya está cubierta por A1–A11 o B1–B5, se enlaza con ella.
>
> **Orden de ataque:** primero lo que protege el piloto y la base; después lo que sostiene la
> defensa del informe; al final la reestructuración y el alcance nuevo. Ver sección 5.

---

## 0. Antes de nada: lo que ya está hecho

La evaluación se escribió sobre el informe, no sobre el código actual. Estas observaciones **ya están
cerradas** y no hay que reimplementarlas:

| Observación de la evaluación | Estado | Dónde |
| --- | --- | --- |
| Cabeceras de seguridad (HSTS, X-Frame-Options, CSP) | ✅ Hecho | `aplicarCabecerasSeguridad` en `backend/src/common/`, montado en `main.ts` para estáticos y como middleware de Nest. CSP completo, `frame-ancestors 'none'`, HSTS solo en producción |
| Validar contenido real de los archivos | ✅ Hecho para imágenes | `common/imagenes.ts` lee la **firma binaria** y renombra con prefijo + marca de tiempo + aleatorio |
| Privacidad y consentimiento | ✅ Hecho | Aviso versionado `2026-10-25`, `/privacidad`, `/aceptar-aviso`, obligatorio también para cuentas anteriores |
| Retención de datos | ✅ Hecho | Archivado de instituciones con historial |
| Panel institucional | ✅ Hecho | Panel de desempeño por institución y docente |
| Índices del informe automáticos | 🟡 Parcial | Los campos `TOC` + numeración `SEQ` existen en el v10, pero el índice en caché no está actualizado; queda el `Ctrl+E`/`F9` de D5 |
| Tanda A de redacción del v10 | ✅ Hecho | Título, objetivo, Scrum como prácticas, arquitectura, rendimiento renombrado y conclusión reformulada |
| Cifras del v10 y Anexo C | ✅ Hecho | Cifras al 28-oct y anexo de métricas como fuente única |
| Respaldo y restauración manual | ✅ Hecho en L6 | `release/l6/ClasesconjuntasBD-2026-10-27.dump`; restauración probada en base temporal |

> **Corrección a lo que te dije el 28 por la mañana:** afirmé que las cabeceras eran solo por ruta. Me
> equivoqué: mi búsqueda no cubría el archivo donde vive el middleware. Están puestas a nivel de
> aplicación. Es el único punto de mi informe anterior que queda retirado.

### 0.1 Estado real de las partidas

| Partida | Estado al 28-oct | Qué falta |
| --- | --- | --- |
| A1 — pruebas de frontend | ✅ Hecho | 29 casos: auth, TOTP, recuperación, confirmación, registro, solicitud, revisión, planificación, evidencia, cierre y certificado |
| A2 — aislamiento institucional | ✅ Hecho | Suite e2e con institución externa: materias, docentes, proyecto, sesiones, reportes, evaluaciones, mensajes, evidencias, listas, planificación y certificados |
| A3 — entropía del JWT | ✅ Hecho | Mínimo 32 bytes y prueba unitaria |
| A4 — contenido real de evidencias | ✅ Hecho | Firma PDF/imagen/Office/ZIP y prueba e2e |
| A5 — respaldo automático | 🟡 Parcial | Scripts y restauración probada; falta instalar el temporizador en el servidor |
| A6 — monitorización | ✅ Hecho | `X-Request-Id`, logs de 5xx y `scripts/verificar-salud.js` |
| A7 — carga mínima | ⏸️ Opcional | Solo si sobra tiempo; no es requisito del piloto |
| A12 — TOTP CACE | ✅ Hecho | Alta, login en dos pasos, recuperación y desactivación |
| B1 — reestructuración a siete capítulos | ❌ Pendiente | Hacerla **después** del piloto, cuando resultados estén congelados |
| B2 — matriz de trazabilidad | ❌ Pendiente | 37 requerimientos → módulo → prueba → evidencia |
| B3 — matriz de auditorías | ❌ Pendiente | Cinco rondas + análisis integral + declaración de herramientas |
| B4 — protocolo de aceptación | ❌ Pendiente | Participantes, tareas, indicadores y hoja de registro |
| B5 — sincronizar el informe | ❌ Pendiente | Cifras, privacidad, panel, secretaría y figuras |
| C1 — piloto real | ❌ Pendiente | Depende de servidor, cuentas y fecha de la CACE |
| D1–D8 — cierre editorial y figuras | 🟡 Parcial | Algunos remates del v10; ver bloque D |

---

## 1. Bloque A — Código

| ID | Tarea | Por qué | Criterio de aceptación | Est. |
| --- | --- | --- | --- | --- |
| **A1** | **Pruebas de comportamiento del frontend** (10-20 casos) | Hoy hay 1 prueba de humo de 186 casos: es el 0,5 % y la crítica más fácil de hacer en la defensa | `ng test` corre en CI y cubre: acceso y recuperación, registro y verificación de correo, alta de solicitud, revisión, planificación conjunta, carga de evidencia, cierre y emisión/verificación de certificado | **8 h** |
| **A2** | **Suite de aislamiento institucional (e2e)** | Hay pruebas sueltas (invitaciones, certificados), pero no una que garantice que una institución no toca lo de otra cambiando el id | Un caso por recurso con dueño institucional (docentes, materias, listas, evidencias, proyectos, certificados): con el usuario de otra institución y el id manipulado, la API responde 403 o 404 y no filtra datos | **6 h** |
| **A3** | **Secreto JWT con entropía real** | Hoy solo se valida longitud mínima (16); el evaluador pide alta entropía | El arranque rechaza un secreto de menos de 32 bytes; `.env.example` y la guía de despliegue explican cómo generarlo con `openssl rand -hex 32` o `openssl rand -base64 48` | **1 h** |
| **A4** | **Contenido real en las evidencias** | Las imágenes ya se validan por firma binaria, pero las evidencias siguen filtrando por extensión: renombrar `.txt` a `.pdf` pasa | El filtro de evidencias comprueba la firma del archivo (PDF, Office, ZIP, imagen) y rechaza lo que no coincida; un caso e2e lo prueba | **3 h** |
| **A5** | **Respaldo automático + prueba de restauración** | El evaluador pide que respaldo y restauración no queden como trabajo futuro | Script de `pg_dump` + tarea programada + `restaurar` probado una vez, con fecha y resultado anotados en `respaldo-y-restauracion.md` | **4 h** (restan ~2 h) |
| **A6** | **Monitorización y trazas** | Sin monitorización externa no hay operación | Un chequeo externo que consulte `/health` y avise si cae; los errores 5xx se registran con un identificador de petición que aparezca también en la respuesta | **4 h** |
| **A7** | **Carga mínima** (opcional) | La sección ya se renombró a «optimización del peso transferido», que es la salida honesta | Si se hace: k6 con 50 usuarios virtuales y latencias p50/p95/p99 anotadas. Si no se hace, no se toca nada | **4 h** |

### 1.1 Orden dentro del bloque A

Antes del piloto, el orden es:

1. **A5** — la base no se toca sin respaldo probado.
2. **A3** — una hora y evita una observación de seguridad.
3. **A2** — aísla datos entre instituciones.
4. **A4** — impide que un archivo disfrazado entre como evidencia.
5. **A6** — permite enterarse de que el servidor cayó.
6. **A1** — importante para la defensa, pero no bloquea el piloto.

**A7 no se hace antes del piloto.** Para 8–10 personas no aporta y desvía tiempo.

---

## 2. Bloque B — Documento

| ID | Tarea | Por qué | Criterio de aceptación | Est. |
| --- | --- | --- | --- | --- |
| **B1** | **Reestructurar a los siete capítulos de residencia** | Es la crítica número dos y la más cara: el informe se lee como reporte técnico | Generalidades, problema, marco teórico, desarrollo, resultados, conclusiones y recomendaciones, competencias, referencias y anexos. Capítulos, figuras y tablas renumerados y referencias cruzadas al día | **12 h** |
| **B2** | **Matriz de trazabilidad** | El evaluador la pide explícitamente y no existe | Tabla requerimiento → módulo → caso de prueba → resultado → evidencia, con los 37 requerimientos y la prueba que cubre cada uno. Las filas sin prueba se marcan: son las que hay que escribir | **6 h** |
| **B3** | **Matriz de auditorías y declaración de herramientas** | Fecha, hallazgo, severidad, corrección, evidencia; y declarar si se usó IA | Tabla de las cinco rondas + el análisis integral, y un párrafo que declare las herramientas empleadas en la auditoría y en la redacción | **3 h** |
| **B4** | **Protocolo de prueba de aceptación** | El evaluador propone participantes e indicadores; hay que dejar el guion | Participantes, tareas, indicadores (tareas completadas, errores, tiempo, SUS/UMUX-Lite, satisfacción, aceptación), hoja de registro y criterio de resultado por rol | **3 h** |
| **B5** | **Sincronizar el informe con los cambios de esta semana** | Lo hago yo cuando cierres: métricas, figuras y menciones | Anexo C y cuerpo al día; figuras regeneradas | **2 h** |

### 2.1 Regla para B1

**B1 no se empieza antes del piloto.** Reestructurar ahora obliga a reescribir el capítulo de
resultados después de la prueba real. Se hace una sola vez, cuando el contenido de resultados ya no
vaya a cambiar.

Mientras tanto, sí se pueden adelantar **B2, B3, B4 y B5**, porque no dependen de la estructura.

---

## 3. Bloque C — Campo

| ID | Tarea | Depende de |
| --- | --- | --- |
| **C1** | **Piloto real** con 2-3 agentes, 4-6 docentes y 1 responsable de CACE, con los indicadores del punto B4 | Servidor, cuentas reales y fecha de la CACE |

Sin C1, la observación principal de la evaluación sigue abierta, por mucho código que se escriba.

---

## 4. Bloque D — Pendientes de la revisión de tesis que faltaban

Estas partidas vienen de la revisión del informe técnico y de la respuesta a la evaluación. Algunas
ya quedaron parcialmente resueltas en el v10; se indica para no volver a pagar lo mismo.

| ID | Tarea | Estado / criterio de aceptación | Est. |
| --- | --- | --- | --- |
| **D1** | **Cierre editorial de portada y metadatos** | ❌ Pendiente / verificar en Word. Criterio: una sola portada, fecha real, sin marcador del formato de evaluación, fechas de referencias completas, sin pies huérfanos, sin párrafos vacíos, `dc:title`/`dc:creator` completos y estilos de encabezado unificados | **2 h** |
| **D2** | **Figuras y referencias cruzadas** | 🟡 Parcial. ER, contenedores y API REST regenerados; falta verificar el cronograma, sustituir las capturas viejas por acceso/recuperación/verificación/panel/verificación de certificado y renumerar los pies con referencias reales de Word | **3 h** |
| **D3** | **Resultados, conclusiones, recomendaciones y anexos** | ❌ Pendiente, dentro de B1. Capítulo de resultados con capturas y casos ejecutados; conclusión que responda uno por uno a los objetivos; trabajo futuro desde `plan-de-fases-pendientes.md`; anexos de diccionario de datos y evidencia de pruebas | **incluido en B1** |
| **D4** | **Requerimientos, cola de correo y §2.8** | ❌ Pendiente. Añadir los 7 RF y 3–4 RNF que faltan; reescribir RNF-01; documentar la cola de correo; describir CI, `tsc` strict, lint, 19 archivos e2e y 186 casos | **4 h** |
| **D5** | **Índices, TOC y campos de Word** | ❌ Pendiente. Actualizar el índice general, el de figuras y el de tablas con `Ctrl+E` y `F9`; verificar que los pies conservan los campos `SEQ` después de editar | **0,5 h** |
| **D6** | **Sincronización final con el repositorio** | ❌ Pendiente, se solapa con B5. Incorporar privacidad, panel de desempeño, secretaría de institución, dashboard y cifras actuales; regenerar figuras afectadas | **2 h** |
| **D7** | **Citar el análisis integral del 16-oct** | ❌ Pendiente. Referenciar `docs/auditorias/analisis-integral-2026-10-16.md` y explicar qué hallazgos se corrigieron | **0,5 h** |
| **D8** | **Remates de anexos y peso del archivo** | ❌ Pendiente. Diccionario de datos, evidencia de pruebas, fechas de consulta, metadatos, estilos y limpieza de duplicados VML/SVG (≈ 777 KB) | **2 h** |

### 4.1 Lo que ya no se repite

- **Tanda A** (título, objetivo, Scrum, arquitectura, rendimiento y conclusión) ya está en el v10.
- **Cifras, Anexo C y Anexo B** ya están en el v10.
- **Privacidad, retención, panel y cabeceras** ya están en el código.
- **Respaldo y restauración manual** ya se probaron en L6; de A5 solo queda automatizar y repetir.

### 4.2 Lo que no se implementa antes del piloto

- **A8** zona horaria por institución.
- **A9** interfaz multilingüe.
- **A10** matching de pares académicos.
- **A11** resultados de aprendizaje y rúbrica.
- **Multi-institución con observadores** (más de dos instituciones; observadores sin certificado).

Se declaran como alcance previsto, con requisitos escritos, no como trabajo hecho. Implementarlos
antes del piloto sería ampliar el proyecto en la peor semana.

---

## 5. Orden real hasta el día del piloto

### 5.1 Regla de prioridad

| Prioridad | Qué entra | Por qué |
| --- | --- | --- |
| **P0 — Proteger el piloto** | A5, A3, A2, A4, A6, B4, C1 | Evita pérdida de datos, fuga entre instituciones, archivos falsos y caídas sin aviso |
| **P1 — Sostener la defensa** | A1, B2, B3, B5, D1, D2, D5 | Convierte el informe en evidencia verificable |
| **P2 — Cerrar el documento** | D4, D6, D7, D8 | Pule lo que un sínodo revisa al final |
| **P3 — Después del piloto** | B1, D3, A8–A11, A7 | Dependen de resultados reales o son alcance nuevo |

### 5.2 Bloque inmediato: hoy o mañana

1. **A5 — automatizar respaldo y repetir restauración** (2 h restantes).
   - No basta el respaldo manual de L6: dejar script, programarlo y probar una restauración.
2. **A3 — JWT de 32 bytes** (1 h).
3. **B4 — protocolo de aceptación** (3 h).
   - Es barato, no depende del código y ordena el piloto.
4. **A2 — aislamiento institucional** (6 h).
   - Es la prueba que más tranquiliza antes de meter datos reales.
5. **A4 — firma de evidencias** (3 h).
6. **A6 — health check externo y trazas** (4 h).

Si el piloto es **en uno o dos días**, haz solo estos seis y no abras A1, B1 ni D2.

### 5.3 Si quedan tres a cinco días

Después del bloque inmediato:

- **A1** — pruebas de frontend (8 h).
- **B2** — matriz de trazabilidad (6 h).
- **B3** — matriz de auditorías (3 h).
- **D1/D5** — cierre editorial e índices (2,5 h).
- **B5** — sincronización del informe (2 h).

Con esto el informe queda defendible sin tocar la estructura.

### 5.4 Si queda una semana o más

- **A1** completo, no solo los flujos mínimos.
- **B2/B3/B4/B5** completos.
- **D2** figuras y capturas.
- **D4** requerimientos y §2.8.
- **D6/D7/D8** remates.
- **B1** solo cuando el piloto ya haya terminado y resultados estén congelados.

### 5.5 Después del piloto

1. Cerrar **C1** y registrar indicadores.
2. Rehacer **B1** y **D3** con resultados reales.
3. Actualizar **B5** una sola vez.
4. Recién entonces decidir **A8–A11** y multi-institución.
5. **A7** solo si hay servidor propio y una razón medida.

---

## 6. Checklist de corte antes de tocar datos reales

- [ ] A5: respaldo programado y restauración probada.
- [ ] A3: secreto JWT de al menos 32 bytes.
- [ ] A2: aislamiento institucional probado.
- [ ] A4: evidencias validadas por contenido.
- [ ] A6: `/health` vigilado y errores 5xx trazables.
- [ ] B4: protocolo de aceptación listo.
- [ ] C1: fecha, participantes y responsable de CACE confirmados.
- [ ] Servidor de la VM probado con la guía de Ubuntu.
- [ ] Paquete L6 y SHA identificados.
- [ ] Respaldo fuera de la VM.
- [ ] Datos reales, aviso de privacidad y autorización revisados.

**Si falta cualquiera de los cinco primeros, no se empieza el piloto.**

## 7. Checklist de corte para la entrega del informe

- [ ] D1: portada, fecha, metadatos y pies.
- [ ] D2: figuras y referencias cruzadas.
- [ ] D5: índice general, figuras y tablas actualizados.
- [ ] A1: pruebas de frontend.
- [ ] B2: matriz de trazabilidad.
- [ ] B3: matriz de auditorías y declaración de herramientas.
- [ ] B5/D6: cifras, privacidad, panel y secretaría sincronizados.
- [ ] D4: RF/RNF, cola de correo y §2.8.
- [ ] B1/D3: siete capítulos, resultados y conclusiones.
- [ ] El ZIP de entrega coincide con la versión del informe.

---

## 8. Lo que yo haría primero, en una frase

**Primero dejo el piloto seguro (A5, A3, A2, A4, A6, B4); después cierro la evidencia que exige el
sínodo (A1, B2, B3, B5, D1, D2, D5); y dejo la reestructuración (B1) y el alcance nuevo para después
del piloto.**

La reestructuración es la tarea más cara y la que más cambia con los resultados reales. Pagarla dos
veces no mejora la titulación; solo retrasa el piloto.
