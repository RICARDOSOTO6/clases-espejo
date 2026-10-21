# 🏗 Arquitectura — componentes y despliegue

Este documento responde a dos preguntas: **qué piezas forman el sistema** y
**quién habla con quién y por dónde**. Todo lo que dice sale del código
(`backend/src/main.ts`, los módulos de `backend/src/`, `backend/src/mail/`), de
la configuración (variables de entorno del README) y de las guías de despliegue
y de respaldo.

> La versión gráfica del modelo de datos está en
> [`entidad_relacion.md`](entidad_relacion.md) y la de las clases del dominio en
> [`clases_dominio.md`](clases_dominio.md). Aquí solo se ve **dónde vive cada
> cosa**, no cómo está modelada.

---

## 1. Diagrama de contexto

Quién usa el sistema y con qué sistemas de fuera se habla. La aplicación es
**una sola**; la CACE, los agentes, los docentes y el público entran por la
misma dirección.

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#F5F7FA",
        "primaryTextColor": "#1F2927",
        "lineColor": "#64748B",
        "fontFamily": "Arial"
    }
}}%%

flowchart LR

    Docente([Docente])
    Agente([Agente de internacionalización])
    Cace([Presidencia y secretaría de la CACE])
    Publico([Cualquiera con un certificado en la mano])

    subgraph Sistema["Clases Conjuntas"]
        App["Aplicación web<br/>pantallas + API"]
    end

    SMTP["Servidor de correo saliente<br/>(SMTP)"]
    Tunel["Túnel o proxy inverso<br/>(cloudflared, ngrok, nginx, Caddy, IIS)"]
    Admin([Administrador del servidor])

    Docente --> App
    Agente --> App
    Cace --> App
    Publico --> App
    Tunel -- "dirección pública" --> App
    App -- "invitaciones, avisos y certificados" --> SMTP
    Admin -- "respaldos y despliegue" --> App

    classDef actor fill:#DCFCE7,stroke:#16A24A,color:#14522D,stroke-width:2px
    classDef caceActor fill:#DBEAFE,stroke:#2562EB,color:#1E2A8A,stroke-width:2px
    classDef publico fill:#F2F4F6,stroke:#6B7280,color:#274151,stroke-width:2px
    classDef sistema fill:#E0E7FF,stroke:#4F46E5,color:#212E81,stroke-width:2px
    classDef externo fill:#FEF2C7,stroke:#D97706,color:#78250F,stroke-width:2px

    class Docente,Agente,Admin actor
    class Cace caceActor
    class Publico publico
    class App sistema
    class SMTP,Tunel externo
```

* **Cuatro formas de entrar y una sin cuenta.** Docente, agente y CACE se
  autentican con JWT; la **verificación pública** de un certificado
  (`/verificar/:folio?c=<código>`) y la pantalla de acceso (que necesita el lema,
  el logo y el tema de la CACE antes de que nadie entre) se abren **sin sesión**.
* **El túnel no es una pieza opcional de adorno**: es lo que hace que el enlace
  de invitación y el QR del certificado apunten a una dirección que el docente o
  el alumno pueden abrir desde su propio equipo.

---

## 2. Diagrama de contenedores

Las piezas que se despliegan de verdad. Todo el servidor de la aplicación es
**un solo proceso Node** (`NestJS`): sirve la API **y** el frontend compilado
por el **mismo puerto**.

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#F5F7FA",
        "primaryTextColor": "#1F2927",
        "lineColor": "#64748B",
        "fontFamily": "Arial"
    }
}}%%

flowchart TB

    subgraph NAV["Equipo del usuario"]
        SPA["Aplicación Angular 21<br/>standalone + signals · zoneless<br/>(interfaz completa)"]
    end

    subgraph SRV["Servidor de la aplicación — un proceso Node (NestJS 11)"]
        API["API NestJS<br/>escucha en :2000 (PORT)"]
        PUBC["backend/public<br/>frontend compilado (ng build)"]
        UP["backend/uploads/<br/>evidencias · avatares · logos · cace ·<br/>premios · certificados-fondos · certificados (privado)"]
        PL["backend/plantillas/<br/>plantillas descargables (lista de alumnos ·<br/>zonas del certificado · guía de diseño)"]
    end

    PG[("PostgreSQL<br/>:5422 · ClasesconjuntasBD<br/>35 tablas · 27 migraciones")]
    BKP[("clasesconjuntas_respaldo_20261012<br/>copia de la base en el mismo servidor")]
    SMTP["Servidor SMTP<br/>SMTP_HOST:SMTP_PORT"]
    TUN["Túnel o proxy inverso<br/>cloudflared · ngrok · nginx · Caddy · IIS"]

    SPA -- "HTTPS/HTTP · JSON con JWT" --> API
    SPA -- "navegación: GET / y estáticos de la SPA" --> API
    API -- "Prisma · DATABASE_URL" --> PG
    API -- "lee y escribe archivos subidos" --> UP
    API -- "sirve los archivos descargables de" --> PL
    API -- "sirve los estáticos de" --> PUBC
    API -- "correo saliente" --> SMTP
    TUN -- "reenvía a http://localhost:2000" --> API
    PG -. "CREATE DATABASE … WITH TEMPLATE" .-> BKP
    Admin([Administrador]) -. "copia también la carpeta uploads/" .-> UP

    classDef cliente fill:#DCFCE7,stroke:#16A24A,color:#14522D,stroke-width:2px
    classDef proceso fill:#E0E7FF,stroke:#4F46E5,color:#212E81,stroke-width:2px
    classDef almacen fill:#CCFBF1,stroke:#0D9488,color:#124E4A,stroke-width:2px
    classDef externo fill:#FEF2C7,stroke:#D97706,color:#78250F,stroke-width:2px

    class SPA cliente
    class API proceso
    class PUBC,UP,PL,PG,BKP almacen
    class SMTP,TUN,Admin externo
```

