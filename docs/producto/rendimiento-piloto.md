# Medir el rendimiento real del piloto

El proyecto ya puede medir el tráfico real que atiende, sin generar peticiones
sintéticas. Sirve para responder en el informe **cómo se comportó el piloto**,
no para decir que aguanta una carga que nunca se probó.

## Qué mide

El middleware `MetricasMiddleware` mide cada petición HTTP:

- método y ruta normalizada (`/proyectos/:id`, no cada id);
- estado HTTP;
- duración total de la petición, incluida la base de datos;
- `X-Request-Id`;
- errores 4xx y 5xx recientes.

El resumen añade:

- peticiones totales, exitosas y con error;
- latencia promedio, p50, p90, p95, p99 y máxima;
- rutas ordenadas por volumen;
- memoria RSS/heap, carga del proceso, uptime y retardo del event loop.

No guarda cuerpos, contraseñas, correos ni datos de alumnos.

## Consulta para la CACE

Está protegido con la capacidad `verRendimientoPiloto`: solo presidencia y
secretaría de la CACE.

```http
GET /metricas/rendimiento
Authorization: Bearer <token de la CACE>
```

Devuelve JSON. Para el informe o una hoja de cálculo:

```http
GET /metricas/rendimiento.csv
Authorization: Bearer <token de la CACE>
```

El CSV trae una fila por ruta con peticiones, errores, promedio, p50, p95, p99
y máximo.

La propia ruta `/metricas`, `/health` y los archivos estáticos no se cuentan para
no contaminar la medición.

## Botón temporal en la CACE

En el panel de presidencia o secretaría de la CACE aparece la tarjeta
**Rendimiento del piloto (temporal)** con el botón:

```text
Descargar histórico de rendimiento (CSV)
```

Descarga `rendimiento-historico-piloto.csv`. Si el histórico persistente no está
configurado, descarga el acumulado de la instancia actual y muestra un aviso para
no confundirlo con un histórico completo.

También se puede llamar directamente:

```http
GET /metricas/rendimiento/historico.csv
Authorization: Bearer <token de la CACE>
```

La cabecera `X-Metricas-Alcance` indica `HISTORICO` o `INSTANCIA`. Cuando es
histórico, `X-Metricas-Desde` y `X-Metricas-Hasta` indican el periodo.

## Conservar las mediciones entre reinicios

El endpoint `/metricas/rendimiento` resume la **instancia actual**: si se reinicia
el servidor, su memoria empieza de cero. Para un piloto de varios días, configura:

```dotenv
METRICAS_ARCHIVO="/var/log/clasesespejo/rendimiento.jsonl"
```

Cada petición se agrega al archivo en formato JSONL. El archivo no se sirve en
bruto; el botón y el endpoint de histórico lo agregan por ruta.

Para convertirlo en un informe legible desde el servidor:

```powershell
cd backend
node scripts/informe-rendimiento.js C:\ruta\rendimiento.jsonl
```

El script escribe un Markdown con el periodo, las latencias globales y una tabla
por ruta.

## Cómo usarlo en el informe

No conviene presentar una sola cifra aislada. Para el piloto, reporta:

1. Periodo y número de peticiones reales.
2. p50 y p95; el p95 es más honesto que el promedio para la experiencia.
3. Porcentaje de errores 4xx y 5xx.
4. Rutas más lentas o con más errores.
5. Uptime y memoria del proceso.
6. Qué no mide: renderizado del navegador, red del usuario, latencia del SMTP ni
   capacidad bajo carga concurrente.

Una prueba de carga sigue siendo otra cosa. Si el informe necesita «aguanta N
usuarios», hay que hacer una prueba aparte y decirlo con su método.

## Limitaciones

- Es observabilidad de una instancia; si el piloto se despliega en varias
  instancias, cada una mide su propio tráfico.
- Conserva como máximo las últimas 20.000 muestras globales en memoria y 2.000
  por ruta; el JSONL, si se configura, conserva el histórico.
- El archivo JSONL puede crecer. Rótalo o recórtalo al terminar el periodo.
- No sustituye a un APM externo ni a Prometheus; es una solución ligera para un
  piloto pequeño.
