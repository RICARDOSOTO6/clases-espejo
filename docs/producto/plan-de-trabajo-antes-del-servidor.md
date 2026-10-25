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

## 1. Punto de partida

### Lo que ya está cerrado

- Autenticación, recuperación, verificación de correo y cambio de correo.
- Política de contraseñas, bloqueo por intentos y aviso por correo.
- Roles y capacidades de docente, agente, presidencia y secretaría.
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

### Fase L2 — Certificado DEMO local (1–2 días)

**Objetivo:** comprobar que el certificado se puede emitir y verificar antes de
la entrega.

- [ ] Crear o revisar la plantilla activa en la base de ensayo.
- [ ] Usar la identidad de la CACE y una marca **DEMO** provisional, de acuerdo
      con la decisión ya cerrada (“certificados con marca DEMO salvo
      autorización expresa”).
- [ ] Emitir dos certificados de alumnos ficticios.
- [ ] Descargar PDF y ZIP.
- [ ] Verificar el folio, el código y el QR desde la URL local.
- [ ] Comprobar que un certificado anulado deja de aparecer como válido.
- [ ] Anotar qué datos de la plantilla necesitan aprobación oficial (anexo B).

**Aceptación:** folio `CACE-AAAA-####`, QR verificable en local y PDF con marca
DEMO, sin usar datos de alumnos reales.

**No incluye:** plantilla oficial ni URL pública definitiva. El QR de la demo
solo debe apuntar a una URL que exista durante el ensayo.

---

### Fase L3 — Privacidad y accesos locales (1 día)

**Objetivo:** cerrar los huecos que no necesitan revisión legal externa.

- [ ] Forzar la aceptación del aviso a cuentas existentes con versión vacía.
- [ ] Verificar con pruebas locales que presidencia, secretaría, agente y
      docente reciben 401/403 donde corresponde.
- [ ] Verificar que un docente solo ve su institución y su lista.
- [ ] Quitar credenciales de demostración de la documentación de producción;
      dejarlas solo en el material local de demo.
- [ ] Conservar el aviso actual como **borrador**, sin afirmar que ya es la
      versión legal definitiva.

**Aceptación:** ninguna cuenta entra sin aceptar el aviso vigente; las pruebas de
aislamiento pasan; no hay credenciales en documentación de producción.

**Pendiente fuera de esta fase:** revisión legal, correo de contacto y plazos de
conservación definitivos (anexo B).

---

### Fase L4 — Regresión, móvil y accesibilidad (1–2 días)

**Objetivo:** evitar que el ensayo se caiga por una regresión visual o de
permisos.

- [ ] Ejecutar todas las pruebas unitarias y e2e.
- [ ] Compilar backend y frontend desde cero.
- [ ] Revisar acceso, registro, panel, proyecto y certificado en ancho móvil.
- [ ] Revisar navegación por teclado, foco, textos alternativos y contraste
      básico.
- [ ] Revisar que la CSP no bloquee CSS, fuentes, imágenes ni descargas.
- [ ] Repetir el empaquetado y comprobar que no incluye secretos.

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
