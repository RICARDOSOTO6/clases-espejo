# Ramas para el piloto y para el sprint

**Proyecto:** Clases Conjuntas  
**Fecha:** 28 de octubre de 2026  
**Objetivo:** dejar una copia intocable de lo que ya está listo para el piloto y trabajar
los pendientes en otra rama sin ponerla en riesgo.

---

## 0. Idea en una frase

```text
release/piloto-2026-10-27  →  no se toca; es lo que se usa si el tiempo no alcanza
sprint/post-evaluacion     →  aquí se trabaja
master                     →  solo recibe el sprint cuando esté probado
```

La etiqueta `demo-local-2026-10-27` y el ZIP
`ClasesEspejo-entrega-2026-10-27.zip` son la red de seguridad. Una rama no
sustituye esa red: la complementa.

---

## 1. Estado actual del repositorio

| Elemento | Valor |
| --- | --- |
| Rama actual | `master` |
| Último commit de código | `dc0fb71` |
| Etiqueta del piloto | `demo-local-2026-10-27` |
| Commit de la etiqueta | `128e321` |
| Paquete del piloto | `release/ClasesEspejo-entrega-2026-10-27.zip` |
| SHA-256 | `DC534D292051F2669EF28DC99244E85950A8DA8044E6FE9058C73840AC04575D` |

Después de la etiqueta, `master` solo tiene commits de documentación (incluida
esta guía). El código es el mismo que el del piloto. Eso es importante: la rama
de sprint puede partir de `master` sin arrastrar cambios de código no probados.

Para saber el commit exacto de `master` antes de crear la rama:

```powershell
git rev-parse --short master
```

---

## 2. Antes de crear nada

### 2.1 Comprobar que no hay cambios sin guardar

Desde la carpeta del proyecto:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git status --short
git log --oneline --decorate -5
```

Los únicos archivos sin seguimiento deberían ser los documentos personales que
no forman parte del paquete:

```text
backend/scripts/_capturas/
docs/producto/diagramas/svg.zip
docs/tesis/
```

No los agregues a Git por accidente.

Si aparecen cambios en `backend/`, `frontend/`, `prisma/` o `scripts/` que no
quieres perder, haz un commit o guárdalos antes de seguir.

### 2.2 Confirmar la etiqueta

```powershell
git show -s --format='%H %s' demo-local-2026-10-27
```

Debe mostrar `128e321` y el mensaje de cierre de L6.

### 2.3 Confirmar el paquete

```powershell
Get-ChildItem release\ClasesEspejo-entrega-2026-10-27.zip*
Get-Content release\ClasesEspejo-entrega-2026-10-27.zip.sha256
```

No regeneres este ZIP durante el trabajo del sprint. Se queda como está.

### 2.4 Tener un respaldo de la base

El piloto usa una base. El sprint debe usar otra. Antes de tocar cualquiera:

```powershell
# Desde una terminal con PostgreSQL disponible
$env:PGPASSWORD='root'
& 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe' `
  -h localhost -U postgres -Fc -d ClasesconjuntasBD `
  -f C:\Users\ricar\Documents\ClasesEspejo\release\l6\antes-de-ramas-2026-10-28.dump
```

Ese respaldo es local; no lo subas a Git.

---

## 3. Crear la rama del piloto

