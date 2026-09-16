# Reporte de revisión — Clases Espejo

Fecha de la revisión: hoy (enero 2026).

## Qué se revisó

Se revisó la aplicación de principio a fin, leyendo el código del backend
(`backend/src`) y del frontend (`frontend/src/app`), y comparándolo con los
documentos de `docs/` (casos de uso, diagrama de flujo, diagrama de secuencias,
modelo de datos y readme).

También se comprobó que el proyecto compila bien:

- `npx prisma validate` → el esquema de base de datos es válido.
- `npm run build` (backend) → compila sin errores.

No se tocó la base de datos real ni se levantó el servidor. Todo lo que se dice
aquí salió de leer el código, salvo esas dos comprobaciones.

## Qué encontré (resumen)

Hay 12 hallazgos:

- 2 críticos (problemas serios de seguridad o de datos).
- 4 importantes (rompen un flujo o bloquean a un usuario).
- 4 menores (confusión o inconsistencias).
- 2 sugerencias (mejoras, sin ser un error grave).

Lo más importante es esto:

1. El botón "Desactivar docente" no desactiva nada.
2. Un docente puede cerrar el proyecto saltándose las reglas.
3. Invitar a un correo que ya existe deja un enlace inservible.
4. El flujo de "doble revisión" que dicen los diagramas no está hecho.
5. Borrar docentes, asignaciones o sesiones con datos relacionados da error 500.
6. Las evidencias no se pueden unir a una sesión.

---

## Los problemas uno por uno

### 1. "Desactivar docente" no desactiva nada (crítico)

**Dónde**: `backend/src/agentes/agentes.service.ts`, línea 75 a 97.

**Qué dice la pantalla**: el agente ve un botón "Activar / Desactivar" en cada
docente, como si al desactivarlo le quitara el acceso.

**Qué pasa en realidad**: el botón solo cambia un campo llamado `activo`, pero
ese campo no se revisa en ningún otro lado. El docente "desactivado" puede
seguir entrando, creando solicitudes, escribiendo en el chat y subiendo
archivos.

**Por qué importa**: es un control de acceso que no funciona.

**Cómo arreglarlo**: revisar ese campo al iniciar sesión y en cada acción del
docente, para que un docente desactivado no pueda seguir usando el sistema.

---

### 2. Se puede cerrar el proyecto sin cumplir las reglas (crítico)

**Dónde**: `backend/src/proyectos/dto/update-proyecto.dto.ts` (líneas 3 a 14) y
`backend/src/proyectos/proyectos.service.ts` (líneas 101 a 121).

**Qué dice el sistema**: para cerrar una clase espejo se necesita al menos una
evaluación final y que cada sesión tenga su reporte confirmado. Eso lo cumple
el botón "Cerrar clase espejo".

**Qué pasa en realidad**: hay otro camino. En "Datos del proyecto", el docente
ve un campo "Estado" con la opción "Finalizado". Si lo cambia y guarda, el
proyecto queda "Finalizado" sin evaluación ni reportes, saltándose todas las
reglas.

**Por qué importa**: se puede dar por terminado un proyecto incompleto.

**Cómo arreglarlo**: quitar la opción de cambiar el estado a "Finalizado" o
"Cancelado" desde ese formulario, y obligar a que solo se cierre por el botón
que sí revisa las reglas.

---

### 3. Invitar a un correo que ya existe deja un enlace inservible (importante)

**Dónde**: `backend/src/auth/auth.service.ts` (líneas 166 a 171) y
`backend/src/agentes/agentes.service.ts` (líneas 19 a 52).

**Qué dicen los documentos**: el diagrama de secuencia dice que si el correo ya
existe, se reutiliza ese usuario y se le agrega el rol de docente.

**Qué pasa en realidad**: al invitar no se revisa si el correo ya existe. Luego,
cuando el docente abre el enlace y completa su registro, el sistema responde
"Ya existe un usuario con ese correo o DNI" y no lo deja terminar.

**Por qué importa**: no se puede agregar como docente a alguien que ya tiene
cuenta, y una invitación repetida termina en error.

**Cómo arreglarlo**: si el correo ya existe y no es docente, vincularlo como
docente en lugar de intentar crear otro usuario.

---

### 4. Falta la doble revisión que dicen los diagramas (importante)

**Dónde**: `docs/diagramas/diagrama de flujo.md` (líneas 27 a 45) contra
`backend/src/solicitudes/solicitudes.service.ts` (líneas 175 a 196).

**Qué dicen los documentos**: el diagrama de flujo dice que primero revisa el
agente de la institución de origen y luego el de la institución de destino.

**Qué pasa en realidad**: el código solo tiene la revisión de la institución de
destino. No existe la revisión de origen ni los estados "Aprobada por origen".

**Ojo**: el `docs/readme` describe una sola revisión. Las dos fuentes se
contradicen. Hay que decidir cuál manda.

