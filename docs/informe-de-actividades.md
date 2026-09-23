# 📋 Informe de actividades — Proyecto Clases Conjuntas

**Informe de avance con evidencia verificable**
Fecha del informe: **23 de septiembre de 2026**

---

## 1. Datos generales

| Campo | Valor |
| --- | --- |
| **Proyecto** | Clases Conjuntas — plataforma B2B de clases espejo (Comunidad CACE) |
| **Tipo** | Proyecto académico de tesis |
| **Autor** | Ricardo Soto (`RICARDOSOTO6`) — `RICARDOSOTO6@CECYTE.EDU.MX` |
| **Repositorio** | <https://github.com/RICARDOSOTO6/clases-espejo> (público) |
| **Rama** | `master` |
| **Periodo documentado** | **28 de agosto → 18 de septiembre de 2026** (evidencia en Git) |
| **Días con actividad registrada** | 9 |
| **Commits** | 28 |
| **Stack** | NestJS 11 + Prisma 6.19.3 + PostgreSQL 17 · Angular 21 (zoneless) + TypeScript |
| **Plan de referencia** | `docs/readme`, plan de desarrollo de 8 semanas |

> **Alcance de este informe.** Todo lo que se afirma aquí está respaldado por una
> fuente verificable: un *commit* (con su hash y fecha), una migración de base de
> datos, un documento del repositorio o una medición ejecutada en la fecha del
> informe. Al final (Anexo B) están los comandos exactos para reproducir cada
> dato.

---

## 2. Resumen ejecutivo

| Indicador | Resultado |
| --- | --- |
| Semanas del plan completadas | **7 de 8** (semanas 1 a 7 terminadas y verificadas; la 8 en curso) |
| Ritmo | Las 7 semanas se completaron en **3 semanas calendario** de trabajo registrado |
| Commits | 28 (5 en agosto, 23 en septiembre) |
| Código fuente | **11 842 líneas** (backend 3 901 · frontend 7 941) |
| Modelo de datos | **22 tablas**, 9 migraciones aplicables |
| API | **59 endpoints** en 9 controladores |
| Documentación | **13 documentos**, 6 440 líneas, más la primera parte de la tesis (`.docx`) |
| Auditorías | **3 rondas**: 21 hallazgos en las dos primeras + 35 de código y 9 de diseño en la tercera |
| Datos de demostración | **273 registros** verificados en la base de datos |
| Estado de compilación | Backend ✅ · Frontend ✅ · Esquema Prisma ✅ (verificado el 23-sep) |

**Conclusión de avance:** el ciclo funcional completo (de registro de institución
a cierre de la clase espejo) está implementado, auditado en tres rondas y
documentado. Lo que resta es la semana 8: recuperación de contraseña, prueba
integral sobre la versión compilada y el despliegue.

---

## 3. Metodología y trazabilidad de la evidencia

### 3.1 Fuentes de evidencia utilizadas

| Tipo de evidencia | Fuente | Qué demuestra |
| --- | --- | --- |
| **Historial de versiones** | `git log` (28 commits, 28-ago → 18-sep) | Qué se hizo, cuándo y en qué orden |
| **Migraciones** | `backend/prisma/migrations/` (9 carpetas con fecha en el nombre) | Cómo evolucionó el modelo de datos |
| **Documentos** | `docs/` (13 archivos Markdown + tesis) | Diseño, auditorías, manuales y guías |
| **Código** | `backend/src`, `frontend/src` | Implementación de cada módulo |
| **Mediciones** | Comandos ejecutados el 23-sep-2026 | Estado real de compilación, esquema y datos |
| **Conteo en base de datos** | Consulta de solo lectura a las 22 tablas | Volumen real de datos de demostración |

### 3.2 Criterio de honestidad

Se distingue en todo el informe entre:

* **Verificado** — comprobado con un comando o lectura directa del archivo.
* **Evidenciado por commit** — existe un commit con hash y fecha que lo respalda.
* **En curso** — trabajo presente en el árbol de archivos pero **sin commitear**
  (sección 11), que por tanto todavía no puede citarse como evidencia formal.

---

## 4. Cronología detallada por fechas

### 🟢 Fase 1 — Arranque y cimentación · 28–29 de agosto de 2026

**Objetivo:** dejar el proyecto en pie: repositorio, NestJS, Prisma, base de datos
y documentación inicial.

| Evidencia | Detalle |
| --- | --- |
| `5cf3603` · 28-ago | *Initial project setup* |
| `b1bc81d` · 28-ago | *fix: configurar NestJS Prisma y variables de entorno* |
| `1700922` · 29-ago | *creacion del radme* |
| `3c677c5` · 29-ago | *creacion del radme 2* |
| Migración `20260828144308_init` | **333 líneas de SQL**: crea el modelo de datos completo |
| Migración `20260828162600_hacer_password_opcional` | Ajuste del modelo de usuario para el flujo de invitación |