### 2.1 Qué es cada contenedor

| Contenedor | Qué es en el repositorio | Notas de despliegue |
| --- | --- | --- |
| **Aplicación Angular** | `frontend/src/app/**` (features, core y shared). Angular 21 **standalone** con **signals** y modo **zoneless**; sin librería de UI (CSS propio). | Se compila con `ng build` y **no** se despliega aparte: su salida va dentro del backend. |
| **API NestJS** | `backend/src/**` (12 módulos + `AppModule`). | Un proceso Node. En Linux va con **systemd** (`clasesespejo.service`), en Windows con **NSSM** o **pm2**; el directorio de trabajo es `backend/`. |
| **Frontend compilado** | `backend/public/` (salida de `ng build`, configurada en `frontend/angular.json` → `outputPath: ../backend/public`). | `main.ts` comprueba **al arrancar** si existe `public/index.html`. Si existe, sirve los estáticos y aplica el *fallback* SPA; si no, solo expone la API. Los `.js`/`.css` y el `index.html` se sirven con **gzip** y ETag; los nombres con hash del build, con caché `immutable` de un año (ver [`rendimiento.md`](../rendimiento.md)). `public/` está en `.gitignore`. |
| **Archivos en disco** | `backend/uploads/**` (datos del usuario, en `.gitignore`) y `backend/plantillas/**` (archivos descargables: la lista de alumnos de ejemplo, la imagen de zonas del certificado y la guía de diseño; **versionados**). | `main.ts` **crea las carpetas de `uploads` al arrancar** (`mkdirSync` recursivo). Los archivos subidos son la única parte del sistema que no se respalda con la base: la guía de despliegue pide copiarlos aparte. |
| **PostgreSQL** | `backend/prisma/schema.prisma` (35 modelos), `backend/prisma/migrations/` (27 migraciones). | El esquema se aplica con `npx prisma migrate deploy`. El puerto y la base salen de `DATABASE_URL`. La migración de índices (18-oct-2026) es aditiva y cubre las FKs y filtros calientes (ver [`rendimiento.md`](../rendimiento.md)). |
| **Copia de la base** | No es un contenedor del código: es una operación de administración documentada en `docs/guias/respaldo-y-restauracion.md`. | La copia vigente es **`clasesconjuntas_respaldo_20261012`**, hecha con `CREATE DATABASE … WITH TEMPLATE "ClasesconjuntasBD"`; se compara con la base de trabajo con un script que usa el cliente de Prisma y cuenta filas y huella `md5` por tabla. |
| **Servidor SMTP** | `backend/src/mail/mail.service.ts` (Nodemailer). | Host, puerto, TLS y credenciales salen de `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`. Si el correo falla, **la operación de negocio no se deshace** (la decisión ya está guardada): se anota en el log. |
| **Túnel o proxy inverso** | No hay código: es infraestructura. | Nginx, Caddy o IIS hacen `reverse_proxy 127.0.0.1:2000`; `cloudflared`/`ngrok` apuntan al **2000**. La regla de oro de la guía: el **2000 no se abre a Internet**, solo el 80/442. |

### 2.2 Las cuatro rutas del navegador hacia el backend

El mismo puerto `2000` sirve cosas muy distintas, y `main.ts` las separa por
**prefijo de ruta** y por **cabecera `Accept`**. Esta es la tabla que hay que
tener a mano:

| Lo que pide el navegador | Ruta | Cómo responde el backend |
| --- | --- | --- |
| La aplicación (pantallas) | `GET /login`, `/docente`, `/proyectos/24`, … | `index.html` de `backend/public`; Angular resuelve la ruta. |
| La API | `GET/POST /auth`, `/usuarios`, `/agentes`, `/materias`, `/asignaciones`, `/instituciones`, `/solicitudes`, `/proyectos`, `/recordatorios`, `/cace`, `/verificar`, `/health` y `/` | JSON. Los prefijos se **derivan del router de NestJS** en cada arranque y se suman a una lista conocida, para que un módulo nuevo no quede tapado por el `index.html`. |
| Archivos que se **muestran** en la página | `/avatares/…`, `/logos/…`, `/cace-logo/…`, `/premios/…`, `/certificado-fondo/…` | Estáticos **en línea** (`Content-Disposition: inline`), con `nosniff` y `CORP: cross-origin` para que se vean con `<img>` incluso con el frontend en `:4200`. |
| Archivos que se **descargan** | `/uploads/…`, `/plantillas/…` | Estáticos forzados como descarga (`Content-Disposition: attachment`), con `nosniff` y `CSP: default-src 'none'`. |

> **La dirección que es pantalla y API a la vez.** `/proyectos/24` existe en la
> API y también es una pantalla. El *fallback* mira la cabecera `Accept`: si la
> petición pide `text/html` (una navegación, o un F5) se entrega la aplicación;
> si pide JSON (la propia app) se entrega la API. Sin eso, recargar dentro de una
> clase espejo mostraría un `401` en JSON en lugar de la pantalla.

> **Un caso aparte: los PDF emitidos.** Viven en `uploads/certificados/`, pero
> `main.ts` corta esa ruta y responde **404**: llevan el nombre de una persona y
> **no se sirven nunca como estáticos**. Se descargan solo con sesión, por
> `GET /proyectos/:id/certificados/:certificadoId/pdf`.

---

## 2. Tabla de comunicaciones: qué habla con qué y por dónde

| Origen | Destino | Puerto / ruta | Protocolo y credencial | Para qué |
| --- | --- | --- | --- | --- |
| Navegador (Angular) | API NestJS | `:2000` (variable `PORT`); en desarrollo puede ser `:2000` con `ng serve` en `:4200` | HTTP(S) + JSON, `Authorization: Bearer <JWT>` | Todas las operaciones de la aplicación. |
| Navegador (Angular) | Frontend compilado | `:2000` · `GET /` y rutas sin extensión | HTTP(S) | Cargar la aplicación y resolver rutas del cliente. |
| Navegador | Archivos en línea | `:2000` · `/avatares`, `/logos`, `/cace-logo`, `/premios`, `/certificado-fondo` | HTTP(S) | Pintar fotos, logos, premios y fondos con `<img>`. |
| Navegador | Archivos de descarga | `:2000` · `/uploads`, `/plantillas` | HTTP(S) forzado a descarga | Bajar evidencias y la plantilla de la lista de alumnos. |
| API NestJS | PostgreSQL | `:5422` · `ClasesconjuntasBD` | Prisma sobre TCP; `DATABASE_URL="postgresql://usuario:clave@host:5422/ClasesconjuntasBD?schema=public"` | Persistencia de los 22 modelos. |
| API NestJS | Disco (`uploads/`) | Rutas locales `uploads/`, `uploads/avatares`, `uploads/instituciones`, `uploads/cace`, `uploads/premios`, `uploads/certificados-fondos`, `uploads/certificados` | Sistema de archivos (subidas con `multer`) | Guardar evidencias, fotos, logos, imágenes de premios, fondos de la plantilla y los PDF emitidos. |
| API NestJS | Disco (`plantillas/`) | Ruta local `plantillas/` | Sistema de archivos (solo lectura) | Servir la plantilla de la lista de alumnos. Se sirve desde `backend/plantillas` y **no** desde `public/`, porque `public/` se vacía en cada compilación. |
| API NestJS | Servidor SMTP | `SMTP_HOST:SMTP_PORT` (por defecto `smtp.gmail.com:587`, `SMTP_SECURE=false`) | SMTP con usuario y contraseña (`SMTP_USER` / `SMTP_PASS`), remitente `MAIL_FROM` | Invitaciones a docentes, credenciales de la presidencia y de las secretarías, avisos de decisión sobre una institución y **certificados a los alumnos** (con el PDF adjunto). |
| Navegador → túnel | API NestJS | El túnel publica el `:2000` | HTTPS del túnel → HTTP local | Dar dirección pública al sistema (enlaces de invitación y QR del certificado). |
| Proxy inverso | API NestJS | `127.0.0.1:2000` | HTTP | Publicar en 80/442 con dominio y HTTPS, sin exponer el 2000. |
| Administración | PostgreSQL | Misma instancia, `CREATE DATABASE … WITH TEMPLATE` | SQL local | Respaldar la base completa (`clasesconjuntas_respaldo_20261012`). |
| Administración | Disco (`uploads/`) | Copia de carpeta | Sistema de archivos | Respaldar los archivos del usuario, que no van dentro de la base. |

