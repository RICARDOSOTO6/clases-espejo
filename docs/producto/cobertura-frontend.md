# Cobertura del frontend

> **Medida el 29 de octubre de 2026** con `npm run test:cov` (que ejecuta
> `ng test --watch=false --coverage`), en un Windows local con Node 24.21 y el
> entorno `jsdom` de Vitest. En el CI los números pueden moverse unas décimas; el
> informe de cada ejecución es el que manda.

## Qué mide y cómo

Las 34 pruebas de la interfaz se ejecutan con el constructor
`@angular/build:unit-test` (Vitest) y el proveedor de cobertura
`@vitest/coverage-v8`. El informe incluye las plantillas `.html` de los
componentes además del TypeScript: Angular las instrumenta, y una plantilla sin
probar también es una pantalla sin probar. Quedan fuera los archivos de prueba y
las dependencias.

## La cifra

| Métrica | Cobertura |
| --- | ---: |
| Líneas | **50,18 %** (548 de 1 092) |
| Sentencias | **47,87 %** (687 de 1 435) |
| Funciones | **30,48 %** (75 de 246) |
| Ramas | **49,53 %** (269 de 543) |

30 archivos medidos. Son 34 casos y unas 30 s de ejecución en el equipo de la
medición.

## Por carpeta

| Carpeta | Archivos | Líneas % | Ramas % | Funciones % |
| --- | ---: | ---: | ---: | ---: |
| `app/app.html` | 1 | 0,0 | — | — |
| `app/app.ts` | 1 | 33,3 | 60,0 | 33,3 |
| `app/core` | 16 | 36,7 | 50,3 | 25,2 |
| `app/features` | 12 | 54,4 | 49,0 | 38,0 |

## Qué queda sin cubrir y por qué

- **Las plantillas de las pantallas que no se probaron.** Los `.html` de
  `register`, `restablecer`, `recuperar`, `seguridad-totp` y el registro de
  correo están entre el 15 % y el 40 %: las pruebas ejercitan el componente y su
  lógica, pero no todas las ramas de la vista.
- **Los servicios de CACE** (`cace.service.ts` 2,4 %, `identidad-cace.service.ts`
  2,9 % y `instituciones.service.ts` 8,3 %): el panel de la CACE, la identidad
  visual y las plantillas no tienen pruebas de interfaz; se probaron por la API
  en las e2e del backend.
- **Las utilidades de error y de URL de archivo** (`http-error.util.ts`,
  `url-archivo.util.ts`) están a 0 %: son de una línea y solo se usan en las
  pantallas de CACE.
- **Funciones al 30 %.** Es la métrica más baja: los manejadores de eventos de
  los componentes se cubren poco aunque la línea se ejecute al pintar.

## Lo que esta cifra no dice

- **No es una garantía.** Un 50 % de líneas no dice si las pruebas comprueban lo
  importante; dice qué se ejecutó al menos una vez.
- **No cubre las e2e del backend**, que sí recorren estos flujos a través de la
  API (ver `cobertura-backend.md`).
- **No hay umbral que haga fallar el CI.** Se mide y se publica; poner un mínimo
  se decide aparte.
- **El entorno es `jsdom`**, no un navegador real: no mide pintado ni diseño.

## Cómo se consulta

- **En cada push o pull request**, el job `Frontend` ejecuta `npm run test:cov`,
  escribe el resumen en la página del job (paso «Resumen de cobertura en el
  registro») y publica el informe completo como artefacto `cobertura-frontend`
  (14 días): `coverage/frontend/index.html` y
  `coverage/frontend/RESUMEN.md`.
- **En local**, desde `frontend`:

```powershell
npm run test:cov
node ../backend/scripts/resumen-cobertura.js --archivo coverage/frontend/coverage-summary.json --titulo "Cobertura del frontend" --niveles 2
```

El informe navegable queda en `frontend/coverage/frontend/index.html` (no se
versiona: `/coverage` está en `frontend/.gitignore`).

> El proveedor `@vitest/coverage-v8` se añadió a `devDependencies` en esta tarea;
> sin él, `ng test --coverage` termina pidiendo instalarlo.