**Resultado:** esquema de base de datos completo desde el inicio (decisión de
diseño: modelar todo antes de programar la lógica) y primer documento de
planificación.

---

### 🟢 Fase 2 — Autenticación en el backend y unificación del repositorio · 31 de agosto de 2026

**Objetivo:** autenticación funcional y un solo repositorio para backend y frontend.

| Evidencia | Detalle |
| --- | --- |
| `32586a3` · 31-ago | *feat: backend auth, timestamps, migraciones y unificar frontend en el repo* |
| Migración `20260831155142_agregar_token_invitacion_usuario` | Token de invitación en el usuario |
| Migración `20260831194048_agregar_timestamps_globales` | 77 líneas: marcas de tiempo globales |

---

### 🟢 Fase 3 — Autenticación completa y Semana 1 · 2 de septiembre de 2026

**Objetivo:** cerrar el módulo de autenticación de punta a punta y entregar la
**Semana 1** del plan (catálogo de materias y asignación docente ↔ materia).

| Evidencia | Detalle |
| --- | --- |
| `def75f5` · 02-sep | *feat: autenticación completa (backend modular + frontend Angular)* |
| `abb1b64` · 02-sep | *feat: semana 1 - materias y asignacion docente-materia* |
| Migración `20260902210546_agregar_dni_apellidos_invitacion` | Datos de identificación y apellidos en la invitación |

**Entregable del plan cumplido:** el agente da de alta materias y las asigna a
docentes por periodo escolar.

---

### 🟢 Fase 4 — Semanas 2 y 3, y el modo oscuro · 4 de septiembre de 2026

**Objetivo:** panel real del agente (Semana 2) y solicitudes de clase espejo del
lado docente (Semana 3).

| Evidencia | Detalle |
| --- | --- |
| `aa2d1d1` · 04-sep | *feat: correcciones de revision y semana 2 (docentes, instituciones y panel del agente)* |
| `d66dab3` · 04-sep | *feat: semana 3 - solicitudes de clase espejo (lado docente)* |
| `b360da6` · 04-sep | *feat: modo oscuro* — 6 archivos, 187 líneas: `theme.service.ts`, estilos y selector de tema |
| Migración `20260905000000_agregar_registro_completo_institucion` | Control de registro completo de la institución |
| Migración `20260905120000_agregar_estandares_internacionales` | País ISO, tipo de documento y datos de contacto |

> **Nota sobre el modo oscuro (con evidencia).** Se implementó el **4-sep** en el
> commit `b360da6` y **se retiró por completo el 14-sep** en el commit
> `082efb5`: hoy no queda ninguna referencia en el código (verificado: 0
> ocurrencias de `dark` en `frontend/src`). Responde a una **decisión
> institucional** de un superior, no a un problema técnico.

---

### 🟢 Fase 5 — Semana 4 y estándares internacionales · 9 de septiembre de 2026

**Objetivo:** revisión de solicitudes por parte del agente (Semana 4) y
formalización de los estándares internacionales.

| Evidencia | Detalle |
| --- | --- |
| `70fb5f9` · 09-sep | *feat: estándares internacionales, gate de institución y validación de texto* |
| `8edfdd2` · 09-sep | *feat: semana 4 - revisión de solicitudes (lado agente)* |
| `5198d78` · 09-sep | *docs: actualizar readme al estado actual del proyecto* |
| Migración `20260909140000_agregar_asignacion_destino_solicitud` | Docente y materia de destino en la solicitud |
| `docs/logos/ChatGPT Image 9 sept 2026, 03_13_37 p.m..png` | Fecha del archivo: **9-sep-2026** — identidad visual CACE |

**Hito de diseño:** se define el flujo de **doble revisión** (primero la
institución de origen, después la de destino), que es el que finalmente se
implementó y el que describen los diagramas.

---

### 🟢 Fase 6 — Semana 5 y retiro del modo oscuro · 14 de septiembre de 2026

**Objetivo:** proyecto, planificación conjunta y chat entre docentes (Semana 5).

| Evidencia | Detalle |
| --- | --- |
| `082efb5` · 14-sep | *feat: semana 5 - proyectos, planificación conjunta y chat entre docentes* |
| `4779c7f` · 14-sep | *docs: actualizar readme (semana 5, chat y simulacion)* |
| Migración `20260914110000_agregar_mensaje` | Tabla de mensajes del chat |
| Borrado de `frontend/src/app/core/services/theme.service.ts` | Ocurre en `082efb5` (retiro del modo oscuro) |

**Entregable del plan cumplido:** solicitud aprobada → proyecto → planificación
conjunta + chat.

---

### 🟠 Fase 7 — Semanas 6 y 7, y las dos primeras auditorías · 15 de septiembre de 2026

**Día de mayor actividad del proyecto: 7 commits.**

**Objetivo:** completar el ciclo de la clase espejo (sesiones, actividades,
evidencias, reportes, evaluación y cierre) y someterlo a revisión de calidad.