La rama del piloto sale de la **etiqueta**, no de `master`:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git branch release/piloto-2026-10-27 demo-local-2026-10-27
```

Comprobar:

```powershell
git branch --list "release/*"
git log -1 --oneline release/piloto-2026-10-27
```

Debe apuntar a `128e321`.

> Esta rama no se modifica durante el sprint. Si hay que hacer una corrección
> urgente, se hace en una rama `hotfix/...` aparte y se prueba antes de tocar
> `release/piloto-2026-10-27`.

---

## 4. Crear la rama de trabajo

La rama de trabajo sale de `master`, para incluir la guía de Ubuntu y el sprint
consolidado:

```powershell
git branch sprint/post-evaluacion-2026-10-28 master
git branch --list "sprint/*"
git log -1 --oneline sprint/post-evaluacion-2026-10-28
```

Debe apuntar al mismo commit que `master` en ese momento (`git rev-parse
--short master`). No importa que el hash exacto cambie con la documentación; lo
que importa es que no incluya código del sprint.

---

## 5. Trabajar en dos carpetas separadas (recomendado)

Puedes cambiar de rama en la misma carpeta, pero es más seguro tener dos
worktrees: una para el piloto y otra para el sprint.

### 5.1 Crear los dos árboles

Desde `C:\Users\ricar\Documents\ClasesEspejo`:

```powershell
git worktree add ..\ClasesEspejo-piloto release/piloto-2026-10-27
git worktree add ..\ClasesEspejo-sprint sprint/post-evaluacion-2026-10-28
```

Quedan:

```text
C:\Users\ricar\Documents\ClasesEspejo          → master (documentación)
C:\Users\ricar\Documents\ClasesEspejo-piloto   → release/piloto-2026-10-27
C:\Users\ricar\Documents\ClasesEspejo-sprint   → sprint/post-evaluacion-2026-10-28
```

Comprobar:

```powershell
git worktree list
```

### 5.2 ¿Qué se hace en cada una?

| Carpeta | Rama | Uso |
| --- | --- | --- |
| `ClasesEspejo-piloto` | `release/piloto-2026-10-27` | Ensayo del piloto, servidor estable, paquete congelado |
| `ClasesEspejo-sprint` | `sprint/post-evaluacion-2026-10-28` | Pendientes, pruebas, migraciones nuevas |
| `ClasesEspejo` | `master` | Documentación y fusión final |

El worktree comparte el `.git`, pero **no** comparte `node_modules`, `.env`,
`uploads` ni la base de datos. Cada carpeta necesita su propia instalación si
vas a ejecutar código.

### 5.3 Si prefieres no usar worktrees

También funciona:

```powershell
git switch release/piloto-2026-10-27   # modo piloto
# ...
git switch sprint/post-evaluacion-2026-10-28  # modo sprint
# ...
git switch master                       # fusión
```

Pero entonces debes detener el servidor antes de cambiar de rama y recordar qué
carpeta estás usando. Los worktrees evitan esa confusión.

---

## 6. Preparar la base y el `.env` del sprint

Nunca apuntes el sprint a la base del piloto.

### 6.1 Crear una base separada

```powershell
$env:PGPASSWORD='root'
& 'C:\Program Files\PostgreSQL\17\bin\createdb.exe' `
  -h localhost -U postgres -O clasesespejo ClasesconjuntasBD_sprint
```

Si prefieres partir de los datos actuales:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' `
  -h localhost -U postgres `
  -d ClasesconjuntasBD_sprint `
  --no-owner --no-privileges `
  C:\Users\ricar\Documents\ClasesEspejo\release\l6\ClasesconjuntasBD-2026-10-27.dump
```

Para una instalación limpia, usa `createdb` y luego las migraciones.

### 6.2 Copiar `.env` solo dentro del worktree del sprint

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint\backend
Copy-Item C:\Users\ricar\Documents\ClasesEspejo\backend\.env .env
```

Edita `.env` del sprint:

```env
DATABASE_URL="postgresql://clasesespejo:CONTRASENA@127.0.0.1:5432/ClasesconjuntasBD_sprint?schema=public"
PORT="3001"
URL_PUBLICA="http://localhost:3001"
FRONTEND_URL="http://localhost:3001"
```

El servidor del piloto puede seguir en `3000`; el del sprint usa `3001`.

### 6.3 Instalar dependencias en el worktree

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint\backend
npm ci
npx prisma generate
npx prisma migrate deploy
```

No copies `node_modules` entre worktrees. Cada uno debe tener su instalación.

### 6.4 Comprobar que la base del sprint es independiente

```powershell
$env:PGPASSWORD='CONTRASENA_DEL_USUARIO'
psql -h 127.0.0.1 -U clasesespejo -d ClasesconjuntasBD_sprint -c 'SELECT 1;'
```

Y comprueba que el piloto sigue apuntando a `ClasesconjuntasBD`:

```powershell
Get-Content C:\Users\ricar\Documents\ClasesEspejo-piloto\backend\.env |
  Select-String DATABASE_URL
```

Nunca ejecutes `prisma migrate deploy` del sprint contra `ClasesconjuntasBD`.

---

## 7. Flujo diario de trabajo

### 7.1 Antes de empezar

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint
git status
git log -1 --oneline
```

### 7.2 Durante el trabajo

Haz commits pequeños:

```powershell
git add backend/src/... frontend/src/...
git commit -m "Agrega prueba de aislamiento institucional"
```

No mezcles en un mismo commit:

- pruebas y migraciones;
- cambios de frontend y de documento;
- un arreglo urgente del piloto y una funcionalidad nueva.

### 7.3 Antes de cada commit

```powershell
git diff --check
git status --short
```

### 7.4 Pruebas mínimas

Backend:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint\backend
npm test
$env:DATABASE_URL='postgresql://postgres:root@localhost:5432/clasesconjuntasbd_test?schema=public'
npm run test:e2e
```

