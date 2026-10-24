# Plan por fases — prioridad: primera clase espejo real

> Reordenado el 24-oct-2026. **Sustituye el orden anterior.** Las funciones de las
> antiguas fases 7 y 8 no se pierden: pasan a la Fase 4, troceadas para que no
> bloqueen la primera clase.
>
> Regla: si algo no es necesario para que **una clase con dos instituciones
> reales** funcione de principio a fin, no va antes de la Fase 4.

## Qué significa «primera clase real»

Una clase con **dos instituciones reales**, docentes y alumnos reales, que cumpla:

- La solicitud se crea y las dos instituciones la aprueban.
- La planificación, las sesiones y las evidencias quedan registradas.
- Se cierra la clase y se emiten los certificados de los alumnos.
- Cada certificado se puede verificar por su folio y QR.
- Los correos de invitación, calendario y certificados llegan.
- Antes y después hay **respaldo y restauración comprobados**.
- No se usan cuentas de demostración ni datos inventados en producción.

Si algo de esto falla, la clase no está «lista», aunque la pantalla se vea bien.

## Regla de prioridad

- **P0 — Sin esto no hay clase real:** dominio/TLS, backups, correo, privacidad,
  cuentas reales, ensayo general.
- **P1 — Debe estar antes de abrir la plataforma a más gente:** contraseñas,
  TOTP si se autoriza, límites de seguridad, plantilla de certificado.
- **P2 — Después de la primera clase:** panel de desempeño, multi-institución,
  enlaces de evidencias, plazos configurables.
- **P3 — Continuo:** paginación, rendimiento, refactor, documentación.

## Cómo se reordena

| Antes | Ahora |
| --- | --- |
| Fases 0–2 | Ya cerradas; no se repiten |
| Fase 3 (integridad) | Solo lo que protege datos reales, en 2.4; el resto, en 4.4 y 5 |
| Fase 4 (operación) | 1.1–1.6 |
| Fase 5 (producto) | Privacidad en 2.1; el resto, en 4.4 |
| Fase 6 (mantenibilidad) | 5 |
| Fase 7 (funciones pedidas) | 4.1 (plazos y enlaces), 4.3 (multi-institución) y 4.4 (identificador) |
| Fase 8 (panel) | 4.2, en tres entregas separadas |

## Cuadro de conjunto

| Fase | Qué resuelve | Duración | Depende de |
| --- | --- | --- | --- |
| **0** | Decidir la clase y preparar a las personas | 2–3 días | — |
| **1** | Operación mínima: servidor, dominio, backups, correo, seguridad | 1–2 semanas | Fase 0 |
| **2** | Datos, privacidad y accesos reales | 1 semana | Fase 0 |
| **3** | Ensayo general y primera clase | 1 semana | Fases 1 y 2 |
| **4** | Después de la primera clase: mejoras pedidas, por incrementos | 4–6 semanas | Fase 3 |
| **5** | Endurecimiento y mantenibilidad continua | continuo | — |

**Camino crítico:** autorización del proveedor de correo + dominio/DNS + prueba de
restauración. Si eso se retrasa, la clase se retrasa; el código ya está casi todo.

---

## Fase 0 — Decidir la clase y preparar a las personas (2–3 días)

No es código; es evitar improvisar el día de la clase.

- [ ] Confirmar **fecha, materia, dos instituciones, docentes, agentes y grupos**.
- [ ] Confirmar que las dos instituciones están **aprobadas por la CACE** y que sus
  agentes y docentes tienen cuentas activas.
- [ ] Confirmar que la fecha cumple la antelación mínima (**8 días**); si no, mover
  la clase o cambiar el plazo antes de abrir solicitudes.
- [ ] Nombrar un **responsable técnico** y un **responsable académico** durante la
  clase, con horario de soporte.
- [ ] Revisar el **aviso de privacidad y el consentimiento** para datos de alumnos;
  sin esto no se cargan alumnos reales.
