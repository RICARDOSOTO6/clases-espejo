# Cobertura del backend

> **Medida el 29 de octubre de 2026** con `npm run test:cov`, en un Windows local
> (Node 24) contra la base `clasesconjuntasbd_test`. En el CI los números pueden
> moverse unas décimas; el informe de cada ejecución es el que manda.

## Qué mide y cómo

`npm run test:cov` ejecuta **unitarias y e2e en la misma pasada** (configuración
`backend/test/jest-cov.json`), de modo que la cifra no sale de las 53 pruebas
unitarias solas —que solo tocan funciones puras— sino también de los 175 casos
e2e que recorren la API de verdad contra PostgreSQL. Sin las e2e, el número
sería engañosamente bajo: servicios y controladores no tienen pruebas unitarias
porque se prueban de extremo a extremo.

- Quedan fuera de la cuenta los archivos de prueba (`*.spec.ts`), las
  declaraciones (`*.d.ts`, sin código ejecutable) y nada más.
- `backend/src/main.ts` **se cuenta**: es el arranque real y está al 0 % porque
  las pruebas construyen la aplicación con `Test.createTestingModule`, no con
  `NestFactory.create`.
- El cliente de Prisma (`backend/generated`) no está bajo `src/`, así que no
  entra: es código generado.

## La cifra

| Métrica | Cobertura |
| --- | ---: |
| Líneas | **68,04 %** (3 496 de 5 138) |
| Sentencias | **67,56 %** (3 755 de 5 558) |
| Funciones | **67,23 %** (632 de 940) |
| Ramas | **47,14 %** (1 510 de 3 203) |

Son 39 suites y **228 pruebas** (53 unitarias + 175 e2e) en 168,8 s. Con las 39
del frontend, el proyecto va por **267 casos**.

## Por carpeta

| Carpeta | Archivos | Líneas % | Ramas % | Funciones % |
| --- | ---: | ---: | ---: | ---: |
| `main.ts` | 1 | 0,0 | 0,0 | 0,0 |
| `mail` | 3 | 35,8 | 13,1 | 23,8 |
| `usuarios` | 4 | 57,5 | 32,5 | 28,6 |
| `cace` | 23 | 58,5 | 39,3 | 54,2 |
| `proyectos` | 27 | 59,1 | 40,0 | 63,5 |
| `recordatorios` | 4 | 62,2 | 33,3 | 46,9 |
| `agentes` | 7 | 63,6 | 42,9 | 56,8 |
| `asignaciones` | 4 | 64,9 | 46,2 | 45,5 |
| `certificados` | 18 | 69,4 | 43,6 | 66,4 |
| `materias` | 5 | 72,5 | 55,6 | 71,4 |
| `invitaciones-agente` | 4 | 80,2 | 58,9 | 70,6 |
| `instituciones` | 4 | 80,5 | 50,0 | 76,0 |
| `common` | 25 | 83,3 | 61,4 | 87,0 |
| `secretarias` | 6 | 83,3 | 59,6 | 87,5 |
| `auth` | 17 | 84,0 | 67,5 | 91,4 |
| `solicitudes` | 6 | 84,4 | 58,8 | 88,4 |
| `envios` | 4 | 88,7 | 70,5 | 91,7 |
| `desempeno` | 1 | 91,3 | 71,4 | 100,0 |

`app.module.ts`, `app.service.ts` y `prisma/` están al 100 % (son pocas líneas y
las toca cualquier suite). `app.controller.ts`, al 87,5 %.

## Qué queda sin cubrir y por qué

Los doce archivos con menos cobertura de líneas:

