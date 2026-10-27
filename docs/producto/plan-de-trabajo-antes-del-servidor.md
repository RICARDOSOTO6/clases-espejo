# Plan de trabajo antes del servidor

**Versión:** 25 de octubre de 2026  
**Objetivo:** cerrar todo lo que se puede hacer en local sin servidor público y
sin nuevas autorizaciones de la CACE. El servidor y las decisiones pendientes
quedan al final, como anexos, para no bloquear el avance.

> Este documento **no sustituye** al plan original
> [`plan-de-fases-pendientes.md`](plan-de-fases-pendientes.md). Lo reordena: el
> original mezcla preparación local con infraestructura. Aquí primero se termina
> lo demostrable y exportable; después se abre la puerta del servidor.

---

## 0. Escenario confirmado: piloto real, no demo preparada

La primera vez que la CACE usará la aplicación **no es una demo con datos
conocidos**. Es una **clase espejo real de prueba**:

- los participantes no se conocen hasta el día del piloto;
- no se pueden crear de antemano sus instituciones, agentes ni docentes;
- todavía no hay dominio propio;
- el servidor será rentado por un mes para la prueba;
- la CACE espera descubrir **nuevos requisitos** a partir de cómo gestionan la
  clase, no solo validar que la aplicación “se vea bonita”;
- el éxito es que puedan **organizar y gestionar la clase completa** y salir con
  una lista de mejoras, no que todo sea perfecto.

Esto cambia el riesgo principal. El problema ya no es solo el certificado: es
que **una persona que no existe en la base pueda entrar, registrarse, ser
aprobada, invitar a su docente y llegar a la clase sin ayuda técnica intensiva**.
El piloto se trata en el anexo E; la preparación local para ese escenario es la
fase L1.5.

---

## 1. Punto de partida

### Lo que ya está cerrado

- Autenticación, recuperación, verificación de correo y cambio de correo.
- Política de contraseñas, bloqueo por intentos y aviso por correo.
- Roles y capacidades de docente, agente, presidencia, secretaría de la CACE y
  secretaría de institución.
- Secretaría de institución: una por institución, invitada por el agente
  principal con enlace copiable; mantiene contacto y docentes, sin aprobar
  clases ni tocar listas o certificados.
- Invitación de docentes con enlace copiable: si el correo falla, la invitación
  no se borra y el agente puede compartir el enlace manualmente.
- Auto-registro presentado como **Solicitud de alta** en `/solicitud` (con
  `/register` conservado por compatibilidad), pendiente de aprobación o
  confirmación según el caso.
- Solicitudes, doble revisión, proyectos, planificación, sesiones, evidencias,
  evaluación, cierre, certificados, ZIP y verificación de folio.
- Cola de correo con reintentos, progreso por lote y calendario `.ics`.
- Cabeceras de seguridad, CSP, límite de intentos en verificación y respaldos
  locales.
- Restricciones de integridad de docente-institución, materia-clave y
  asignación-periodo.
- Plazos configurables por la presidencia.
- Evidencias por archivo o por enlace con lista blanca.
- Aviso de privacidad, aceptación con versión/fecha y consentimiento al cargar
  listas de alumnos.
- Baja de instituciones con historial: se archivan, no se borran.
- Paquete de entrega reproducible sin secretos.

### Lo que sigue abierto y **no** se toca en este plan

- Servidor público, dominio, HTTPS, correo real y respaldos fuera del equipo.
- Cuentas reales de la CACE y de las instituciones.
- TOTP y proveedor de correo de producción.
- Revisión legal definitiva del aviso de privacidad.
- Plantilla oficial del certificado y marca DEMO definitiva.
- Panel de desempeño y multi-institución, que el plan original deja para
  después de la demo.

---

## 2. Reglas de trabajo

1. **Nada de este plan depende de un servidor público.** Se usa la base de
   prueba local y el servidor local `:3000`; nunca se toca la base de demo con
   datos reales.
2. Cada cambio sale con migración si aplica, backend, interfaz, pruebas y
   documentación.
3. No se despliega nada a medias. Si una tarea no se termina, no se incluye en
   el release candidate.
