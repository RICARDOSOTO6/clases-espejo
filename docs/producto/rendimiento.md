# Rendimiento — documentación de la optimización

> **Fecha:** 18 de octubre de 2026 · **Estado:** aplicado, medido y en `master`.
> **Alcance:** backend (servido de estáticos y base de datos) y frontend
> (imágenes del acceso). **No** se cambió ningún flujo de negocio: los permisos,
> las rutas, los datos y las pantallas son los mismos.
>
> Las cifras no son estimaciones: se midieron con el servidor compilado en
> `http://localhost:3000` y Chrome headless controlado por CDP
> (`Network.setCacheDisabled` para la carga fría, caché activa para la segunda
> visita), más `curl` para las cabeceras y `EXPLAIN` para los planes de la base.

## 1. Resumen ejecutivo

| Medida | Antes | Después | Reducción |
| --- | --- | --- | --- |
| **Login en frío** (sin caché, sin sesión) | 1.014.948 B / 14 peticiones | **186.979 B / 14 peticiones** | **−81,6 %** |
| **Login en segunda visita** (caché caliente) | ~1 MB otra vez | **650 B** (304 + caché) | **−99,9 %** |
| Logo del acceso | 544.840 B (PNG 1254 px) | **15.476 B** (WebP 300 px) | **−97,2 %** |
| Chunk grande del bundle (gzip) | 274.011 B | **84.493 B** | −69,2 % |
| `styles.css` (gzip) | 66.356 B | **12.108 B** | −81,8 % |
| `index.html` (gzip) | 12.641 B | **2.287 B** | −81,9 % |
| Índices de negocio en la base | 0 | **41** (22 modelos) | — |

Lo que se tocó, en una frase: **el servidor comprime y cachea los estáticos, la
base tiene índices para las consultas calientes y el logo del acceso se sirve en
su tamaño real**.

## 2. Línea base (antes)

Carga fría de `/login`, desglose de los 14 recursos medidos:

| Recurso | Bytes | Nota |
| --- | ---: | --- |
| `logo-cace.png` | 545.212 | 1254×1254, se pintaba a 150 px |
| `chunk-NC4P65EG.js` | 274.011 | chunk compartido del bundle, sin comprimir |
| `styles-62IV7BIJ.css` | 66.356 | hoja global, sin comprimir |
| Fuente Inter (Google) | 48.288 | externa, no controlada por el proyecto |
| `chunk-QCUWNRLA.js` | 45.228 | ruta de acceso |
| `index.html` | 13.026 | `Cache-Control: public, max-age=0` |
| resto (chunks pequeños, JSON) | ~22.827 | `/cace/publico`, `/cace/paises`… |

Dos problemas de fondo, además del peso: los estáticos se servían **sin
comprimir** y con `max-age=0` (cada visita revalidaba, pero el cuerpo volvía a
viajar), y la base tenía **cero índices de negocio**: toda clave foránea y todo
filtro por estado se resolvían recorriendo la tabla.

## 3. Qué se hizo

### 3.1 Estáticos del frontend: gzip, ETag y caché (`backend/src/main.ts`)

Antes de montar `public/`, `main.ts` instala ahora una capa propia de servido:

| Pieza (en `main.ts`) | Qué hace |
| --- | --- |
| `TIPOS_DE_TEXTO` | Mapa de extensiones → `Content-Type`: `.js`, `.mjs`, `.css`, `.html`, `.svg`, `.json`, `.map`, `.txt`, `.xml`. Solo esos se comprimen; las imágenes y fuentes ya vienen comprimidas. |
| `esNombreConHash()` | Distingue los nombres del build (`main-ABCD1234.js`, `chunk-XXXX.js`, `styles-XXXX.css`): su contenido no cambia nunca sin cambiar el nombre. |
| `cacheDeArchivo()` | Nombre con hash → `public, max-age=31536000, immutable`. Sin hash (logo, iconos, favicon) → `public, max-age=604800` (una semana). |
| `CACHE_HTML` | `max-age=0, must-revalidate`: la página se revalida siempre, pero puede responder 304. |
| `servirTexto()` | Sirve un archivo de texto con gzip nivel 9 (buffers en memoria, cacheados por ruta + fecha de modificación + tamaño), `ETag`, `Vary: Accept-Encoding`, `nosniff` y **304** si el `If-None-Match` coincide. |
| middleware antes de `useStaticAssets` | Atiende `/` y los archivos de texto de `public/`; comprueba que la ruta resuelta siga dentro de `public/` (un `../` no sale). El resto (imágenes, fuentes) lo sigue sirviendo Express, con la misma política de caché. |
| *fallback* SPA | Sirve el `index.html` con el mismo `servirTexto()`: gzip + ETag + 304, también en rutas como `/panel` o `/proyectos/24`. |

