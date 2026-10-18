# Análisis integral del proyecto — Clases Conjuntas

> **Fecha:** 16 de octubre de 2026 · **Alcance:** producto, documentación y código.
> **Método:** lectura de `docs/` (los 34 `.md` previos, 11 368 líneas) + verificación directa del repositorio
> (código, esquema Prisma, migraciones, git, compilación y pruebas). **No** se levantó la base de
> datos ni se ejecutó la aplicación, así que todo lo que depende de datos vivos se marca como
> «no comprobado en ejecución».
>
> **Nota (17-oct-2026):** después de este análisis se añadió el envío del calendario por correo
> (`POST /proyectos/:id/calendario/enviar`, +1 ruta), se quitó el campo de orden de los países de
> la comunidad y se añadió una prueba de esa ordenación: las cifras de rutas de este documento
> (126) pasan a 127 en el estado actual del repositorio.
>
> **Nota (18-oct-2026):** ya se hizo la optimización de rendimiento que pedía este análisis:
> estáticos con gzip y caché (login en frío 1.014.948 → 186.979 B), 41 índices de base de datos
> (migración `20261018011641_indices_de_rendimiento`) y logo del acceso de 532 KB a 15 KB. El
> detalle está en [`../producto/rendimiento.md`](../producto/rendimiento.md). Las menciones a
> «0 `@@index`» y al peso de los estáticos de este documento describen el estado del 16-oct-2026.

---

## 1. Veredicto en una página

**El proyecto está por encima de lo que es habitual en un TFG**: producto funcional de ciclo
completo, autoridad externa (CACE) modelada, certificados con verificación pública criptográfica,
cinco rondas de auditoría con respuesta, 11 368 líneas de documentación y un esquema de 32 tablas
migrado y versionado. La arquitectura es coherente y hay decisiones de diseño que se sostienen
(permisos por capacidad, estados centralizados, PDFs no servidos como estáticos, folio derivado por
HMAC).

**Los tres riesgos reales no son de arquitectura, son de verificación y de sincronía:**

| # | Riesgo | Evidencia |
|---|---|---|
| 1 | **No hay pruebas automatizadas del flujo crítico.** 126 rutas de API y solo 3 casos triviales (2 corren por defecto). | `backend/src/app.controller.spec.ts` (20 líneas), `backend/src/prisma/prisma.service.spec.ts` (17), `backend/test/app.e2e-spec.ts` (stub). `jest`: 2/2 en 47 s. `README.md:1736` admite la casilla vacía. |
| 2 | **La documentación de gestión y de usuario quedó congelada antes del último tercio del producto.** El informe de actividades, el informe al cliente, el manual y la presentación no incluyen CACE ni certificados. | `informe-de-actividades.md:625-640` (23-sep, «árbol limpio»), `informe-para-el-cliente.md:459-475` («tres rondas»), `manual-de-usuario.md:62` («Los dos roles»), `guion-de-estudio.md:5`. |
| 3 | **Hallazgos de auditoría abiertos que tocan seguridad y reglas de negocio.** De la QA 4 se cerraron los dos críticos y dos importantes (QA-01, QA-02, QA-10, QA-17); el resto sigue vivo en el código. | QA-03, QA-04, QA-12, QA-14, QA-15, QA-20 + `m7`/QA-29. Verificado en esta pasada (§5). |

**Lo que sí está resuelto:** compila sin errores (`tsc --noEmit`, exit 0), `.env` fuera de git
(`backend/.gitignore:39`), CORS restringido, rate limit en login/activación, `passwordHash` omitido
por defecto, subidas en lista blanca y forzadas a descarga, folio de certificado verificado en
tiempo constante, invitaciones de un solo uso y verificación pública sin caché (`README.md:1442-1471`).
La QA 5 (código muerto) se aplicó en buena parte: `bootstrap` ya no está en `package.json`, la cadena
muerta del formulario de invitación ya tiene consumidor (`layout.component.ts:827` →
`agente.component.ts:117`) y los 142 archivos duplicados por *junctions* salieron de git.