4. El release candidate se congela al terminar la fase L6. Después solo se
   corrigen bloqueos del ensayo.
5. Las decisiones de la CACE no se inventan: si algo depende de autorización,
   se anota en el anexo B y se pregunta en la junta.
6. Los documentos `.docx`, `docs/tesis/` y `svg.zip` siguen fuera de git; no se
   fuerzan a un commit.

---

## 3. Fases locales, en orden

### Fase L0 — Preparar el entorno y el paquete de trabajo (medio día)

**Objetivo:** tener una base limpia, un build de trabajo y un paquete preliminar
para empezar el ensayo.

- [ ] Revisar que el árbol de trabajo no tenga cambios ajenos al release.
- [ ] Compilar backend y frontend.
- [ ] Guardar un paquete preliminar de entrega y su SHA-256.
- [ ] Guardar un respaldo de la base de prueba antes del ensayo.
- [ ] Comprobar que la base de ensayo se puede recrear desde cero.

**Aceptación:** build reproducible, paquete preliminar y respaldo local que
permitan repetir el ensayo.

**Estado actual:** el paquete ya existe; faltan el respaldo de ensayo y la
comprobación de recrear la base.

---

### Fase L1 — Ensayo funcional completo con datos ficticios (2–3 días)

**Objetivo:** demostrar que el flujo completo funciona sin editar la base a mano.

Se parte de una base de ensayo **vacía** (nombre terminado en `_test` o una base
local separada; nunca `ClasesconjuntasBD`).

- [ ] Arrancar la presidencia desde la configuración inicial.
- [ ] Crear la secretaría.
- [ ] Registrar dos instituciones y aprobarlas desde la CACE.
- [ ] Crear agentes y docentes de las dos instituciones.
- [ ] Crear materias y asignaciones.
- [ ] Crear una solicitud de clase espejo con los plazos vigentes.
- [ ] Aprobar por origen, confirmar por destino y generar el proyecto.
- [ ] Completar planificación, confirmaciones y sesiones.
- [ ] Registrar evidencias con archivo y con enlace.
- [ ] Cargar la lista de alumnos ficticios y firmar la declaración de
      consentimiento.
- [ ] Cerrar la clase con reportes y evaluación.
- [ ] Emitir certificados, descargar el ZIP y verificar folio y QR.
- [ ] Probar el calendario y la cola de correo con el simulador local.
- [ ] Repetir el recorrido con cada rol y anotar cada fricción.

**Aceptación:** el flujo se completa dos veces desde cero sin SQL manual, con
datos ficticios y sin correos reales.

**Entregable:** guion de ensayo y lista de fricciones priorizadas (solo se
corrige lo que bloquee la demo).

---

### Fase L1.5 — Preparar el piloto con participantes desconocidos (1–2 días)

**Objetivo:** medir el alta real desde cero, como ocurrirá el día del piloto.

No se crean cuentas reales antes. Se ensaya con dos personas ficticias que
**actúan como si no existieran en la base** y solo reciben una URL o un QR.

- [ ] Probar el registro de una institución nueva desde un dispositivo limpio.
- [ ] Probar que la CACE pueda aprobarla durante la misma sesión.
- [ ] Probar la invitación del docente desde el panel del agente.
- [ ] Probar que el enlace del docente se pueda copiar aunque el correo no salga;
      la invitación conserva el enlace y no se borra.
- [ ] Probar la activación del docente desde el enlace recibido.
- [ ] Comprobar si el enlace de activación se puede copiar o compartir sin
      depender del correo; si no, anotarlo como cambio bloqueante.
- [ ] Simular un correo que no llega y definir la entrega manual del enlace.
- [ ] Medir cuánto tarda cada paso y dónde se bloquea una persona nueva.
- [ ] Definir qué se hace si el correo de invitación no llega: enlace copiable,
      entrega manual o cuenta provisional.
- [ ] Definir qué se hace si el participante no tiene correo institucional.
- [ ] Comprobar el recorrido desde un teléfono y desde una computadora.
- [ ] Preparar un “kit de piloto”: URL/QR, guion de 15 minutos, responsables de
      soporte y plan B.
