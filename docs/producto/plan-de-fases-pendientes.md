# Plan por fases — demo real en servidor temporal

> Reordenado el 24-oct-2026. **Sustituye el orden anterior.** El objetivo ya no es
> «terminar funciones»: es llegar a la demo con un servidor confiable y con todo lo
> que se use ese día funcionando de verdad.
>
> Lo funcional ya existe (solicitud, dos instituciones, lista, sesiones, evidencias,
> cierre, certificados, ZIP, verificación y cola de correo). Lo que falta es la
> **operación**: URL pública, respaldos, correo, privacidad y cuentas reales.
>
> Regla: **servidor primero**. Las funciones nuevas solo entran si la demo ya está
> desplegada y probada, y cada una se entrega completa; no se deja media función.

## Qué se va a demostrar

Una clase con **dos instituciones**, con el fin de encontrar errores humanos y de
operación que no aparecen en simulación. La prueba solicitada arranca con una
**base vacía**: sin instituciones, docentes, materias, alumnos, proyectos ni
certificados; solo el alta inicial de la presidencia de la CACE. Las instituciones
y los usuarios se crean durante la propia prueba. Puede ser:

- **Alumnos ficticios:** más seguro; los certificados llevan marca **DEMO** y no
  se presentan como oficiales.
- **Alumnos reales:** solo con aviso de privacidad y consentimiento; los
  certificados también se marcan como demostración salvo que la CACE autorice lo
  contrario.

La demo **no valida** que el folio sea oficial ni que el certificado tenga validez
legal. Valida el flujo completo: que la gente pueda entrar, trabajar, cerrar,
emitir, descargar, recibir y verificar.

## Reglas de esta etapa

- **P0 — Sin esto no hay demo:** URL pública estable, HTTPS, respaldos con
  restauración, correo, privacidad y cuentas reales.
- **P1 — Antes de abrir a más gente:** contraseñas, TOTP si se autoriza, límites de
  seguridad y plantilla del certificado.
- **P2 — Después de la demo:** panel de desempeño, multi-institución, identificador
  interno, paginación y rendimiento.
- **Terminado significa terminado:** migración, backend, interfaz, pruebas y
  documentación. Si no está completo, no se despliega.
- **Nada de cambios de último minuto:** 48 horas antes de la demo solo se corrigen
  bloqueos; no se estrena una función nueva.

## Cuadro de conjunto

| Fase | Qué resuelve | Duración | Depende de |
| --- | --- | --- | --- |
| **0** | Preparar base vacía, guion desde cero y alcance | 2–3 días | — |
| **1** | Servidor temporal listo: URL, HTTPS, respaldos, correo, seguridad | 1–2 semanas | Fase 0 |
| **2** | Datos, privacidad y accesos reales | 1 semana | Fase 0 |
| **3** | Release candidate y ensayo | 1 semana | Fases 1 y 2 |
| **4** | Funciones opcionales antes de la demo, solo si hay tiempo | 1 semana | Fase 3 |
| **5** | Demo real y cierre | 2–3 días | Fase 3 (y 4 si se hace) |
| **6** | Después de la demo: panel, multi-institución y deudas | 4–6 semanas | Fase 5 |
| **7** | Endurecimiento y mantenibilidad continua | continuo | — |

**Camino crítico:** dominio/URL estable + autorización de correo + prueba de
restauración. Si falla uno de los tres, la demo se limita o se retrasa.

---

## Fase 0 — Preparar la base vacía y el guion (2–3 días)

No hacen falta los nombres de las instituciones ni una fecha cerrada para avanzar.
Si todavía no te los dieron, **no es un bloqueo**: la prueba empieza sin datos y
las instituciones se registran durante la demo.

- [ ] Confirmar que se quiere una **base vacía** (sin seed de demostración) y quién
  hará de presidencia y secretaría de la CACE.
- [ ] Nombrar responsable técnico, operador de la base y persona de soporte.
- [ ] Escribir el **guion desde cero**: presidencia → secretaría → registro de
  institución → aprobación CACE → agentes y docentes → materias → solicitud →
  aprobación → planificación → sesión → evidencias → cierre → certificado DEMO →
  verificación.