Frontend:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint\frontend
npx tsc -p tsconfig.app.json --noEmit
npx ngc -p tsconfig.app.json --noEmit
npx ng build
```

No hace falta ejecutar todo en cada commit, pero sí antes de fusionar.

### 7.5 Migraciones nuevas

Si el sprint cambia el esquema:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint\backend
npx prisma migrate dev --name nombre-corto
npx prisma migrate deploy
```

- La migración se prueba primero en `ClasesconjuntasBD_sprint`.
- Se versiona el archivo de `prisma/migrations/`.
- **No** se aplica a la base del piloto hasta que el sprint esté aprobado.
- La base del piloto conserva las 35 migraciones actuales.
- `migrate dev` puede necesitar crear una **base sombra**. Si falla, crea una
  base `ClasesconjuntasBD_sprint_shadow` y configura `SHADOW_DATABASE_URL`, o
  usa un rol de PostgreSQL con permiso `CREATEDB`. Hazlo solo en el sprint.
  Nunca ejecutes `migrate dev` contra la base del piloto.

---

## 8. Corrección urgente durante el piloto

Si el piloto está corriendo y hay que corregir algo:

1. No trabajes en `sprint/post-evaluacion`.
2. Crea una rama corta desde la etiqueta. Si usas worktrees, entra al árbol del
   piloto; si no, cambia de rama:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-piloto
# o, si no usas worktrees:
# cd C:\Users\ricar\Documents\ClasesEspejo
# git switch release/piloto-2026-10-27

git switch -c hotfix/piloto-2026-10-28
```

3. Haz solo el arreglo mínimo.
4. Prueba.
5. Fusiona el hotfix en la rama del piloto y crea una etiqueta nueva:

```powershell
git switch release/piloto-2026-10-27
git merge --no-ff hotfix/piloto-2026-10-28
git tag piloto-2026-10-28-hotfix
```

6. Solo si el arreglo también sirve para el sprint, llévalo al sprint desde el
   árbol del sprint:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint
git switch sprint/post-evaluacion-2026-10-28
git cherry-pick <commit-del-hotfix>
```

No fusiones todo el sprint en la rama del piloto por un arreglo urgente.

> Con worktrees, la rama `release/piloto-2026-10-27` está “ocupada” por el árbol
> del piloto. Por eso los comandos anteriores se ejecutan **dentro de ese árbol**,
> no desde `ClasesEspejo`.

---

## 9. Fusionar el sprint cuando esté listo

### 9.1 Actualizar el sprint con lo que haya en `master`

Antes de fusionar, integra los documentos nuevos que estén en `master`:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-sprint
git switch sprint/post-evaluacion-2026-10-28
git merge master
```

Si no hay cambios en `master` desde que creaste la rama, dirá que ya está al día.

### 9.2 Resolver conflictos

Si hay conflicto:

```powershell
git status
```

Abre los archivos marcados, resuelve y luego:

```powershell
git add archivo-resuelto
git commit
```

Reglas:

- no resuelvas un conflicto de `.env` con `--theirs` ni `--ours`; el `.env` no se versiona;
- no fusiones `uploads`;
- si el conflicto es de una migración, entiende el orden antes de continuar;
- si no estás seguro, detente y guarda el estado con `git status` y `git diff`.

### 9.3 Fusionar en `master`

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git switch master
git merge --no-ff sprint/post-evaluacion-2026-10-28
```

`--no-ff` conserva un commit de fusión y deja claro qué entró junto.

### 9.4 Verificar después de fusionar

```powershell
git log --oneline --graph -10
git status --short
```

Luego, en `master`:

```powershell
cd backend
npm ci
npx prisma generate
npm test
$env:DATABASE_URL='postgresql://postgres:root@localhost:5432/clasesconjuntasbd_test?schema=public'
npm run test:e2e

cd ..\frontend
npx tsc -p tsconfig.app.json --noEmit
npx ngc -p tsconfig.app.json --noEmit
npx ng build
```

No etiquetes ni generes paquete hasta que todo pase.

---

## 10. Etiqueta y paquete nuevos