| Evidencia | Detalle |
| --- | --- |
| `96e6572` · 15-sep | *feat: semana 6 - sesiones, actividades y evidencias* |
| `c1e46a0` · 15-sep | *feat: acceso público - API_URL dinámica y script start:lan* |
| `4d41434` · 15-sep | *refactor: modal de chat y ajustes de estilos* |
| `b9efa87` · 15-sep | *docs: readme - semana 6, permisos del agente y tabla de API* |
| `74166fc` · 15-sep | *feat: semana 7 - reportes de clase, evaluación final y cierre* |
| `3e8d263` · 15-sep | *fix: auditoría de QA - hallazgos de las dos revisiones* |
| `6778455` · 15-sep | *docs: respuesta a las auditorías, casos de uso y readme* |

**Documentos producidos ese día:**

| Documento | Líneas | Contenido |
| --- | --- | --- |
| `docs/auditorias/reporte-qa-clasesespejo.md` | 243 | Primera revisión: **12 hallazgos** (2 críticos, 4 importantes, 4 menores, 2 sugerencias) |
| `docs/auditorias/reporte-qa-clasesespejo-v2.md` | 167 | Segunda revisión: verifica los 12 arreglos y añade **3 problemas + 6 de experiencia de usuario** |
| `docs/auditorias/respuesta-auditoria.md` | 161 | Respuesta punto por punto a ambas revisiones |

**Entregable del plan cumplido:** ciclo completo hasta *Finalizado*.

---

### 🔴 Fase 8 — Tercera auditoría, correcciones, simulación y documentación · 18 de septiembre de 2026

**Objetivo:** auditoría profunda (código y diseño), corregir lo encontrado, dejar
una base de datos de demostración y cerrar la documentación.

| Evidencia | Detalle |
| --- | --- |
| `ab758df` · 18-sep | *feat(seguridad): endurecer autenticación, subidas y errores de la API* (9 archivos) |
| `9ebe953` · 18-sep | *fix(backend): reglas de negocio y validaciones de la tercera auditoría* (7 archivos) |
| `e457536` · 18-sep | *fix(frontend): accesibilidad, contraste y estados de carga de la auditoría* (10 archivos) |
| `cfa5735` · 18-sep | *docs: tercera auditoría y respuesta actualizada* |
| `a5d6a44` · 18-sep | *chore(scripts): simulación de clases espejo para demostración* |
| `badd26c` · 18-sep | *docs: readme actualizado, manual de usuario y guías de despliegue* |

**Correcciones de seguridad introducidas (evidencia: `ab758df`):**

| Medida | Archivo |
| --- | --- |
| Los hashes de contraseña ya no viajan en las respuestas | `backend/src/prisma/prisma.service.ts` |
| La aplicación no arranca con un `JWT_SECRET` débil o ausente | `backend/src/auth/auth.module.ts` |
| Límite de 10 intentos por minuto en login y activación | `backend/src/common/guards/rate-limit.guard.ts` |
| Traducción de errores de Prisma (409 / 400 / 404) | `backend/src/common/filters/prisma-exception.filter.ts` |
| Lista blanca de archivos y permiso verificado **antes** de escribir la evidencia | `backend/src/proyectos/proyectos.controller.ts`, `backend/src/proyectos/guards/docente-participante.guard.ts` |
| CORS restringido y `/uploads` forzado como descarga | `backend/src/main.ts` |

**Simulación de demostración (evidencia: `a5d6a44`):**

| Script | Líneas | Función |
| --- | --- | --- |
| `backend/scripts/seed-demo-clases.js` | 840 | Crea clases espejo en todos los estados, con fechas relativas al día de ejecución |
| `backend/scripts/borrar-demo-clases.js` | 101 | Deshace la simulación en orden seguro de claves foráneas |

**Documentación producida (evidencia: `badd26c` y posteriores):**

| Documento | Líneas | Contenido |
| --- | --- | --- |
| `docs/readme` | 1 244 | Documentación técnica completa, con índice navegable |
| `docs/manual-de-usuario.md` | 749 | Manual de uso para agente y docente, con FAQ y glosario |
| `docs/guia-de-despliegue.md` | 814 | Montaje en servidor Linux o Windows |
| `docs/receta-para-montarlo.md` | 929 | La misma instalación en versión casera |
| `docs/practica-en-maquina-virtual.md` | 1 014 | Ensayo general en máquina virtual con 12 ejercicios de rotura y reparación |
| `docs/auditorias/auditoria-v3-y-analisis-de-diseno.md` | 435 | Tercera auditoría + análisis de diseño |

---

## 5. Avance contra el plan de 8 semanas

El plan está definido en `docs/readme`. Los commits citan explícitamente cada
semana, lo que permite fechar cada entregable.

