# Respaldo y restauración de la base de datos

**Fecha del respaldo:** 10 de octubre de 2026
**Base de datos de trabajo:** `ClasesconjuntasBD`
**Base de datos de respaldo:** `clasesconjuntas_respaldo_20261010`

> Este documento explica qué se hizo, cómo se comprobó y, sobre todo, **cómo
> devolver la base a su estado original** paso a paso, sin necesidad de ayuda.

---

## 1. Qué se hizo

1. **Se hizo una copia completa** de `ClasesconjuntasBD` antes de tocar nada.
2. **Se verificó la copia** comparando todas las tablas de las dos bases.
3. Solo entonces se borraron datos, dejando un conjunto pequeño para las pruebas.
4. **La base de respaldo no se ha vuelto a tocar** desde que se creó.

El respaldo es una **copia entera de la base** (no un volcado de texto), hecha con
PostgreSQL a través de la instrucción:

```sql
CREATE DATABASE "clasesconjuntas_respaldo_20261010" WITH TEMPLATE "ClasesconjuntasBD";
```

Esta instrucción **tiene que ejecutarse conectado a otra base** (por ejemplo
`postgres`), porque PostgreSQL no permite copiar una base con conexiones
abiertas y porque `CREATE DATABASE` no puede ir dentro de una transacción.

---

## 2. Cómo se comprobó que el respaldo sirve

Se compararon **las 25 tablas** de la base original y del respaldo, dos veces por
tabla:

* **Número de filas** de cada tabla.
* **Huella del contenido** (`md5` de todas las filas de la tabla), para
  asegurar que no solo coincidía la cantidad, sino **el contenido exacto**.

Resultado: **las 25 tablas coincidieron en filas y en contenido**. También
coincide el número de tablas del esquema (`26`, que son las 25 tablas de datos
más la tabla interna `_prisma_migrations`).

| Tabla | Filas en el respaldo |
|---|---|
| INSTITUCION | 3 |
| USUARIO | 19 |
| INVITACION | 2 |
| AGENTE_INTERNACIONALIZACION | 3 |
| DOCENTE | 15 |
| DOCENTE_INSTITUCION | 15 |
| MATERIA | 11 |
| ASIGNACION_DOCENTE | 15 |
| SOLICITUD_CLASE_ESPEJO | 19 |
| REVISION_SOLICITUD | 25 |
| PROYECTO_CLASE_ESPEJO | 10 |
| PROYECTO_DOCENTE | 25 |
| MENSAJE | 5 |
| PLANIFICACION_CONJUNTA | 9 |
| PARTICIPACION_PLANIFICACION | 23 |
| REPORTE_PLANIFICACION | 3 |
| SESION | 17 |
| ACTIVIDAD | 14 |
| REPORTE_CLASE_CONJUNTA | 11 |
| PARTICIPACION_REPORTE | 22 |
| EVIDENCIA | 8 |
| EVALUACION | 4 |
| LISTA_ALUMNOS | 0 |
| ALUMNO | 0 |
| MIEMBRO_CACE | 1 |

---

## 3. Qué quedó en la base después de la limpieza

Se conservó un conjunto mínimo:

| Tabla | Antes | Después |
|---|---|---|
| INSTITUCION | 3 | **2** |
| USUARIO | 19 | **5** |
| INVITACION | 2 | **0** |
| AGENTE_INTERNACIONALIZACION | 3 | **2** |
| DOCENTE | 15 | **2** |
| DOCENTE_INSTITUCION | 15 | **2** |
| MATERIA | 11 | **2** |
| ASIGNACION_DOCENTE | 15 | **2** |
| SOLICITUD_CLASE_ESPEJO | 19 | **2** |
| REVISION_SOLICITUD | 25 | **4** |
| PROYECTO_CLASE_ESPEJO | 10 | **2** |
| PROYECTO_DOCENTE | 25 | **4** |
| MENSAJE | 5 | **0** |
| PLANIFICACION_CONJUNTA | 9 | **2** |
| PARTICIPACION_PLANIFICACION | 23 | **4** |
| REPORTE_PLANIFICACION | 3 | **2** |
| SESION | 17 | **3** |
| ACTIVIDAD | 14 | **3** |
| REPORTE_CLASE_CONJUNTA | 11 | **3** |
| PARTICIPACION_REPORTE | 22 | **6** |
| EVIDENCIA | 8 | **2** |
| EVALUACION | 4 | **2** |
| LISTA_ALUMNOS | 0 | **0** |
| ALUMNO | 0 | **0** |
| MIEMBRO_CACE | 1 | **1** |

### Lo que se conservó, con nombre y apellidos

**Instituciones**
* `id 14` — Instituto Tecnológico Superior de Calkiní (México)
* `id 15` — Universidad Nacional de Colombia (Colombia)

**Agentes** (uno por institución)
* `usuario 43` — María Fernanda López Hernández · `agente.calkini@clasesespejo.mx` (Calkiní)
* `usuario 44` — Juan Carlos Ramírez Torres · `agente.colombia@clasesespejo.co` (Colombia)

**Docentes** (uno por institución)
* `usuario 46` — Sofía Gómez Ruiz · `sofia.gomez@clasesespejo.mx` (Calkiní, docente 31)
* `usuario 56` — Isabella Cárdenas Uribe · `isabella.cardenas@clasesespejo.co` (Colombia, docente 41)

**Presidencia de la CACE**
* `usuario 63` — Presidente CACE · `antiniosotobeh@gmail.com` · `MIEMBRO_CACE 3` (cargo `PRESIDENTE`)