- [ ] Decidir si los alumnos serán **ficticios o reales**. Si son reales, revisar
  aviso de privacidad y consentimiento antes de cargar sus datos.
- [ ] Definir el certificado de la prueba: **plantilla DEMO**, folio automático y
  sin presentarlo como oficial. La plantilla hay que crearla porque la base vacía
  no la trae.
- [ ] Confirmar **URL pública y dominio**; no se emitirán certificados con una URL
  que pueda cambiar después.
- [ ] Definir el **plan B** si falla el correo, el registro o la plataforma.
- [ ] Escribir el criterio de éxito y el criterio de **no celebrar la demo** si falta
  algo crítico.
- [ ] Reservar una fecha tentativa cuando la CACE la indique; no hace falta fijarla
  para dejar el entorno listo.

**Aceptación:** base vacía definida, guion desde cero escrito, roles y soporte
confirmados, plantilla DEMO prevista y URL identificada. Los nombres de las
instituciones pueden llegar después.

---

## Fase 1 — Servidor temporal listo (1–2 semanas)

### 1.1 URL pública, dominio y HTTPS

- [ ] Publicar el build actual en un servidor accesible por los participantes.
- [ ] Dominio y certificado TLS; una sola URL, sin `localhost` ni puertos raros.
- [ ] Configurar `FRONTEND_URL` y `URL_PUBLICA` con la URL definitiva **antes** de
  emitir certificados: el QR y los correos dependen de ella.
- [ ] Si se usa un túnel, que sea con nombre estable o dominio propio; no una URL
  gratuita que cambie en cada arranque.
- [ ] Disco persistente para uploads, PDFs y respaldos.

### 1.2 Despliegue, migraciones y cola

- [ ] `prisma migrate deploy`, nunca `db push` sobre datos reales.
- [ ] Frontend compilado servido desde `backend/public`; rutas de API fuera del
  fallback de la SPA.
- [ ] Worker de correo activo, con reintentos y sin procesos duplicados.
- [ ] Guion de despliegue reproducible y vuelta atrás documentada.
- [ ] Probar el despliegue completo una vez antes de la demo.

### 1.3 Correo real

- [ ] Autorizar el proveedor de correo (está al final del plan).
- [ ] Dominio de envío con SPF, DKIM y DMARC.
- [ ] Probar invitación, recuperación, calendario, certificado y rebote.
- [ ] Conocer el límite de envío y no prometer lotes mayores.
- [ ] Si no hay autorización, limitar la demo: no se promete entrega de correos.

### 1.4 Respaldos y restauración

- [ ] Respaldo automático diario de base, uploads y certificados.
- [ ] Copia fuera del servidor y retención definida.
- [ ] **Restauración real** en una base aparte, documentada.
- [ ] Repetir respaldo antes y después de la demo.

### 1.5 Seguridad mínima

- [ ] `helmet` con HSTS, `X-Frame-Options` y CSP global.
- [ ] Límite de intentos en login, registro y verificación pública.
- [ ] Cookies seguras, sin trazas internas ni endpoints de depuración.
- [ ] Límite de subida y extensiones permitidas para evidencias.
- [ ] **Cuentas de demostración desactivadas** en el entorno de la demo.

### 1.6 Monitorización y logs

- [ ] `/health` comprobado desde fuera y aviso si cae.
- [ ] Logs con identificador de petición y errores 5xx.
- [ ] Aviso de disco lleno y de cola de correo atascada.

### 1.7 Entorno de demostración: base vacía

**Modo A — base vacía de verdad (el que pidieron):**

- [ ] Crear una base nueva y aplicar prisma migrate deploy; **no** ejecutar
  seed-demo.js.
- [ ] Configurar PRESIDENTE_CORREO y URL_PUBLICA. Al arrancar, el sistema crea
  la presidencia y envía su contraseña provisional; si el SMTP falla, la deja en el
  log (solo para la demo).