| Semana | Contenido | Estado | Fecha de cierre (commit) |
| --- | --- | --- | --- |
| **1** | Materias y asignación docente ↔ materia | ✅ Completada | 02-sep (`abb1b64`) |
| **2** | Docentes, instituciones y panel del agente | ✅ Completada | 04-sep (`aa2d1d1`) |
| **3** | Solicitudes de clase espejo (docente) | ✅ Completada | 04-sep (`d66dab3`) |
| **4** | Revisión de solicitudes (agente) | ✅ Completada | 09-sep (`8edfdd2`) |
| **5** | Proyecto, planificación conjunta y chat | ✅ Completada | 14-sep (`082efb5`) |
| **6** | Sesiones, actividades y evidencias | ✅ Completada | 15-sep (`96e6572`) |
| **7** | Reportes de clase, evaluación y cierre | ✅ Completada | 15-sep (`74166fc`) |
| **8** | Pulido, pruebas y despliegue | 🟡 **En curso** | — |

**Dentro de la semana 8 ya se completó:** build de producción del frontend servido
por NestJS, corrección de los hallazgos de las tres auditorías, simulación de
demostración y toda la documentación final.

**Pendiente de la semana 8:** recuperación de contraseña, prueba integral del flujo
sobre la versión compilada y despliegue en el servidor definitivo.

---

## 6. Inventario de evidencia documental

### 6.1 Documentos (13 archivos, 6 440 líneas)

| Documento | Líneas | Tipo |
| --- | --- | --- |
| `docs/readme` | 1 244 | Técnico |
| `docs/practica-en-maquina-virtual.md` | 1 014 | Operativo |
| `docs/receta-para-montarlo.md` | 929 | Operativo |
| `docs/guia-de-despliegue.md` | 814 | Operativo |
| `docs/manual-de-usuario.md` | 749 | Usuario |
| `docs/auditorias/auditoria-v3-y-analisis-de-diseno.md` | 435 | Calidad |
| `docs/auditorias/reporte-qa-clasesespejo.md` | 243 | Calidad |
| `docs/diagramas/entidad_relacion.md` | 235 | Diseño |
| `docs/diagramas/diagrama de flujo.md` | 204 | Diseño |
| `docs/diagramas/casos_de_uso.md` | 179 | Diseño |
| `docs/auditorias/reporte-qa-clasesespejo-v2.md` | 167 | Calidad |
| `docs/auditorias/respuesta-auditoria.md` | 161 | Calidad |
| `docs/diagramas/diagrama_de_secuencias.md` | 66 | Diseño |
| **Total** | **6 440** | |

**Otros archivos de evidencia:**

| Archivo | Tamaño | Contenido |
| --- | --- | --- |
| `docs/PRIMERA PARTE TESIS LISTO.docx` | 896 KB | Primera parte del documento de tesis |
| `docs/diagramas/diagrama_de_secuencias_registros_e_invitacion_de_usuarios.png` | 1.8 MB | Diagrama de secuencia ilustrado |
| `docs/logos/ChatGPT Image 9 sept 2026…png` | 545 KB | Logotipo de la comunidad CACE (fechado el 9-sep-2026) |

### 6.2 Migraciones de base de datos (9)

| # | Migración | Fecha | SQL |
| --- | --- | --- | --- |
| 1 | `20260828144308_init` | 28-ago | 333 líneas — modelo completo |
| 2 | `20260828162600_hacer_password_opcional` | 28-ago | 2 |
| 3 | `20260831155142_agregar_token_invitacion_usuario` | 31-ago | 15 |
| 4 | `20260831194048_agregar_timestamps_globales` | 31-ago | 77 |
| 5 | `20260902210546_agregar_dni_apellidos_invitacion` | 2-sep | 33 |
| 6 | `20260905000000_agregar_registro_completo_institucion` | 5-sep | 2 |
| 7 | `20260905120000_agregar_estandares_internacionales` | 5-sep | 8 |
| 8 | `20260909140000_agregar_asignacion_destino_solicitud` | 9-sep | 5 |
| 9 | `20260914110000_agregar_mensaje` | 14-sep | 16 |

**Verificación realizada el 23-sep-2026:** las 9 migraciones cubren **el 100 %**
de las 22 tablas y de todas las columnas escalares definidas en
`backend/prisma/schema.prisma` (0 tablas y 0 columnas sin respaldo en
migraciones). Esto significa que un servidor nuevo se puede montar solo con
`npx prisma migrate deploy`.

---

## 7. Estado de las auditorías

| Ronda | Documento | Hallazgos | Estado | Evidencia del arreglo |
| --- | --- | --- | --- | --- |
| **1.ª** | `reporte-qa-clasesespejo.md` | 12 (2 críticos, 4 importantes, 4 menores, 2 sugerencias) | ✅ Todos corregidos | `3e8d263` (15-sep) |
| **2.ª** | `reporte-qa-clasesespejo-v2.md` | 3 nuevos (1 importante, 2 menores) + **6 de experiencia de usuario** | ✅ Todos corregidos | `3e8d263` (15-sep) |
| **3.ª (código)** | `auditoria-v3-y-analisis-de-diseno.md` | 35 (2 críticos, 12 importantes, 21 menores) | ✅ Críticos e importantes corregidos; **7 menores abiertos y documentados** | `ab758df`, `9ebe953`, `e457536` (18-sep) |
| **3.ª (diseño)** | mismo documento | 4 bugs visuales confirmados, 2 problemas de disposición, 3 líneas de mejora | ✅ Corregidos los bugs visuales y la disposición | `e457536` (18-sep) |