- [ ] Congelar el alcance: dos instituciones, evidencias por archivo, sin panel de
  desempeño, sin multi-institución y sin documento internacional.
- [ ] Hacer un **respaldo fresco** de la base y guardarlo fuera del servidor.
- [ ] Definir el **plan B**: si falla el correo o la plataforma, cómo se comparte el
  enlace, cómo se recogen evidencias y a quién se avisa.
- [ ] Escribir el criterio de éxito (el de «primera clase real») y firmarlo.

**Aceptación:** fecha, personas, datos, permisos y plan B confirmados por escrito.

---

## Fase 1 — Operación mínima para salir de localhost (1–2 semanas)

### 1.1 Servidor, dominio y HTTPS

- [ ] Publicar el build actual en un servidor accesible por los participantes.
- [ ] Dominio y certificado TLS; una sola URL, sin puertos raros.
- [ ] Variables de entorno reales; secretos fuera del repositorio.
- [ ] **Desactivar o eliminar las cuentas de demostración** en producción.
- [ ] Revisar que el frontend compilado se sirve desde `backend/public` y que las
  rutas de la API no devuelven el `index.html`.

### 1.2 Respaldos y restauración

- [ ] Respaldo **automático diario** de la base y de los archivos subidos.
- [ ] Retención definida (por ejemplo 7 diarios, 4 semanales) y copia fuera del
  servidor.
- [ ] **Prueba de restauración real** en una base aparte, documentada, antes de
  cargar alumnos reales.
- [ ] Comprobar que los certificados y las evidencias también se restauran.

### 1.3 Correo real

- [ ] Autorizar el proveedor de correo (está al final del plan).
- [ ] Dominio de envío con SPF, DKIM y DMARC; remitente visible.
- [ ] Probar: invitación, recuperación de contraseña, calendario, certificado y
  rebote.
- [ ] Worker de la cola activo y con reintentos; límite de envío conocido.
- [ ] No usar Gmail personal para lotes de certificados.

### 1.4 Seguridad mínima

- [ ] `helmet` con HSTS, `X-Frame-Options` y CSP global.
- [ ] Límite de intentos en login, registro y verificación pública.
- [ ] Cookies seguras, sin trazas internas en las respuestas y sin endpoints de
  depuración.
- [ ] Límite de subida y extensiones permitidas para evidencias.

### 1.5 Monitorización y logs

- [ ] Comprobar `/health` desde fuera del servidor y avisar si cae.
- [ ] Logs con identificador de petición y errores 5xx.
- [ ] Aviso de disco lleno y de cola de correo atascada.

### 1.6 Despliegue y migraciones

- [ ] `prisma migrate deploy` en el despliegue, no `db push`.
- [ ] Guion de despliegue reproducible y vuelta atrás documentada.
- [ ] Probar el despliegue completo una vez antes de la clase.

**Aceptación:** URL pública con HTTPS, correo entregado, restauración comprobada,
`/health` vigilado y migraciones aplicadas sin pasos manuales ocultos.

---

## Fase 2 — Datos, privacidad y accesos reales (1 semana)

### 2.1 Privacidad y consentimiento

- [ ] Aviso de privacidad y términos, con versión y fecha de aceptación.
- [ ] Consentimiento o base legal para cargar nombre, matrícula y correo de alumnos.
- [ ] Política de retención: institución dada de baja queda **inoperable y
  archivada**, con historial; certificados conservados y, si procede, anulados.
- [ ] Enlace al aviso desde el registro y el pie de la aplicación.

### 2.2 Contraseñas y segundo factor

- [ ] Aplicar la política acordada: mínimo **12**, sin regla del carácter repetido,
  comprobación de contraseñas comunes/filtradas, aviso y desbloqueo administrativo.
- [ ] Mantener 5 intentos fallidos / 15 minutos, con aviso al usuario.
- [ ] Si se autoriza, TOTP obligatorio para presidencia y secretaría, con códigos
  de respaldo y reset auditado.