**Nota de credibilidad:** las auditorías se contradicen entre sí en al menos 8 puntos (una respuesta
da por corregido algo que la ronda siguiente reabre), y el propio repositorio lo reconoce. Eso es
mejor que un documento impoluto: demuestra que hubo revisión real. Pero conviene que el informe final
no repita las afirmaciones ya desmentidas.

---

## 2. Qué es el producto (según docs, confirmado en código)

Plataforma web **B2B institución↔institución** para gestionar *clases espejo* (una experiencia
académica conjunta entre docentes de dos instituciones), con la **CACE** como autoridad que aprueba
instituciones, da identidad a la comunidad y respalda los **certificados**.

**Cuatro roles reales**, deducidos de vínculos, no de una columna (`common/capacidades.ts`):

| Rol | Alcance |
|---|---|
| `DOCENTE` | Propone clases espejo, organiza el proyecto (planificación, sesiones, actividades, evidencias, reportes, evaluación), gestiona alumnos y emite/anula certificados. |
| `AGENTE` | Gestiona institución, docentes, materias y asignaciones; revisa solicitudes y confirma el alta de agentes nuevos. |
| `PRESIDENTE_CACE` | Aprueba/rechaza/veta/reactiva instituciones, personaliza la CACE, firma la plantilla del certificado, nombra secretarías y transmite la presidencia. |
| `SECRETARIA_CACE` | Permisos fijos: solicita el borrado de instituciones, administra premios y personalización. Sin firma ni veto. |

**Ciclo funcional**: registro con «buscar antes de crear» → aprobación de la CACE → invitación y
activación del docente → solicitud de clase espejo con **doble revisión** (origen → destino) →
proyecto + planificación conjunta → sesiones/actividades/evidencias → reportes firmados → evaluación
→ cierre → lista de alumnos → **emisión, envío, anulación y verificación pública del certificado**.

**Fases del plan de acción (`producto/plan-de-accion.md`)**: 0 (permisos), 2 (instituciones),
3 (identidad), 4 (emisión), 5 (confianza y entrega) y 6 (secretarías y transmisión) están
**implementadas** según `README.md:1887-1901`; verificado: existen los módulos `cace` (34 rutas) y
`certificados` (15 rutas) y las 23 migraciones cubren hasta `mejorar-premios`.

---

## 3. Radiografía técnica verificada

### 3.1 Stack real (leído de los `package.json`, no de la prosa)

| Capa | Tecnología | Nota |
|---|---|---|
| Backend | NestJS **11**, Prisma **6.19.3**, PostgreSQL | `main.ts` con `ValidationPipe`, filtro de excepciones Prisma y *fallback* de SPA para rutas de API. |
| Auth | `@nestjs/jwt` + `bcrypt` | `JwtAuthGuard` revalida cuenta e institución activa en **cada** petición. |
| Correo | Nodemailer | Obligatorio para invitar docentes. |
| Documentos | `pdfkit`, `qrcode`, `exceljs`, `jszip` | PDF + QR + listas Excel + ZIP. |
| Frontend | Angular **21.2** standalone, `signal()`, sin `zone.js` | 102 usos de `signal(`; no hay `provideZonelessChangeDetection` porque Angular 21 ya es zoneless por defecto (y no hay polyfill de zone). |
| Estado | Signals + servicios (`UiStateService`) | No hay NgRx: correcto para el tamaño. |
| Build | Frontend compilado **dentro** de `backend/public` | `frontend/dist` existe desde 2026-09-23; `backend/public` reconstruido el 2026-10-16. |

### 3.2 Volumen y estructura