Decisiones:

- **No se añadió el paquete `compression`**: el registro de npm no es accesible en
  este entorno (EPERM) y el proyecto ya tiene `zlib` en Node. La compresión se
  cachea en memoria, así que se paga una vez por archivo y proceso.
- **Los buffers se cachean por `mtime` + tamaño**: al reconstruir el frontend
  cambian los nombres (y el contenido), así que no quedan respuestas viejas.
  El mapa se vacía solo al pasar de 200 entradas.
- **`nosniff` se mantiene**: la compresión no relaja las cabeceras de seguridad.

### 3.2 API pública revalidable (`identidad-cace-publica.controller.ts`, `instituciones.controller.ts`)

`GET /cace/publico`, `GET /cace/premios-publicos` y `GET /instituciones/directorio`
responden ahora con `Cache-Control: max-age=0, must-revalidate`. Es a propósito
**revalidar y no cachear por minutos**: si la presidencia cambia el lema, el logo
o las banderas, la portada no puede enseñar la identidad vieja. El `ETag` ya lo
ponía Express.

> Límite conocido: en este proyecto, con Express 5.2.1, las respuestas JSON
> generadas por los controladores contestan **200** aunque el `ETag` coincida
> (comprobado con `If-None-Match`); el 304 solo se consigue en los estáticos, que
> los sirve `servirTexto()`. Está en pendientes.

### 3.3 Índices de base de datos (`backend/prisma/`)

- Migración **`20261018011641_indices_de_rendimiento`**: **41 `CREATE INDEX`**
  sobre 22 modelos. El SQL no tiene `DROP`, `ALTER` ni borrados.
- Cubren las claves foráneas que no tenían índice y los filtros/ordenaciones
  reales del código. Por área:
  - **Clases**: `SESION(proyectoId, fechaHora)` y `SESION(fechaHora)`;
    `ACTIVIDAD(proyectoId, fechaLimite)` y `ACTIVIDAD(fechaLimite)`;
    `EVIDENCIA(proyectoId)`, `EVIDENCIA(sesionId)`; `EVALUACION(proyectoId)`.
  - **Planificación y chat**: `PARTICIPACION_PLANIFICACION(planificacionId)`,
    `(proyectoDocenteId)`; `MENSAJE(proyectoId, creadoEn)`,
    `MENSAJE(proyectoDocenteId)`; `PARTICIPACION_REPORTE(reporteClaseId)`,
    `(proyectoDocenteId)`.
  - **Proyectos**: `PROYECTO_DOCENTE(proyectoId)`, `(asignacionDocenteId)`;
    `PROYECTO_CLASE_ESPEJO(estado)`.
  - **Solicitudes y revisiones**: `SOLICITUD_CLASE_ESPEJO(institucionDestinoId,
    estado)`, `(asignacionOrigenId)`, `(asignacionDestinoId)`,
    `(materiaDestinoId)`, `(fechaPropuesta)`; `REVISION_SOLICITUD(solicitudId)`,
    `(agenteId)`.
  - **Instituciones y comunidad**: `INSTITUCION(estadoCace)`,
    `INVITACION(institucionId)`, `(correo)`, `MATERIA(institucionId)`,
    `DOCENTE_INSTITUCION(docenteId)`, `(institucionId)`,
    `AGENTE_INTERNACIONALIZACION(institucionId)`, `ASIGNACION_DOCENTE(...)`.
  - **Certificados y listas**: `CERTIFICADO(proyectoId, estado)`,
    `(alumnoId)`, `(plantillaId)`; `LISTA_ALUMNOS(subidaPorUsuarioId)`;
    `ALUMNO(listaId)`; `PREMIOS(institucionId)`, `(publicado)`;
    `SOLICITUD_BORRADO_INSTITUCION(institucionId)`, `(estado)`.
