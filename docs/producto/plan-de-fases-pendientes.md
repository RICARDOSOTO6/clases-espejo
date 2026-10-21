# Plan de fases — lo que falta para poner la plataforma en uso real

> **Escrito el 17 de octubre de 2026**, con el repositorio en `master` (96 commits,
> 127 rutas —hoy 135—, 32 modelos —hoy 34—, 23 migraciones —hoy 26—) y los
> datos de demostración cargados
> (2 instituciones, 6 usuarios, 2 proyectos, 19 países, 0 certificados).
>
> No repite lo que ya está hecho (permisos por capacidad, doble revisión,
> certificados con verificación pública, calendario, CACE, auditorías): eso está
> y funciona. Aquí solo están los huecos **comprobados en el código**, ordenados
> por lo que duele primero cuando hay usuarios de verdad.
>
> Cada fase termina con un **criterio de aceptación medible**. Si no se puede
> medir, no es criterio: es deseo.
>
> **Actualización (18-oct-2026):** la parte de rendimiento de la Fase 3 ya está
> hecha (41 índices en 22 modelos, migración
> `20261018011641_indices_de_rendimiento`, `EXPLAIN` comprobado) y el frontend
> pasó a servirse comprimido y cacheado (login en frío 1.014.948 → 186.979 B).
> El detalle está en [`rendimiento.md`](rendimiento.md). Lo que sigue sin hacer de
> la fase: `ENUM`/`CHECK`, `@@unique` de negocio, paginación y revisión de N+1.

---

## Cuadro de conjunto

| Fase | Qué resuelve | Esfuerzo | Depende de |
| --- | --- | --- | --- |
| **0** | Red de seguridad: CI y pruebas de los flujos que se van a tocar | 1 semana | — |
| **1** | Cuenta y acceso: recuperar contraseña, verificar correo, cerrar sesiones | 1,5–2 semanas | Fase 0 |
| **2** | Correo y procesos largos: cola, reintentos, topes de lote | 1 semana | Fase 1 |
| **3** | Integridad y rendimiento: índices, `ENUM`/`CHECK`, paginación | 1 semana | Fase 0 |
| **4** | Operación: backups automáticos, monitorización, `helmet`, API documentada | 1 semana | Fase 0 |
| **5** | Producto y confianza: privacidad, exportar/eliminar cuenta, correos de hitos | 1–2 semanas | Fases 1 y 2 |
| **6** | Mantenibilidad: duplicación, componentes gigantes, despliegue reproducible | continuo | — |
| **7** | Nuevas funciones: plazos configurables, evidencias por enlace, documento internacional y clases con N instituciones | 6–8 semanas | Fases 2 y 3 |

**Total realista:** 6–8 semanas de una persona a tiempo parcial para las fases 0–6.
La Fase 7 añade 6–8 semanas más y no está incluida en ese total. Las fases 1 y 3
pueden ir en paralelo si hay dos personas (tocan archivos distintos).

---

## Fase 0 — Red de seguridad (primero, aunque no se vea)

**Por qué:** 127 rutas y 4 archivos de prueba triviales. Cualquier cambio de las
fases siguientes sin pruebas es a ciegas, y este proyecto ya se comió un caso de
«corregido» que volvió a abrirse (fechas).