- [ ] Entrar como presidencia, cambiar la contraseña y crear la secretaría.
- [ ] Confirmar que no hay instituciones, docentes, materias, proyectos ni
  certificados.
- [ ] Probar que /registro crea una institución en PENDIENTE y que la CACE la
  aprueba.
- [ ] Crear la **plantilla de certificado DEMO desde cero**; sin plantilla activa no
  se puede emitir.
- [ ] Poder reiniciar la demo: borrar la base, volver a migrar y repetir el bootstrap.

**Modo B — copia de demostración:** útil para un ensayo interno rápido, pero no
sirve para la prueba de «empezar desde cero».

La cuenta de presidencia no es un dato de demostración: sin ella nadie aprueba
instituciones. Es el **único registro inicial**; todo lo demás se crea en la prueba.

**Aceptación:** base vacía migrada, presidencia y secretaría creadas, registro de
institución funcionando, plantilla DEMO lista, URL pública con HTTPS, correo
probado, restauración comprobada, `/health` vigilado y cola activa. No hay
instituciones ni alumnos precargados.

---

## Fase 2 — Datos, privacidad y accesos reales (1 semana)

### 2.1 Privacidad y consentimiento

- [x] Aviso de privacidad y términos con versión y fecha de aceptación
  (`2026-10-25`): se guarda en `USUARIO` y se exige al registrarse y al activar
  una invitación.
- [x] Base legal o consentimiento para nombre, matrícula y correo de alumnos:
  declaración obligatoria al guardar la lista, con versión y fecha en
  `LISTA_ALUMNOS`.
- [x] Política de retención: una institución rechazada con historial pasa a
  `ARCHIVADA` (inoperable, con todo su historial); sin historial se puede
  eliminar. Los certificados se conservan y su folio sigue verificable; la
  anulación es una acción aparte.
- [x] Enlace al aviso desde el registro, la activación, el acceso y el pie.

### 2.2 Contraseñas y segundo factor

- [x] Política aplicada: mínimo **12**, sin regla del carácter repetido y
  comprobación local de contraseñas comunes; se mantiene el enlace de recuperación
  como desbloqueo.
- [x] 5 intentos/15 minutos con aviso por correo al bloquear.
- [ ] Si se autoriza, TOTP para presidencia y secretaría, con códigos de respaldo y
  reset auditado.

### 2.3 Cuentas y roles

- [ ] Crear las cuentas reales o de demo que se usarán ese día.
- [ ] Probar cada rol: presidencia, secretaría, agente y docente; verificar 401/403.
- [ ] Quitar credenciales de demostración de la documentación de producción.
- [ ] Comprobar que cada docente solo ve su institución y su lista.

### 2.4 Certificado y folio

- [ ] Plantilla activa, logo y datos de la CACE revisados.
- [ ] Entender que el folio lo genera el sistema (`CACE-AAAA-####`); **no hace falta
  un folio externo**.
- [ ] La emisión solo se bloquea si la clase no está `FINALIZADO`, falta plantilla,
  falta lista o se pasa de 500 certificados.
- [ ] Definir si el certificado de la demo lleva marca DEMO y cómo se explica a los
  participantes.

### 2.5 Integridad que afecta a datos reales

- [x] Duplicados revisados en demo y pruebas (0) y añadidos tres índices únicos: docente-institución, materia-clave y asignación-periodo (24-oct-2026).
- [ ] Añadir solo restricciones que protejan la demo; paginación, N+1, `ENUM`/`CHECK`
  pueden esperar a la Fase 6.
- [ ] Comprobar que el folio es único y que la verificación no filtra datos.

**Aceptación:** alumnos con consentimiento o ficticios, cuentas y roles probados,
plantilla DEMO verificable y folio generado sin pasos manuales.

---

## Fase 3 — Release candidate y ensayo (1 semana)

### 3.1 Release candidate