- Comprobado con `EXPLAIN`: con los índices, PostgreSQL usa `Index Scan` en
  `SESION(proyecto_id, fecha_hora)`, `ALUMNO(lista_id)` y
  `CERTIFICADO(proyecto_id, estado)`. Con la base de demostración (3-19 filas) el
  planificador prefiere `Seq Scan` por coste, que **es lo correcto** a ese
  tamaño; los índices importan con volumen real.

### 3.4 Imágenes del acceso (`frontend/public/`)

- `logo-cace.png`: se recortó al contenido visible (contenido real 1191×1191) y
  se reescaló a **300×300** (2× de los 150 px que se muestran, suficiente para
  pantallas densas) con margen del 3 %: **544.840 → 47.472 B**.
- `logo-cace.webp`: **15.476 B** con calidad 90; es el que usa la aplicación.
  El PNG se conserva como respaldo.
- Referencias cambiadas: `LOGO_CACE_POR_DEFECTO` (`core/constants/cace.ts`),
  `register.component.html` y `activate.component.html`. El login ya usaba
  `logo()` y cae en la constante cuando no hay logo configurado.
- Los iconos de la pestaña no cambian: se generaron aparte en la tarea anterior
  (`favicon.ico` multi-tamaño y PNG de 32, 180 y 192).

## 4. Resultados

Carga fría de `/login` después de los cambios:

| Recurso | Bytes | Cambio |
| --- | ---: | --- |
| `chunk-NC4P65EG.js` | 84.493 | gzip de 274.011 |
| Fuente Inter (Google) | 48.288 | igual (externa) |
| `logo-cace.webp` | 15.852 | antes 545.212 |
| `styles-62IV7BIJ.css` | 12.108 | gzip de 66.356 |
| `chunk-QCUWNRLA.js` | 10.528 | gzip |
| `index.html` | ~2.300 | gzip de 13.026 |
| resto (chunks y JSON) | ~14.000 | gzip donde aplica |
| **Total** | **186.979** | **−81,6 %** |

Segunda visita (caché caliente): **650 B** en 14 peticiones; el navegador no
vuelve a bajar los archivos con hash y recibe 304 del HTML y de los JSON
revalidables.

## 5. Cómo comprobarlo (reproducible)

Con el backend en marcha (`cd backend; node dist/src/main`) y el frontend
compilado en `backend/public`:

```powershell
# 1) gzip y caché de un estático con hash
$js = (Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).Content
$main = [regex]::Match($js, 'main-[A-Z0-9]+\.js').Value
curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" "http://localhost:3000/$main"
#   esperado: Content-Encoding: gzip, Cache-Control: public, max-age=31536000, immutable

# 2) HTML comprimido y 304 (Node, porque curl en PowerShell complica las comillas del ETag)
node -e "const b='http://localhost:3000'; (async()=>{const r=await fetch(b); const e=r.headers.get('etag'); console.log(r.status, r.headers.get('content-encoding'), e); const r2=await fetch(b,{headers:{'if-none-match':e}}); console.log('revalidado:', r2.status)})()"
#   esperado: 200 gzip W/"..."  y  revalidado: 304

# 3) imágenes y su caché
curl.exe -s -I http://localhost:3000/logo-cace.webp
#   esperado: 200, image/webp, Content-Length: 15476, Cache-Control: public, max-age=604800

# 4) índices
#   psql -d ClasesconjuntasBD -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_idx';"   -- 41
#   psql -d ClasesconjuntasBD -c 'EXPLAIN (ANALYZE) SELECT * FROM "SESION" WHERE proyecto_id = 17 ORDER BY fecha_hora;'

# 5) carga fría/caliente: Chrome con --remote-debugging-port=9222 y CDP,
#    Network.setCacheDisabled(true/false), sumando encodedDataLength por petición.
```

## 6. Qué significa en el día a día