| Métrica | Valor |
|---|---|
| Backend `src` | **127** archivos `.ts`, **14 905** líneas |
| Frontend `src` | **64** `.ts` (13 431 líneas) + **18** `.html` (7 228) + `styles.css` (**4 011** líneas, sin SCSS) |
| Módulos backend | 11 de dominio (`agentes, asignaciones, auth, cace, certificados, instituciones, mail, materias, prisma, proyectos, recordatorios, solicitudes, usuarios`) |
| Rutas de API | **126** decoradores en **23 clases** controladoras (22 archivos): `proyectos` 31, `identidad-cace` 16, `agentes` 8, `instituciones` 7, `certificados` 7, `instituciones-cace` 6, `plantillas` 6, `solicitudes` 6, `materias` 5, `listas-alumnos` 5, `usuarios` 4, `auth` 4 y menores |
| Autorización | **39** `@Requiere` declarados: ~87 de las 126 rutas validan a mano dentro del servicio (8 `ForbiddenException` en `proyectos.service.ts`) |
| Modelo de datos | **32** modelos, 62 relaciones, **23** migraciones, **0** `ENUM`, **0** `CHECK`, **0** `@@index`, 12-13 `@unique`, **1** `@@unique` |
| Pruebas | **3** casos triviales en 3 archivos (2 suites corren por defecto: 2/2 en 47 s; `app.e2e-spec.ts` pide su propio config) · 1 spec trivial de frontend · **sin** CI (`.github` no existe) |
| Lint y tipos | ESLint 9 solo en backend (`eslint.config.mjs`); frontend **sin** ESLint · `tsconfig` backend con `noImplicitAny: false` y sin `strict`; frontend sí `strict` + `strictTemplates` |
| Git | **91** commits, 2026-08-28 → 2026-10-16, 426 archivos, 23.2 MB |
| Documentación | **34** `.md`, **11 368** líneas, 711 KB, 27 imágenes, 14 diagramas |

### 3.3 Patrones que merecen elogio

1. **Permisos por capacidad, no por rol**: matriz de 26 capacidades en `common/capacidades.ts` +
   `@Requiere()`/`CapacidadesGuard`. Añadir un permiso es añadir una fila, no buscar comparaciones
   de rol por el código. Es la decisión que más ha envejecido bien del proyecto.
2. **Estados centralizados** en `common/estados.ts` (25 constantes), con la regla escrita en
   `README.md:1606`.
3. **Certificados bien pensados**: el folio determina el código de verificación por HMAC-SHA256 (no
   se guarda), alfabeto de 32 símbolos sin ambigüedad, comparación en tiempo constante, formato
   validado **antes** de tocar la base, PDF no servido como estático y respuesta `no-store`.
4. **Endurecimiento de archivos**: lista blanca de extensiones rechazando `.html/.svg/.js`, descarga
   forzada, `nosniff`, CSP `default-src 'none'` (`main.ts:74-104`).
5. **Auditorías con respuesta**: 5 rondas documentadas, con hallazgos fechados, severidad y commit
   del arreglo. Es el activo documental más valioso del repositorio.

---

## 4. Estado documentado vs. estado real (deriva concreta)

La documentación **técnica** (`docs/README.md`) es buena y está viva, pero arrastra cifras y fechas
que ya no cuadran. La **documentación de gestión y de usuario** quedó congelada el 23-sep, antes de
las fases de la CACE y los certificados (10–16 oct).

| Afirmación documentada | Realidad verificada | Dónde |
|---|---|---|
| «122 rutas» | 126 decoradores de ruta en 23 clases controladoras | `README.md:1912` |
| «21 migraciones» | **23** directorios en `prisma/migrations` | `README.md:1839, 1908` |
| «32 tablas» | 32 modelos ✅ | `README.md:743` |
| Informe de actividades: 46 commits, 9 migraciones, 22 tablas, 16 documentos, árbol limpio | 91 commits, 23 migraciones, 32 tablas, 34 documentos, **árbol sucio** (v5 modificado; v6/v7 y un script sin seguimiento; `~$` de Word) | `informe-de-actividades.md:395-420, 601-613, 625-640` vs `git status` |
| «Tres rondas de revisión» y estado sin CACE ni certificados | 5 rondas; el producto incluye CACE, certificados, premios y verificación | `informe-para-el-cliente.md:461-475` |
| «Los dos roles» (manual) | 4 roles; el manual solo dedica 4 menciones incidentales a la CACE y ninguna al panel del presidente/secretaría, al diseño del certificado, a los premios ni a la verificación pública | `manual-de-usuario.md:62` |
| Presentación/discurso: 2 menciones de CACE en total | El diferencial del producto son precisamente la CACE y los certificados | `guion-de-estudio.md`, `discurso-para-exponer.md` |
| Informe técnico de la tesis | **4 versiones** (v4 1.26 MB, v5 2.77 MB, v6 2.74 MB, v7 3.01 MB) + `~$` de Word; v6/v7 **sin commitear**; no consta cuál es la vigente | `docs/tesis/` |