### Ejemplos de hallazgos corregidos (con su verificación)

| Hallazgo | Riesgo | Corrección |
| --- | --- | --- |
| El *hash* de la contraseña viajaba en 11 endpoints distintos | Crítico | Se omite por defecto desde `PrismaService` |
| Se podía subir un `.html` o `.svg` y ejecutarlo en el mismo origen que la aplicación (robo del token) | Crítico | Lista blanca de extensiones + descarga forzada + cabeceras de seguridad |
| El botón "Desactivar docente" no desactivaba nada | Importante | Se verifica la cuenta vigente en **cada** petición |
| Se podía cerrar la clase espejo sin cumplir las reglas | Importante | El cierre valida evaluación final y reportes confirmados |
| Editar un reporte de clase ya firmado no invalidaba las firmas | Importante | Al cambiar el contenido, las firmas se reinician en una transacción |
| Una solicitud rechazada quedaba atascada para siempre | Importante | Se puede corregir y reenviar (vuelve a *Pendiente*) |
| Los formularios seguían visibles y activos en un proyecto cerrado | UX | La pantalla queda en solo lectura al cerrar |

### Hallazgos abiertos al cierre de este informe

**Verificado el 23-sep-2026 por lectura directa del código:**

| # | Hallazgo | Comprobación |
| --- | --- | --- |
| m7 | Faltan índices `@@unique` (asignación, docente-institución, clave de materia) | ⏳ Abierto — no hay `@@unique` en `schema.prisma`; **requiere migración de base de datos** |
| m14 | Métodos O(n²) en las plantillas | ⏳ Abierto — 2 llamadas a `asignacionesDeMateria()` dentro de bucles de plantilla |
| m15 | `activate` ignora la propiedad `valido` | 🟡 Parcial — ya usa `numeroEmpleado`, pero sigue sin usar `valido` |
| m17 | Posible bucle de redirección si el rol es nulo | ⏳ Abierto — `roleGuard` devuelve a `/login` cuando el rol es nulo |
| m18 | El aviso "Cuenta creada correctamente" persiste tras un login fallido | ⏳ Abierto — se lee del parámetro `?registrado` y nunca se limpia |
| m19 | El registro de agente no pide confirmar la contraseña | ⏳ Abierto — 0 referencias a "confirmar" en el formulario |
| m20 | `API_URL` duplicada en 6 servicios | ⏳ Abierto — 6 servicios con la misma detección de origen |

> Ninguno es crítico ni bloquea el uso del sistema. Su seguimiento está
> documentado en la sección de auditorías de `docs/readme`.

---

## 8. Métricas del sistema

### 8.1 Código fuente

| Área | Archivos | Líneas |
| --- | --- | --- |
| Backend (`backend/src`, TypeScript) | 67 | 3 901 |
| Frontend (`frontend/src`, TypeScript) | 33 | 3 679 |
| Frontend (plantillas HTML) | 10 | 2 380 |
| Frontend (hojas de estilo CSS) | 3 | 1 882 |
| **Total** | **113** | **11 842** |

*(Medición del 23-sep-2026, excluyendo `node_modules`, `dist` y el cliente generado por Prisma.)*

### 8.2 Arquitectura del backend

| Elemento | Cantidad |
| --- | --- |
| Módulos | 11 |
| Controladores | 9 |
| Servicios | 11 |
| DTO (validación de entrada) | 25 |
| Guardias de autorización | 3 |
| Filtro global de errores | 1 |
| **Rutas HTTP** | **59** |

**Endpoints por módulo:**

| Módulo | Rutas |
| --- | --- |
| `proyectos` (clase espejo completa) | 29 |
| `solicitudes` | 6 |
| `materias` | 5 |
| `agentes` | 4 |
| `instituciones` | 4 |
| `asignaciones` | 4 |
| `auth` | 4 |
| `app` (raíz y salud) | 2 |
| `usuarios` | 1 |

### 8.3 Frontend

| Elemento | Cantidad |
| --- | --- |
| Componentes | 8 |
| Plantillas | 8 |
| Servicios HTTP | 6 |
| Guardias de ruta | 2 |

### 8.4 Modelo de datos

| Elemento | Cantidad |
| --- | --- |
| Tablas (modelos Prisma) | 22 |
| Migraciones | 9 |
| Estados de dominio centralizados | 5 grupos (solicitud, proyecto, planificación, reporte, sesión) |

### 8.5 Repositorio

| Elemento | Valor |
| --- | --- |
| Archivos versionados | 382 |
| Tamaño del historial | 3.6 MB |
| Commits | 28 |
| Ramas | `master` |

---

## 9. Estado verificado de la base de datos de demostración