- **Al reconstruir el frontend** (`npx ng build`), Angular cambia el hash de los
  archivos que cambiaron. Los navegadores piden el nuevo `index.html`
  (revalida), ven nombres nuevos y bajan solo eso; los archivos viejos quedan
  huérfanos en la caché y no estorban.
- **No hace falta vaciar caché a mano** ni reiniciar el backend tras un
  `ng build`: el servidor lee de disco y detecta los archivos nuevos. Solo hay
  que reiniciar si se cambia código del backend (`main.ts`, controladores).
- **Si se cambia una imagen con nombre fijo** (`logo-cace.webp`, iconos), el
  navegador puede tardar hasta una semana en pedirla de nuevo (`max-age`). Para
  un cambio inmediato, o se cambia el nombre del archivo, o se hace
  `Ctrl+Shift+R`.
- **La API no se cachea**: todo lo que pasa por `/auth`, `/proyectos`,
  `/certificados`, etc. sigue viajando y validándose como antes.
- **Los estáticos de usuario** (`/uploads`, `/logos`, `/avatares`…) no cambian:
  son archivos con nombre aleatorio y se siguen sirviendo con `nosniff` y su
  cabecera de descarga cuando toca.

## 7. Mantenimiento

- **Añadir un tipo de archivo comprimible**: añadirlo a `TIPOS_DE_TEXTO` en
  `main.ts` y probar con `curl -H "Accept-Encoding: gzip"`.
- **Añadir un índice**: editarlo en `schema.prisma` con `@@index([...])`, crear
  la migración con `npx prisma migrate dev --name ...` (con el backend parado si
  hay que regenerar el cliente) y revisar que el SQL solo tenga `CREATE INDEX`.
- **No editar** una migración ya aplicada: se añade otra.
- **Si cambia el nombre del logo o de un icono**, actualizar las referencias y
  recordar que el archivo nuevo no lo tiene cacheado el navegador.

## 8. Límites de lo medido

- Base de **demostración** (2 instituciones, 6 usuarios, 2 proyectos, 3 sesiones,
  0 certificados). El beneficio de los índices está comprobado a nivel de plan,
  no con miles de filas.
- Red local (`localhost`), Chrome headless: no simula latencia ni 3G.
- La caché de disco del perfil de Chrome se controla con CDP; en un navegador
  real la segunda visita puede variar (extensiones, modo privado).
- La fuente Inter viaja desde Google Fonts (48 KB, 26 % de la carga fría
  restante) y no se puede medir su latencia desde aquí.

## 9. Pendientes y criterios de aceptación

| Pendiente | Por qué no se hizo | Criterio de aceptación |
| --- | --- | --- |
| Comprimir las respuestas JSON de la API | Sin acceso al registro npm para `compression`; las respuestas de la demo son de 2-3 KB | `/proyectos/:id` o el panel CACE bajan al menos un 60 % con `Accept-Encoding: gzip`, sin romper `Content-Length` ni el ETag |
| 304 en las respuestas JSON | Express 5 en este proyecto responde 200 con ETag coincidente (comprobado) | `GET /cace/publico` con `If-None-Match` responde 304 |
| Paginación y consultas más estrechas | Cambia contratos de API y frontend; requiere datos de volumen | El panel carga con 1.000 certificados y 500 alumnos sin traerlo todo |
| Alojar la fuente Inter | Requiere descargar y servir archivos; el registro no está accesible | La carga fría no depende de `fonts.gstatic.com` |
| Trocear el bundle compartido | Hay que ver qué arrastra el chunk de 84 KB gzip | El chunk inicial baja de forma medible sin perder funcionalidad |

## 10. Cambios en el repositorio

| Commit | Qué |
| --- | --- |
| `7cf8d81` | Estáticos comprimidos y cacheados (`main.ts`, controladores públicos). |
| `1c9de7f` | Índices de base de datos (esquema + migración). |
| `0bc5348` | Imágenes del acceso (PNG optimizado, WebP y referencias). |
| `61dfeb0` | Esta documentación y el enlace desde `docs/README.md`. |

Los datos de demostración y el respaldo `clasesconjuntas_respaldo_20261013` no se
tocaron: la migración de índices solo añade índices, no cambia filas.
