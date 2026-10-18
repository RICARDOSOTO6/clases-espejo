# Rendimiento — qué se optimizó y cuánto

> Medido el 18 de octubre de 2026 con la base de demostración y el servidor
> compilado en `http://localhost:3000`. Las cifras de carga se tomaron con Chrome
> headless por CDP (`Network.setCacheDisabled` para la carga fría y caché activa
> para la segunda visita), no con estimaciones.

## Resumen

| Medida | Antes | Después | Reducción |
| --- | --- | --- | --- |
| **Login en frío** (sin caché, sin sesión) | 1.014.948 B en 14 peticiones | **186.979 B** en 14 peticiones | **−81,6 %** |
| **Login en segunda visita** (caché caliente) | ~1 MB otra vez | **650 B** (304 + caché) | **−99,9 %** |
| Logo del acceso | 544.840 B (1254 px) | **15.476 B** (WebP 300 px) | **−97,2 %** |
| Chunk grande del bundle (gzip) | 274.011 B | **84.493 B** | **−69,2 %** |
| `styles.css` (gzip) | 66.356 B | **12.108 B** | **−81,8 %** |
| `index.html` (gzip) | 12.641 B | **2.287 B** | **−81,9 %** |
| Índices de base de datos | 0 índices de negocio | **41 índices** en 22 tablas | — |

## Lo que se hizo

### 1. Estáticos comprimidos y cacheados (backend `main.ts`)

- Los `.js`, `.css` y el `index.html` se sirven **gzip** desde memoria (nivel 9,
  cacheado por archivo y fecha). No se añadió el paquete `compression` porque el
  registro de npm no es accesible en este entorno; se hace con `zlib`, que viene
  con Node.
- Los nombres con hash de contenido (`main-ABCD1234.js`, `chunk-XXXX.js`,
  `styles-XXXX.css`) se sirven con `Cache-Control: public, max-age=31536000,
  immutable`: una segunda visita no los vuelve a pedir.
- Las imágenes y fuentes (sin hash en el nombre) van con `max-age=604800` (una
  semana).
- El `index.html` va con `max-age=0, must-revalidate` y **ETag**: se revalida
  siempre y responde **304** cuando no cambió (comprobado con Chrome/Node).
- El sitio no cambia de comportamiento: es el mismo archivo, solo viaja
  comprimido y se cachea.

### 2. Índices de base de datos (Prisma)

- Migración `20261018011641_indices_de_rendimiento`: **41 `CREATE INDEX`** sobre
  22 modelos (ninguna operación destructiva).
- Cubren las claves foráneas que no tenían índice y las consultas calientes:
  sesiones por proyecto y fecha, evidencias, evaluaciones, mensajes del chat,
  participaciones, certificados por proyecto/estado, alumnos por lista,
  solicitudes por institución/estado, invitaciones por institución/correo,
  revisiones por solicitud, premios publicados, etc.
- Comprobado con `EXPLAIN`: con los índices presentes, PostgreSQL usa
  `Index Scan` para `SESION(proyecto_id, fecha_hora)`, `ALUMNO(lista_id)` y
  `CERTIFICADO(proyecto_id, estado)`. Con la base de demo (3-19 filas) el
  planificador prefiere `Seq Scan` por coste, que es lo correcto a ese tamaño;
  con datos reales usará los índices.

### 3. Imágenes del frontend

- `logo-cace.png`: recortado al contenido visible, 300×300 (2× de los 150 px que
  se muestran) y optimizado: **532 KB → 47 KB**. Además se genera
  `logo-cace.webp` (**15 KB**) y es el que usa la aplicación; el PNG se queda
  como respaldo en el repositorio.
- Iconos de la pestaña ya generados en la tarea anterior (`.ico` multi-tamaño y
  PNG de 32, 180 y 192).

## Lo que queda pendiente (y por qué)

1. **Compresión de las respuestas JSON de la API.** Son pequeñas con la demo
   (2-3 KB) y grandes con datos reales. Se haría con el paquete `compression` o
   un middleware equivalente; el registro de npm no está disponible aquí.
2. **304 en las respuestas JSON.** El `index.html` y los estáticos ya responden
   304, pero las respuestas generadas por Express 5 en este proyecto contestan
   200 aunque el `ETag` coincida (comprobado con `If-None-Match`). Las cabeceras
   `max-age=0, must-revalidate` ya evitan servir datos viejos; falta el ahorro
   del cuerpo.
3. **Paginación y consultas más estrechas.** Los listados grandes (certificados,
   alumnos, panel CACE) traen todo; hay que paginar y revisar `include`/`select`
   con datos de volumen.
4. **Fuentes.** Inter se carga desde Google Fonts y pesa 48 KB (26 % de la carga
   fría restante); alojarla en el propio servidor quitaría una conexión externa.
5. **Bundle del frontend.** El chunk compartido sigue en 84 KB gzip; habría que
   ver qué arrastra (Angular + servicios comunes) antes de trocearlo.

## Cómo se mide (reproducible)

```powershell
# cabeceras y compresión
curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" http://localhost:3000/
curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" http://localhost:3000/chunk-XXXX.js

# 304 del HTML (con el ETag devuelto arriba)
curl.exe -s -o NUL -H 'If-None-Match: W/"..."' -H 'Accept-Encoding: gzip' http://localhost:3000/

# planes de la base
#   EXPLAIN (ANALYZE) SELECT * FROM "SESION" WHERE proyecto_id = 17 ORDER BY fecha_hora;

# carga fría/caliente: Chrome con --remote-debugging-port=9222 y
#   Network.setCacheDisabled(true/false) midiendo encodedDataLength.
```