**Lo que sí está sano:** los 65 enlaces relativos entre documentos resuelven (0 rotos), `.env` está
ignorado (`backend/.gitignore:39`), no hay `TODO`/`FIXME` ni código comentado (QA 5 lo certifica y lo
revisé: `ESLint` solo marca 2 variables), `prisma validate` es válido y las 23 migraciones cubren el
esquema.

---

## 5. Hallazgos abiertos (verificados hoy en el código)

No repito los cerrados. Estos son los que **siguen vivos** en el código de `main`:

| ID | Hallazgo | Verificación en el código (2026-10-16) | Severidad |
|---|---|---|---|
| QA-03 | El alta pública de agentes no tiene límite de intentos | `auth.controller.ts:13` (`POST /auth/register`) **sin** `RateLimitGuard`; solo lo tienen login (`:21`) y activación (`:38`) | 🟠 Alto |
| QA-04 | Las evidencias se sirven sin autenticación | `main.ts:104` `useStaticAssets(uploadsDir, { prefix: '/uploads/' })`; hay mitigación (descarga forzada, `nosniff`, CSP, certificados en 404) pero **no** hay comprobación de pertenencia: quien tenga la URL, baja el archivo | 🟠 Alto |
| QA-12 | El cierre se valida por conteos, no por conjuntos | `proyectos.service.ts:797-810`: `sesiones.count()` vs `reportesConfirmados.count()`; dos reportes de una sesión «compensan» otra sesión sin acta | 🟡 Medio-alto |
| QA-14 | La planificación la aprueba el propio docente | Sin cambio: el «visto bueno» sigue sin pasar por el agente (`proyectos.service.ts`, participación de planificación) | 🟡 Medio |
| QA-15 | Un acta confirmada se puede re-firmar sin invalidar firmas ajenas | Sin cambio en `proyectos.service.ts` | 🟡 Medio |
| QA-16 | El estado `CANCELADO` de proyecto es inalcanzable | Sin cambio (no hay acción de cancelación) | 🟡 Bajo-medio |
| QA-20 | El motivo del rechazo no llega al docente | `docente.component.html:196-209` solo pinta la etiqueta de estado; el modelo trae `revisiones` (`solicitud.models.ts:55`) pero **ninguna plantilla** las muestra | 🟡 Medio |
| QA-29 / `m7` | Sin `ENUM`/`CHECK` y sin unicidad compuesta clave | 0 `ENUM`, 0 `CHECK`, 1 solo `@@unique` en 32 modelos; los estados se validan solo en la aplicación | 🟡 Medio (estructural) |
| QA-05 | Enlace de invitación derivado de cabeceras del cliente | **Mitigado**: `common/url-publica.ts:39-44` exige `URLS_PERMITIDAS`, pero **si la variable está vacía se acepta cualquier host** (`hostsPermitidos()` vacío = cualquiera). Falta fijarla en los `.env` de producción | 🟡 Medio |
| — | `JWT_SECRET` es también la clave HMAC del código de certificado | `certificados/codigo-verificacion.ts:105` lee `JWT_SECRET`: **rotar el secreto de sesión invalida todos los códigos de verificación** ya emitidos. Falla en acoplamiento, no en criptografía | 🟠 Alto (operación) |
| — | El rate limit vive en memoria y es parcial | `common/guards/rate-limit.guard.ts:21-24` guarda el mapa en el proceso (no sirve con varias instancias) y solo cubre login/activación: `POST /auth/register` y `GET /verificar/:folio` quedan sin freno | 🟠 Alto |
| — | Sin cabeceras de seguridad globales (no hay `helmet`) | `main.ts:60-72`: no hay HSTS, `X-Frame-Options` ni CSP global; solo `/uploads` y `/avatares` fijan `nosniff` (`main.ts:99-101, 111-112`) | 🟡 Medio |
| — | Autorización dispersa: 39 `@Requiere` para 126 rutas | El resto valida a mano en el servicio (8 `ForbiddenException` en `proyectos.service.ts`, 3 en `certificados.service.ts`, 2 en `listas-alumnos.service.ts`). Funciona, pero un endpoint nuevo puede nacer sin control | 🟡 Medio |
| — | 0 `@@index` en 32 modelos | Con datos reales, las consultas por `proyectoId`/`institucionId`/`usuarioId` harán *table scan*. No se nota con la demo; sí en producción | 🟡 Medio |
| — | `ValidationPipe` sin `forbidNonWhitelisted` | `main.ts:70`: los campos extra se descartan en silencio en vez de rechazarse | 🟢 Bajo |
| — | JWT en `localStorage` | `auth.service.ts:30, 122-123`: un XSS lo exfiltra; sin refresh ni revocación, expira en 1 día (`auth.module.ts:20`) | 🟡 Medio |
| CM-01 (v5) | Duplicación entre paneles de agente y docente (~450 líneas) | Siguen siendo dos componentes separados (1 143 + 1 083 líneas de plantilla) | 🟢 Bajo (mantenibilidad) |

