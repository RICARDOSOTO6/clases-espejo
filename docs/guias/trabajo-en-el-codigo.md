# Cómo trabajar en el código de este proyecto

> Reglas completas para cualquier asistente que vaya a **tocar código o la base de
> datos** de Clases Conjuntas. Para preguntas, explicaciones o documentos no aplican:
> ahí se responde al grano.

## La regla que resume todas las demás

**No digas que algo funciona si no lo has comprobado.** Cada afirmación se apoya en
una comprobación: una compilación, una llamada a la API, una medición en el navegador
o una consulta a la base. Lo que no se ha podido verificar **se dice** — con la
palabra «no verificado» — en vez de rellenarse con optimismo.

## El proyecto en treinta segundos

- **Backend**: NestJS 11 + Prisma 6 + PostgreSQL (base `ClasesconjuntasBD`).
- **Frontend**: Angular 21 **zoneless** (solo señales), servido **compilado** desde
  `backend/public`. En desarrollo no hay servidor aparte: una sola URL, `:3000`.
- **Base de demostración**: 2 instituciones (Calkiní y Colombia), 2 agentes, 2
  docentes, 2 clases espejo (17 finalizada y 24 en planificación), presidencia,
  secretaría, configuración de la CACE, 1 plantilla de certificado y **0 certificados
  emitidos**.
- **Respaldo**: `clasesconjuntas_respaldo_20261013` (copia exacta del estado bueno).
  **No se toca** salvo que se pida.

### Credenciales de demostración

Contraseñas **de prueba**; si el repositorio se hace público, cámbialas.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Presidencia | `antiniosotobeh@gmail.com` | `CaceDemo2026!` |
| Secretaría | `secretaria.cace@clasesespejo.mx` | `SecretariaCace2026!` |
| Agente | `agente.calkini@clasesespejo.mx` / `agente.colombia@clasesespejo.co` | `Demo1234` |
| Docente | `sofia.gomez@clasesespejo.mx` / `isabella.cardenas@clasesespejo.co` | `Demo1234` |

## El servidor

- Se levanta con `cd backend` y `node dist/src/main` (necesita `nest build` antes si
  cambió el backend). Sirve API **y** frontend compilado en `http://localhost:3000`.
- **Cuando haya cambios visibles, deja el servidor levantado** al terminar, para que
  la persona pueda valorarlos **en el navegador**. Y avísale de **`Ctrl+Shift+R`**:
  el frontend se sirve estático y el navegador guarda el `index.html` viejo; sin la
  recarga forzada parece que algo está roto cuando solo es la caché.
- Si el servidor se cae solo, **casi siempre es que algo de fuera lo mata** (otra
  sesión trabajando en el mismo puerto). No es un fallo de la aplicación: en ese caso
  dile que lo arranque **en su propia terminal** (así no depende de ninguna sesión y
  ve los registros en vivo).

## Antes de decir «está hecho», comprueba

1. **Compilación y lint**: `cd backend && npx nest build`; en `frontend`
   `npx tsc -p tsconfig.app.json --noEmit`, `npx ngc -p tsconfig.app.json --noEmit`
   (revisa plantillas) y **`npx ng build`** (empaqueta lo que se sirve de verdad).
   `npm run lint:ci` en los dos (sin `--fix` y sin avisos), `npx jest --runInBand`
   si el cambio toca servicios, y `npm run test:e2e -- --runInBand` si toca flujos
   (ver abajo).
2. **API de verdad**: un servidor de pruebas en el puerto **3001 — nunca el 3000**
   (el 3000 es el de la persona y no se debe tocar) — y llamadas reales: login de los
   roles implicados, el caso bueno, el caso malo y el que debe dar **403/401**.
3. **Navegador** cuando sea visual: Chrome con `--remote-debugging-port=9222` y un
   guion por el protocolo de DevTools (`backend/scripts/*.js`). Midiendo, no mirando:
   tamaños, desbordes, contraste, presencia de elementos.
4. **Los datos de prueba se borran**: dejar la base como estaba.

## Pruebas e2e y CI

Las e2e cubren los seis flujos críticos y viven en `backend/test/*.e2e-spec.ts`.
**Nunca** corren contra la base de demostración: `test/base-e2e.ts` se niega a
arrancar si el nombre de `DATABASE_URL` no termina en `_test` o `_ci`, vacía las
tablas de esa base y siembra dos instituciones aprobadas con sus agentes,
docentes, presidencia y secretaría. El correo va simulado (no sale ningún SMTP).

```powershell
# una sola vez: crear la base de prueba y aplicar las migraciones
psql -U postgres -c "CREATE DATABASE clasesconjuntasbd_test"
Get-ChildItem backend\prisma\migrations -Directory | ForEach-Object {
  psql -U postgres -d clasesconjuntasbd_test -f (Join-Path $_.FullName 'migration.sql')
}

# ejecutar
cd backend
$env:TEST_DATABASE_URL="postgresql://postgres:CLAVE@localhost:5432/clasesconjuntasbd_test?schema=public"
npm run test:e2e -- --runInBand
```

El CI (`.github/workflows/ci.yml`) hace lo mismo contra un PostgreSQL 17 de
servicio y añade lint, tipos en `strict`, `prisma validate`/`migrate deploy`,
unitarias y build; el frontend corre lint, `tsc`, `ngc` y `ng build`. Se dispara
en cada push y en cada pull request.

`ng build` y los comandos de Prisma **lanzan binarios** que el sandbox puede
bloquear con `EPERM`: se repite una vez con permisos ampliados (`danger-full-access`),
como ya se hacía con `prisma generate`.

## Commits

- **Se commitea cada cambio verificado**, con un mensaje que explique **qué** y **por
  qué** (no «cambios varios»). **Nunca se hace `git push`**: la persona sube cuando
  quiere. Se le informa de cuántos commits quedan sin subir.
