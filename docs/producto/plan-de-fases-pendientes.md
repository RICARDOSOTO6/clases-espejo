# Plan de fases — lo que falta para poner la plataforma en uso real

> **Escrito el 17 de octubre de 2026**, con el repositorio en `master` (96 commits,
> 127 rutas, 32 modelos, 23 migraciones —24 desde la migración de índices del
> 18-oct-2026—) y los datos de demostración cargados
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

**Total realista:** 6–8 semanas de una persona a tiempo parcial. Las fases 1 y 3
pueden ir en paralelo si hay dos personas (tocan archivos distintos).

---

## Fase 0 — Red de seguridad (primero, aunque no se vea)

**Por qué:** 127 rutas y 4 archivos de prueba triviales. Cualquier cambio de las
fases siguientes sin pruebas es a ciegas, y este proyecto ya se comió un caso de
«corregido» que volvió a abrirse (fechas).

- [ ] CI en `.github/workflows/`: `npm run lint`, `npx tsc --noEmit`,
  `npx jest --runInBand`, `npx prisma validate`, `ng build` en cada push.
- [ ] `.env.example` con todas las variables (hoy solo existe `.env`, ignorado).
- [ ] `strict` en el `tsconfig` del backend (hoy `noImplicitAny: false`) y ESLint
  en el frontend (hoy no tiene).
- [ ] 20–30 pruebas e2e de los seis flujos críticos, con una base de prueba:
  1. registro → aprobación de institución → invitación → activación;
  2. doble revisión de una solicitud y creación atómica del proyecto;
  3. matriz de capacidades: una prueba por rol × ruta sensible (401/403);
  4. emisión, reemisión, anulación y verificación de un certificado (incluye HMAC);
  5. cierre de la clase con sus reglas;
  6. envío del calendario (éxito, fallo parcial y 403 del agente).

**Aceptación:** el CI corre en cada push y falla si se rompe cualquiera de los seis
flujos; `prisma validate` y `ng build` en verde.

---

## Fase 1 — Cuenta y acceso (el hueco más caro)

**Por qué:** hoy no hay recuperación de contraseña (solo `register`, `login` y
`activate`), el correo no se verifica al registrarse (`activo: true` sin
comprobarlo), cambiar la contraseña no cierra las sesiones (JWT de 1 día sin
versión ni refresh) y la invitación caducada no se puede reenviar.

- [ ] **Recuperar contraseña** (`POST /auth/recuperar`, `POST /auth/restablecer`):
  token de un solo uso con caducidad y consumo atómico, reutilizando el patrón de
  `Invitacion` (`updateMany` con `usadaEn: null`). Pantallas en el frontend.
  La respuesta es siempre la misma exista o no la cuenta (no revelar correos).
- [ ] **Invalidar sesiones** al cambiar o restablecer la contraseña: columna
  `tokenVersion` (o `passwordActualizadoEn`) que viaje en el JWT y se compare en
  `JwtAuthGuard`. Con esto, un token robado muere al cambiar la contraseña.
- [ ] **Verificación de correo al registrarse**: cuenta en estado «pendiente» +
  correo con token; sin verificar no se puede operar. Añadir «reenviar
  verificación».
- [ ] **Reenviar invitación** de docente desde el panel del agente (hoy hay que
  borrar y volver a invitar), mostrando la caducidad.
- [ ] **Política de contraseña**: mínimo 10, sin ser la del correo, y bloqueo
  temporal tras N intentos fallidos (además del rate limit).
- [ ] **Cambio de correo** con verificación en la dirección nueva.
- [ ] *(Opcional, a decidir)* segundo factor TOTP para presidencia y secretaría.

**Aceptación:** un usuario que olvida su contraseña la recupera solo, sin tocar la
base; un token robado deja de valer en cuanto se cambia la contraseña; ninguna
cuenta nueva opera sin correo verificado. Todo con e2e de la fase 0.

---

## Fase 2 — Correo y procesos largos

**Por qué:** el envío de certificados va en un `for … await` dentro de la petición
(hasta 300 destinatarios por lote), con SMTP de Gmail, sin cola, sin reintentos y
sin registro de rebotes. Un lote grande puede agotar el tiempo de espera o el
límite diario del proveedor.

- [ ] Tabla `ENVIO_CORREO` (destinatario, asunto, adjunto, estado, intentos,
  últimoError) y un worker por cron que vacíe la cola cada minuto.
- [ ] Los endpoints de envío **encolan** y responden al instante con un
  identificador de lote; el frontend muestra el progreso.
- [ ] Reintentos con espera creciente y registro del rebote.
- [ ] Tope de emisión por clase (por ejemplo 500) y aviso claro al superarlo.
- [ ] ZIP de certificados en streaming (hoy se arma entero en memoria).
- [ ] Documentar la configuración SMTP del despliegue (SPF/DKIM si es dominio
  propio) y separar el remitente de certificados.

**Aceptación:** un envío de 300 certificados responde en menos de 2 s y termina en
la cola; matar el proceso a mitad no pierde envíos (se reintentan); cada fallo
queda registrado con su motivo.

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
