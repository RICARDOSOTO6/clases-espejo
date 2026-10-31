# Checklist antes de la sesión

Se recorre **el día anterior** y otra vez **una hora antes**. Lo que falle aquí se arregla sin público;
lo que falle con el participante delante se convierte en una incidencia que no mide el sistema.

---

## El entorno

- [ ] El servidor está arriba y responde: `GET /health`.
- [ ] **Anotado el commit y la versión** que se va a probar (el que congeles como punto seguro).
- [ ] El frontend compilado servido desde el backend: la aplicación abre en una sola URL.
- [ ] Base de datos con los datos de la sesión cargados y comprobados.
- [ ] **Respaldo hecho** antes de tocar nada.
- [ ] Correo saliente configurado, o el simulador local sabiendo que los correos no saldrán.

## Las cuentas

- [ ] Un usuario por cada rol que vaya a participar, y **cada uno ha entrado al menos una vez**.
- [ ] El docente invitado ya activó su cuenta (no descubrirlo delante del participante).
- [ ] El segundo factor probado en la cuenta de presidencia o secretaría, si se va a usar.
- [ ] El aviso de privacidad vigente aceptado, para no encontrarse la pantalla a mitad de la sesión.

## Los datos

- [ ] Hay una solicitud pendiente para revisar (T03) y un proyecto en planificación (T06).
- [ ] Hay una clase lista para cerrar y emitir certificado (T08, T09).
- [ ] Hay una institución pendiente de aprobación (T10).
- [ ] Hay un certificado emitido de prueba **con su código**, para verificar (T13).

## La medición

- [ ] Métricas a cero: se hicieron las peticiones de calentamiento y se llamó a `POST /metricas/reiniciar`.
- [ ] Comprobado que `GET /metricas/rendimiento.csv` responde con el rol adecuado.
- [ ] Cronómetro a mano (el móvil vale) para los minutos por tarea.

## El papeleo

- [ ] `sesion-piloto.xlsx` abierto, con una fila por participante preparada.
- [ ] `guion-entrevista.md` a la vista.
- [ ] Consentimiento impreso o listo para firmar.
- [ ] Batería del portátil y conexión comprobadas. Sin chistes.

---

## Si algo falla

Se anota en `Incidencias` **antes** de intentar arreglarlo: la hora, qué se intentaba y qué pasó. Un
arreglo sin registro deja el informe sin evidencia y la sesión sin datos.

Y si el fallo es bloqueante, se suspende la sesión y se reprograma. Una sesión con el sistema a medias
no produce datos limpios: produce una anécdota incómoda.