**Cerrados y verificados:** QA-01 (fechas), QA-02 (caducidad al nacer), QA-10 (aprobación atómica),
QA-11 (edición de solicitud aprobada: `solicitudes.service.ts:246-252` solo permite editar
`PENDIENTE/RECHAZADA/CADUCADA`), QA-17 (recordatorio del agente), QA-05 parcial, CM-15 y CM-21 de la
QA 5.

---

## 6. Riesgos por área y prioridad

### P0 — antes de presentar o desplegar

1. **Cobertura de pruebas en el camino crítico.** Con 126 rutas y cero pruebas de flujo, cualquier
   refactor es a ciegas. Mínimo recomendable: 30–40 pruebas e2e sobre
   (a) registro → aprobación CACE → invitación → activación; (b) doble revisión y atomicidad;
   (c) matriz de capacidades (un test por rol × ruta sensible); (d) certificados: emisión, anulación,
   reemisión, HMAC y página pública; (e) reglas de cierre. Añadir CI (lint + `tsc --noEmit` + `jest`
   + `prisma validate`) en `.github/workflows`.
2. **QA-03**: `RateLimitGuard` en `POST /auth/register` (y, si se puede, verificación de correo).
   Es el único endpoint público de escritura sin freno.
3. **QA-04**: endpoint autenticado de descarga de evidencias que valide pertenencia (al proyecto o a
   la sesión) en vez de `useStaticAssets`. Es el hallazgo de seguridad abierto más citado en las
   auditorías y el más fácil de explotar con una URL filtrada.
4. **Cerrar el control documental de la tesis**: declarar v7 como vigente, commitearla, eliminar el
   `~$` de Word y las copias de la raíz (`Informe_..._v2/v3/corregido.docx`, ya ignoradas pero
   presentes).

### P1 — siguiente iteración

5. **QA-12 / QA-14 / QA-15 / QA-20** (reglas de cierre, autoridad de aprobación de planificación,
   invalidación de firmas y visualización de revisiones). Son las que un tribunal puede probar en
   vivo en una demo.
6. **QA-29 + `m7`**: migración con `ENUM`/`CHECK` para los estados y `@@unique` en
   `ASIGNACION_DOCENTE`, `DOCENTE_INSTITUCION` y `MATERIA` (verificar duplicados históricos antes).
7. **Endurecimiento de seguridad** (los cuatro hallazgos medios verificados):
   `helmet` con HSTS/`X-Frame-Options`/CSP global en `main.ts`; secreto propio `CERT_CODE_SECRET`
   para el código de certificado (hoy se usa `JWT_SECRET`, así que rotarlo invalida los códigos
   emitidos); `@@index` en las FKs consultadas (`proyectoId`, `institucionId`, `usuarioId`,
   `solicitudId`); y rate limit que cubra `register` y `/verificar/:folio` (o al menos sacar el mapa
   en memoria, que no sirve con más de una instancia).