- [ ] No cargar datos reales ni crear cuentas de participantes antes del día.

**Aceptación:** dos personas que no existen en la base pueden registrarse, ser
aprobadas, invitar/activar a su docente y entrar, usando solo una URL o QR y con
acompañamiento mínimo. Si algo no se logra, queda identificado como requisito
bloqueante del piloto.

**Entregable:** guion de alta exprés, tiempos medidos y lista de bloqueos de
entrada.

---

### Fase L1.6 — Secretaría de institución (4–6 días, prioritaria)

**Objetivo:** que el agente principal tenga apoyo administrativo sin crear un
segundo agente ni compartir sus privilegios.

Decisiones cerradas con la CACE:

- La invita el **agente principal**, no la presidencia.
- Es **una sola** secretaría activa por institución.
- Puede **invitar y activar docentes**, mantener teléfono, correo, estado,
  ciudad y logo de la institución.
- **No** puede cambiar el nombre ni el país, invitar agentes, confirmar altas,
  aprobar clases, ver listas nominales ni emitir/firmar/anular certificados.
- El enlace se crea **sin correo**: solo se copia y se comparte por WhatsApp u
  otro canal. Vale por uso o por tiempo, lo que ocurra primero.
- El auto-registro sigue existiendo como solicitud; no se elimina.

Implementado:

- [x] Rol relacional `SECRETARIA_INSTITUCION`, independiente de `AGENTE`.
- [x] Tabla `SECRETARIA_INSTITUCION` con una fila por institución.
- [x] Tabla `INVITACION_SECRETARIA` con token, expiración y uso.
- [x] Invitación desde el agente principal **solo con enlace copiable**, sin
  correo.
- [x] Cuestionario público en `/activar-secretaria`.
- [x] Activación transaccional: consume el enlace una sola vez y crea o
  reemplaza el vínculo de secretaría.
- [x] Panel `/panel` con contacto, logo, docentes, invitación de docentes y
  conteos.
- [x] Prohibiciones de agente/clases/certificados aplicadas en el servicio.
- [x] Consulta, desactivación y revocación de enlaces desde el panel del agente.
- [x] Pruebas e2e del flujo completo, logo, límite, revocación y permisos.

**Aceptación:** el agente principal genera el enlace sin correo, la persona lo
abre, completa el cuestionario, entra como secretaría y no puede realizar las
acciones reservadas. Una segunda secretaría activa se rechaza.

**Entregable:** migración, API, pantallas, pruebas y esta documentación.

---

### Fase L1.7 — Invitación del agente por la presidencia (3–5 días, prioritaria)

**Objetivo:** que la presidencia pueda incorporar a una persona que todavía no
existe en la base y que esa persona cree su institución desde cero.

Decisiones cerradas:

- La **presidencia** crea el enlace; no se pide correo ni se envía
  automáticamente.
- El agente completa sus datos personales, los de la institución y su cargo.
- La institución nace **PENDIENTE** y la presidencia la aprueba después.
- El agente queda confirmado como **principal** y puede entrar mientras espera
  la aprobación.
- El enlace es de un solo uso y caduca por uso o por tiempo.
- La invitación es distinta de la de secretaría y de la de docentes.

Implementado:

- [x] Tabla `INVITACION_AGENTE` con token, expiración y uso.
- [x] Creación y revocación desde la presidencia.
- [x] Cuestionario público en `/activar-agente`.
- [x] Alta transaccional de usuario, institución pendiente y agente principal.
- [x] Aprobación posterior con el flujo actual de la CACE.
- [x] Pruebas e2e de permiso de la secretaría, activación, aprobación y enlace
  de un solo uso.

**Aceptación:** la presidencia genera un enlace, otra persona crea su cuenta y
su institución, la CACE la aprueba, y el enlace no puede reutilizarse.

---

### Fase L2 — Certificado DEMO local (1–2 días)

**Objetivo:** comprobar que el certificado se puede emitir y verificar antes de
la entrega.