- [x] CI en `.github/workflows/ci.yml` (20-oct-2026): PostgreSQL 17 de servicio,
  `prisma generate`/`validate`/`migrate deploy`, lint sin `--fix`
  (
pm run lint:ci`), tipos en `strict`, unitarias, e2e y build; el frontend con
  lint, `tsc`, 
gc` y 
g build`. Corre en cada push y pull request.
- [x] `.env.example` con todas las variables del backend (el `.env` sigue
  ignorado).
- [x] `strict` en el `tsconfig` del backend (las 73 propiedades de DTO que hacían
  falta llevan asignación definida) y ESLint en el frontend
  (`frontend/eslint.config.mjs` con `angular-eslint`, scripts `lint` y `lint:ci`).
- [x] **64 pruebas e2e** en 7 suites contra una base de prueba real
  (`clasesconjuntasbd_test`, PostgreSQL): 14 de registro → aprobación →
  invitación → activación; 10 de doble revisión y proyecto; 7 de la matriz de
  capacidades; 12 de certificados, HMAC y verificación pública; 11 del cierre de
  la clase; 6 del calendario `.ics` y su envío; 4 de humo. La infraestructura se
  niega a correr si `DATABASE_URL` no termina en `_test` o `_ci`, y el correo va
  simulado.

**Aceptación:** el CI corre en cada push y falla si se rompe cualquiera de los seis
flujos; `prisma validate` y 
g build` en verde. **Estado:** cumplida el
20-oct-2026, con una salvedad: el workflow no se ha ejecutado todavía en GitHub
(aquí se verificó cada comando por separado y las 64 e2e contra PostgreSQL real).

---

## Fase 1 — Cuenta y acceso (el hueco más caro)

**Por qué:** hoy no hay recuperación de contraseña (solo `register`, `login` y
`activate`), el correo no se verifica al registrarse (`activo: true` sin
comprobarlo), cambiar la contraseña no cierra las sesiones (JWT de 1 día sin
versión ni refresh) y la invitación caducada no se puede reenviar.

- [x] **Recuperar contraseña** (20-oct-2026): `POST /auth/recuperar`,
  `GET /auth/recuperar/validar` y `POST /auth/restablecer`. Token de 32 bytes
  del que solo se guarda el hash SHA-256, un solo uso con consumo atómico,
  caducidad de 1 hora y un único enlace válido por cuenta. La respuesta es
  siempre la misma exista o no la cuenta. Pantallas `/recuperar` y
  `/restablecer` en el frontend.
- [x] **Invalidar sesiones** al cambiar o restablecer la contraseña
  (`USUARIO.sesionesValidasDesde` comparada con el `iat` del JWT en
  `JwtAuthGuard`). Con esto, un token robado muere al cambiar la contraseña.
- [x] **Verificación de correo al registrarse** (20-oct-2026): la cuenta nace
  con `correoVerificado` en falso, recibe un enlace de 48 h (solo el hash en la
  base) y el login responde 403 hasta abrirlo; hay reenvío desde el acceso.
  Las cuentas que ya existían y las de docentes invitados quedan verificadas.
- [x] **Reenviar invitación** de docente desde el panel del agente
  (20-oct-2026): el agente ve las invitaciones pendientes (también las
  caducadas, con su fecha) y las reenvía generando un **token nuevo** —el
  enlace anterior deja de valer— sin borrar y volver a invitar.
- [x] **Política de contraseña** (20-oct-2026): mínimo 10, sin ser la del correo
  y sin un carácter repetido, más bloqueo temporal de 15 minutos tras 5 intentos
  fallidos (además del rate limit).
- [x] **Cambio de correo** (20-oct-2026): se pide desde «Mi perfil», el enlace
  llega a la **dirección nueva** y el cambio se aplica al confirmarlo (con
  cierre de sesiones); un correo ya usado responde 409.
- [ ] *(Opcional, a decidir)* segundo factor TOTP para presidencia y secretaría.

**Aceptación:** un usuario que olvida su contraseña la recupera solo, sin tocar la
base; un token robado deja de valer en cuanto se cambia la contraseña; ninguna
cuenta nueva opera sin correo verificado. Todo con e2e de la fase 0.
**Estado (20-oct-2026):** recuperación, cierre de sesiones, política, reenvío de
invitaciones, verificación de correo y cambio de correo hechos y cubiertos por
las suites `cuenta`, `invitaciones` y `verificacion-correo` (26 pruebas e2e).
Solo queda decidir el TOTP opcional.

---

## Fase 2 — Correo y procesos largos

**Por qué:** el envío de certificados va en un `for … await` dentro de la petición
(hasta 300 destinatarios por lote), con SMTP de Gmail, sin cola, sin reintentos y
sin registro de rebotes. Un lote grande puede agotar el tiempo de espera o el
límite diario del proveedor.

- [x] Tabla `ENVIO_CORREO` (destinatario, asunto, adjunto, estado, intentos,
  últimoError) y un worker periódico que vacía la cola cada minuto
  (21-oct-2026: migración `20261021120000_fase2_envio_correo`).
- [x] Los endpoints de envío **encolan** y responden al instante con un
  identificador de lote; el frontend muestra el progreso con una barra y los
  fallos con su motivo (`GET /envios/lotes/:loteId`).
- [x] Reintentos con espera creciente (1, 5, 15 y 60 minutos) y registro del
  motivo de cada fallo; a los 5 intentos queda `FALLIDO` con su detalle.
- [x] Tope de emisión por clase (500) con aviso claro al superarlo.
- [x] ZIP de certificados en streaming (21-oct-2026): los PDF se leen como
  flujos y el ZIP sale con `generateNodeStream`, sin armarlo entero en memoria.
- [x] Documentar la configuración SMTP del despliegue (SPF/DKIM si es dominio
  propio), incluido el worker de la cola (21-oct-2026).
- [x] Separar el remitente de certificados del resto: `MAIL_FROM_CERTIFICADOS`
  opcional; si no está, se usa `MAIL_FROM`.

**Aceptación:** un envío de 300 certificados responde en menos de 2 s y termina en
la cola; matar el proceso a mitad no pierde envíos (se reintentan); cada fallo
queda registrado con su motivo.
**Estado (21-oct-2026):** cola, worker, progreso, reintentos y tope hechos y
cubiertos por la suite `envios-cola` (7 pruebas; 300 encolados en <2 s), el ZIP en
streaming y el remitente propio de certificados. La fase queda cerrada.

---

## Fase 3 — Integridad de datos y rendimiento

**Por qué:** `@@index: 0` en 32 modelos (todo se recorre en tabla), estados como
texto libre (0 `ENUM`, 0 `CHECK`), un solo `@@unique` de negocio y listados sin
paginación (6 `take` en todo el backend).

- [x] **Una migración con índices en las FKs consultadas** (hecho el
  18-oct-2026: `20261018011641_indices_de_rendimiento`, 41 índices en 22 modelos,
  con `EXPLAIN` comprobado; ver [`rendimiento.md`](rendimiento.md)): `proyectoId`,
  `institucionId`, `usuarioId`, `solicitudId`, `alumnoId`, y los campos de fecha
  usados en recordatorios.
- [ ] `ENUM` de Prisma o `CHECK` para los estados (`SESION`, `SOLICITUD`,
  `PROYECTO`, `PLANIFICACION`, `REPORTE`, `CERTIFICADO`, `INSTITUCION.estadoCace`).
- [ ] `@@unique` de negocio: `ASIGNACION_DOCENTE`, `DOCENTE_INSTITUCION`,
  `MATERIA` (revisar duplicados históricos antes de aplicar).
- [ ] Paginación (`page`/`limit` o cursor) en certificados, alumnos, docentes,
  instituciones y proyectos, con el frontend adaptado.
- [ ] Revisar N+1 en los listados grandes (`include` masivos del panel CACE).

**Aceptación:** `EXPLAIN ANALYZE` de los listados principales usa índices; el panel
carga con 1.000 certificados y 500 alumnos sin traerlo todo; los estados inválidos
son rechazados por la base.

---

## Fase 4 — Operación

**Por qué:** sin `helmet`, sin backups automáticos, sin monitorización, sin logs
estructurados, sin API documentada y sin entorno reproducible.

- [ ] `helmet` con HSTS, `X-Frame-Options` y CSP global (hoy solo `/uploads` y
  `/avatars` fijan cabeceras).
- [ ] Rate limit en `POST /auth/register` y `GET /verificar/:folio`; sacar el mapa
  en memoria a algo compartido si va a haber más de una instancia.
- [ ] Copia de seguridad automática diaria (script + tarea programada) y **prueba
  de restauración** documentada y fechada.
- [ ] Logs estructurados con identificador de petición y registro de errores 5xx.
- [ ] Monitorización del `/health` desde fuera del servidor y alerta si cae.
- [ ] Swagger/OpenAPI (`@nestjs/swagger`) publicado solo en entornos internos; es
  la documentación que hoy vive a mano en el README.
- [ ] Despliegue reproducible: `Dockerfile`/`docker-compose` o script de
  instalación; separar `.env` de desarrollo y producción.
- [ ] `prisma migrate deploy` en el despliegue (ya documentado; falta el automatismo).

**Aceptación:** el servidor arranca desde cero con un comando; hay un backup
automático diario probado restaurándolo en una base temporal; si el servicio cae,
alguien se entera antes que los usuarios.

---

## Fase 5 — Producto y confianza

**Por qué:** se tratan datos de alumnos (nombre, matrícula, correo) y no hay aviso
de privacidad ni consentimiento; no se puede exportar ni eliminar la cuenta; las
notificaciones solo viven dentro de la aplicación.

- [ ] Páginas de **aviso de privacidad y términos**, con enlace desde el registro y
  el pie; registro de la aceptación (fecha y versión del aviso).
- [ ] **Exportar mis datos** (usuario/institución) y **solicitar baja** con
  borrado o anonimización según la política que se decida.
- [ ] Correos de hitos (a decidir): solicitud aprobada/rechazada, sesión próxima,
  certificado disponible. Hoy solo hay agenda interna; el análisis de la QA 3 lo
  dejó fuera a propósito, pero con usuarios reales se espera.
- [ ] Centro de ayuda contextual dentro de la app (la guía y el manual existen; no
  están enlazados desde cada pantalla).
- [ ] Revisión de accesibilidad después de los últimos rediseños (la auditoría de
  contraste es anterior a los cambios de octubre).

**Aceptación:** cualquier usuario puede ver qué datos se guardan, exportarlos y
pedir la baja; los correos de hitos se pueden desactivar por preferencia.

---

## Fase 6 — Mantenibilidad (continua)

- [ ] Extraer los componentes comunes de agente/docente (~450 líneas duplicadas).
- [ ] Trocear `cace.component.ts` (2.283 líneas), `proyecto.component.ts` (1.605)
  y `styles.css` (4.011 líneas, sin SCSS).
- [ ] Seed de Prisma (`prisma/seed.ts`) en lugar de los scripts sueltos.
- [ ] Borrar el andamiaje SSR inerte (`main.server.ts`, `server.ts`,
  `@angular/ssr`) y el resto de residuos de la QA 5.
- [ ] Repasar los `.docx` del repositorio: ya están fuera del control de versiones
  (política de octubre); mantenerlo así.


---

## Fase 7 — Nuevas funciones pedidas (21-oct-2026)

**Por qué:** la CACE pidió cuatro cambios que no estaban en las fases 0–6. Se
planifican aparte para no mezclarlos con la integridad y la operación, y porque
la multi-institución toca el modelo de solicitudes, revisiones y certificados.

### Decisiones ya tomadas (21-oct-2026)

- **Plazos:** **8 días** como mínimo para proponer una clase y **7 días** para
  revisarla. Los dos los configura la presidencia desde el panel (no una variable
  de entorno). Hoy el código usa un único valor por entorno, 7 por defecto.
- **Mínimo de participantes:** **2 instituciones en total** (la de origen cuenta
  como participante). Si una institución rechaza y todavía quedan 2 o más, la
  clase sigue adelante; si se baja de 2, no se crea (o no continúa) la clase.
- **Evidencias por enlace:** solo se aceptan enlaces de una **lista blanca
  reducida** para evitar enlaces maliciosos; nada de URL libres.
- **Multi-institución:** la clase sigue siendo **una sola** (un proyecto) aunque
  participen más de dos instituciones; no se duplica en varias clases.

### 7.1 Plazos configurables por la presidencia

- [ ] Añadir a `CONFIGURACION_CACE` dos campos: `diasMinimosPropuesta` (8 por
  defecto) y `diasRevision` (7 por defecto), con rango válido (2–60) y auditoría
  de quién los cambia.
- [ ] Pantalla de la presidencia en «Comunidad/Configuración» para editarlos, con
  la fecha mínima resultante a la vista. La secretaría no puede cambiarlos.
- [ ] Usar esos valores en: alta y edición de solicitud, fecha mínima del
  formulario, caducidad de la revisión, recordatorios y textos de la pantalla.
- [ ] Mantener `REVISION_DIAS_ANTELACION` solo como respaldo de instalación.
- [ ] e2e: 7 días rechaza, 8 acepta; el cambio de la presidencia se aplica a la
  siguiente solicitud; la secretaría recibe 403.

**Esfuerzo:** 1–2 días. **Riesgo:** bajo. **Aceptación:** un cambio en el panel
cambia la fecha mínima real sin reiniciar el servidor y queda registrado.

### 7.2 Evidencias por enlace (lista blanca)

- [ ] `EVIDENCIA`: `archivoUrl` pasa a opcional y se añade `enlaceUrl`; `tipo`
  distingue `ARCHIVO`, `ENLACE` y `VIDEO`. Al menos uno de los dos debe existir.
- [ ] Lista blanca inicial (pendiente de confirmar los dos últimos): YouTube
  (`youtube.com`, `youtu.be`), Vimeo (`vimeo.com`), Google Drive
  (`drive.google.com`), OneDrive (`1drv.ms`, `onedrive.live.com`).
- [ ] Validar `https` (y `http` solo si se decide), longitud máxima, sin
  credenciales embebidas y sin `javascript:` ni `data:`; **no** descargar el
  enlace en el servidor (evita SSRF).
- [ ] Endpoint de alta por JSON (o campo opcional en el formulario multipart) y
  UI con «Subir archivo / Pegar enlace», mostrando el proveedor reconocido.
- [ ] Abrir en pestaña nueva con `rel="noopener noreferrer"`; no incrustar
  iframes de dominios no previstos.
- [ ] e2e: enlace de YouTube aceptado; dominio fuera de la lista → 400; enlace
  inválido o `javascript:` → 400; una evidencia antigua de archivo sigue viéndose.

**Esfuerzo:** 3–5 días. **Riesgo:** bajo. **Aceptación:** se puede registrar una
evidencia de vídeo por enlace sin subir el archivo y el archivo ya no es
obligatorio.

### 7.3 Identificador internacional del alumno

- [ ] `ALUMNO`: añadir `tipoDocumento` (DNI, Pasaporte, Cédula, RUT, CURP, Otro) y
  `numeroDocumento`, normalizados; `@@unique([listaId, tipoDocumento, numeroDocumento])`
  (la matrícula puede repetirse entre instituciones, el documento no dentro de
  una lista).
- [ ] Aviso si un mismo documento aparece en listas de instituciones distintas.
- [ ] Plantilla de importación y formulario de lista con los dos campos; tabla
  del panel con tipo y número.
- [ ] Emisión: exigir documento en las listas nuevas; las antiguas se pueden
  completar o marcar como «sin documento».
- [ ] Certificado: hueco opcional `documento` en el editor de plantilla (o debajo
  del nombre), sin romper los diseños actuales.
- [ ] Verificación pública: decidir si se muestra el tipo y los últimos 4 dígitos
  o nada (privacidad); el número completo se queda en el panel.
- [ ] e2e: documento duplicado en la misma lista → 400; falta de documento en
  emisión nueva → 400; el certificado lo imprime si el diseño lo activa.

**Esfuerzo:** 5–7 días con el campo del certificado; 2–3 días si solo es registro
interno. **Riesgo:** medio (importación y privacidad).

### 7.4 Clases con múltiples instituciones

- [ ] Nueva tabla `PARTICIPANTE_SOLICITUD`: solicitud, institución, docente,
  materia, rol (`ORIGEN`/`DESTINO`), estado (`PENDIENTE`, `ACEPTADA`, `RECHAZADA`,
  `CADUCADA`), quién revisó y cuándo. La institución de origen también es
  participante.
- [ ] Migrar el destino actual de cada solicitud a una fila de participante;
  mantener las columnas viejas como compatibilidad mientras se termina la
  migración (aditiva).
- [ ] Flujo: el docente de origen elige N instituciones (cada una con su
  docente/materia opcional); el agente de origen revisa una vez; **cada destino
  acepta o rechaza por separado**. La clase se crea cuando hay **2 participantes
  aceptados en total**; un rechazo no la tumba si aún quedan 2 o más.
- [ ] Si se baja de 2, la solicitud no se convierte en proyecto (o se cancela con
  motivo) y el origen puede volver a invitar; decidir si se permite incorporar
  instituciones después de crear el proyecto y hasta qué fecha.
- [ ] `ProyectoClaseEspejo`: un solo proyecto con N participantes; listas por
  institución (ya existen), `ProyectoDocente` por docente, calendario a todos y
  reportes por docente. Certificados: un certificado por alumno y el texto de
  **todas** las instituciones; verificación pública con todas.
- [ ] UI: selector múltiple de instituciones, panel de respuestas por destino y
  vista del proyecto con N instituciones.
- [ ] e2e: 3 instituciones (origen + 2 destinos) con un rechazo y quórum de 2;
  certificado con tres instituciones; calendario a todos los docentes.

**Esfuerzo:** 3–5 semanas. **Riesgo:** alto (modelo, revisiones, certificados y
calendario). **Aceptación:** una clase con tres instituciones participantes se
crea, se planifica, se certifica y se verifica sin duplicar proyectos.

### Orden recomendado dentro de la fase

1. Evidencias por enlace (rápida e independiente).
2. Plazos configurables (rápida, alto valor).
3. Identificador internacional (media; depende de si se imprime).
4. Múltiples instituciones (la grande; cerrar antes las preguntas de abajo).

### Decisiones que faltan para cerrar la Fase 7

- ¿El documento internacional se **imprime** en el certificado y se muestra
  **enmascarado** en la verificación pública, o queda solo como registro interno?
- ¿La lista blanca incluye Google Drive y OneDrive desde el principio, y qué
  proveedor se añadiría después?
- En multi-institución: ¿se pueden añadir instituciones **después** de crear el
  proyecto? ¿Hasta cuándo? ¿Quién cierra la clase con N participantes?

---

## Decisiones que necesitan tu visto bueno

1. **¿Segundo factor (TOTP) para presidencia y secretaría?** Recomendado sí.
2. **¿Providencia de correo para producción?** Gmail limita (≈500/día); para
   certificados masivos hace falta un proveedor transaccional o cola propia.
3. **Política de contraseñas y de bloqueo** (mínimo 10, intentos antes de bloquear).
4. **Notificaciones por correo**: ¿solo hitos o también recordatorios de sesión?
   (La plataforma nació sin recordatorios propios: el `.ics` los pone en el
   calendario del usuario. No confundir las dos cosas.)
5. **Retención de datos y qué significa «baja»**: borrado real o anonimización.
6. **¿Una sola sede o multi-institución con subdominios?** Cambia la fase 4.

---

## Cómo se verifica cada fase (el listón de este repositorio)

1. `cd backend && npx tsc --noEmit && npx nest build && npx jest --runInBand`.
2. `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npx ngc -p tsconfig.app.json --noEmit && npx ng build`.
3. Servidor de pruebas **en 3001** (nunca el 3000): login de los roles implicados,
   caso bueno, caso malo y el 403/401 que corresponda.
4. Navegador por DevTools cuando sea visual, midiendo (no mirando).
5. Los datos de prueba se borran al terminar.
6. Cada fase se commitea con su mensaje y no se hace `git push`.

---

## Lo que este plan NO incluye (fuera de alcance)

- Aplicación móvil nativa (la web es responsive; valorar PWA más adelante).
- Integración con LMS (Moodle, Canvas) ni con videoconferencia por API.
- Firma electrónica avanzada/cualificada de los certificados (hoy son PDF con
  folio y verificación por QR).
- Facturación, planes o multi-tenant comercial.
- Traducción a otros idiomas (hoy todo está en español).