- Si el cambio es de otra persona o de otra sesión, se commitea **por separado** y
  se dice que no es propio.
- **No se commitean** binarios que engordan el repositorio (los `.docx` del informe:
  solo la última versión), ni perfiles de navegador (`.tmp-chrome*/`), ni archivos de
  bloqueo de Word (`~$*`). El `.gitignore` ya los cubre.

## Migraciones y base de datos

- Las migraciones se crean con `npx prisma migrate dev --name lo_que_sea`. Prisma y
  `nest build` **necesitan permisos ampliados** en el sandbox (si el comando muere con
  `EPERM`, se repite una vez con `danger-full-access`).
- Si Prisma dice que **una migración ya aplicada cambió de contenido** (checksum),
  **nunca** se reinicia la base: se vuelve a registrar con `migrate resolve`.
- **Nunca** se borran datos del usuario sin preguntar. Se informa de lo sospechoso
  (filas de prueba, basura) y **decide la persona**.

## Cómo se responde cuando se ha tocado código

Al final de la respuesta, tres cosas:

1. **Qué se comprobó** y con qué resultado (con números, no adjetivos).
2. **La lista de pendientes**, incluido lo que quedó a medias y por qué.
3. **El estado del repositorio**: commit, archivos, árbol limpio o no, commits sin
   subir, y si el servidor quedó arriba.

Y siempre, separado y claro: **lo que no está verificado**.

## Trampas de este entorno (aprendidas a golpes)

- **PowerShell**: `$algo:` se lee como una unidad → usar `${algo}:`. No existe `<<<`.
  Evitar `-split` con comillas escapadas dentro de una misma línea. Para mensajes de
  commit largos: **escribir el mensaje en un archivo y usar `git commit -F`** (con
  `-m` y texto multilínea se rompe y acaba interpretando palabras como archivos).
  `Invoke-WebRequest` necesita `-UseBasicParsing`.
- **Caché del navegador**: es el primer sospechoso cuando «dejó de funcionar» algo que
  funcionaba. `Ctrl+Shift+R` o ventana de incógnito.
- **El puerto 3000 puede tener instancias colgando**: comprobar con `netstat -ano`
  antes de arrancar otra, o se pelean.
- **La herramienta de subagentes** es útil para trabajos grandes, pero conviene darle
  encargos **pequeños y de un solo tema**: cuando se le piden tres cosas a la vez, o
  cuando la sesión lleva mucho rato, falla sin avisar. Un encargo por subagente.

## Decisiones ya tomadas (no las deshagas sin hablar con la persona)

- **La presidencia no se borra ni se desactiva: se transmite** (el saliente queda como
  suplente y conserva las capacidades).
- **Instituciones**: PENDIENTE, APROBADA, RECHAZADA y VETADA, con motivo y autor; el
  registro **busca antes de crear** para no duplicar; el borrado definitivo lo
  **autoriza la presidencia** (la secretaría lo pide).
- **Permisos por capacidades** (`backend/src/common/capacidades.ts` + `@Requiere`), no
  comparando el rol. La interfaz **oculta** lo que el rol no puede hacer.
- **El diseño del certificado se hace FUERA** de la aplicación; la app solo estampa
  tres datos dinámicos: **nombre, folio y QR**, con **autoajuste del nombre**. Los
  certificados emitidos son **inmutables** y se guardan con su hash.
- **La verificación pública** (`/verificar/:folio?c=...`) exige un **código derivado
  por HMAC** del folio: el folio solo no revela nada, para que no se puedan enumerar
  certificados.
- **Solicitudes de clase espejo**: el destino **solo se entera cuando el origen
  aprueba** (ni en la lista ni por identificador directo).
- **Calendario**: se entrega un **`.ics`** y son los calendarios de cada persona
  quienes avisan (1 hora, 30 y 15 minutos). Las horas en **UTC** para respetar la
  zona de cada país.
- **Temas de la CACE**: lista cerrada, con el contraste medido en todos. No se inventan
  colores nuevos sin medirlos.
- **Contraseñas (Fase 1)**: mínimo 10 caracteres, distintas del correo y sin un
  carácter repetido; 5 intentos fallidos bloquean la cuenta 15 minutos. Cambiar o
  restablecer la contraseña **cierra las sesiones** (`sesionesValidasDesde`), así
  que el frontend manda volver a entrar.
- **Recuperación de contraseña**: enlace de un solo uso que caduca en 1 hora; en la
  base solo se guarda el **hash** del token y la respuesta no revela si la cuenta
  existe. Las pantallas son `/recuperar` y `/restablecer`.
- **Verificación de correo**: las cuentas nuevas no entran (login 403) hasta abrir
  el enlace de `/confirmar-correo` (48 h); el cambio de correo también se confirma
  en la dirección nueva. Los enlaces guardan solo el hash y son de un solo uso.

## Dónde está cada cosa

- `backend/src`: módulos por área (`auth`, `usuarios`, `agentes`, `instituciones`,
  `solicitudes`, `proyectos`, `certificados`, `cace`, `recordatorios`).
- `backend/prisma/schema.prisma`: el modelo (34 tablas, 26 migraciones).
- `frontend/src/app/features`: pantallas; `core/` servicios, modelos y constantes;
  `shared/` componentes reutilizables (layout, modal, guía, carrusel).
- `docs/`: `producto/` (plan y diagramas), `guias/` (usuario, despliegue, respaldo,
  diseño del certificado), `tesis/` (informe y memoria), `auditorias/`, `plantillas/`,
  `capturas/`. El índice está en `docs/README.md`.
- `backend/scripts/`: guiones de verificación (navegador, capturas, contraste) y
  utilidades. Los que se usan no se borran.