**Medición de solo lectura ejecutada el 23-sep-2026** sobre la base de datos de
demostración (`ClasesconjuntasBD`), con un script temporal que se eliminó después
de usarlo.

| Entidad | Cantidad | Desglose por estado |
| --- | --- | --- |
| Instituciones | 2 | México (ITESCam) y Colombia (UNAL) |
| Usuarios | 17 | 2 agentes + 15 docentes |
| Materias | 10 | 5 por institución |
| Asignaciones docente ↔ materia | 17 | — |
| Invitaciones | 4 | — |
| **Solicitudes de clase espejo** | **19** | 4 *Pendiente* · 2 *Aprobada por origen* · 11 *Aprobada* · 2 *Rechazada* |
| Revisiones de solicitud | 24 | Registro de la doble revisión |
| **Proyectos (clases espejo)** | **11** | 4 *En planificación* · 3 *En curso* · 3 *Finalizado* · 1 *Cancelado* |
| Docentes en proyectos | 22 | — |
| Planificaciones conjuntas | 8 | — |
| Confirmaciones de planificación | 16 | — |
| Mensajes de chat | 10 | — |
| **Sesiones** | **21** | 8 *Programada* · 12 *Finalizada* · 1 *Cancelada* |
| Actividades | 15 | — |
| Evidencias (archivos) | 8 | — |
| **Reportes de clase** | **12** | 2 *Borrador* · 1 *En revisión* · 9 *Confirmado* |
| Firmas de reportes | 24 | — |
| Evaluaciones finales | 3 | Una por proyecto finalizado |
| **Total de registros** | **273** | — |

**Coherencia verificada:** los 3 proyectos en estado *Finalizado* tienen su
evaluación final registrada y sus reportes de clase *Confirmados*, tal como exige
la regla de cierre implementada. La base sirve como escenario de demostración con
clases concluidas, en proceso y pendientes **al mismo tiempo**.

---

## 10. Verificaciones técnicas ejecutadas

### 10.1 Ejecutadas el 23 de septiembre de 2026 (fecha de este informe)

| # | Verificación | Comando | Resultado |
| --- | --- | --- | --- |
| 1 | Esquema de base de datos válido | `npx prisma validate` | ✅ *The schema at prisma\schema.prisma is valid* |
| 2 | El backend compila | `npm run build` (backend) | ✅ Sin errores (`nest build`, exit 0) |
| 3 | El frontend no tiene errores de tipos | `npx tsc -p tsconfig.app.json --noEmit` | ✅ Exit 0 (incluye el trabajo en curso de la sección 11) |
| 4 | Las migraciones cubren el esquema | Comparación esquema ↔ migraciones | ✅ 22/22 tablas y 0 columnas sin cubrir |
| 5 | Consistencia de la documentación | Verificación de los 103 enlaces internos de los 5 documentos principales | ✅ 0 enlaces rotos |
| 6 | Volumen real de datos | Conteo de las 22 tablas | ✅ 273 registros |
| 7 | Codificación de caracteres | Búsqueda de texto corrupto en los documentos | ✅ 0 ocurrencias |

### 10.2 Ejecutadas durante el desarrollo (sesiones previas a los commits del 18-sep-2026)

| Verificación | Resultado |
| --- | --- |
| `npm run build` del backend | ✅ Sin errores |
| `npx tsc` del frontend | ✅ Sin errores |
| Pruebas de humo contra la API, sobre un backend de prueba en el puerto 3001 y la base de demostración | ✅ Detectaron y permitieron corregir: el login roto por el ocultamiento del *hash*, el rechazo de un archivo `.html` como evidencia y la denegación (403) a un agente antes de que el archivo se escribiera en disco |

---

## 11. Trabajo sin commitear al cierre de este informe

Existe trabajo **presente en el árbol de archivos pero sin registrar en un
commit**. Se documenta aquí porque forma parte del estado real del proyecto, pero
**no puede citarse como evidencia formal mientras no se commitee**.

### 11.1 Interfaz (23-sep-2026, 11:46–11:48 h)

| Elemento | Detalle |
| --- | --- |
| **Componente nuevo** | `frontend/src/app/shared/components/layout/` (37 líneas TS + 8.2 KB de plantilla): barra de navegación + menú lateral compartido que sustituye la barra superior duplicada en los paneles de docente, agente y proyecto |
| **Reescritura de estilos** | `frontend/src/styles.css` (2 568 líneas modificadas) |
| **Estilos del modal** | `frontend/src/app/shared/components/modal/modal.component.css` |
| **Plantillas adaptadas** | Paneles de agente, docente y proyecto |
| **Otros** | `frontend/src/index.html` |

**Estado verificado:** el proyecto **compila y pasa la verificación de tipos** con
estos cambios (verificación 3 de la sección 10.1).

### 11.2 Documentación (18-sep-2026, posterior a los commits de ese día)