- [ ] Etiquetar el commit que se va a demostrar; no desplegar cambios sueltos.
- [ ] Congelar la configuración y las migraciones 48 horas antes.
- [ ] Guardar el build, el `.env` de demo (sin secretos en git) y el respaldo.
- [ ] Verificar que se puede volver a la versión anterior.

### 3.2 Ensayo con datos ficticios

En el servidor de pruebas (`:3001`, nunca el `:3000`):

- [ ] Empezar con base vacía: presidencia, secretaría, registro de dos instituciones,
  aprobación de la CACE y alta de agentes/docentes.
- [ ] Crear materias, solicitud, aprobación, planificación, sesiones, evidencias y
  cierre.
- [ ] Subir lista, sesiones, evidencias y cerrar.
- [ ] Emitir, descargar ZIP, verificar folio y QR.
- [ ] Probar cola de correo y calendario.
- [ ] Anotar cada fricción; corregir solo lo que impida la demo.

### 3.3 Ensayo con las cuentas reales

- [ ] Repetir el flujo con docentes y agentes reales, sin alumnos reales.
- [ ] Medir quién puede entrar, qué correo recibe y qué pantalla confunde.
- [ ] Confirmar enlace de sesión, soporte y horario.

**Aceptación:** release candidate desplegado y ensayado con datos
ficticios y con cuentas reales. La demo se celebra en la Fase 5.

---

## Fase 4 — Funciones opcionales antes de la demo (1 semana)

**Puerta de entrada:** solo se empieza si las Fases 1 y 2 están verdes, el release
candidate está desplegado y los ensayos 3.2/3.3 están hechos. Se trabaja en una rama
aparte; si no se termina **antes del congelamiento de 48 horas**, se descarta la
rama y se demuestra el release candidate.

### 4.1 Plazos configurables (1–2 días)

- [x] Campos en `CONFIGURACION_CACE`: 8 días para proponer y 7 para revisar.
- [x] Pantalla de presidencia y uso en alta, edición, caducidad, agenda y formulario.
- [x] e2e: con 10 días se rechaza una fecha a 9 y se acepta a 10; el cambio de la presidencia se aplica.

### 4.2 Evidencias por enlace (3–5 días)

- [x] `archivoUrl` opcional y `enlaceUrl` con lista blanca: YouTube, Vimeo, Google
  Drive y OneDrive; solo `https` y enlaces públicos.
- [x] Validación sin descargar el enlace en el servidor; abrir en pestaña nueva.
- [x] e2e: enlace válido, dominio ajeno y archivo más enlace; pantalla con modo
  archivo o enlace.
- [ ] e2e: enlace válido, dominio no permitido y `javascript:` rechazado.

### 4.3 Lo que **no** entra antes de la demo

- Multi-institución.
- Identificador interno por alumno.
- Panel de desempeño completo; como mucho, la entrega A de métricas después de la
  demo.
- Refactors, paginación o cambios de diseño que no afecten la demo.

Cada función debe salir con migración, backend, interfaz, pruebas y documentación.
Si el tiempo no alcanza, no se despliega a medias.

---

## Fase 5 — Demo real y cierre (2–3 días)

### 5.1 Día de la demo

- [ ] Checklist de accesos, sesión, lista, evidencias y certificados.
- [ ] Una persona de soporte pendiente de la plataforma y del correo.
- [ ] Observadores con guion: registro de institución, login, invitación, roles,
  móvil, lista, archivos,
  zona horaria, cierre, emisión, QR y correo.
- [ ] Registrar cada incidencia con rol, hora, pantalla y captura.
- [ ] **No corregir código durante la demo** salvo bloqueo total; usar el plan B.

### 5.2 Después de la demo

- [ ] Emitir o completar certificados y comprobar que llegan.
- [ ] Verificar varios folios desde el QR y desde la URL pública.
- [ ] Respaldo posterior y restauración de prueba.
- [ ] Reunión de cierre: errores humanos, errores técnicos y qué se pospone.

**Aceptación:** una demo completa, certificados DEMO verificables, correos
entregados (si se autorizó), respaldo restaurado y lista de incidencias.

---

## Fase 6 — Después de la demo (4–6 semanas)

