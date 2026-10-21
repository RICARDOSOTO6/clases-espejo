# Informe de la Fase 0 — «la red de seguridad»

> Para quien no siguió el proceso. Sin dar por sabido ningún término.
> Fecha: 20 de octubre de 2026. Autor: sesión de trabajo con el agente.

## Si solo lees una frase

**La aplicación funciona igual que antes; lo que se añadió es una red de
seguridad que avisa sola si algo se rompe en el futuro.** Antes, cualquier
cambio en el código se comprobaba a mano y con suerte; ahora hay 64
comprobaciones automáticas que recorren la aplicación de punta a punta y un
«portero» (CI) que las ejecuta en cada cambio, además de reglas de estilo y
tipado estricto. No se tocó ni la base de datos de demostración ni los datos
reales.

---

## 1. El problema, en palabras sencillas

Imagina una casa grande con muchas puertas. Hasta ahora, para saber que todo
seguía funcionando, alguien tenía que recorrer las habitaciones a mano cada vez
que se cambiaba una cerradura. Si se olvidaba una puerta, el fallo aparecía
semanas después, cuando ya no se sabía qué cambio lo había causado.

El proyecto tenía exactamente eso:

- **127 rutas** (puertas) en el servidor y solo **4 pruebas triviales**.
- Ningún sistema que revisara automáticamente que el registro, la aprobación de
  instituciones, los certificados o el cierre de una clase siguieran
  funcionando.
- El código del backend no estaba en modo «estricto» y el frontend no tenía
  corrector de estilo.

La **Fase 0** del plan consistía en poner esa red de seguridad **antes** de
seguir añadiendo funciones, porque tocar código sin red es trabajar a ciegas.

---

## 2. Las piezas, una por una (qué son y para qué sirven)

| Pieza | Qué es, en simple | Para qué sirve |
| --- | --- | --- |
| **Pruebas e2e** | Un robot que usa la aplicación como lo haría una persona: entra, rellena formularios, pulsa botones y comprueba las respuestas. «e2e» = *de extremo a extremo*. | Descubre en segundos si un cambio rompió un flujo completo |
| **Base de prueba** | Una copia vacía de la base de datos, solo para que el robot experimente. | El robot puede crear y borrar datos sin riesgo. **La base real nunca se toca** |
| **CI** (*integración continua*) | Un portero automático que, cada vez que se sube un cambio a GitHub, ejecuta todas las revisiones y avisa en rojo si algo falla. | Nadie puede «colar» un cambio roto sin que se vea |
| **Modo estricto** (`strict`) | Hacer que el lenguaje de programación sea más exigente al revisar el código: si falta un dato, no lo deja pasar. | Evita errores tontos antes de que lleguen al usuario |
| **ESLint** | Un corrector de estilo y de despistes (variables que no se usan, comparaciones mal escritas, convenciones). | Código más limpio y uniforme; detecta fallos reales pequeños |
| **`.env.example`** | La «lista de ingredientes» de la configuración, con valores de ejemplo y **sin contraseñas**. | Montar el proyecto en otro ordenador sin adivinar qué variables hacen falta |
| **Mensaje de commit** | La etiqueta que explica qué cambió y por qué, guardada en el historial. | Poder entender meses después qué se hizo |

---

## 3. Qué se hizo, en orden

Se trabajó en seis pasos pequeños, cada uno comprobado y guardado por separado
(esos son los commits que aparecen en el historial):

### Paso 1 — La lista de ingredientes
Se creó [`backend/.env.example`](../backend/.env.example): todas las variables
que el servidor necesita (base de datos, claves, correo, URLs), con ejemplos.
El archivo `.env` real sigue fuera del repositorio, como debe ser.

### Paso 2 — El modo estricto y el corrector
- Se activó `strict` en el backend. Al hacerlo aparecieron **73 avisos** en los
  formularios internos (los llamados DTO), que se corrigieron uno a uno con un
  cambio inocuo (no cambia cómo funciona nada).
- Se dejó el lint del backend en verde **de verdad**: se apagaron solo las
  reglas que dan falsos positivos por el uso deliberado de un tipo de dato
  flexible, y se arreglaron los seis avisos reales.

### Paso 3 — La primera tanda de pruebas y el portero
- Se creó la **base de prueba** (`clasesconjuntasbd_test`) y las utilidades para
  que cada prueba empiece de cero y con datos inventados (dos instituciones
  aprobadas, sus agentes, docentes, presidencia y secretaría).
- Se escribieron las primeras **21 pruebas** (registro completo y permisos por
  rol) y el archivo del **CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
- El correo se sustituye por un «simulador»: las pruebas no envían correos
  reales.

### Paso 4 — Las pruebas de los cuatro flujos que faltaban
Se añadieron **39 pruebas** más (más 4 de humo):