8. **Cerrar la autorización en el borde**: 39 `@Requiere` para 126 rutas; declarar la capacidad en
   los ~87 endpoints que hoy validan a mano en el servicio (el `CapacidadesGuard` ya lo soporta).
9. **Actualizar la documentación de gestión y de usuario** para que cubra CACE y certificados:
   manual (capítulos de presidente/secretaría, certificado y verificación), informe al cliente
   (estado real y «cinco rondas»), presentación (diapositiva de CACE + certificado + QR) e informe de
   actividades (cifras y fecha). Alinear las cifras del README (122→126 rutas, 21→23 migraciones).
10. **Higiene del repositorio**: borrar `.tmp-chrome*` (**553 MB** entre 4 carpetas), decidir política
    de `.docx` (Git LFS o carpeta externa), sacar las *junctions* `backend/.agents/skills` del
    control de versiones (**71 archivos**), retirar el andamiaje SSR inerte (`main.server.ts`,
    `server.ts`, `@angular/ssr` sin uso) y añadir `.env.example` (hoy solo existe `.env` local,
    correctamente ignorado).

### P2 — deuda asumible

11. Partir los monolitos del frontend: `cace.component.ts` (**2 283** líneas) y `.html`
    (**2 040**), `proyecto` (1 605/1 389), `agente` (1 143/1 083). Extraer los componentes comunes de
    agente/docente (CM-01) y trocear `styles.css` (4 011 líneas, sin SCSS).
12. Operación: backups automatizados (hoy hay guía y restauración manuales), monitorización del
    `/health`, y script de despliegue reproducible (no hay Docker ni CI).

---

## 7. Qué diría un evaluador (lectura externa)

- **A favor**: el producto no es un CRUD de ejemplo; tiene ciclo de vida completo, autoridad externa,
  documento con validez verificable públicamente y una cultura de auditoría poco frecuente. La
  documentación (11 k líneas) y los 14 diagramas están por encima de la media.
- **En contra**: la distancia entre lo que la documentación promete y lo que está verificado *en
  ejecución* es el punto débil. El informe de actividades afirma un árbol limpio y 46 commits cuando
  hay 91 y cambios sin commitear; el informe al cliente habla de «tres rondas» y no menciona la CACE;
  el manual describe dos roles cuando hay cuatro. Ninguna de esas frases es falsa cuando se escribió,
  pero hoy todas están desactualizadas y son verificables en cinco minutos.
- **La pregunta que más riesgo tiene en una defensa**: «¿cómo sabes que funciona?». La respuesta hoy
  es «lo probé a mano con Thunder Client y con capturas» (`README.md:1472-1474`). Con 30–40 pruebas
  automatizadas y CI esa respuesta pasa de anécdota a evidencia.

---

## 8. Cómo se verificó (reproducible)

```text
# volúmenes y modelo
(Select-String schema.prisma '^model ').Count          → 32
Get-ChildItem prisma\migrations -Directory             → 23
(Select-String src -Pattern '@(Get|Post|Put|Patch|Delete)\(').Count → 126 (23 clases controladoras)

# compilación y pruebas
npx tsc -p tsconfig.json --noEmit                      → exit 0
npx jest --runInBand                                   → 2 suites, 2 tests, PASS (47 s)

# documentación
34 .md · 11 368 líneas · 711 KB · 65 enlaces relativos, 0 rotos

# git
91 commits · 426 archivos · 23.2 MB · git status: 1 modificado + 3 sin seguimiento
```

---

## 9. Conclusión

El proyecto está **terminado en producto y a medias en verificación**. Lo que falta no es código
nuevo: es (1) pruebas automatizadas que demuestren lo que ya funciona, (2) cerrar los cuatro
hallazgos abiertos que tocan dinero o datos ajenos (QA-03, QA-04, QA-12, QA-20) y (3) sincronizar la
documentación de gestión con el producto de octubre. Con esas tres cosas hechas, la distancia entre
lo que el repositorio dice ser y lo que el repositorio demuestra ser desaparece, que es exactamente
lo que se evalúa en una entrega final.