| Archivo | Líneas % | Líneas |
| --- | ---: | ---: |
| `src/main.ts` | 0 | 152 |
| `src/proyectos/resumen-pdf.service.ts` | 5,26 | 114 |
| `src/cace/presidencia-cace.service.ts` | 14,44 | 90 |
| `src/cace/solicitudes-borrado.service.ts` | 17,91 | 67 |
| `src/mail/mail.service.ts` | 20 | 40 |
| `src/proyectos/listas-alumnos.service.ts` | 23,07 | 208 |
| `src/common/imagenes.ts` | 28,78 | 66 |
| `src/certificados/plantillas.service.ts` | 29,62 | 54 |
| `src/cace/miembros-cace.service.ts` | 32,3 | 65 |
| `src/usuarios/usuarios.service.ts` | 43,47 | 46 |
| `src/asignaciones/asignaciones.service.ts` | 46,87 | 32 |
| `src/cace/identidad-cace.service.ts` | 47,41 | 116 |

Por bloques:

- **Arranque (`main.ts`).** No se ejecuta en las pruebas: `NestFactory.create`,
  el servido de `public` y `/uploads`, los filtros globales y `listen`.
- **Resumen en PDF (`resumen-pdf.service.ts`).** La ruta
  `/proyectos/:id/resumen-pdf` no tiene ningún caso e2e; el generador de PDF se
  ejercita solo indirectamente.
- **CACE (`presidencia-cace.service.ts`, `solicitudes-borrado.service.ts`,
  `miembros-cace.service.ts`).** Los caminos delicados —transferir la
  presidencia, borrar una institución con historia, altas y bajas de miembros—
  no están recorridos; las pruebas de CACE tocan aprobación, desempeño y
  capacidades.
- **Correo (`mail.service.ts`).** En las pruebas el `MailService` se sustituye
  por un doble, así que el envío SMTP real no se ejecuta nunca.
- **Listas de alumnos (`listas-alumnos.service.ts`).** Las pruebas suben la
  lista **pegada** (JSON); la lectura de archivo CSV o Excel, los avisos de
  filas y la previsualización no se recorren.
- **Imágenes (`common/imagenes.ts`).** La validación por firma se prueba para
  evidencias; los caminos de logo de institución, foto de premio y fondo del
  certificado que usan las mismas funciones no.
- **Plantillas del certificado (`plantillas.service.ts`).** El diseño, la subida
  de fondo y la comprobación del hueco del nombre se usan desde la interfaz, no
  desde una prueba.

## Lo que esta cifra no dice

- **No es una garantía.** Un 68 % de líneas no dice si los casos prueban lo
  importante; dice qué código se ejecutó al menos una vez. Las ramas al 47 %
  indican que casi la mitad de los caminos alternativos (validaciones, errores,
  permisos) no se han recorrido.
- **El frontend no está aquí.** Sus 39 pruebas y su cobertura se miden aparte;
  ver `cobertura-frontend.md` (41,14 % de líneas el 29-oct).
- **No hay umbral que haga fallar el CI.** Se mide y se publica; poner un mínimo
  obligatorio es una decisión aparte, y un umbral mal puesto se esquiva
  añadiendo pruebas triviales.
- **La pasada con cobertura es algo más lenta** que las dos tandas sueltas que
  había antes (169 s frente a unos 136 s medidos), pero se ejecuta una sola vez
  en el CI: no se duplican las pruebas.

## Cómo se consulta

- **En cada push o pull request**, el job `Backend` del CI ejecuta
  `npm run test:cov`, escribe el resumen en la página del job (paso «Resumen de
  cobertura en el registro») y publica el informe completo como artefacto
  `cobertura-backend` (14 días de retención): `coverage/index.html` y
  `coverage/RESUMEN.md`.
- **En local:**

```powershell
cd backend
$env:TEST_DATABASE_URL="postgresql://postgres:CLAVE@localhost:5432/clasesconjuntasbd_test?schema=public"
npm run test:cov
npm run test:cov:resumen   # deja coverage/RESUMEN.md
```

El informe navegable queda en `backend/coverage/index.html` (no se versiona:
`.gitignore` excluye `coverage/`).