| Flujo | Qué recorre | Pruebas |
| --- | --- | --- |
| 1. Registro y acceso | Registrar agente → aprobar institución → invitar docente → activar cuenta | 14 |
| 2. Doble revisión | Docente propone → agente de origen aprueba → agente de destino aprueba → nace la clase | 10 |
| 3. Permisos | Cada rol contra las rutas que le corresponden (y las que no) | 7 |
| 4. Certificados | Lista de alumnos → emitir → PDF → verificar por QR → anular → reemitir | 12 |
| 5. Cierre | Intentos de cerrar sin evaluación o sin firmas, hasta el «Finalizado» | 11 |
| 6. Calendario | Descargar el `.ics`, consultarlo, enviarlo por correo | 6 |
| Humo | Que el servidor arranque y responda a lo público | 4 |

### Paso 5 — El corrector del frontend
- Se instaló y configuró **ESLint también en el frontend** (antes no tenía),
  para código y para plantillas.
- Aparecieron **7 avisos**; se corrigieron todos. Uno era interesante: un
  componente llamaba `close` a un aviso interno, y eso choca con un evento
  estándar del navegador; ahora se llama `cerrado`. Para el usuario no cambia
  nada: se ve exactamente igual.

### Paso 6 — La documentación
Se actualizaron el [plan de fases](../producto/plan-de-fases-pendientes.md), el
[README](../README.md) y la [guía de trabajo](../guias/trabajo-en-el-codigo.md)
para que digan la verdad: cómo montar la base de prueba, cómo lanzar las
pruebas, qué hace el CI y la salvedad de que aún no se ha ejecutado en GitHub.

---

## 4. Cómo se comprobó (números, no adjetivos)

Todo esto se ejecutó de verdad en este equipo, no se supuso:

| Comprobación | Resultado |
| --- | --- |
| Pruebas e2e contra PostgreSQL real | **64 de 64 en verde** (unos 19 segundos) |
| Tipos del backend en modo estricto | **0 errores** (revisión completa) |
| Lint del backend | **0 errores y 0 avisos** |
| Lint del frontend | **0 errores y 0 avisos** |
| Pruebas unitarias del backend | **5 de 5 en verde** |
| Compilación del backend | Correcta |
| Tipos y plantillas del frontend | Correctos (`tsc` y `ngc`) |
| Compilación del frontend | Correcta; escribe la aplicación que sirve `:3000` |
| Servidor | Arriba en `http://localhost:3000`; sirve el bundle nuevo |

**La base de demostración (`ClasesconjuntasBD`) no se tocó**: todas las pruebas
usan la base aparte, y el código se niega a arrancarlas si el nombre de la base
no termina en `_test` o `_ci`. Es una cerradura de seguridad.

---

## 5. Lo que no se comprobó (y por qué)

- **El CI no se ha ejecutado todavía en GitHub**: aquí no hay servidor de
  GitHub. Se verificó cada comando por separado y las 64 pruebas contra
  PostgreSQL real; el primer push será la prueba definitiva.
- **No se ejecutaron las pruebas unitarias del frontend** (`ng test`), y la
  cobertura de pruebas unitarias de los servicios del backend sigue pendiente
  (las e2e ya existen).
- No se han probado flujos que dependan de un **SMTP real**: el correo va
  simulado a propósito, para no enviar mensajes desde las pruebas.

---

## 6. Cómo usarlo tú

- **La aplicación**: está en `http://localhost:3000`. Si ves una versión
  antigua, pulsa `Ctrl+Shift+R` (el navegador guarda la página anterior).
- **Lanzar las pruebas** (necesita la base de prueba; está explicado en la
  [guía de trabajo](../guias/trabajo-en-el-codigo.md)):

  ```powershell
  cd backend
  $env:TEST_DATABASE_URL="postgresql://postgres:CLAVE@localhost:5432/clasesconjuntasbd_test?schema=public"
  npm run test:e2e -- --runInBand
  ```

- **Subir los cambios a GitHub**: hay **8 commits sin subir**. No se ha hecho
  `push` porque la norma del proyecto es que lo hagas tú. Al subirlos, GitHub
  ejecutará el CI por primera vez.
- **Qué revisar primero**: el archivo del CI
  ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) y la primera
  ejecución del CI en GitHub. Si algo falla allí, el mensaje indicará qué paso.

---

## 7. Lo que cambió para el usuario

**Nada visible.** La aplicación se ve y se usa igual. Lo que cambió es cómo de
seguro es el futuro: cualquier cambio que rompa el registro, la doble revisión,
los permisos, los certificados, el cierre o el calendario **se verá antes de
llegar a producción**.

Detalle honesto: sí hubo dos cambios pequeños en el código del frontend
(quitar un import y una variable que no se usaban, y corregir dos comparaciones
`==` por `===`). No alteran ninguna pantalla ni flujo.

---

## 8. Qué sigue

La **Fase 1** del plan es la más urgente desde el punto de vista del usuario:
recuperar contraseña («olvidé mi contraseña»), cerrar sesiones al cambiar la
contraseña, verificar el correo al registrarse y reenviar invitaciones. Hoy, si
alguien olvida su contraseña, depende de que un agente se la restablezca a mano.

Antes de empezarla conviene hacer el primer `push` y ver el CI en verde.