**Clases espejo**
* `proyecto 17` (solicitud 37) — «Clase espejo: Calidad y Pruebas de Software» ·
  FINALIZADO · Sofía Gómez (ORIGEN) ↔ Isabella Cárdenas (DESTINO) ·
  3 sesiones, 3 reportes de clase, 6 participaciones, 3 actividades,
  2 evidencias, 2 evaluaciones y planificación aprobada con reporte.
* `proyecto 24` (solicitud 50) — «Clase espejo: Metodologías Ágiles de Software» ·
  EN_PLANIFICACION · Sofía Gómez (ORIGEN) ↔ Isabella Cárdenas (DESTINO) ·
  planificación con 2 participaciones y su reporte.

**Ajuste mínimo que hubo que hacer** (queda dicho por transparencia): la
solicitud 50 tenía como docente de origen una asignación del docente Roberto
Pérez (que no se conserva). Como la clase espejo 24 ya declaraba a Sofía Gómez
como docente **ORIGEN**, se reapuntó la solicitud a la asignación de Sofía
(`asignacion_origen_id`: 33 → 34). Es el único dato que se modificó en vez de
borrarse. Todo lo demás que desapareció eran dependencias de entidades no
conservadas.

---

## 4. Cómo restaurar el respaldo (devolver la base a como estaba)

### Antes de empezar

1. **Para el backend** (el servidor del puerto 3000 y cualquier servidor de
   pruebas). Si hay conexiones abiertas a `ClasesconjuntasBD`, PostgreSQL no
   dejará renombrarla ni borrarla.
2. **No apuntes nunca la aplicación a la base de respaldo** para trabajar con
   ella: la aplicación escribe, y estropearías el respaldo. Lo correcto es
   **traer el respaldo encima de `ClasesconjuntasBD`**.

### Opción A (recomendada): renombrar la actual y crear una nueva desde la plantilla

Esto **no borra nada**: la base actual se guarda con otro nombre.

```sql
-- Conectado a la base "postgres", NO a ClasesconjuntasBD.
ALTER DATABASE "ClasesconjuntasBD" RENAME TO "ClasesconjuntasBD_antes_de_restaurar";
CREATE DATABASE "ClasesconjuntasBD" WITH TEMPLATE "clasesconjuntas_respaldo_20261010";
```

Cuando compruebes que todo está bien, puedes borrar la intermedia:

```sql
DROP DATABASE "ClasesconjuntasBD_antes_de_restaurar";
```

### Opción B: borrar la actual y recrearla desde la plantilla

```sql
-- Conectado a la base "postgres".
DROP DATABASE "ClasesconjuntasBD" WITH (FORCE);
CREATE DATABASE "ClasesconjuntasBD" WITH TEMPLATE "clasesconjuntas_respaldo_20261010";
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

const RESPALDO = 'clasesconjuntas_respaldo_20261010';
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

Después de restaurar, la base debe volver a tener **3 instituciones, 19 usuarios,
10 clases espejo, 25 filas en `PROYECTO_DOCENTE`**, etc. (columna «Antes» de la
tabla de la sección 3).

Puedes comprobarlo con este script (guárdalo como `backend/scripts/contar.js`):

```js
require('dotenv').config();
const { PrismaClient } = require('../dist/generated/prisma/client');

const TABLAS = [
  'INSTITUCION', 'USUARIO', 'INVITACION', 'AGENTE_INTERNACIONALIZACION', 'DOCENTE',
  'DOCENTE_INSTITUCION', 'MATERIA', 'ASIGNACION_DOCENTE', 'SOLICITUD_CLASE_ESPEJO',
  'REVISION_SOLICITUD', 'PROYECTO_CLASE_ESPEJO', 'PROYECTO_DOCENTE', 'MENSAJE',
  'PLANIFICACION_CONJUNTA', 'PARTICIPACION_PLANIFICACION', 'REPORTE_PLANIFICACION',
  'SESION', 'ACTIVIDAD', 'REPORTE_CLASE_CONJUNTA', 'PARTICIPACION_REPORTE',
  'EVIDENCIA', 'EVALUACION', 'LISTA_ALUMNOS', 'ALUMNO', 'MIEMBRO_CACE',
];

async function main() {
  const p = new PrismaClient();
  for (const t of TABLAS) {
    const [r] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    console.log(t.padEnd(30), r.n);
  }
  await p.$disconnect();
}
main();
```

Como último paso, arranca el backend y entra con las cuentas de demostración
(`Demo1234`) y con la del presidente (`CaceDemo2026`).

---

## 6. Avisos

* **No borres ni modifiques `clasesconjuntas_respaldo_20261010`.** Es la única
  copia del estado original. Si necesitas trabajar con esos datos, **restaura**
  sobre `ClasesconjuntasBD`, no trabajes sobre el respaldo.
* `backend/.env` sigue apuntando a `ClasesconjuntasBD`; el nombre de la base de
  trabajo no ha cambiado, así que la aplicación no necesita ninguna
  configuración nueva.
* En la copia original **no había ninguna lista de alumnos ni ningún alumno**
  (`LISTA_ALUMNOS` y `ALUMNO` estaban a 0), así que tampoco hay nada de eso
  ahora.
* La aplicación, al arrancar, revisa si hay solicitudes vencidas y si alguna
  solicitud aprobada se quedó sin clase espejo. Con los datos que quedan eso no
  cambia nada (se comprobó: los conteos no se movieron).