- [x] Crear o revisar la plantilla activa en la base de ensayo.
- [x] Usar la identidad de la CACE y una marca **DEMO** provisional, de acuerdo
      con la decisión ya cerrada (“certificados con marca DEMO salvo
      autorización expresa”). Se controla con `CERTIFICADO_MODO_DEMO`.
- [x] Emitir dos certificados de alumnos ficticios.
- [x] Descargar PDF y ZIP.
- [x] Verificar el folio, el código y el QR desde la URL local.
- [x] Comprobar que un certificado anulado deja de aparecer como válido.
- [ ] Anotar qué datos de la plantilla necesitan aprobación oficial (anexo B).

**Aceptación:** folio `CACE-AAAA-####`, QR verificable en local y PDF con marca
DEMO, sin usar datos de alumnos reales.

**Datos de plantilla que necesitan aprobación oficial:** firma y cargo de la
presidencia, leyenda legal, uso del logo de la CACE, correo de contacto, formato
definitivo del folio y URL pública del QR. Hasta esa aprobación, los certificados
se emiten con `CERTIFICADO_MODO_DEMO=true` y la verificación pública muestra el
aviso DEMO; para una entrega oficial se cambia a `false`.

**No incluye:** plantilla oficial ni URL pública definitiva. El QR de la demo
solo debe apuntar a una URL que exista durante el ensayo.

---

### Fase L3 — Privacidad y accesos locales (1 día)

**Objetivo:** cerrar los huecos que no necesitan revisión legal externa.

- [x] Forzar la aceptación del aviso a cuentas existentes con versión vacía.
- [x] Verificar con pruebas locales que presidencia, secretaría, agente y
      docente reciben 401/403 donde corresponde.
- [x] Verificar que un docente solo ve su institución y su lista.
- [x] Quitar credenciales de demostración de la documentación de producción;
      quedaron únicamente en secciones rotuladas como demo local (README,
      manual de recorrido, receta y guía de desarrollo).
- [x] Conservar el aviso actual como **borrador**, sin afirmar que ya es la
      versión legal definitiva.

**Aceptación:** ninguna cuenta entra sin aceptar el aviso vigente; las pruebas de
aislamiento pasan; no hay credenciales en documentación de producción.

**Pendiente fuera de esta fase:** revisión legal, correo de contacto y plazos de
conservación definitivos (anexo B).

---

### Fase L4 — Regresión, móvil y accesibilidad (1–2 días)

**Objetivo:** evitar que el ensayo se caiga por una regresión visual o de
permisos.

- [x] Ejecutar todas las pruebas unitarias y e2e.
- [x] Compilar backend y frontend desde cero.
- [x] Revisar acceso, registro, panel, proyecto y certificado en ancho móvil.
- [x] Revisar navegación por teclado, foco, textos alternativos y contraste
      básico.
- [x] Revisar que la CSP no bloquee CSS, fuentes, imágenes ni descargas.
- [x] Repetir el empaquetado y comprobar que no incluye secretos.

**Aceptación:** pruebas en verde, build reproducible y recorrido móvil sin
pérdida de funciones.

---

### Fase L5 — Mantenibilidad prioritaria (2–4 días, opcional)

**Objetivo:** dejar el código en mejor forma antes de que llegue el servidor,
sin cambiar el comportamiento.

Orden recomendado, de menor a mayor riesgo:

1. [ ] Crear `prisma/seed.ts` para datos ficticios reproducibles.
2. [ ] Retirar el andamiaje SSR inerte.
3. [ ] Sacar `.docx` y documentos pesados de git; documentar dónde viven.
4. [ ] Añadir Swagger interno para revisar la API.
5. [ ] Extraer componentes comunes de agente/docente.
6. [ ] Trocear `cace.component.ts` y `proyecto.component.ts`.

**Aceptación:** cada paso conserva el comportamiento y las pruebas en verde. Si
el tiempo aprieta, se hacen 1–4 y se dejan 5–6 para después de la demo.

---

### Fase L6 — Congelar y exportar el release candidate (medio día)

**Objetivo:** fijar la versión que se va a ensayar y entregar.

- [ ] Etiquetar el commit con una etiqueta local, por ejemplo
      `demo-local-2026-10-25`.