| Elemento | Estado |
| --- | --- |
| `docs/practica-en-maquina-virtual.md` (1 014 líneas) | Archivo nuevo, **sin versionar** |
| Enlaces cruzados añadidos a `docs/readme`, `docs/guia-de-despliegue.md` y `docs/receta-para-montarlo.md` | Modificados, **sin commitear** |
| `docs/informe-de-actividades.md` (este informe) | Archivo nuevo, **sin versionar** |

**Recomendación:** commitear ambos bloques en cuanto estén cerrados, para que
puedan citarse con hash y fecha en el documento de tesis.

---

## 12. Pendientes y observaciones sobre la evidencia

### 12.1 Pendientes técnicos

| # | Pendiente | Prioridad | Nota |
| --- | --- | --- | --- |
| 1 | Recuperación de contraseña | Media | Hoy solo existe un aviso: *"contacta a tu agente"* |
| 2 | Prueba integral del flujo sobre la versión compilada | Alta | Es el último entregable de la semana 8 |
| 3 | Índices `@@unique` (hallazgo m7) | Media | Requiere migración de base de datos |
| 4 | 6 hallazgos menores restantes (m14, m15, m17–m20) | Baja | Ninguno bloquea el uso |
| 5 | Commitear el trabajo en curso (sección 11) | Alta | Sin commit no hay evidencia citable |
| 6 | Subir los commits al repositorio remoto | Alta | Ver 12.2 |

> **Nota:** el orden lógico es commitear primero (sección 11), después subir todo
> junto.

### 12.2 Observación importante: el repositorio remoto está desactualizado

**Verificado el 23-sep-2026:** la rama local está **9 commits por delante** de
`origin/master`. Los 6 commits del 18-sep y 3 anteriores **no están respaldados
en GitHub**. Mientras eso no se resuelva, el respaldo externo del proyecto no
existe.

### 12.3 Observaciones sobre la calidad de la propia evidencia

| Observación | Detalle | Acción sugerida |
| --- | --- | --- |
| Los informes de auditoría no llevan fecha fiable | El primer informe dice *"Fecha de la revisión: hoy (enero 2026)"*, cuando la revisión corresponde al **15-sep-2026** | Corregir la fecha en el documento antes de anexarlo a la tesis |
| Falta evidencia gráfica | No hay capturas de pantalla del sistema en funcionamiento dentro del repositorio | Tomar capturas de cada pantalla (login, paneles, clase espejo) y guardarlas en `docs/capturas/` |
| Falta evidencia de pruebas con usuarios | No hay registro de sesiones de prueba con docentes o agentes reales | Levantar un acta breve por sesión de prueba con fecha y participantes |
| La base de demostración no es evidencia de uso real | Los 273 registros son simulados | Aclararlo así en la tesis; usar `seed-demo.js` solo en bases de prueba (**borra toda la base**) |
| Documentación extensa generada en un solo día | Los 5 documentos operativos se escribieron el 18-sep | Es correcto, pero conviene mencionar en la tesis que se elaboraron al cierre de la semana 8 |

---

## 13. Anexo A — Tabla completa de commits (28)

| # | Hash | Fecha | Mensaje |
| --- | --- | --- | --- |
| 1 | `5cf3603` | 28-ago | Initial project setup |
| 2 | `b1bc81d` | 28-ago | fix: configurar NestJS Prisma y variables de entorno |
| 3 | `1700922` | 29-ago | creacion del radme |
| 4 | `3c677c5` | 29-ago | creacion del radme 2 |
| 5 | `32586a3` | 31-ago | feat: backend auth, timestamps, migraciones y unificar frontend en el repo |
| 6 | `def75f5` | 02-sep | feat: autenticación completa (backend modular + frontend Angular) |
| 7 | `abb1b64` | 02-sep | feat: semana 1 - materias y asignacion docente-materia |
| 8 | `aa2d1d1` | 04-sep | feat: correcciones de revision y semana 2 (docentes, instituciones y panel del agente) |
| 9 | `d66dab3` | 04-sep | feat: semana 3 - solicitudes de clase espejo (lado docente) |
| 10 | `b360da6` | 04-sep | feat: modo oscuro |
| 11 | `70fb5f9` | 09-sep | feat: estándares internacionales, gate de institución y validación de texto |
| 12 | `8edfdd2` | 09-sep | feat: semana 4 - revisión de solicitudes (lado agente) |
| 13 | `5198d78` | 09-sep | docs: actualizar readme al estado actual del proyecto |
| 14 | `082efb5` | 14-sep | feat: semana 5 - proyectos, planificación conjunta y chat entre docentes |
| 15 | `4779c7f` | 14-sep | docs: actualizar readme (semana 5, chat y simulacion) |
| 16 | `96e6572` | 15-sep | feat: semana 6 - sesiones, actividades y evidencias |
| 17 | `c1e46a0` | 15-sep | feat: acceso público - API_URL dinámica y script start:lan |
| 18 | `4d41434` | 15-sep | refactor: modal de chat y ajustes de estilos |
| 19 | `b9efa87` | 15-sep | docs: readme - semana 6, permisos del agente y tabla de API |
| 20 | `74166fc` | 15-sep | feat: semana 7 - reportes de clase, evaluación final y cierre |
| 21 | `3e8d263` | 15-sep | fix: auditoría de QA - hallazgos de las dos revisiones |
| 22 | `6778455` | 15-sep | docs: respuesta a las auditorías, casos de uso y readme |
| 23 | `ab758df` | 18-sep | feat(seguridad): endurecer autenticación, subidas y errores de la API |
| 24 | `9ebe953` | 18-sep | fix(backend): reglas de negocio y validaciones de la tercera auditoría |
| 25 | `e457536` | 18-sep | fix(frontend): accesibilidad, contraste y estados de carga de la auditoría |
| 26 | `cfa5735` | 18-sep | docs: tercera auditoría y respuesta actualizada |
| 27 | `a5d6a44` | 18-sep | chore(scripts): simulación de clases espejo para demostración |
| 28 | `badd26c` | 18-sep | docs: readme actualizado, manual de usuario y guías de despliegue |