Solo después de que la fusión esté probada:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git tag demo-local-2026-10-29
git tag --list
```

No muevas `demo-local-2026-10-27`: esa etiqueta es el piloto que ya funcionaba.

Genera un paquete nuevo con otro nombre:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\empaquetar-entrega.ps1
```

El script puede generar `ClasesEspejo-entrega-2026-10-29.zip`. Comprueba el SHA:

```powershell
Get-Content release\ClasesEspejo-entrega-2026-10-29.zip.sha256
```

No sobrescribas el ZIP del piloto. Si el script usara el mismo nombre, detente y
copia el anterior antes de continuar.

---

## 11. Si el tiempo no alcanza

No hay problema. El piloto no depende de la rama del sprint.

Para dejarlo listo:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-piloto
git status
git log -1 --oneline
```

Debe estar en `release/piloto-2026-10-27` o en la etiqueta. Usa el ZIP:

```text
release/ClasesEspejo-entrega-2026-10-27.zip
```

Y la base respaldada. El sprint puede quedarse en su rama, sin fusionar.

Lo importante:

- no se tocó la etiqueta;
- no se regeneró el ZIP del piloto;
- no se aplicaron migraciones del sprint a la base del piloto;
- el servidor del piloto no se actualizó desde el sprint.

---

## 12. Cómo volver atrás

### Código

Con worktrees, entra al árbol del piloto:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo-piloto
git switch release/piloto-2026-10-27
```

Sin worktrees:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git switch release/piloto-2026-10-27
```

O, si solo quieres mirar sin cambiar la rama de trabajo:

```powershell
git switch --detach demo-local-2026-10-27
```

### Base

La base no se revierte con Git. Se restaura desde un respaldo:

```powershell
$env:PGPASSWORD='root'
& 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' `
  -h localhost -U postgres `
  -d ClasesconjuntasBD `
  --clean --if-exists `
  C:\Users\ricar\Documents\ClasesEspejo\release\l6\ClasesconjuntasBD-2026-10-27.dump
```

> `--clean --if-exists` borra y recrea objetos de la base. Úsalo solo sobre una
> base de prueba o después de un respaldo. Nunca lo ejecutes contra la base real
> sin confirmar el respaldo.

### Paquete

Usa el ZIP y el SHA de L6. No dependas de una rama para recuperar el entregable.

---

## 13. Limpieza de los worktrees

Cuando ya no necesites el árbol del sprint y hayas fusionado:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git worktree remove ..\ClasesEspejo-sprint
git worktree list
```

No borres la rama `release/piloto-2026-10-27` hasta que el piloto haya terminado y
tengas un paquete/etiqueta posterior.

---

## 14. Reglas de oro

1. **La etiqueta no se mueve.**
2. **El ZIP del piloto no se sobrescribe.**
3. **La base del piloto no recibe migraciones del sprint.**
4. **El sprint no se fusiona hasta que pase pruebas y smoke.**
5. **Los documentos personales no se mezclan con los commits del sprint.**
6. **Si hay que corregir el piloto, se usa una rama `hotfix` desde la etiqueta.**
7. **Primero se prueba en la base del sprint; después se decide.**
8. **Si el tiempo no alcanza, se entrega lo congelado, no una rama a medias.**

---

## 15. Resumen de comandos

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git status --short

# Rama del piloto, desde la etiqueta
git branch release/piloto-2026-10-27 demo-local-2026-10-27

# Rama de trabajo, desde master
git branch sprint/post-evaluacion-2026-10-28 master

# Dos carpetas separadas
git worktree add ..\ClasesEspejo-piloto release/piloto-2026-10-27
git worktree add ..\ClasesEspejo-sprint sprint/post-evaluacion-2026-10-28
git worktree list

# Base separada para el sprint
$env:PGPASSWORD='root'
& 'C:\Program Files\PostgreSQL\17\bin\createdb.exe' `
  -h localhost -U postgres -O clasesespejo ClasesconjuntasBD_sprint

# Trabajo y pruebas en el sprint
cd ..\ClasesEspejo-sprint\backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm test
npm run test:e2e

# Fusión, cuando esté listo
cd C:\Users\ricar\Documents\ClasesEspejo
git switch master
git merge --no-ff sprint/post-evaluacion-2026-10-28

# Etiqueta y paquete nuevos, solo después de probar
git tag demo-local-2026-10-29
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\empaquetar-entrega.ps1
```
