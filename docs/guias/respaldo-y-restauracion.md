# Respaldo y restauración de la base de datos

**Base de datos de trabajo:** `ClasesconjuntasBD`
**Base de datos de respaldo vigente:** `clasesconjuntas_respaldo_20261013`
**Fecha del respaldo:** 13 de octubre de 2026
**Respaldo anterior:** `clasesconjuntas_respaldo_20261010` — **ya no existe: se borró**

> Este documento explica qué hay respaldado, cómo se hizo la copia y, sobre todo,
> **cómo devolver la base a su estado original** paso a paso, sin necesidad de
> ayuda.

---

## 1. Qué hay hoy

1. El respaldo vigente es **`clasesconjuntas_respaldo_20261013`**: una **copia
   exacta del estado actual** de `ClasesconjuntasBD`, hecha con PostgreSQL.
2. La copia se creó **con la base de trabajo en reposo** (backend detenido), que
   es la única forma de que `CREATE DATABASE … WITH TEMPLATE` funcione.
3. El respaldo anterior (`clasesconjuntas_respaldo_20261010`) **se ha borrado**:
   describía un estado que ya no es el actual, y mantener dos copias con nombres
   parecidos solo invita a restaurar la equivocada.
4. **La base de respaldo no se toca** desde que se creó: no se le apunta la
   aplicación ni se trabaja sobre ella.

El respaldo es una **copia entera de la base** (no un volcado de texto), hecha con
PostgreSQL a través de la instrucción:

```sql
CREATE DATABASE "clasesconjuntas_respaldo_20261013" WITH TEMPLATE "ClasesconjuntasBD";
```

---

## 2. La regla que hay que respetar: parar el servidor

**PostgreSQL no copia una base que tenga conexiones abiertas.** Mientras el
backend esté corriendo (o cualquier otra herramienta tenga una sesión abierta
contra `ClasesconjuntasBD`), la instrucción falla con:

```text
ERROR:  source database "ClasesconjuntasBD" is being accessed by other users
DETAIL: There is 1 other session using the database.
```

Antes de copiar, por tanto:

1. **Para el backend** (el del puerto 3000 y cualquier servidor de pruebas o
   
pm run start:dev` que esté levantado).
2. **Cierra Prisma Studio** (
px prisma studio`), pgAdmin, DBeaver o cualquier
   consola SQL que esté conectada a la base de trabajo.
3. Comprueba que no queda ninguna conexión:

   ```sql
   -- Conectado a la base "postgres", NO a ClasesconjuntasBD.
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'ClasesconjuntasBD';
   ```

   Tiene que dar `0`. Si no, la copia fallará.

Y una segunda regla, igual de importante: **`CREATE DATABASE` no puede ir dentro de
una transacción**, así que hay que ejecutarlo conectado a **otra** base (por
ejemplo `postgres`), nunca a la que se está copiando.

---

## 3. Cómo comprobar que el respaldo sirve

Un respaldo que no se ha probado no es un respaldo. La comprobación es comparar
**el respaldo y la base de trabajo**, tabla por tabla, en dos cosas:

* **Número de filas** de cada tabla.
* **Huella del contenido** (`md5` de todas las filas), para asegurar que no solo
  coincide la cantidad, sino **el contenido exacto**.

El esquema tiene **35 tablas** (`backend/prisma/schema.prisma`, 35 modelos con su
`@@map`), así que la base tiene esas **35 tablas de datos más `_prisma_migrations`**
(la tabla interna de Prisma).

> **A propósito no se dejan escritos aquí los conteos de filas del estado actual:**
> cambian en cuanto alguien usa la aplicación (una solicitud nueva, una clase
> cerrada, un certificado emitido). Un número fijo en esta página envejecería mal.
> Compruébalos con el script, que siempre dice la verdad del momento.

### Script para contar y comparar (opcional, pero recomendado)

`psql` y `pg_dump` **no están en el PATH** de este equipo, así que lo más cómodo es
un pequeño script de Node: el cliente de Prisma ya está instalado.

Crea `backend/scripts/comparar-respaldo.js` con este contenido:

```js
// Compara la base de trabajo con el respaldo: filas y huella de contenido.
// Uso:  node scripts/comparar-respaldo.js
//
// Se abren DOS conexiones (una por base) porque PostgreSQL no permite consultar
// dos bases en la misma consulta: cada cuenta se pide a su propia conexión.
require('dotenv').config();
const { PrismaClient } = require('../dist/generated/prisma/client');

const HOST = 'postgresql://postgres:root@localhost:5432';
const BD_TRABAJO = 'ClasesconjuntasBD';
const BD_RESPALDO = 'clasesconjuntas_respaldo_20261013';

// Las 35 tablas del esquema, más la de Prisma.
const TABLAS = [
  'INSTITUCION', 'USUARIO', 'INVITACION', 'AGENTE_INTERNACIONALIZACION', 'DOCENTE',
  'DOCENTE_INSTITUCION', 'MATERIA', 'ASIGNACION_DOCENTE', 'SOLICITUD_CLASE_ESPEJO',
  'REVISION_SOLICITUD', 'PROYECTO_CLASE_ESPEJO', 'PROYECTO_DOCENTE', 'MENSAJE',
  'PLANIFICACION_CONJUNTA', 'PARTICIPACION_PLANIFICACION', 'REPORTE_PLANIFICACION',
  'SESION', 'ACTIVIDAD', 'REPORTE_CLASE_CONJUNTA', 'PARTICIPACION_REPORTE',
  'EVIDENCIA', 'EVALUACION', 'LISTA_ALUMNOS', 'ALUMNO', 'MIEMBRO_CACE',
  'CONFIGURACION_CACE', 'PAIS_COMUNIDAD', 'PREMIO', 'PLANTILLA_CERTIFICADO',
  'CERTIFICADO', 'SOLICITUD_BORRADO_INSTITUCION', 'CAMBIO_PRESIDENCIA',
  '_prisma_migrations',
];

function cliente(bd) {
  return new PrismaClient({
    datasources: { db: { url: `${HOST}/${bd}?schema=public` } },
  });
}

async function main() {
  const trabajo = cliente(BD_TRABAJO);
  const respaldo = cliente(BD_RESPALDO);
  let diferencias = 0;

  for (const t of TABLAS) {
    // Una consulta por base: no se pueden cruzar dos bases en la misma.
    const resumen = async (p) =>
      (
        await p.$queryRawUnsafe(
          `SELECT count(*)::int AS filas,
                  coalesce(md5(string_agg(x::text, '' ORDER BY x::text)), '') AS huella
             FROM "${t}" x`,
        )
      )[0];

    const [a, b] = await Promise.all([resumen(trabajo), resumen(respaldo)]);
    const igual = a.filas === b.filas && a.huella === b.huella;
    if (!igual) diferencias += 1;
    console.log(
      `${igual ? 'OK  ' : 'DIFF'} ${t.padEnd(32)} trabajo=${a.filas}/${a.huella.slice(0, 8)}  respaldo=${b.filas}/${b.huella.slice(0, 8)}`,
    );
  }

  console.log(
    diferencias === 0
      ? '\nTodas las tablas coinciden en filas y en contenido.'
      : `\n${diferencias} tabla(s) con diferencias: el respaldo y la base de trabajo no son el mismo estado.`,
  );
  await trabajo.$disconnect();
  await respaldo.$disconnect();
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
```

La **huella** es el `md5` de todas las filas de la tabla puestas en orden: sirve
para detectar que, con el mismo número de filas, el contenido cambió.

Ejecútalo desde la carpeta `backend`:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo\backend
node scripts/comparar-respaldo.js
```

---

## 4. Cómo restaurar el respaldo (devolver la base a como estaba)

### Antes de empezar

1. **Para el backend** (el servidor del puerto 3000 y cualquier servidor de
   pruebas) y cierra cualquier herramienta con una sesión abierta. Si hay
   conexiones abiertas a `ClasesconjuntasBD`, PostgreSQL no dejará renombrarla ni
   borrarla.
2. **No apuntes nunca la aplicación a la base de respaldo** para trabajar con
   ella: la aplicación escribe, y estropearías el respaldo. Lo correcto es
   **traer el respaldo encima de `ClasesconjuntasBD`**.

### Opción A (recomendada): renombrar la actual y crear una nueva desde la plantilla

Esto **no borra nada**: la base actual se guarda con otro nombre.

```sql
-- Conectado a la base "postgres", NO a ClasesconjuntasBD.
ALTER DATABASE "ClasesconjuntasBD" RENAME TO "ClasesconjuntasBD_antes_de_restaurar";
CREATE DATABASE "ClasesconjuntasBD" WITH TEMPLATE "clasesconjuntas_respaldo_20261013";
```

Cuando compruebes que todo está bien, puedes borrar la intermedia:

```sql
DROP DATABASE "ClasesconjuntasBD_antes_de_restaurar";
```

### Opción B: borrar la actual y recrearla desde la plantilla

```sql
-- Conectado a la base "postgres".
DROP DATABASE "ClasesconjuntasBD" WITH (FORCE);
CREATE DATABASE "ClasesconjuntasBD" WITH TEMPLATE "clasesconjuntas_respaldo_20261013";
```

`WITH (FORCE)` exige PostgreSQL 13 o superior; cierra las conexiones abiertas.

### Cómo ejecutar esto si no tienes `psql` en el PATH

`psql` y `pg_dump` **no están en el PATH** de este equipo. La forma más cómoda es
un pequeño script de Node, porque el cliente de Prisma ya está instalado.

Crea el archivo `backend/scripts/restaurar.js` con este contenido:

```js
// Restaura la base de trabajo desde el respaldo.
// Uso:  node scripts/restaurar.js            (solo comprueba, no cambia nada)
//       node scripts/restaurar.js --restaurar (hace la restauración)
require('dotenv').config();
const { PrismaClient } = require('../dist/generated/prisma/client');