### 6.1 Panel de desempeño, en tres entregas

1. **Métricas y ranking:** una sola métrica de cierre, caducidad, tiempo de
   respuesta, no conclusión y estancados; filtro mensual; presidencia y secretaría.
2. **Plan de acción:** prioridad, responsable, fecha y estado por institución.
3. **Vista del agente y canal in-app:** su institución y sus docentes; sin correo.

### 6.2 Multi-institución

- [ ] Participantes, migración del destino actual, revisión por destino.
- [ ] Mínimo 2; rechazo no tumba la clase si quedan 2 o más.
- [ ] Participantes congelados, observadores sin certificado y cierre por el docente
  de origen con supervisión de la CACE.

### 6.3 Identificador y deudas

- [ ] Código interno por alumno solo si la CACE lo confirma; nunca impreso ni público.
- [ ] `ENUM`/`CHECK`, paginación y revisión de N+1.
- [ ] Exportar datos, baja de usuario, ayuda contextual y accesibilidad.

---

## Fase 7 — Endurecimiento y mantenibilidad (continuo)

- [ ] Extraer componentes comunes de agente/docente.
- [ ] Trocear `cace.component.ts` y `proyecto.component.ts`.
- [ ] `prisma/seed.ts` y borrar el andamiaje SSR inerte.
- [ ] Swagger interno, despliegue reproducible y migraciones automatizadas.
- [ ] Documentación y `.docx` fuera de git.

---

## Decisiones cerradas

- **Demo:** base separada, certificados con marca DEMO salvo autorización expresa.
- **Folio:** el sistema genera `CACE-AAAA-####`; no se requiere folio externo.
- **Plazos:** 8 días para proponer y 7 para revisar; configurables por presidencia.
- **Participantes:** mínimo 2 instituciones; un rechazo no tumba la clase si quedan
  2 o más; un solo proyecto; congelados al crear; cierra el docente de origen.
- **Contraseñas:** mínimo 12, sin regla del carácter repetido, comprobación de
  filtradas, 5 intentos/15 minutos con aviso por correo y desbloqueo mediante el enlace de recuperación.
- **Notificaciones:** correo para hitos y seguridad; el resto dentro de la app; no
  duplicar el `.ics`.
- **Baja de institución:** inoperable y archivada, con historial; certificados
  conservados y anulados si procede.
- **Sede:** una sola instancia y una sola base.
- **Identificador:** sin pasaporte/DNI; el folio es el identificador público.
- **Enlaces:** YouTube, Vimeo, Google Drive y OneDrive, solo `https` y públicos.
- **Panel:** una sola métrica de cierre; periodo mensual ajustable; presidencia y
  secretaría ven todo (secretaría en lectura); agentes ven su institución y sus
  docentes; canal solo in-app.

## Pendientes de autorización (al final, para la próxima reunión)

### TOTP para presidencia y secretaría

- Qué se decide: exigir un código de app autenticadora además de la contraseña.
- Recomendación: obligatorio para presidencia y secretaría, con códigos de respaldo
  y reset auditado.
- Falta: quién resetea, cuántos códigos y si se extiende a agentes.
- Mientras no se autorice: no se toca el login actual.

### Proveedor de correo para producción

- Qué se decide: qué servicio manda los correos reales y con qué dominio.
- Situación: hoy hay SMTP y envía, pero no está pensado para lotes de certificados.
- Recomendación: proveedor transaccional con dominio propio, SPF/DKIM/DMARC,
  rebotes y la cola actual.
- Falta: dominio, presupuesto, volumen estimado y quién administra el DNS.
- Mientras no se autorice: la demo puede hacerse, pero no se promete entrega
  masiva ni confiable de correos.

## Decisiones menores que pueden esperar

- ¿Código interno por alumno o basta el folio?
- ¿El agente ve el detalle por docente o solo el agregado de su institución?
- ¿Secretaría en solo lectura?
- Umbral de alerta (propuesto 30 % con 3 casos) y 30 días de gracia para
  «estancado».