### 2.3 Cuentas y roles reales

- [ ] Crear las cuentas reales de presidencia, secretaría, agentes y docentes.
- [ ] Revisar que cada rol ve solo lo suyo; probar un 403 y un 401.
- [ ] Quitar las credenciales de demostración de la documentación de producción.
- [ ] Verificar la plantilla y el logo del certificado con la CACE.

### 2.4 Integridad que afecta a datos reales

- [ ] Revisar duplicados antes de añadir `@@unique` de asignaciones y materias.
- [ ] Añadir solo las restricciones que protegen la clase real; **paginación, N+1
  y `ENUM`/`CHECK` pueden esperar** a la Fase 4.
- [ ] Comprobar que el folio del certificado es único y que la verificación no
  filtra datos personales.

**Aceptación:** alumnos reales con aviso de privacidad, cuentas reales sin demo,
contraseñas acordes y certificado de prueba verificable.

---

## Fase 3 — Ensayo general y primera clase (1 semana)

### 3.1 Ensayo con datos ficticios

En el servidor de pruebas (`:3001`, nunca el `:3000`):

- [ ] Crear la clase con dos instituciones y recorrer todo el flujo.
- [ ] Subir lista, crear sesiones, adjuntar evidencias y cerrar la clase.
- [ ] Emitir certificados, descargar el ZIP y verificar folio y QR.
- [ ] Probar la cola de correo y el calendario.
- [ ] Anotar cada fricción y corregir solo lo que impida la clase.

### 3.2 Ensayo con las cuentas reales

- [ ] Repetir el flujo con docentes y agentes reales, sin alumnos reales todavía.
- [ ] Medir quién puede entrar, qué correo recibe y qué pantalla confunde.
- [ ] Confirmar el enlace de la sesión y el canal de soporte del día.

### 3.3 Día de la clase

- [ ] Checklist de accesos, sesión, lista de alumnos y evidencias.
- [ ] Una persona de soporte pendiente del correo y de la plataforma.
- [ ] Registrar hora, incidencias y quién las resolvió.

### 3.4 Después de la clase

- [ ] Emitir los certificados y comprobar que llegan.
- [ ] Verificar varios folios desde el QR y desde la URL pública.
- [ ] Hacer un respaldo posterior y probar una restauración.
- [ ] Reunión de cierre: qué falló, qué se corrige y qué se pospone.

**Aceptación:** una clase real completa, certificados verificables, correos
entregados y respaldo restaurado. Recién entonces se abre la Fase 4.

---

## Fase 4 — Después de la primera clase (4–6 semanas)

Nada de esto bloquea la primera clase. Se hace **por incrementos pequeños**, no
todo de golpe.

### 4.1 Mejoras rápidas (1–2 semanas)

- [ ] Plazos configurables por la presidencia: **8 días para proponer, 7 para
  revisar**.
- [ ] Evidencias por enlace con lista blanca: YouTube, Vimeo, Google Drive y
  OneDrive, solo `https` y enlaces públicos; sin descargar el enlace en el servidor.
- [ ] Correos de hitos y preferencias, sin duplicar los recordatorios del `.ics`.

### 4.2 Panel de desempeño, en tres entregas

No se implementa completo en una sola fase.

1. **Entrega A — métricas y ranking (1 semana).** Solicitudes y proyectos por
   estado, una sola métrica de cierre (`FINALIZADO`), tasa de caducidad, tiempo de
   respuesta, tasa de no conclusión y proyectos estancados; filtro mensual
   ajustable; presidencia y secretaría. Sin acciones ni mensajes.
2. **Entrega B — plan de acción (3–5 días).** Prioridad, nota, responsable, fecha
   y estado por institución, con historial; secretaría en lectura.
3. **Entrega C — vista del agente y canal (1 semana).** Versión simplificada de su
   institución y sus docentes y canal **solo dentro de la app**, sin correo.