- [ ] Congelar migraciones y configuración de demo local.
- [ ] Guardar el paquete final y su SHA-256.
- [ ] Verificar que se puede volver a la versión anterior sin tocar la base real.
- [ ] Repetir el ensayo corto (humo) sobre el paquete final.

**Aceptación:** paquete final reproducible, etiqueta local, respaldo y prueba de
rollback documentada.

---

### Fase L7 — Trabajo posterior a la demo (no ejecutar antes)

Estas tareas también son locales, pero el plan original las coloca **después de
la demo**. No se empiezan hasta que la demo se haya celebrado.

- Panel de desempeño: métricas, ranking, plan de acción y vista del agente.
- Multi-institución: participantes, revisión por destino y cierre por origen.
- `ENUM`/`CHECK`, paginación y revisión de N+1.
- Exportación de datos, baja de usuario, ayuda contextual y accesibilidad
  completa.

Las decisiones que falten para estas tareas están en el anexo B (por ejemplo,
umbrales del panel o código interno del alumno).

---

## 4. Qué se puede exportar al terminar

Al cerrar L0–L6 se puede entregar:

- Paquete ZIP reproducible sin secretos.
- Base de ensayo ficticia y respaldo local.
- Guion de demo desde cero.
- Certificado DEMO de prueba con folio y QR verificables en local.
- Informe corto de fricciones y decisiones pendientes.
- Lista de preguntas para la junta (anexo C).

---

## Anexo A — Lo que necesita servidor

**No empezar hasta que haya un servidor disponible.** No bloquea las fases L0–L6.

| Tarea | Depende de |
|---|---|
| Dominio, DNS y HTTPS | Proveedor y acceso al dominio |
| `URL_PUBLICA` y `FRONTEND_URL` definitivas | Dominio |
| Correo real y DNS del dominio | Autorización del proveedor |
| Despliegue del build y migraciones | Servidor |
| Worker de correo en segundo plano | Servidor |
| Respaldo diario, copia fuera del servidor y restauración | Servidor y responsable |
| Monitorización, logs, disco y cola | Servidor |
| Construir y validar la imagen Docker | Docker en el servidor o equipo |
| Base de producción vacía | Servidor |
| Cuentas reales y ensayo con ellas | Servidor y CACE |
| Demo real, incidencias y respaldo posterior | Servidor y fecha confirmada |

Los scripts de respaldo, el Dockerfile, el compose y el paquete ya están
preparados; lo que falta es ejecutarlos y verificarlos en el entorno real.

---

## Anexo B — Lo que necesita autorización o decisión de la CACE

| Tema | Qué se necesita | Si no se decide |
|---|---|---|
| Fecha y alcance de la demo | Fecha, duración y mínimo demostrable | Se usa el ensayo local como entrega |
| Participantes | Instituciones y personas reales | Se usan datos ficticios |
| Alumnos | ¿Ficticios o reales? | Ficticios, sin datos personales |
| Aviso de privacidad | Revisión, correo de contacto y plazos de conservación | Se queda como borrador |
| TOTP | Autorización para presidencia y secretaría | Se queda fuera |
| Proveedor de correo | Autorización y dominio de envío | Se mantiene el simulador local |
| Plantilla DEMO | Logo, datos, marca DEMO y quién aprueba | Se usa una versión provisional local |
| Código interno del alumno | Confirmación de que hace falta | No se implementa |
| Panel de desempeño | Umbrales, responsables y periodicidad | Se pospone a después de la demo |
| Multi-institución | Confirmar alcance y orden | Se pospone |
| Respaldos | Frecuencia, retención, destino externo y responsable | Se queda en respaldo local |
| Servidor | Quién administra, credenciales y soporte | No se puede desplegar |

---

## Anexo C — Preguntas para la próxima junta

Estas son las preguntas que conviene llevar, con una recomendación por defecto
para no bloquear el trabajo si no hay respuesta.

### Demo y alcance

1. **¿Cuál es la fecha objetivo y el mínimo que debe verse?**  
   *Recomendado:* flujo completo de una clase ficticia, dos instituciones y dos
   certificados DEMO.

