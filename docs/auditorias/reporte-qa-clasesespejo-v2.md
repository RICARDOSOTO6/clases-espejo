# Segunda revisión de Clases Espejo

Este es el segundo informe. El primero está en
[`reporte-qa-clasesespejo.md`](./reporte-qa-clasesespejo.md).

Aquí se revisó de nuevo el código después de los arreglos, y se hizo una
revisión de experiencia de usuario (cómo se siente usar la aplicación).

## Qué se comprobó

Se leyó de nuevo el código del backend y del frontend y se compiló todo:

- `npm run build` (backend) → compila bien.
- `npm run build` (frontend) → compila bien.

No se levantó el servidor ni se tocó la base de datos. Todo lo que se dice salió
de leer el código, salvo esas dos comprobaciones.

---

## Parte 1: ¿Quedaron bien corregidos los 12 problemas?

Sí. Los 12 problemas del primer informe están corregidos correctamente.

| # | Problema | Estado |
| --- | --- | --- |
| 1 | "Desactivar docente" no desactivaba nada | ✅ Corregido: ahora se revisa en cada petición |
| 2 | Se podía cerrar el proyecto sin cumplir las reglas | ✅ Corregido: el formulario ya no permite "Finalizado" |
| 3 | Invitar a un correo existente dejaba enlace inservible | ✅ Corregido: se avisa con un mensaje claro |
| 4 | Faltaba la doble revisión | ✅ Corregido: origen primero, luego destino |
| 5 | Borrar datos relacionados daba error 500 | ✅ Corregido: se avisa antes de borrar |
| 6 | Las evidencias no se unían a una sesión | ✅ Corregido: ya se puede elegir sesión |
| 7 | Estados sueltos y etiquetas muertas | ✅ Corregido: todo en un solo archivo |
| 8 | Login engañaba al invitado sin activar | ✅ Corregido: mensaje correcto |
| 9 | Condición que siempre se cumplía | ✅ Corregido: eliminada |
| 10 | Dos fechas de vencimiento distintas | ✅ Corregido: una sola |
| 11 | Se podían agregar cosas a un proyecto finalizado | ✅ Casi: quedan dos detalles (ver abajo) |
| 12 | No existía el rol de Administrador | ✅ Decidido: se quitó de los documentos |

El documento
[`respuesta-auditoria.md`](./respuesta-auditoria.md) resume bien todo lo que se
hizo.

---

## Parte 2: Problemas nuevos que encontré

### 1. Una solicitud rechazada se queda atascada (importante)

**Dónde**: `backend/src/solicitudes/solicitudes.service.ts`.

Cuando un agente rechaza una solicitud, el docente la ve como "Rechazada", pero
no puede editarla, ni cancelarla, ni volverla a enviar. Se queda ahí para
siempre sin poder hacer nada.

Los diagramas dicen que el docente debería poder "corregir y reenviar", pero esa
opción no existe.

**Cómo arreglarlo**: permitir que el docente edite o reenvíe una solicitud
rechazada para que vuelva a "Pendiente".

---

### 2. Se puede confirmar la planificación en un proyecto ya cerrado (menor)

**Dónde**: `backend/src/proyectos/proyectos.service.ts` (función
`confirmarParticipacion`).

Esa función se olvidó de revisar si el proyecto está cerrado. En un proyecto
"Finalizado", un docente todavía puede confirmar su participación en la
planificación. No es grave, pero rompe la regla de "cerrado = sin cambios".

---

### 3. Se puede seguir escribiendo en el chat después del cierre (menor)

**Dónde**: `backend/src/proyectos/proyectos.service.ts` (función
`enviarMensaje`).

El chat sigue abierto para escribir aunque el proyecto esté "Finalizado". Puede
ser a propósito (dejar el chat como recuerdo), pero conviene decidirlo.

---

## Parte 3: Revisión de experiencia de usuario

Esto es sobre cómo se siente usar la aplicación, no sobre errores graves.

### UX-1. En un proyecto finalizado se siguen viendo los formularios (importante)

Cuando la clase espejo ya está cerrada, el docente todavía ve los formularios de
"Datos del proyecto", "Planificación", "Sesiones", "Actividades" y "Evidencias".
Puede rellenarlos, pero al pulsar guardar el sistema responde "ya está cerrada".

Solo el formulario de "Evaluación final" se esconde al cerrar. Los demás no.

**Cómo arreglarlo**: esconder (o poner en solo lectura) esos formularios cuando
el proyecto está cerrado, igual que ya se hace con la evaluación.

---

### UX-2. Doble clic puede duplicar cosas (importante)

Varios botones no se desactivan mientras están guardando:

- Agregar sesión
- Agregar actividad
- Registrar evidencia
- Guardar reporte de clase
- Confirmar reporte
- Registrar evaluación

Si el usuario hace doble clic, se envían dos veces y se crean dos sesiones, dos
actividades o dos evidencias.

**Cómo arreglarlo**: desactivar el botón mientras se guarda (algunos botones ya
lo hacen, falta aplicarlo a estos).

---

### UX-3. Si te desactivan la cuenta, la app no te saca (menor)

Si un docente es desactivado, el sistema le devuelve "no autorizado", pero la
pantalla no lo manda al login. Se queda a medias, viendo errores.

**Cómo arreglarlo**: cuando llegue un error "no autorizado", cerrar la sesión y
mandar al usuario al login.

---

### UX-4. Mensajes del navegador (menor)

El panel del agente usa las ventanitas del navegador (`alert` y `confirm`) para
avisar de errores y confirmar borrados, mientras el resto de la aplicación usa
tarjetas y ventanas propias. Funciona, pero se ve distinto y bloquea la página.

**Cómo arreglarlo**: usar el mismo estilo de avisos en toda la aplicación.

---

### UX-5. Faltan validaciones de fechas (menor)

Se puede guardar un proyecto donde la fecha de fin es antes que la de inicio, o
una solicitud con fecha en el pasado. El sistema no avisa.

**Cómo arreglarlo**: avisar cuando la fecha de fin sea anterior a la de inicio o
cuando la fecha ya pasó.

---

### UX-6. El "Enlace virtual" no revisa que sea una dirección web (menor)

El campo dice "Enlace virtual (URL)" y sugiere escribir `https://…`, pero acepta
cualquier texto, como "hola". Después ese enlace no funciona.

**Cómo arreglarlo**: validar que sea una dirección web real.

---

## Resumen

- **Los arreglos están bien hechos**: los 12 problemas del primer informe quedaron
  resueltos y el proyecto compila.
- **Quedan por resolver**: 1 importante (solicitud rechazada atascada) y 2 menores
  (confirmación de planificación y chat en proyectos cerrados).
- **En experiencia de usuario**: lo más visible es UX-1 (formularios visibles en
  un proyecto cerrado) y UX-2 (doble clic que duplica).
