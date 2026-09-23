# 📖 Manual de usuario — Clases Conjuntas

**Plataforma CACE (Comunidad de Apoyo a Clases Espejo)**
*Uniendo mentes, corazones y proyectos.*

Este manual explica, paso a paso, cómo usar la plataforma. Está escrito para las
dos personas que la utilizan a diario: el **agente de internacionalización** y el
**docente**.

---

## Índice

1. [¿Qué es una clase espejo?](#1-qué-es-una-clase-espejo)
2. [Cómo entrar al sistema](#2-cómo-entrar-al-sistema)
3. [Los dos roles](#3-los-dos-roles)
4. [Primeros pasos: registro y activación](#4-primeros-pasos-registro-y-activación)
5. [El ciclo completo de una clase espejo](#5-el-ciclo-completo-de-una-clase-espejo)
6. [Manual del agente de internacionalización](#6-manual-del-agente-de-internacionalización)
7. [Manual del docente](#7-manual-del-docente)
8. [La clase espejo paso a paso](#8-la-clase-espejo-paso-a-paso)
9. [Estados del sistema](#9-estados-del-sistema)
10. [Preguntas frecuentes y solución de problemas](#10-preguntas-frecuentes-y-solución-de-problemas)
11. [Buenas prácticas](#11-buenas-prácticas)
12. [Glosario](#12-glosario)
13. [Recorrido de demostración (10 minutos)](#13-recorrido-de-demostración-10-minutos)

---

## 1. ¿Qué es una clase espejo?

Una **clase espejo** es una experiencia académica en la que **dos docentes de
instituciones distintas** (y normalmente de países distintos) imparten una clase
de forma conjunta y coordinada: comparten objetivos, temas, actividades y
evaluación, y sus estudiantes participan en el mismo espacio virtual.

En la plataforma, la clase espejo nace como una **solicitud** que un docente
propone a otra institución, pasa por una **doble revisión** de los agentes de
internacionalización (institución de origen y de destino) y, al aprobarse, se
convierte en un **proyecto** que ambos docentes organizan hasta su **cierre**.

---

## 2. Cómo entrar al sistema

### Dirección de la aplicación

| Entorno | Dirección |
| --- | --- |
| Producción (recomendado) | `http://localhost:3000` |
| Desarrollo | `http://localhost:4200` |

> En producción el frontend y la API se sirven juntos desde el puerto `3000`.

### Iniciar sesión

1. Abre la dirección de la aplicación. Si no has iniciado sesión, llegarás a la
   pantalla **Iniciar sesión**.
2. Escribe tu **Correo** y tu **Contraseña**.
3. Pulsa **Iniciar sesión**.

El sistema te llevará automáticamente a tu panel según tu rol:

* Agente → panel con el menú de institución, docentes, materias, asignaciones,
  solicitudes y proyectos.
* Docente → panel con tus solicitudes y tus proyectos.

### Cerrar sesión

Pulsa **Cerrar sesión** en la esquina superior de tu panel.

### ¿Olvidaste tu contraseña?

Pulsa el enlace **¿Olvidaste tu contraseña?** en la pantalla de inicio de sesión;
la aplicación te indicará que **contactes a tu agente de internacionalización**
para restablecerla. *(El restablecimiento automático por correo aún no está
habilitado; forma parte del plan de trabajo pendiente.)*

### Seguridad del acceso

* La sesión caduca sola pasado un tiempo (`JWT_EXPIRES_IN`); si ocurre, vuelve a
  iniciar sesión.
* Tras varios intentos fallidos seguidos, el sistema **bloquea temporalmente** el
  inicio de sesión (10 intentos por minuto). Espera un momento y reintenta.

---

## 3. Los dos roles

| | **Agente de Internacionalización** | **Docente** |
| --- | --- | --- |
| **Objetivo** | Gestionar la colaboración entre instituciones | Impartir la clase espejo |
| **Qué hace** | Registra su institución, da de alta docentes y materias, revisa solicitudes y supervisa las clases espejo | Propone clases espejo y organiza la clase conjunta |
| **Qué NO hace** | No organiza la clase (no crea sesiones, actividades ni reportes) | No gestiona docentes, materias ni asignaciones |

> **Importante:** un agente solo puede ver y gestionar la información de **su
> propia institución**. En una clase espejo puede **consultar** todo el proyecto y
> **agregar o quitar docentes de su institución**, pero no puede tocar la
> planificación, las sesiones, las evidencias ni la evaluación.

---

## 4. Primeros pasos: registro y activación

El alta del sistema se hace en **tres fases**.

### 4.1 Registro del agente y su institución (FASE 1)

1. En la pantalla de inicio de sesión, pulsa **Regístrate**.
2. Completa la pantalla **Registro de institución**. Tienes dos bloques:

   **Tus datos personales**

   | Campo | Notas |
   | --- | --- |
   | Nombres, Apellido paterno, Apellido materno | Tal como aparecen en tu documento. |
   | Tipo de documento | Selección del catálogo (DNI, cédula, pasaporte, etc.). |
   | Número de documento | Identificación oficial. |
   | Correo | Será tu usuario para iniciar sesión. |
   | Contraseña | Guarda la contraseña: no se puede recuperar automáticamente. |

   **Datos de la institución**

   | Campo | Notas |
   | --- | --- |
   | Nombre de la institución | Nombre oficial. |
   | País | Catálogo ISO 3166 (con bandera). |
   | Estado / Provincia y Ciudad | Ubicación. |
   | Teléfono | Con lada/indicativo internacional. |
   | Correo institucional | Correo de contacto de la institución. |
   | Cargo | Tu cargo (p. ej. Coordinador de Internacionalización). |

3. Pulsa **Registrarse**. Al terminar, el sistema te lleva a iniciar sesión.

### 4.2 Completar el registro de la institución

Al entrar por primera vez, el panel puede pedirte
**"Completa el registro de tu institución"**. Mientras falten esos datos, el
sistema te mostrará un aviso y no podrás usar el resto del panel: es el
**gate de institución**.

1. Revisa los campos prefijados: Nombre, País, Estado/Provincia, Ciudad,
   Teléfono, Correo institucional.
2. Corrige o completa lo que falte.
3. Pulsa **Guardar**. El aviso desaparece y el panel queda operativo.

> Si detectas un error en los datos de la institución más adelante, siempre puedes
> volver con el botón **Editar** de la sección *Mi institución*.

### 4.3 Invitar a un docente (FASE 2)

Los docentes **no se registran solos**: el agente los invita.

1. En el panel, pulsa **Invitar docente**.
2. Captura:
   * **Correo del docente** — es la dirección a la que llegará la invitación.
   * **Número de empleado** — identificador interno de la institución.
3. Confirma el envío. El docente recibirá un correo con un **enlace de activación**.

> El enlace de invitación **caduca** (`INVITATION_EXPIRES_IN`, 7 días por defecto)
> y **solo puede usarse una vez**.

### 4.4 Activación de la cuenta del docente (FASE 3)

El docente hace esto desde el enlace recibido por correo:

1. Abre el enlace del correo. Si el enlace ya caducó o fue usado, verás
   **"Enlace no válido"** y deberás pedirle al agente una nueva invitación.
2. Completa la pantalla **Completa tu registro**:

   | Campo | Notas |
   | --- | --- |
   | Nombres, Apellido paterno, Apellido materno | Tal como aparecen en tu documento. |
   | Tipo de documento y Número de documento | Identificación oficial. |
   | Grado académico | Catálogo (Licenciatura, Maestría, Doctorado, …). |
   | Especialidad | Área o disciplina. |
   | Contraseña y Confirmar contraseña | Deben coincidir. |

3. Pulsa el botón de registro. Verás la pantalla **"¡Cuenta creada!"** con un
   botón **Ir a iniciar sesión**.

### 4.5 Desactivar o eliminar un docente

Desde la sección **Docentes de la institución** el agente puede:

* **Activar / Desactivar** al docente: al desactivarlo, **no podrá iniciar
  sesión** ni realizar acciones, pero su historial se conserva.
* **Eliminar** al docente: solo se permite cuando ya no tiene participaciones,
  firmas ni mensajes en ningún proyecto (el sistema lo comprueba y avisa).

---

## 5. El ciclo completo de una clase espejo

```text
   DOCENTE                       AGENTE ORIGEN              AGENTE DESTINO
      │                               │                          │
 1. Crea la solicitud ──────────► 2. Revisa  ──► aprobar/rechazar│
      │                               │                          │
      │                               └──► APROBADA POR ORIGEN ─┘
      │                                                           │
      │                            3. Revisa ──► aprobar/rechazar │
      │                                                           │
      ◄──────────── 4. ¡APROBADA! Se crea el PROYECTO ◄───────────┘
      │
 5. Completa los datos del proyecto y la planificación conjunta
      │
 6. Confirma su participación; se agregan los docentes de ambas instituciones
      │
 7. Programa las sesiones
      │
 8. Registra actividades y sube evidencias
      │
 9. Firma el reporte de clase de cada sesión
      │
10. Registra la evaluación final y cierra la clase espejo
```

---

## 6. Manual del agente de internacionalización

### 6.1 Panel principal

Al entrar verás:

* Una **tarjeta de bienvenida** con tu nombre, el rol *Agente de
  Internacionalización*, el nombre de tu institución y su bandera.
* El botón **Invitar docente** (atajo a la acción más frecuente).
* Cuatro **indicadores**: Docentes, Materias, Asignaciones y **Por revisar**
  (solicitudes que esperan tu decisión).
* La sección **Comunidad CACE**, con los países que conforman la comunidad.

Las secciones siguientes están en tarjetas que puedes **contraer y expandir**
pulsando su encabezado; así mantienes el panel ordenado.

> Si alguna sección no carga, aparecerá un **aviso de error con un botón
> Reintentar**. Úsalo: no hace falta recargar toda la página.

### 6.2 Mi institución

* **Ver:** muestra los datos actuales de tu institución.
* **Editar:** abre el formulario para corregir nombre, ubicación, teléfono o
  correo institucional.

Mantener estos datos correctos es importante: otras instituciones los ven al
recibir tus solicitudes de clase espejo.

### 6.3 Docentes de la institución

* **Invitar docente:** envía la invitación por correo (ver 4.3).
* Cada docente aparece con su estado. Los botones disponibles son:
  * **Desactivar / Activar** — corta o devuelve el acceso al sistema.
  * **Eliminar** — borra al docente (solo si no tiene historial asociado).

### 6.4 Materias y asignaciones

**Materias**

1. Pulsa **Nueva materia**.
2. Captura **Clave**, **Nombre**, **Programa educativo** y **Descripción**.
3. Guarda. Después podrás **Editar** o **Eliminar** la materia.

> Una materia **no se puede eliminar** si tiene asignaciones o solicitudes
> asociadas; el sistema te dirá exactamente qué se lo impide.

**Asignaciones (docente ↔ materia por periodo)**

Una asignación es lo que habilita a un docente a proponer una clase espejo con
esa materia.

1. En la materia correspondiente, pulsa **Asignar**.
2. Selecciona el **Docente** y escribe el **Periodo escolar**
   (por ejemplo `2026-1`).
3. Guarda. La lista de asignaciones de la materia muestra el docente y el
   periodo, con un enlace **Quitar** para deshacer.

### 6.5 Solicitudes de clase espejo (revisión)

La sección **Solicitudes de clase espejo** se organiza en un **tablero de tres
columnas**:

| Columna | Qué contiene |
| --- | --- |
| **Pendientes de revisión** | Solicitudes que esperan tu decisión. |
| **Aceptadas** | Solicitudes aprobadas por origen o totalmente aprobadas. |
| **Rechazadas** | Solicitudes rechazadas, con su motivo. |

Cada tarjeta muestra el título, el docente proponente, la materia, la institución
contraparte y la fecha propuesta, además de la etiqueta de estado:
*Pendiente*, *Aprobada por origen*, *Aprobada* o *Rechazada*.

#### Revisar una solicitud

1. Pulsa **Revisar** en la tarjeta.

   > Solo aparece cuando **te corresponde revisar**. La plataforma sabe en qué
   > etapa está la solicitud: primero revisa la institución de **origen** y
   > después la de **destino**.

2. En el formulario de revisión:

   | Campo | Notas |
   | --- | --- |
   | **Decisión** | *Aprobar* o *Rechazar*. |
   | **Docente que impartirá la clase espejo** | Selecciona al docente de tu institución que participará. |
   | **Comentario** | **Obligatorio si rechazas**; opcional si apruebas. |

3. Pulsa el botón de confirmación.

**Qué ocurre según la etapa**

| Etapa | Si apruebas | Si rechazas |
| --- | --- | --- |
| Revisión de **origen** | La solicitud pasa a *Aprobada por origen* y viaja a la institución de destino. | La solicitud queda *Rechazada* con tu motivo. |
| Revisión de **destino** | La solicitud queda *Aprobada* y **se crea el proyecto** de clase espejo. | La solicitud queda *Rechazada* con tu motivo. |

Cuando una solicitud es rechazada, el docente puede **corregirla y reenviarla**;
al hacerlo vuelve al estado *Pendiente* y el ciclo de revisión empieza de nuevo.

### 6.6 Proyectos de clase espejo

Al final del panel, la sección **Proyectos de clase espejo** muestra las clases de
tu institución en tres columnas: **En planificación / En curso**,
**Finalizados** y **Cancelados**.

* Pulsa **Abrir** para entrar al detalle del proyecto.
* Como agente, tu vista del proyecto es de **consulta**, salvo la sección
  *Docentes participantes*, donde puedes **agregar docentes de tu institución**
  (cuando haga falta un co-docente) y **quitar** a los que agregó tu institución.
* El **reporte de planificación** es tuyo: es tu mecanismo de supervisión
  (ver 8.4).

---

## 7. Manual del docente

### 7.1 Panel principal

Verás una tarjeta de bienvenida con tu nombre y el rol *Docente*, el botón
**Nueva solicitud** y cuatro indicadores: Solicitudes, Pendientes, Aprobadas e
Instituciones disponibles.

Las secciones **Mis solicitudes de clase espejo** y
**Mis proyectos de clase espejo** muestran tu trabajo.

### 7.2 Crear una solicitud

1. Pulsa **Nueva solicitud**.
2. Completa el formulario:

   | Campo | Notas |
   | --- | --- |
   | **Materia de origen (tu asignación)** | Solo aparecen las materias que tienes asignadas. |
   | **Institución destino** | Instituciones con registro completo (no aparece la tuya). |
   | **Materia destino (opcional)** | Materias de la institución elegida; puedes dejarla vacía y acordarla después. |
   | **Título** | Un nombre claro de la clase espejo. |
   | **Objetivo** | Qué se busca lograr con la experiencia conjunta. |
   | **Fecha propuesta** | Debe ser una **fecha futura**. |

3. Confirma. La solicitud aparece en *Mis solicitudes* con estado **Pendiente**.

> Si cambias la **institución destino** al editar, la materia destino se limpia
> automáticamente para que elijas una válida de la nueva institución.

### 7.3 Estados de la solicitud y qué hacer

| Estado | Qué significa | Qué puedes hacer |
| --- | --- | --- |
| **Pendiente** | Esperando la revisión de una de las instituciones. | **Editar** o **Cancelar**. |
| **Aprobada por origen** | Tu institución ya aprobó; falta la institución destino. | **Editar** o **Cancelar**. |
| **Aprobada** | Ambas instituciones aprobaron. **Se creó el proyecto.** | Abrir el proyecto y organizar la clase. |
| **Rechazada** | Alguna institución la rechazó (verás el motivo). | **Corregir y reenviar** (vuelve a *Pendiente*) o **Descartar**. |

### 7.4 Mis proyectos

La sección **Mis proyectos de clase espejo** lista tus clases por estado
(*En planificación*, *En curso*, *Finalizado*, *Cancelado*) con un enlace
**Abrir** que te lleva a la pantalla de trabajo de la clase espejo.

---

## 8. La clase espejo paso a paso

La pantalla del proyecto (ruta `/proyectos/:id`) concentra todo el trabajo de la
clase. Si el proyecto está **Finalizado** o **Cancelado**, la pantalla queda en
**solo lectura**: se puede consultar el historial, pero no modificar nada.

### 8.1 Datos del proyecto

**Quién:** docentes participantes.

| Campo | Notas |
| --- | --- |
| **Estado** | *En planificación* o *En curso*. (*Finalizado* solo se asigna al cerrar la clase.) |
| **Plataforma** | Herramienta donde se impartirá (Zoom, Teams, Meet, …). |
| **Fecha de inicio** y **Fecha de fin** | La fecha de fin no puede ser anterior a la de inicio. |

Pulsa **Guardar** para aplicar los cambios.

### 8.2 Docentes participantes

Muestra a los docentes de ambas instituciones, con su rol y su institución.

* El **agente** puede **agregar un docente de su institución**
  (campo *Agregar docente de mi institución*) y **quitar** a los que su
  institución aportó.
* Un proyecto **debe conservar al menos un docente**.
* No se puede quitar a un docente que ya tiene **participaciones, firmas o
  mensajes** en ese proyecto (protege el historial).

### 8.3 Planificación conjunta

Es el acuerdo pedagógico de la clase. **Quién:** docentes.

| Campo | Contenido sugerido |
| --- | --- |
| **Objetivos acordados** | Qué competencias se trabajarán. |
| **Temas acordados** | Contenidos que cubrirá cada sesión. |
| **Metodología** | Cómo se trabajará (expositiva, taller, ABP, …). |
| **Plataforma** | Herramienta común. |
| **Estado de la planificación** | *Borrador*, *En revisión* o *Aprobada*. |

**Confirmación de los docentes.** Debajo, cada docente ve su propia fila con el
estado *Pendiente* o *Confirmado* y el botón **Confirmar mi participación**. La
confirmación de **todos** los docentes es la señal de que la planificación está
cerrada. Cuando un docente nuevo se suma al proyecto, su participación en la
planificación nace como *Pendiente*.

### 8.4 Reporte de planificación

**Quién:** el agente (función de supervisión).

Se completa en tres campos —**Acuerdos**, **Calendario** y **Actividades
acordadas**— y requiere que **ya exista** una planificación conjunta; si no,
el sistema avisa *"Aún no existe una planificación conjunta que reportar"*.

### 8.5 Chat del proyecto

Un botón flotante con un globo de mensaje abre el **chat** entre los docentes del
proyecto. Desde ahí pueden coordinarse sin salir de la plataforma.

* El chat está disponible mientras la clase **no** esté cerrada.
* Las conversaciones quedan guardadas en el proyecto, como historial de la
  colaboración.

### 8.6 Sesiones y reporte de clase

**Quién:** docentes.

1. En **Sesiones**, pulsa el botón para agregar una sesión y captura:

   | Campo | Notas |
   | --- | --- |
   | **Título** | Por ejemplo "Sesión 1 · Introducción a Scrum". |
   | **Fecha y hora** | Cuándo se impartirá. |
   | **Enlace virtual (URL)** | Liga a la sala de videoconferencia. |

2. Cada sesión aparece en la lista con dos acciones: **Reporte de clase** y
   **Eliminar**.

   > Una sesión con evidencias o reporte asociado **no se puede eliminar**.

#### El reporte de clase

Es el registro formal de lo ocurrido en la sesión y **se firma**.

**a) Contenido del reporte** (cualquier docente participante):

| Campo | Notas |
| --- | --- |
| **Desarrollo de la clase** | Cómo se desarrolló. |
| **Total de asistentes** | Número de estudiantes. |
| **Incidencias** | O "Ninguna". |
| **Acuerdos para la siguiente sesión** | Compromisos. |

**b) Firma** (cada docente):

* En **Firmas de los docentes** pulsa **Confirmar mi participación**.
* Captura tus **observaciones** y confirma. El estado pasa a *Confirmado* para
  ti.

**Estados del reporte:** *Borrador* → *En revisión* → *Confirmado*.

> **Atención:** si alguien **modifica el contenido** de un reporte que ya estaba
> firmado, las firmas se reinician y el reporte vuelve a *Borrador*. Es
> intencional: nadie firma un texto que después cambió.

### 8.7 Actividades

**Quién:** docentes.

1. En **Actividades**, agrega una nueva.
2. Captura **Título**, **Instrucciones** y **Fecha límite**.
3. Guarda. Puedes **Eliminar** una actividad desde la lista.

Las actividades son las tareas que los estudiantes (o los docentes) deben
completar entre sesiones.

### 8.8 Evidencias

**Quién:** docentes.

1. En **Evidencias**, elige el archivo con **Archivo**.
2. Opcionalmente indica el **Tipo** (fotografía, acta, video…) y la **Sesión** a
   la que pertenece.
3. Pulsa el botón de subida.

**Reglas de los archivos:**

| Regla | Detalle |
| --- | --- |
| Tamaño máximo | **10 MB** por archivo. |
| Formatos permitidos | PDF, imágenes (png, jpg, jpeg, gif, webp), Office (doc, docx, xls, xlsx, ppt, pptx), texto (txt, csv) y ZIP. |
| Formatos **rechazados** | `.html`, `.svg`, `.js` y cualquier otro fuera de la lista (por seguridad). |
| Descarga | Los archivos se descargan, no se abren dentro de la aplicación. |

Si el archivo es rechazado, verás el motivo exacto (por ejemplo, *"Tipo de
archivo no permitido (.exe)"*).

### 8.9 Evaluación final

**Quién:** docentes.

| Campo | Notas |
| --- | --- |
| **Instrumento** | Rúbrica, encuesta, lista de cotejo… |
| **Resultado** | Por ejemplo "satisfactorio", "4.5/5". |
| **Observaciones** | Conclusiones de la experiencia. |

Se puede registrar más de una evaluación (por ejemplo, una por docente o una por
instrumento). **Al menos una es obligatoria para poder cerrar la clase.**

### 8.10 Cierre de la clase espejo

**Quién:** cualquier docente participante. Es el paso final: el proyecto pasa a
**Finalizado** y queda en solo lectura.

Para poder cerrar, el sistema exige **tres condiciones**:

1. ✅ Al menos **una evaluación final** registrada.
2. ✅ **Todas** las sesiones (las canceladas no cuentan) con su **reporte de
   clase confirmado** por los docentes.

> Un proyecto **sin sesiones** puede cerrarse si ya tiene su evaluación final:
> no hay reportes pendientes que exigir.

Si falta alguna, el cierre se rechaza con un mensaje que indica exactamente qué
falta:

* *"Registren al menos una evaluación final antes de cerrar la clase espejo"*
* *"Cada sesión necesita su reporte de clase confirmado por los docentes"*
* *"La clase espejo ya está finalizada"*

---

## 9. Estados del sistema

### Solicitud de clase espejo

| Estado | Significado |
| --- | --- |
| **Pendiente** | Recién creada; espera revisión. |
| **Aprobada por origen** | La institución que la propone ya la aprobó. |
| **Aprobada** | Aprobada por ambas instituciones. Se creó el proyecto. |
| **Rechazada** | Rechazada en alguna etapa; muestra el motivo. |
| **Caducada** | Nadie respondió dentro del plazo (7 días antes de la fecha propuesta). La cancela el **sistema**, no una institución; puedes **reenviarla con una fecha nueva**. |

### Proyecto (clase espejo)

| Estado | Significado |
| --- | --- |
| **En planificación** | Los docentes acuerdan objetivos, temas y calendario. |
| **En curso** | La clase ya se está impartiendo. |
| **Finalizado** | Cerrada formalmente; historial en solo lectura. |
| **Cancelado** | No se llevó a cabo. |

### Planificación conjunta

| Estado | Significado |
| --- | --- |
| **Borrador** | Se está redactando. |
| **En revisión** | Los docentes la están revisando. |
| **Aprobada** | Acuerdo cerrado. |

### Reporte de clase

| Estado | Significado |
| --- | --- |
| **Borrador** | Contenido capturado, sin firmas completas. |
| **En revisión** | Al menos un docente ya firmó. |
| **Confirmado** | Firmado. Necesario para poder cerrar la clase. |

### Participación

| Estado | Significado |
| --- | --- |
| **Pendiente** | El docente aún no confirma. |
| **Confirmada / Confirmado** | El docente ya confirmó (planificación o reporte). |

---

## 10. Preguntas frecuentes y solución de problemas

**No puedo iniciar sesión y estoy seguro de que mi contraseña es correcta.**
Puede que tu cuenta esté **desactivada**. Pídele a tu agente de
internacionalización que la reactive. Si fallaste varias veces seguidas verás el
mensaje *"Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo."*:
hay un límite de 10 intentos por minuto, así que espera y reintenta.

**Inicié sesión pero mi panel dice "Completa el registro de tu institución".**
Faltan datos obligatorios de la institución. Complétalos y guarda; el panel se
habilitará solo.

**Soy docente y no recibí el correo de invitación.**
Revisa la carpeta de **spam**. Si no aparece, pide al agente que te invite de
nuevo: los enlaces caducan y **solo se pueden usar una vez**.

**El enlace de activación dice "Enlace no válido".**
Ya caducó o ya fue usado. Solicita una nueva invitación.

**No aparece la institución que quiero como destino.**
Solo se listan instituciones con el **registro completo**. Si la institución
contraparte no ha completado sus datos, no aparecerá hasta que lo haga.

**El botón "Revisar" no aparece en una solicitud.**
En ese momento **no te toca revisarla**: la solicitud está en la etapa de la otra
institución (primero origen, después destino).

**No puedo eliminar una materia / un docente / una sesión.**
El sistema protege el historial. El mensaje indicará el motivo: materias con
asignaciones, docentes con participaciones o firmas, sesiones con evidencias o
reporte de clase.

**No puedo quitar a un docente del proyecto.**
O bien es el único docente (siempre debe quedar al menos uno), o ya tiene
participaciones, firmas o mensajes registrados.

**Mi archivo de evidencia fue rechazado.**
Revisa la extensión (solo PDF, imágenes, Office, texto y ZIP) y que no supere
**10 MB**.

**El reporte de clase volvió a "Borrador" después de firmarlo.**
Alguien editó el contenido del reporte después de la firma. Vuelvan a firmarlo:
así las firmas corresponden siempre al texto definitivo.

**No puedo cerrar la clase espejo.**
Revisa las condiciones del punto 8.10: al menos una evaluación final registrada y
**todos** los reportes de clase de las sesiones (no canceladas) confirmados.

**¿Por qué mi solicitud aparece como "Caducada"?**
Pasó el plazo sin que ninguna institución respondiera. El plazo es la **fecha
propuesta menos 7 días**. No la rechazó nadie: la canceló el sistema. Puedes
pulsar **Reenviar con fecha nueva** y vuelve a quedar *Pendiente*.

**¿Para qué sirve el calendario?**
Es una **ventana emergente** que se abre con el botón **Ver calendario** de la
sección *Recordatorios y próximos eventos*, o con **Calendario** en el menú
lateral. Muestra el mes con las **sesiones programadas** (punto azul) y los
**vencimientos de solicitudes** (punto ámbar, rojo cuando queda poco). Al pulsar
un día con eventos verás a la derecha el detalle: **el nombre de cada clase
espejo** con su hora y las instituciones, y las **solicitudes pendientes** de ese
día con su urgencia.

**¿Qué es la lista de recordatorios?**
Es la sección *Recordatorios y próximos eventos* de tu panel (siempre a la
vista): **Lo próximo** reúne las sesiones y los vencimientos por fecha, y **Por
hacer** lo que falta de tu parte. Las marcas de urgencia te dicen cuántos días
quedan: *vence en 2 días*, *vence hoy*, *vencida*.

**¿Qué significan las marcas de urgencia?**
Se calculan solas según los días que quedan. **Crítica** (ámbar): 2 días o menos.
**Próxima** (azul): hasta 7 días. **Vencida** (rojo): el plazo ya terminó y la
solicitud se canceló. Si no respondes a tiempo, la solicitud se cancela sola.

**El proyecto se ve en solo lectura.**
Está **Finalizado** o **Cancelado**: se conserva como historial y ya no admite
cambios.

**Algo no cargó en mi panel.**
Cada sección muestra su propio aviso con un botón **Reintentar**. Úsalo antes de
recargar la página completa.

---

## 11. Buenas prácticas

**Para el agente**

* Mantén al día los datos de tu institución: son tu carta de presentación.
* Da de alta **materias y asignaciones** antes de que los docentes propongan
  clases: sin asignación no pueden crear solicitudes.
* Al rechazar, **escribe siempre un motivo claro**: el docente lo verá y podrá
  corregir la propuesta.
* Revisa el indicador **Por revisar** al inicio de cada jornada: las solicitudes
  detenidas bloquean el trabajo de los docentes.

**Para el docente**

* Antes de proponer una clase, verifica que tu **materia esté asignada** en el
  periodo correcto.
* Define **objetivos, temas y metodología** en la planificación **antes** de
  programar sesiones: es el acuerdo que sostiene toda la clase.
* Programa las sesiones con **antelación** y con el enlace virtual ya listo.
* Captura el **reporte de clase en la misma sesión**, mientras la información
  está fresca, y fírmalo.
* Sube las evidencias con un nombre de archivo descriptivo.
* Antes de cerrar, confirma que **todos** los reportes estén *Confirmados*.

---

## 12. Glosario

| Término | Significado |
| --- | --- |
| **Clase espejo** | Clase impartida conjuntamente por docentes de dos instituciones. |
| **Institución de origen** | La que propone la clase espejo. |
| **Institución de destino** | La que recibe y acepta la propuesta. |
| **Agente de internacionalización** | Responsable de la colaboración internacional de una institución. |
| **Solicitud** | Propuesta formal de clase espejo entre dos instituciones. |
| **Proyecto** | Clase espejo aprobada, en ejecución. |
| **Planificación conjunta** | Acuerdo de objetivos, temas, metodología y calendario. |
| **Sesión** | Encuentro virtual programado de la clase espejo. |
| **Reporte de clase** | Registro de lo ocurrido en una sesión, firmado por los docentes. |
| **Evidencia** | Archivo que respalda el trabajo realizado. |
| **Evaluación final** | Instrumento y resultado con el que se valora la experiencia. |
| **Cierre** | Paso final que marca el proyecto como *Finalizado*. |
| **Asignación** | Vínculo docente ↔ materia dentro de un periodo escolar. |
| **Gate de institución** | Bloqueo del panel hasta completar los datos de la institución. |
| **CACE** | Comunidad de Apoyo a Clases Espejo. |

---

## 13. Recorrido de demostración (10 minutos)

Si vas a mostrar la plataforma (por ejemplo, en una presentación), la base de
datos de demostración permite recorrer **todo el ciclo** con clases ya
concluidas, en proceso y pendientes al mismo tiempo.

**Credenciales** (contraseña `Demo1234`):

| Rol | Correo |
| --- | --- |
| Agente (México) | `agente.calkini@clasesespejo.mx` |
| Agente (Colombia) | `agente.colombia@clasesespejo.co` |
| Docente (México) | `roberto.perez@clasesespejo.mx` |
| Docente (Colombia) | `andres.garcia@clasesespejo.co` |

**Guion sugerido**

1. **Entra como docente** (`roberto.perez@clasesespejo.mx`).
   Muestra los indicadores y que conviven clases **Finalizadas**, **En curso** y
   **En planificación**.
2. **Crea una solicitud** con *Nueva solicitud* y muestra que solo aparecen tus
   materias asignadas y las instituciones con registro completo.
3. **Cambia de sesión** y entra como **agente de México**
   (`agente.calkini@clasesespejo.mx`). Muestra el tablero de solicitudes: hay
   pendientes, aceptadas y rechazadas.
4. **Revisa** la solicitud que acabas de crear: aprueba como **origen** y explica
   que falta la revisión de destino.
5. **Entra como agente de Colombia** (`agente.colombia@clasesespejo.co`),
   aprueba la misma solicitud como **destino** y muestra que **se creó el
   proyecto**.
6. **Vuelve como docente** y abre el proyecto nuevo: datos, planificación,
   confirmación de participación, sesiones y chat.
7. Abre un proyecto **Finalizado** para mostrar el historial: sesiones, reportes
   firmados, evidencias y evaluación.

> Para preparar la demo: `node scripts/seed-demo.js` y luego
> `node scripts/seed-demo-clases.js`. Para limpiarla:
> `node scripts/borrar-demo-clases.js`.

---

*Manual de usuario de Clases Conjuntas · Plataforma CACE*