const RESPALDO = 'clasesconjuntas_respaldo_20261013';
const TRABAJO = 'ClasesconjuntasBD';
const INTERMEDIA = 'ClasesconjuntasBD_antes_de_restaurar';
const admin = 'postgresql://postgres:root@localhost:5432/postgres?schema=public';

async function main() {
  const p = new PrismaClient({ datasources: { db: { url: admin } } });
  const aplicar = process.argv.includes('--restaurar');

  const existe = async (n) =>
    (await p.$queryRawUnsafe('SELECT 1 FROM pg_database WHERE datname = $1', n)).length > 0;
  const conexiones = async (n) =>
    (await p.$queryRawUnsafe('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1', n))[0].n;

  if (!(await existe(RESPALDO))) throw new Error(`No existe la base de respaldo ${RESPALDO}`);

  const abiertas = await conexiones(TRABAJO);
  console.log(`Conexiones abiertas a ${TRABAJO}: ${abiertas}`);
  if (!aplicar) {
    console.log('Comprobación hecha. Añade --restaurar para ejecutar la restauración.');
    await p.$disconnect();
    return;
  }
  if (abiertas > 0) throw new Error('Para el backend primero: hay conexiones abiertas.');
  if (await existe(INTERMEDIA)) throw new Error(`Ya existe ${INTERMEDIA}: revísala antes de continuar.`);

  // Sin transacción: CREATE DATABASE no puede ir dentro de una.
  await p.$executeRawUnsafe(`ALTER DATABASE "${TRABAJO}" RENAME TO "${INTERMEDIA}"`);
  console.log(`Renombrada ${TRABAJO} -> ${INTERMEDIA}`);
  await p.$executeRawUnsafe(`CREATE DATABASE "${TRABAJO}" WITH TEMPLATE "${RESPALDO}"`);
  console.log(`Creada ${TRABAJO} desde ${RESPALDO}. Listo.`);
  await p.$disconnect();
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
```

Ejecútalo desde la carpeta `backend`:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo\backend
node scripts/restaurar.js               # comprueba, no cambia nada
node scripts/restaurar.js --restaurar   # restaura de verdad
```

> La contraseña `root` y el usuario `postgres` están escritos en el script porque
> son los de este equipo (los mismos de `backend/.env`). Si algún día cambian,
> hay que actualizarlos en la variable `admin`.

### Alternativa sin scripts

Abre **pgAdmin** o **DBeaver**, conéctate al servidor `localhost:5432` con el
usuario `postgres`, abre una consola SQL **sobre la base `postgres`** y pega una
de las dos opciones (A o B) de arriba.

---

## 5. Cómo comprobar que la restauración fue bien

1. **Cuenta las filas** de las 35 tablas del respaldo restaurado con el script de
   la sección 3 (
ode scripts/comparar-respaldo.js`): ahora `trabajo` y `respaldo`
   tienen que coincidir **tabla por tabla**.
2. **Aplica las migraciones** por si acaso, que no debería hacer nada:

   ```bash
   npx prisma migrate status
   npx prisma migrate deploy
   ```

   El respaldo ya trae las **21 migraciones** aplicadas, así que `migrate deploy`
   no debe tener nada pendiente.
3. **Arranca el backend** y entra con una cuenta conocida. Con los datos de
   demostración, la contraseña común es `Demo1234`.
4. Comprueba las dos cosas que más duelen si faltan: **una clase espejo con su
   planificación y sus sesiones**, y **un certificado emitido** que se pueda
   verificar en `/verificar/<folio>?c=<código>`.

---

## 6. Avisos

* **No borres ni modifiques `clasesconjuntas_respaldo_20261013`.** Es la copia del
  estado actual. Si necesitas trabajar con esos datos, **restaura** sobre
  `ClasesconjuntasBD`; no trabajes sobre el respaldo.
* **El respaldo anterior (`clasesconjuntas_respaldo_20261010`) ya no existe.** Si
  algún documento antiguo lo menciona, está desactualizado.
* Recuerda: **para copiar hay que parar el servidor.** PostgreSQL no copia una
  base con conexiones abiertas, y `CREATE DATABASE … WITH TEMPLATE` no puede ir
  dentro de una transacción.
* `backend/.env` sigue apuntando a `ClasesconjuntasBD`; el nombre de la base de
  trabajo no ha cambiado, así que la aplicación no necesita ninguna configuración
  nueva.
* La aplicación, al arrancar, revisa los vencimientos de las solicitudes y la
  agenda. Con los datos que queden en la base eso no cambia el contenido más allá
  de pasar a *Caducada* alguna solicitud que ya estuviera fuera de plazo.