2. **¿La demo usa alumnos ficticios o reales?**  
   *Recomendado:* ficticios hasta que el aviso legal esté revisado.

3. **¿Qué instituciones y personas participan?**  
   *Recomendado:* dos instituciones y un docente por lado; nadie más.

4. **¿Qué cuenta como demo exitosa y cuándo no se celebra?**  
   *Recomendado:* no celebrarla si falla el acceso, el cierre o la verificación
   del certificado.

### Correo, URL y servidor

5. **¿Quién autoriza el proveedor de correo y el dominio de envío?**  
   *Recomendado:* definir responsable y proveedor antes de la fecha.

6. **¿Quién es dueño del dominio y del DNS?**  
   *Recomendado:* una sola persona con acceso documentado.

7. **¿Quién administra el servidor y con qué credenciales?**  
   *Recomendado:* responsable técnico único y credenciales fuera del repositorio.

8. **¿Dónde se guardan los respaldos fuera del servidor y por cuánto tiempo?**  
   *Recomendado:* copia externa diaria y prueba de restauración antes de la demo.

### Seguridad y privacidad

9. **¿Se autoriza TOTP para presidencia y secretaría?**  
   *Recomendado:* dejarlo para después de la demo si no hay tiempo de probarlo.

10. **¿Quién revisa y firma el aviso de privacidad?**  
    *Recomendado:* revisión de la CACE antes de usar datos reales.

11. **¿Qué correo de contacto y qué plazos de conservación se publican?**  
    *Recomendado:* correo institucional de la CACE y conservar certificados
    mientras deban ser verificables.

### Certificado

12. **¿El certificado DEMO lleva marca DEMO y quién aprueba la plantilla?**  
    *Recomendado:* marca DEMO visible y aprobación de la presidencia.

13. **¿El QR debe apuntar a la URL local durante el ensayo o a una URL pública?**  
    *Recomendado:* local en el ensayo; URL pública antes de la demo real.

### Alcance futuro

14. **¿Hace falta un código interno por alumno, además del folio?**  
    *Recomendado:* no, salvo que la CACE lo confirme.

15. **¿Se prioriza el panel de desempeño o multi-institución después de la demo?**  
    *Recomendado:* panel primero, multi-institución después.

16. **¿Qué umbrales y responsables tendrá el panel?**  
    *Recomendado:* una métrica de cierre mensual, 30 días de gracia y
    responsables por institución.

### Piloto con participantes desconocidos

17. **¿Cómo recibirán el acceso los participantes el mismo día?**  
    *Recomendado:* URL/QR + registro self-service; el correo solo para
    confirmaciones e invitaciones.

18. **¿Todos tendrán correo electrónico disponible y podrán abrirlo durante la
    sesión?**  
    *Recomendado:* confirmar antes; si no, definir entrega manual del enlace de
    activación.

19. **¿Cuántas personas, dispositivos y redes participarán?**  
    *Recomendado:* máximo dos instituciones, un agente y un docente por lado,
    con una persona de soporte.

20. **Sin dominio, ¿aceptan una URL por IP para el piloto o prefieren un túnel
    temporal con HTTPS?**  
    *Recomendado:* túnel HTTPS temporal para no enviar credenciales por HTTP;
    si no se puede, limitar el piloto a una red de confianza.

21. **¿Quién aprueba las instituciones en vivo y quién atiende los bloqueos?**  
    *Recomendado:* una persona de la CACE y una persona técnica con acceso al
    servidor.

22. **¿El piloto usará alumnos reales o solo docentes/agentes?**  
    *Recomendado:* solo docentes y agentes; alumnos ficticios si hace falta
    probar certificados.

23. **¿Cómo se recogerán los nuevos requisitos y quién decide qué se corrige
    antes de la siguiente sesión?**  
    *Recomendado:* un registro único por incidencia y una reunión de triage al
    terminar, sin cambiar código durante la clase.

24. **¿Cuándo empieza el mes de servidor y alcanza para ensayo, piloto y
    recogida de requisitos?**  
    *Recomendado:* reservar el servidor con al menos una semana de margen antes
    del piloto.