### 2.1 Las dos direcciones públicas (y por qué son dos)

| Variable | Quién la usa | ¿Mira las cabeceras de la petición? | Para qué |
| --- | --- | --- | --- |
| `FRONTEND_URL` | `backend/src/common/url-publica.ts` (invitaciones y avisos por correo) | **Sí**: si no apunta a `localhost`, manda; si no, se deduce de `X-Forwarded-Proto`/`X-Forwarded-Host`, `Origin`, `Referer` o `Host` | Que el enlace del correo apunte a donde el usuario está usando la aplicación (túnel incluido). Se puede acotar con `URLS_PERMITIDAS`. |
| `URL_PUBLICA` | `backend/src/certificados/rutas-certificado.ts` (el QR del certificado) | **No** | Base del enlace `{URL_PUBLICA}/verificar/{folio}?c={código}` impreso en el PDF. Si falta se usa `http://localhost:2000` y la emisión no se cae. |

> **Consecuencia práctica:** con un túnel y `URL_PUBLICA` sin tocar, **los
> correos sí llevan la dirección del túnel, pero el QR impreso apunta a
> `localhost`** y no se abrirá desde el móvil del alumno. En un despliegue con
> dominio hay que poner las dos variables.

### 2.2 CORS y origen cruzado

* `app.enableCors({ origin: origenes, credentials: false })`, con
  `origenes = FRONTEND_URL (admite varias separadas por coma) + http://localhost:4200 + http://127.0.0.1:4200`.
* En producción **todo sale del mismo origen** (`:2000`), así que CORS no entra
  en juego; en desarrollo, con `ng serve` en el `4200`, sí, y por eso las rutas
  de archivos en línea llevan `Cross-Origin-Resource-Policy: cross-origin`.

### 2.2 Arranque del servidor (lo que ocurre antes de atender)

| Paso | Dónde | Qué hace |
| --- | --- | --- |
| 1 | `backend/src/main.ts` | Crea el proceso NestJS, fija CORS, el `ValidationPipe` global y el filtro de errores de Prisma. |
| 2 | `backend/src/main.ts` | Crea `uploads/` y sus subcarpetas si no existen y monta los estáticos con sus cabeceras. Los estáticos de la SPA van con gzip y ETag, y caché larga para los nombres con hash (ver [`rendimiento.md`](../rendimiento.md)). |
| 2 | `backend/src/main.ts` | Si existe `backend/public/index.html`, monta la SPA y su *fallback*. |
| 4 | `backend/src/auth/auth.module.ts` | Lee `JWT_SECRET`: **si falta o tiene menos de 16 caracteres, la aplicación no arranca**. |
| 5 | `backend/src/cace/cace.service.ts` (`OnApplicationBootstrap`) | Si no hay ninguna presidencia y hay `PRESIDENTE_CORREO`, le crea la cuenta con contraseña provisional (cambio obligatorio) y le manda las credenciales. Un fallo aquí **no** impide arrancar. |
| 6 | `backend/src/recordatorios/recordatorios.scheduler.ts` | Deja programada la agenda y la caducidad de solicitudes. |
| 7 | `backend/src/main.ts` | `app.listen(PORT ?? 2000)` y registra «Backend corriendo en http://localhost:2000». |

---

## 4. Notas de arquitectura

* **Un despliegue, un puerto.** No hace falta nginx ni IIS para que el sistema
  funcione: el proxy inverso es **opcional** y solo aporta dominio, HTTPS y no
  exponer el `2000`.
* **El frontend no tiene servidor propio en producción.** No se usa SSR
  (`@angular/ssr` está por el andamiaje). Si se compila con `--output-path`
  apuntando a `backend/public`, Angular crea una subcarpeta `browser/` y el
  backend deja de encontrar `index.html`: el destino ya está fijado en
  `angular.json` y no hay que pasar la opción.
* **Nada de estado en memoria.** El estado vive en PostgreSQL y en `uploads/`;
  el proceso se puede reiniciar sin perder nada (salvo los envíos de correo en
  curso). La única memoria propia es la **caché derivada** de estáticos
  comprimidos, que se reconstruye sola al primer pedido.
* **Prisma es global.** `PrismaModule` está marcado `@Global()` y también
  `MailModule`, así que la mayoría de los módulos no los importan. La matriz de
  módulos y sus dependencias está en [`modulos_backend.md`](modulos_backend.md).
* **Lo que el sistema no tiene:** cola de trabajos, caché distribuida, segundo
  proceso y servicio de archivos aparte (S2 o similar). Los PDF y las evidencias
  se guardan en el disco del propio servidor. La única caché es **en memoria del
  propio proceso**, para los estáticos comprimidos; no hay CDN ni proxy de caché.