### 4.3 Clases con múltiples instituciones (3–5 semanas)

- [ ] Tabla de participantes, migración del destino actual y revisión por destino.
- [ ] Mínimo 2 participantes; un rechazo no tumba la clase si quedan 2 o más.
- [ ] Participantes congelados al crear el proyecto, observadores sin certificado,
  cierre por el docente de origen con supervisión de la CACE.
- [ ] Certificados y calendario con todas las instituciones.
- [ ] Solo se hace si hay demanda real; la primera clase funciona con dos.

### 4.4 Identificador interno y deudas técnicas

- [ ] Si la CACE lo confirma, código interno por alumno para distinguir matrículas
  repetidas; nunca impreso ni público (el folio sigue siendo el identificador).
- [ ] `ENUM`/`CHECK`, paginación y revisión de N+1 en los listados grandes.
- [ ] Exportar datos y baja de usuario, centro de ayuda y accesibilidad.

---

## Fase 5 — Endurecimiento y mantenibilidad (continuo)

- [ ] Extraer componentes comunes de agente/docente.
- [ ] Trocear `cace.component.ts` y `proyecto.component.ts`.
- [ ] `prisma/seed.ts` y borrar el andamiaje SSR inerte.
- [ ] Swagger interno, despliegue reproducible y automatización de migraciones.
- [ ] Documentación y `.docx` fuera de git.

---

## Decisiones cerradas

- **Plazos:** 8 días para proponer y 7 para revisar; configurables por presidencia.
- **Participantes:** mínimo 2 instituciones en total; un rechazo no tumba la clase
  si quedan 2 o más; un solo proyecto; participantes congelados al crear; el
  docente de origen cierra con supervisión de la CACE.
- **Contraseñas:** mínimo 12, sin regla del carácter repetido, comprobación de
  filtradas, 5 intentos/15 minutos, aviso y desbloqueo administrativo.
- **Notificaciones:** correo para hitos y seguridad; el resto dentro de la app; no
  duplicar el `.ics`.
- **Baja de institución:** inoperable y archivada, con historial; certificados
  conservados y anulados si procede; sin borrado en cascada.
- **Sede:** una sola instancia y una sola base de datos.
- **Identificador:** sin pasaporte/DNI; el folio es el identificador público.
- **Enlaces:** YouTube, Vimeo, Google Drive y OneDrive, solo `https` y públicos.
- **Panel:** una sola métrica de cierre (`FINALIZADO`); periodo mensual ajustable;
  presidencia y secretaría ven todo (secretaría en lectura); agentes ven su
  institución y sus docentes; canal solo in-app.

## Pendientes de autorización (al final, para la próxima reunión)

### TOTP para presidencia y secretaría

- Qué se decide: exigir un código de app autenticadora además de la contraseña.
- Recomendación: obligatorio para presidencia y secretaría, con códigos de
  respaldo y reset auditado.
- Falta: quién resetea, cuántos códigos y si se extiende a agentes.
- Mientras no se autorice: no se toca el login actual.

### Proveedor de correo para producción

- Qué se decide: qué servicio manda los correos reales y con qué dominio.
- Situación: hoy hay SMTP y envía, pero no está pensado para lotes de certificados.
- Recomendación: proveedor transaccional con dominio propio, SPF/DKIM/DMARC,
  rebotes y la cola actual.
- Falta: dominio, presupuesto, volumen estimado y quién administra el DNS.
- Mientras no se autorice: las pruebas siguen con el correo actual; no se promete
  envío masivo en producción.

## Decisiones menores que pueden esperar a la Fase 4

- ¿Código interno por alumno o basta el folio?
- ¿El agente ve el detalle por docente o solo el agregado de su institución?
- ¿Secretaría en solo lectura?
- Umbral de alerta (propuesto 30 % con 3 casos) y 30 días de gracia para
  «estancado».