25. **¿Qué condición hace cancelar o posponer el piloto?**  
    *Recomendado:* si nadie puede entrar o no hay forma de entregar el enlace de
    activación, se pospone y se usa el ensayo local.

---

## Anexo D — Criterio para pasar al servidor

No se pasa al anexo A hasta que se cumpla esto:

- [ ] L0 cerrado: entorno, build y paquete preliminar reproducibles.
- [ ] L1 cerrado: ensayo completo con datos ficticios, dos veces.
- [ ] L2 cerrado: certificado DEMO emitido, descargado y verificado.
- [ ] L3 cerrado: aceptación y aislamiento comprobados.
- [ ] L4 cerrado: pruebas, builds y revisión móvil en verde.
- [ ] L5 cerrado si se hizo mantenibilidad; si no, se documenta como pendiente.
- [ ] L6 cerrado: etiqueta, paquete final, respaldo y rollback.
- [ ] Anexo C respondido en lo que bloquee URL, correo, cuentas y plantilla.

Si algo del anexo A falla, el paquete local y el ensayo siguen sirviendo como
entrega funcional; no se debe prometer una demo pública sin servidor, correo y
respaldo probados.

---

## Anexo E — Operación del piloto real

Este anexo no se ejecuta en local: se usa cuando el servidor rentado esté
disponible. El piloto se trata como una **prueba de producto**, no como una
presentación.

### Antes del día

- [ ] Tener el servidor rentado y accesible desde fuera de la red local.
- [ ] Elegir la URL del piloto: IP pública o túnel temporal con HTTPS. Evitar
      HTTP para credenciales si hay cualquier alternativa.
- [ ] Configurar `URL_PUBLICA` y `FRONTEND_URL` con esa URL **antes** de probar
      enlaces, QR o correos.
- [ ] Configurar un correo real de prueba; si no hay proveedor, definir entrega
      manual de enlaces de activación.
- [ ] Base de datos vacía con solo presidencia y secretaría.
- [ ] Probar el registro y la activación con dos cuentas ficticias desde fuera
      de la red local.
- [ ] Preparar QR y enlace corto de acceso.
- [ ] Nombrar: aprobador de instituciones, soporte técnico, observador y quien
      toma notas.
- [ ] Acordar una ventana de 15 minutos para altas antes de la clase.
- [ ] Respaldo previo y plan B (posponer o usar entorno local).

### Durante el piloto

1. La presidencia crea los enlaces de agente y los comparte; cada agente crea
   su institución. Si se usa el auto-registro, se trata como solicitud
   excepcional.
2. La CACE aprueba las instituciones en vivo, una por una.
3. Cada agente invita a su docente; el docente activa su cuenta.
4. Crear materias, asignación, solicitud y clase espejo.
5. Gestionar la clase: planificación, sesiones, evidencias, lista, reporte,
   evaluación, cierre y certificados si corresponde.
6. Registrar cada fricción con rol, paso, hora y captura.
7. **No cambiar código durante el piloto.** Si algo bloquea, usar el plan B.

### Plan B

| Falla | Respuesta |
|---|---|
| El correo de invitación no llega | Entregar el enlace de activación por el canal acordado (manual) |
| El participante no tiene correo | Usar el correo de la institución o una cuenta de apoyo, nunca inventar datos de alumnos |
| La IP o el túnel no responde | Cambiar a red de confianza o posponer; no improvisar otra base |
| La institución no aparece o no se aprueba | El aprobador revisa el estado; no se edita la base a mano |
| La clase no llega al cierre | Cerrar lo que se pueda y emitir certificados después; registrar el bloqueo |

### Después del piloto

- [ ] Respaldo inmediato de la base y de los archivos generados.
- [ ] Reunión de cierre: qué funcionó, qué confundió y qué requisito nuevo salió.
- [ ] Clasificar requisitos: bloqueante, importante, deseable, descartado.
- [ ] No prometer fechas hasta tener el alcance y el servidor definitivo.
- [ ] Guardar las cuentas y datos del piloto según la política de retención.

**Éxito del piloto:** que la CACE pueda gestionar la clase completa y salir con
requisitos claros. **No** es éxito que no exista ninguna fricción.