**Distribución por día:**

| Fecha | Commits |
| --- | --- |
| 28-ago | 2 |
| 29-ago | 2 |
| 31-ago | 1 |
| 02-sep | 2 |
| 04-sep | 3 |
| 09-sep | 3 |
| 14-sep | 2 |
| 15-sep | 7 |
| 18-sep | 6 |

---

## 14. Anexo B — Cómo reproducir cada evidencia

Todos los comandos se ejecutan desde la raíz del proyecto.

### Historial completo con fechas

```bash
git log --pretty=format:"%h|%ad|%s" --date=short --reverse
git log --pretty=format:"%ad" --date=format:"%Y-%m" | Group-Object   # PowerShell
```

### Evidencia de una corrección concreta

```bash
git show --stat ab758df          # ver qué archivos tocó el commit de seguridad
git show ab758df                 # ver el cambio completo
git log -S 'prefers-color-scheme' --oneline -- frontend/src   # rastro del modo oscuro
```

### Métricas de código

```powershell
Get-ChildItem backend\src -Recurse -File -Include *.ts |
  Where-Object { $_.FullName -notmatch 'node_modules|dist|generated' } |
  ForEach-Object { (Get-Content $_.FullName -Encoding UTF8).Count } |
  Measure-Object -Sum
```

### Rutas de la API

```powershell
Select-String -Path (Get-ChildItem backend\src -Recurse -Filter *.controller.ts).FullName `
  -Pattern '^\s*@(Get|Post|Patch|Put|Delete)\(' | Measure-Object
```

### Cobertura de las migraciones sobre el esquema

```bash
npx prisma validate                     # desde backend/
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script
# Si no imprime SQL, el esquema y las migraciones están sincronizados
```

### Estado de la base de datos

```bash
cd backend
npx prisma studio                       # exploración visual de las 22 tablas
```

### Verificaciones de compilación

```bash
cd backend  && npm run build
cd frontend && npx tsc -p tsconfig.app.json --noEmit
```

### Consistencia de la documentación

```bash
# Verifica que cada enlace interno (#ancla) apunte a un encabezado existente
# (script de verificación usado el 23-sep-2026: 103 enlaces, 0 rotos)
```

---

## 15. Conclusión

Entre el **28 de agosto y el 18 de septiembre de 2026**, en **9 días de trabajo
registrado y 28 commits**, el proyecto pasó de una carpeta vacía a una plataforma
funcional con:

* **11 842 líneas de código** en 11 módulos de backend y 8 componentes de frontend,
* un **modelo de datos de 22 tablas** construido por 9 migraciones versionadas,
* **59 endpoints** documentados,
* el **ciclo académico completo** implementado (registro → invitación → solicitud →
  doble revisión → proyecto → planificación → sesiones → actividades → evidencias →
  reportes firmados → evaluación → cierre),
* **tres rondas de auditoría** con sus hallazgos corregidos y con evidencia del
  arreglo en el historial,
* **6 440 líneas de documentación** (técnica, de usuario, de despliegue y de
  práctica),
* una **base de datos de demostración de 273 registros** que muestra clases
  concluidas, en curso y pendientes de forma simultánea, y
* **verificaciones técnicas vigentes** al día del informe: esquema válido, backend
  compilando, frontend sin errores de tipos y documentación sin enlaces rotos.

Los tres frentes abiertos son concretos y están acotados: subir los 9 commits
pendientes al repositorio remoto, commitear el trabajo en curso de la interfaz, y
cerrar los dos pendientes funcionales de la semana 8 (recuperación de contraseña y
prueba integral).

---

*Informe de actividades de Clases Conjuntas · 23 de septiembre de 2026*
*Documentos relacionados: `docs/readme` (técnico), `docs/auditorias/` (calidad),
`docs/manual-de-usuario.md` (uso), `docs/guia-de-despliegue.md` y
`docs/receta-para-montarlo.md` (puesta en marcha).*
