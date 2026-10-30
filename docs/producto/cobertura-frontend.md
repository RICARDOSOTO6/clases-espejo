# Cobertura del frontend

> **Medida el 29 de octubre de 2026** con `npm run test:cov` (que ejecuta
> `ng test --watch=false --coverage`), en un Windows local con Node 24.21 y el
> entorno `jsdom` de Vitest. En el CI los números pueden moverse unas décimas; el
> informe de cada ejecución es el que manda.

## Qué mide y cómo

Las 39 pruebas de la interfaz (34 de comportamiento y 5 de accesibilidad) se
ejecutan con el constructor `@angular/build:unit-test` (Vitest) y el proveedor de
cobertura `@vitest/coverage-v8`. El informe incluye las plantillas `.html` de los
componentes además del TypeScript: Angular las instrumenta, y una plantilla sin
probar también es una pantalla sin probar. Quedan fuera los archivos de prueba y
las dependencias.

> **Por qué la cifra cambió el mismo día.** La primera medición, con las 34
> pruebas de comportamiento, cubrió **30 archivos** y dio **50,18 %**. Las
> pruebas de accesibilidad montan el armazón, que arrastra `layout`, `guía` y
> `modal`: ahora se miden **42 archivos**, las líneas cubiertas suben de **548 a
> 887** y el total pasa de **1 092 a 2 156**. El porcentaje baja porque el
> denominador es más grande, no porque se haya perdido cobertura. La cifra buena
> es esta, que mira más código.

## La cifra

| Métrica | Cobertura |
| --- | ---: |
| Líneas | **41,14 %** (887 de 2 156) |
| Sentencias | **38,35 %** (1 140 de 2 972) |
| Funciones | **24,59 %** (107 de 435) |
| Ramas | **43,16 %** (439 de 1 017) |

42 archivos medidos. Son 39 casos y unas 30 s de ejecución en el equipo de la
medición.

## Por carpeta

| Carpeta | Archivos | Líneas % | Ramas % | Funciones % |
| --- | ---: | ---: | ---: | ---: |
| `app/app.html` | 1 | 0,0 | — | — |
| `app/shared` | 6 | 21,5 | 25,0 | 9,5 |
| `app/app.ts` | 1 | 33,3 | 60,0 | 33,3 |
| `app/core` | 20 | 35,8 | 51,1 | 24,0 |
| `app/features` | 14 | 61,0 | 55,7 | 44,7 |

## Qué queda sin cubrir y por qué

- **El armazón y sus piezas compartidas.** `layout` está al 22 %, `modal` al 10 %
  y `guia` al 3,8 %: la prueba de accesibilidad los monta para revisar el DOM,
  pero no recorre sus acciones (abrir el menú, subir foto, pasos de la guía).
  Es la deuda grande que destapó la segunda medición.
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
- **Funciones al 24,6 %.** Es la métrica más baja: los manejadores de eventos de
  los componentes se cubren poco aunque la línea se ejecute al pintar.

## Lo que esta cifra no dice

- **No es una garantía.** Un 41 % de líneas no dice si las pruebas comprueban lo
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