**Cómo arreglarlo**: primero decidir cuál es el flujo correcto, y después
implementar lo que falte (o actualizar el diagrama).

---

### 5. Borrar docentes, asignaciones o sesiones con datos relacionados da error 500 (importante)

**Dónde**: `backend/src/agentes/agentes.service.ts` (líneas 117 a 121),
`backend/src/asignaciones/asignaciones.service.ts` (líneas 55 a 62) y
`backend/src/proyectos/proyectos.service.ts` (líneas 424 a 432).

**Qué pasa en realidad**: si un docente o una asignación ya tiene solicitudes o
proyectos encima, al borrarlos la base de datos rechaza la operación y la
pantalla muestra un error técnico (500).

**Por qué importa**: el agente o el docente se queda sin saber qué pasó ni cómo
resolverlo.

**Cómo arreglarlo**: antes de borrar, revisar si hay datos relacionados y
mostrar un mensaje claro ("no se puede borrar porque tiene solicitudes"), como
ya se hace con las materias.

---

### 6. Las evidencias no se pueden unir a una sesión (menor)

**Dónde**: `backend/src/proyectos/proyectos.service.ts` (líneas 517 a 525).

**Qué pasa en realidad**: el modelo de datos permite asociar una evidencia a una
sesión, pero el código siempre guarda "sin sesión" (`null`).

**Cómo arreglarlo**: permitir elegir la sesión al subir la evidencia.

---

### 7. Los estados no están acotados y hay literales que no coinciden (menor)

**Dónde**: `backend/prisma/schema.prisma` (campos `estado` de varias tablas) y
`backend/src/proyectos/dto/create-sesion.dto.ts` (líneas 15 a 17).

**Qué pasa en realidad**: en la base de datos los estados son texto libre. El
formulario de sesiones acepta cualquier palabra. Además, el frontend muestra el
estado "Cancelada" de las solicitudes, pero el backend nunca escribe esa
palabra (cancelar borra el registro).

**Cómo arreglarlo**: definir la lista de estados permitidos en un solo lugar y
usarla en las tres capas.

---

### 8. El mensaje de login engaña al docente invitado que aún no activa su cuenta (menor)

**Dónde**: `backend/src/auth/auth.service.ts` (líneas 97 a 105).

**Qué pasa en realidad**: un docente que fue invitado pero todavía no activa su
cuenta intenta entrar y ve "Correo o contraseña incorrectos", que es falso. El
mensaje correcto ("revisa tu correo de invitación") solo aparece en otro caso.

**Cómo arreglarlo**: mostrar el mensaje de "cuenta sin activar" en el orden
correcto.

---

### 9. Una condición que siempre se cumple (sugerencia)

**Dónde**: `backend/src/proyectos/proyectos.service.ts`, línea 203.

Al quitar un docente del proyecto hay una comparación que compara lo mismo
consigo misma y siempre da verdadero. No rompe nada, pero es código muerto que
confunde.

---

### 10. La fecha de vencimiento de la invitación está duplicada (sugerencia)

**Dónde**: `backend/src/agentes/agentes.service.ts`, líneas 29 a 34.

La invitación tiene dos fechas de vencimiento: una configurable y otra fija de
7 días. Si se cambia la configuración, quedan distintas.

---

### 11. Se pueden seguir agregando cosas a un proyecto ya finalizado (menor)

**Dónde**: `backend/src/proyectos/proyectos.service.ts` (varias funciones).

**Qué pasa en realidad**: después de cerrar un proyecto, la API todavía acepta
crear sesiones, actividades, evidencias y evaluaciones. La pantalla oculta
algunos botones, pero la API no lo impide.

**Cómo arreglarlo**: revisar el estado del proyecto antes de aceptar esos
cambios.

---

### 12. No existe el rol de "Administrador del sistema" (importante)

**Dónde**: `docs/diagramas/casos_de_uso.md` (actor Administrador) contra
`backend/prisma/schema.prisma` (no hay ese rol).

Los casos de uso describen un administrador que gestiona instituciones,
usuarios y reportes generales. En el código ese rol no existe. Hay que decidir
si se implementa o se quita de los documentos.

---

## Sobre el ejemplo que mencionaste

Dijiste que encontraste un caso de "pide evidencias pero solo acepta texto".
En el código actual eso no se reproduce: la sección de evidencias sí usa un
selector de archivo real (`type="file"`) y el backend guarda el archivo. Si lo
viste en una versión anterior, ya está corregido.

Lo que sí encontré es el patrón parecido al revés: mensajes o botones que
prometen una cosa y el código hace otra (por ejemplo, "Desactivar docente" que
no desactiva).

---

## Qué falta decidir

1. ¿La revisión de solicitudes es en una o dos etapas?
2. ¿Se implementa el rol de Administrador o se quita de los documentos?
3. ¿Se permite reutilizar un usuario existente al invitarlo como docente?

Estas tres preguntas necesitan una decisión antes de poder "arreglarlas", porque
los propios documentos se contradicen.
