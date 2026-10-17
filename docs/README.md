# 🏫 Clases Conjuntas

## 📁 Mapa de la documentación

| Carpeta | Qué hay dentro |
|---|---|
| [`producto/`](producto/) | Cómo está diseñado: [`plan-de-accion.md`](producto/plan-de-accion.md) (el plan de la CACE y los certificados por fases), [`certificados-diseno.md`](producto/certificados-diseno.md) y [`diagramas/`](producto/diagramas/) (casos de uso, entidad-relación, clases del dominio, flujo, actividades, secuencias, estados, mapa de pantallas, arquitectura, módulos del backend, permisos, pruebas, cronograma y trazabilidad) |
| [`guias/`](guias/) | Cómo se usa y se pone en marcha: [`manual-de-usuario.md`](guias/manual-de-usuario.md), [`guia-diseno-certificado.md`](guias/guia-diseno-certificado.md), [`guia-de-despliegue.md`](guias/guia-de-despliegue.md), [`receta-para-montarlo.md`](guias/receta-para-montarlo.md), [`practica-en-maquina-virtual.md`](guias/practica-en-maquina-virtual.md) y [`respaldo-y-restauracion.md`](guias/respaldo-y-restauracion.md) |
| [`tesis/`](tesis/) | Los documentos académicos: memoria, marco teórico, antecedentes e informe técnico |
| [`informes/`](informes/) | Informes de entrega y de actividades |
| [`presentacion/`](presentacion/) | Material para exponer: discurso, guion de estudio y las presentaciones |
| [`auditorias/`](auditorias/) | Las auditorías de calidad y las respuestas a cada una |
| [`plantillas/`](plantillas/) | Los diseños de ejemplo del certificado, la imagen de zonas y la plantilla de la lista de alumnos (la aplicación sirve copias desde `backend/plantillas/`) |
| [`capturas/`](capturas/) | Capturas de pantalla de las verificaciones |
| [`logos/`](logos/) | Material de imagen de la marca |

**Clases Conjuntas** es una plataforma web B2B (institución a institución) diseñada para facilitar la colaboración académica entre instituciones educativas mediante la creación y gestión de **clases espejo**, con la **CACE** (Comunidad de Apoyo a Clases Espejo) como autoridad que aprueba a las instituciones participantes, da identidad a la comunidad y respalda los **certificados**.

Una clase espejo permite que docentes de distintas instituciones coordinen una experiencia académica conjunta utilizando herramientas de comunicación y colaboración virtual.

> **Última actualización:** semana 8 (ciclo completo hasta *Finalizado*) más las auditorías v3, v4 y de código muerto v5, y las fases de la CACE y de los certificados (instituciones con estado ante la CACE, identidad de la CACE, secretarías, presidencia transmisible, listas de alumnos, emisión, anulación, envío y verificación pública de certificados).

---

## 📘 Documentación del proyecto

| Documento | Contenido |
| --- | --- |
| `docs/README.md` (este archivo) | Documentación técnica: instalación, API, modelo de datos, roles y capacidades, estado y plan. |
| [`guias/manual-de-usuario.md`](guias/manual-de-usuario.md) | **Manual de usuario** paso a paso para agente y docente. |
| [`guias/guia-de-despliegue.md`](guias/guia-de-despliegue.md) | **Guía de despliegue** en un servidor Linux o Windows (base de datos, servicio, HTTPS, respaldos). |
| [`guias/receta-para-montarlo.md`](guias/receta-para-montarlo.md) | La misma instalación contada **como una receta de cocina**, paso a paso y sin formalidades. |
| [`guias/practica-en-maquina-virtual.md`](guias/practica-en-maquina-virtual.md) | **Ensayo general en una máquina virtual**: montarlo, romperlo y arreglarlo antes de tocar un servidor real. |
| [`guias/guia-diseno-certificado.md`](guias/guia-diseno-certificado.md) | **Guía para diseñar el certificado fuera de la aplicación** (medidas, zonas y archivos de ejemplo). |
| [`guias/respaldo-y-restauracion.md`](guias/respaldo-y-restauracion.md) | El respaldo de la base (`clasesconjuntas_respaldo_20261013`) y cómo restaurarlo. |
| [`producto/plan-de-accion.md`](producto/plan-de-accion.md) | El plan por fases de la CACE, las instituciones y los certificados. |
| [`producto/plan-de-fases-pendientes.md`](producto/plan-de-fases-pendientes.md) | El plan por fases de **lo que falta** para uso real (cuenta, correo, integridad, operación, privacidad y mantenibilidad), con criterios de aceptación. |
| [`producto/certificados-diseno.md`](producto/certificados-diseno.md) | Las decisiones de diseño de los certificados (plantilla universal, emisión, verificación y entrega). |
| [`informes/informe-de-actividades.md`](informes/informe-de-actividades.md) | **Informe de actividades con evidencia**: cronología por fechas, commits, métricas, estado verificado y pendientes. |
| [`informes/informe-para-el-cliente.md`](informes/informe-para-el-cliente.md) | El informe de entrega para el cliente. |
| [`auditorias/`](auditorias/) | Las auditorías de calidad, sus respuestas y la auditoría de código muerto v5. |
| [`producto/diagramas/`](producto/diagramas/) | Los **14 diagramas**: casos de uso, entidad-relación, clases del dominio, arquitectura (componentes y despliegue), diagrama de flujo, actividades, secuencias, estados, mapa de pantallas, módulos del backend y sus endpoints, permisos (roles × capacidades), pruebas, cronograma y trazabilidad. |

---

## 🧭 Índice

**Puesta en marcha**

* [Tecnologías](#-tecnologías)
* [Estructura general](#-estructura-general)
* [Requisitos](#-requisitos)
* [Instalación](#-instalación)
* [Configuración del Backend](#-configuración-del-backend)
* [Configuración de PostgreSQL](#-configuración-de-postgresql)
* [Variables de entorno](#-variables-de-entorno)
* [Prisma](#-prisma)
* [Ejecutar el Backend](#-ejecutar-el-backend)
* [Compilar y desplegar el frontend](#-compilar-y-desplegar-el-frontend)
* [Comandos principales](#-comandos-principales)
* [Datos de demostración](#-datos-de-demostración)
* [Guía de despliegue (documento aparte)](guias/guia-de-despliegue.md)
* [Receta para montarlo (documento aparte)](guias/receta-para-montarlo.md)
* [Práctica en máquina virtual (documento aparte)](guias/practica-en-maquina-virtual.md)
* [Informe de actividades con evidencia (documento aparte)](informes/informe-de-actividades.md)

**Diseño del sistema**

* [Modelo de datos](#-modelo-de-datos)
* [Autenticación y roles](#-autenticación-y-roles)
* [Matriz de capacidades](#matriz-de-capacidades)
* [Instituciones ante la CACE](#-instituciones-ante-la-cace)
* [Identidad de la CACE](#-identidad-de-la-cace)
* [Certificados y verificación pública](#-certificados-y-verificación-pública)
* [Flujo de estados](#-flujo-de-estados)
* [Endpoints de la API](#-endpoints-de-la-api)
  * [Autenticación y usuarios](#autenticación-y-usuarios)
  * [Panel del agente](#panel-del-agente)
  * [Solicitudes de clase espejo](#solicitudes-de-clase-espejo)
  * [Proyecto, planificación y chat](#proyecto-planificación-y-chat)
  * [Sesiones, actividades y evidencias](#sesiones-actividades-y-evidencias)
  * [Reportes de clase, evaluación y cierre](#reportes-de-clase-evaluación-y-cierre)
  * [Lista de alumnos](#lista-de-alumnos)
  * [Certificados](#certificados)
  * [Verificación pública](#verificación-pública)
  * [Panel de la CACE: instituciones](#panel-de-la-cace-instituciones)
  * [Panel de la CACE: miembros y presidencia](#panel-de-la-cace-miembros-y-presidencia)
  * [Panel de la CACE: identidad, comunidad y premios](#panel-de-la-cace-identidad-comunidad-y-premios)
  * [Panel de la CACE: plantilla del certificado](#panel-de-la-cace-plantilla-del-certificado)
  * [Borrado de instituciones](#borrado-de-instituciones)
* [Seguridad implementada](#-seguridad-implementada)

**Desarrollo y calidad**

* [Pruebas de API](#-pruebas-de-api)
* [Consideraciones importantes para desarrolladores](#-consideraciones-importantes-para-desarrolladores)
* [Estado actual del proyecto](#-estado-actual-del-proyecto)
* [Auditorías y control de calidad](#-auditorías-y-control-de-calidad)
* [Plan de desarrollo (metas semanales)](#-plan-de-desarrollo-metas-semanales)
* [Guía para agentes / futuros desarrolladores](#-guía-para-agentes--futuros-desarrolladores)

**Cierre**

* [Flujo general del sistema](#-flujo-general-del-sistema)
* [Recomendaciones para futuros desarrolladores](#-recomendaciones-para-futuros-desarrolladores)
* [Filosofía del proyecto](#-filosofía-del-proyecto)
* [Licencia](#-licencia)

---

## 🎯 Objetivo del proyecto

La plataforma busca permitir que dos instituciones educativas puedan:

* Registrar y administrar sus usuarios.
* Registrar docentes y materias.
* Publicar propuestas de clases espejo.
* Enviar solicitudes de colaboración a otras instituciones.
* Revisar y aprobar solicitudes.
* Coordinar la planificación de una clase conjunta.
* Registrar sesiones y actividades.
* Generar reportes de las sesiones.
* Registrar evidencias y evaluaciones.
* Mantener un historial de las colaboraciones realizadas.

Y que la **CACE** (Comunidad de Apoyo a Clases Espejo), a través de su
presidencia y sus secretarías, pueda:

* Aprobar, rechazar, vetar y reactivar a las instituciones participantes.
* Buscar antes de crear (directorio público) para no duplicar instituciones y
  confirmar el alta de los agentes nuevos de una institución ya aprobada.
* Autorizar el borrado definitivo de una institución rechazada sin historia.
* Dar identidad a la comunidad: lema, descripción, logo, tema visual, países y
  premios y reconocimientos.
* Diseñar y firmar la plantilla del **certificado** que respalda la comunidad.

Y que los **docentes** puedan cerrar el ciclo con los alumnos:

* Subir la lista de sus alumnos (Excel, CSV o pegado).
* Emitir sus **certificados** (solo con la clase cerrada), descargarlos en PDF o
  en ZIP y enviarlos por correo.
* Anular un certificado con motivo, y que cualquiera pueda **verificarlo** en la
  página pública.

---

# 🛠 Tecnologías

Las versiones de esta sección salen de `backend/package.json` y
`frontend/package.json`.

## Backend

| Dependencia | Versión declarada | Para qué |
| --- | --- | --- |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | `^11.0.1` | El framework (NestJS 11). |
| `@nestjs/jwt` | `^11.0.2` | Firma y verificación del token de sesión. |
| `prisma` / `@prisma/client` | `^6.19.3` | ORM y cliente generado (generador propio → `backend/generated/prisma`). |
| PostgreSQL | — | Base de datos (`DATABASE_URL`). |
| `bcrypt` | `^6.0.0` | Hash de contraseñas. |
| `class-validator` / `class-transformer` | `^0.15.1` / `^0.5.1` | Validación y transformación de DTO. |
| `nodemailer` | `^9.1.0` | Correo saliente (invitaciones, avisos de la CACE, certificados). |
| `pdfkit` | `^0.20.2` | Generación de los PDF (certificados y resumen de la clase). |
| `qrcode` | `^1.5.4` | El QR de verificación que va estampado en el certificado. |
| `jszip` | `^3.10.2` | La descarga de certificados en ZIP. |
| `exceljs` | `^4.4.0` | Lectura de las listas de alumnos en Excel (`.xlsx`). |
| `multer` (vía `@nestjs/platform-express`) | `^11.0.1` | Subida de archivos (evidencias, fotos, logos, fondos de la plantilla). |
| `dotenv` | `^17.4.2` | Carga de `backend/.env`. |
| TypeScript | `^5.7.3` | Lenguaje. |

## Frontend

| Dependencia | Versión declarada | Para qué |
| --- | --- | --- |
| `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`, `@angular/platform-browser` | `^21.2.0` | Angular 21 con **componentes standalone**, **signals** y modo **zoneless**. |
| `@angular/cli` / `@angular/build` | `^21.2.21` | Compilación (`ng build`) y servidor de desarrollo (`ng serve`). |
| `@angular/ssr` | `^21.2.21` | Presente por el andamiaje de Angular; **la aplicación se sirve como SPA** desde `backend/public`. |
| `express` | `^5.1.0` | Dependencia del andamiaje de SSR. |
| `vitest` | `^4.0.8` | Pruebas unitarias del frontend (`npm test` usa el runner de Angular sobre Vitest). |
| TypeScript | `~5.9.2` | Lenguaje. |

Notas de diseño del frontend:

* Formularios reactivos con validación personalizada.
* Diseño institucional CACE (paleta, logo y **temas** predefinidos), **CSS propio
  sin librería de UI**.
* Catálogos desplegables (países ISO 3166, cargos, grados académicos, programas,
  periodos de la comunidad).
* Sin modo oscuro salvo el **tema oscuro** de la lista cerrada de temas de la
  CACE (decisión institucional).

---

# 📁 Estructura general

```text
ClasesEspejo/
│
├── backend/
│   ├── src/
│   │   ├── auth/            # registro, login, activación por invitación, JWT
│   │   │                    #   + capacidades.guard.ts (@Requiere + CapacidadesGuard)
│   │   ├── usuarios/        # /usuarios/me (perfil, foto y cambio de contraseña)
│   │   ├── agentes/         # panel del agente: docentes, altas por confirmar
│   │   ├── instituciones/   # mi institución, catálogo de destinos y directorio
│   │   ├── materias/        # CRUD de materias
│   │   ├── asignaciones/    # docente ↔ materia por periodo
│   │   ├── solicitudes/     # clases espejo: crear, editar, doble revisión
│   │   ├── proyectos/       # proyecto + planificación + chat + sesiones +
│   │   │                    #   actividades + evidencias + reportes + evaluación
│   │   │                    #   + listas de alumnos + resumen en PDF
│   │   ├── certificados/    # plantilla, emisión, PDF, ZIP, envío, anulación y
│   │   │                    #   verificación pública (código por HMAC)
│   │   ├── cace/            # CACE: capacidades, instituciones, miembros,
│   │   │                    #   presidencia, identidad (textos, logo, temas,
│   │   │                    #   países, premios) y solicitudes de borrado
│   │   ├── recordatorios/   # agenda, caducidad y recordatorios
│   │   ├── mail/            # envío de correos (Nodemailer)
│   │   ├── prisma/          # PrismaService (omit global de passwordHash)
│   │   ├── common/
│   │   │   ├── estados.ts               # estados del dominio centralizados
│   │   │   ├── capacidades.ts           # roles y matriz de capacidades
│   │   │   ├── temas-cace.ts            # lista cerrada de temas de la CACE
│   │   │   ├── institucion-habilitada.ts# ¿puede operar el agente?
│   │   │   ├── plazos.ts                # antelación, urgencia y caducidad
│   │   │   ├── url-publica.ts           # URL pública de los enlaces por correo
│   │   │   ├── imagenes.ts              # opciones de multer para imágenes
│   │   │   ├── filters/                 # filtro de errores de Prisma
│   │   │   └── guards/                  # rate limit del login/activación
│   │   ├── app.module.ts
│   │   └── main.ts          # CORS, filtros, estáticos, /uploads, SPA fallback
│   │
│   ├── prisma/
│   │   ├── schema.prisma    # modelo de datos completo (32 tablas)
│   │   └── migrations/      # 21 migraciones versionadas
│   │
│   ├── generated/
│   │   └── prisma/          # cliente generado (NO editar a mano)
│   │
│   ├── scripts/
│   │   ├── seed-demo.js             # siembra base (instituciones, docentes, materias)
│   │   ├── seed-demo-clases.js      # simulación de clases (proyectos y solicitudes)
│   │   ├── borrar-demo-clases.js    # deshace la simulación de clases
│   │   ├── verificar-flujo.js       # comprobación del flujo por API
│   │   ├── verificar-navegador.js   # comprobación con navegador automatizado
│   │   ├── probar-editor-certificado.js   # prueba del editor de la plantilla
│   │   └── revisar-diseno-certificado.js  # revisión de un diseño de certificado
│   │
│   ├── plantillas/          # archivos descargables servidos en /plantillas
│   │                        #   (lista de alumnos de ejemplo, zonas y guía de diseño)
│   ├── uploads/             # archivos del usuario (no versionado):
│   │                        #   evidencias, avatares, instituciones, cace,
│   │                        #   premios, certificados (privados) y certificados-fondos
│   ├── public/              # frontend compilado que sirve NestJS
│   ├── .env                 # NO versionado
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── frontend/
│   └── src/app/
│       ├── core/            # servicios, guards, interceptores, modelos, utilidades
│       │                    #   y constants/ (catalogos.ts, cace.ts, guia.ts)
│       ├── shared/          # layout, modal, calendario, agenda y guía interactiva
│       └── features/
│           ├── auth/        # login, registro y activación
│           ├── agente/      # panel del agente de internacionalización
│           ├── docente/     # panel del docente (solicitudes y clases)
│           ├── cace/        # panel de la CACE + editor del diseño del certificado
│           ├── proyecto/    # clase espejo: planificación → alumnos → certificados → cierre
│           └── verificacion/# página pública /verificar/:folio
│
└── docs/
    ├── README.md
    ├── producto/            # diseño y diagramas
    ├── guias/               # manual, despliegue, certificado, respaldo
    ├── auditorias/          # QA y auditoría de código muerto
    ├── informes/            # informes de entrega y de actividades
    ├── presentacion/        # discurso, guion y presentaciones
    ├── tesis/               # documentos académicos
    ├── plantillas/          # diseños de ejemplo y plantilla de la lista
    ├── capturas/            # capturas de pantalla de las verificaciones
    └── logos/               # material de imagen de la marca
```

---

# 📋 Requisitos

Para trabajar con el proyecto se necesita instalar:

* Node.js
* npm
* PostgreSQL
* Git

Se recomienda utilizar una versión reciente de Node.js compatible con NestJS 11.

La versión instalada en el equipo donde se revisó esta documentación es:

```text
Node.js 24.21.0
npm 11.19.0
```

---

# 🚀 Instalación

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
```

Entrar al proyecto:

```bash
cd ClasesEspejo
```

---

# 🔧 Configuración del Backend

Entrar a la carpeta:

```bash
cd backend
```

Instalar las dependencias:

```bash
npm install
```

---

# 🗄 Configuración de PostgreSQL

Crear una base de datos PostgreSQL para el proyecto.

Por ejemplo:

```text
ClasesconjuntasBD
```

El proyecto utiliza PostgreSQL como sistema gestor de base de datos.

Las tablas se crean con las **migraciones versionadas** que están en
`backend/prisma/migrations/` (**21 migraciones**):

```bash
npx prisma migrate deploy
```

> `db push` sincroniza el esquema sin dejar historial y dejó de ser el modo de
> trabajo: el esquema ya está **migrado y versionado**, y la última migración es
> `20261011173930_cambio_presidencia`.
>
> `prisma db push` sigue sirviendo solo para una base de pruebas desechable. En
> una base con datos, usar `migrate deploy`.
>
> Para ver el historial de migraciones aplicadas: `npx prisma migrate status`.

---

# 🔐 Variables de entorno

Crear un archivo:

```text
backend/.env
```

El archivo `.env` **NO debe subirse al repositorio**.

Debe contener al menos:

```env
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/ClasesconjuntasBD?schema=public"
```

Ejemplo:

```env
DATABASE_URL="postgresql://postgres:TU_CONTRASEÑA@localhost:5432/ClasesconjuntasBD?schema=public"
```

Además, para autenticación, enlaces de activación, correos, certificados y el
alta de la presidencia de la CACE:

```env
# --- Autenticación (JWT) ---
# El mismo secreto firma los tokens de sesión y deriva el código de
# verificación de los certificados (HMAC). Mínimo 16 caracteres.
JWT_SECRET="clave-secreta-de-al-menos-16-caracteres"
JWT_EXPIRES_IN="1d"
INVITATION_EXPIRES_IN="7d"

# --- URL pública del frontend (se usa en el enlace de activación) ---
FRONTEND_URL="http://localhost:4200"

# --- Dirección pública de la aplicación: base del enlace del QR del certificado
#     ({URL_PUBLICA}/verificar/{folio}?c={codigo}). Si falta, se usa
#     http://localhost:3000 y la emisión sigue funcionando. ---
URL_PUBLICA="http://localhost:3000"

# --- Servicio de correo (Nodemailer / SMTP) ---
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="no-reply@clasesespejo.local"

# --- Correo del presidente de la CACE: al arrancar, si no hay ninguna
#     presidencia registrada, se le crea la cuenta y se le manda su contraseña
#     provisional (con cambio obligatorio al entrar). ---
PRESIDENTE_CORREO="presidencia@ejemplo.org"

# --- Opcionales ---
PORT="3000"
REVISION_DIAS_ANTELACION="7"
URLS_PERMITIDAS=""
```

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL (la usa Prisma). |
| `JWT_SECRET` | Firma de los tokens. **La aplicación no arranca si falta o tiene menos de 16 caracteres.** Con este mismo secreto se **deriva** el código de verificación de los certificados, así que cambiarlo invalida los códigos ya impresos. |
| `JWT_EXPIRES_IN` | Vigencia del token de sesión. |
| `INVITATION_EXPIRES_IN` | Vigencia del token de invitación a docentes. |
| `FRONTEND_URL` | URL del frontend. Se usa como **primera opción** para el enlace de activación y como origen permitido en CORS (admite varias separadas por coma). |
| `URL_PUBLICA` | Dirección pública de la aplicación; es la base del enlace que lleva el **QR del certificado**. Si no se define, se usa `http://localhost:3000`. |
| `PRESIDENTE_CORREO` | Correo de la presidencia de la CACE. Si al arrancar no existe ninguna presidencia, se le crea la cuenta (con DNI provisional y contraseña provisional) y se le envían sus credenciales. Sin esta variable no se da de alta a nadie. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Servidor de correo saliente: invitaciones a docentes, avisos de la CACE (decisiones sobre instituciones, credenciales de secretarías, cambios de presidencia), altas de agentes y **certificados a los alumnos**. |
| `PORT` | Puerto del backend (por defecto `3000`). |
| `REVISION_DIAS_ANTELACION` | Opcional. Días de antelación con los que debe responderse una solicitud antes de la fecha propuesta (por defecto `7`). Pasado ese plazo, la solicitud caduca sola. |
| `URLS_PERMITIDAS` | Opcional. Lista de hosts (admite `*.dominio`) que se aceptan para deducir la URL pública de la petición. Vacío = se acepta cualquier host válido. |

> Estas son las variables que usa el código; el `backend/.env` real de este
> equipo contiene exactamente estas claves (sin `PORT`, `REVISION_DIAS_ANTELACION`
> ni `URLS_PERMITIDAS`, que son opcionales).
>
> Nunca subir contraseñas, claves JWT ni otros secretos al repositorio.

## Enlaces públicos (invitaciones) con túnel o proxy

El correo de invitación lleva un enlace del tipo `<url-pública>/activate?token=…`.
Si esa URL fuera siempre `localhost`, el docente **no podría abrirlo desde su
equipo**; pasa con un túnel (`cloudflared`, `ngrok`), con un proxy inverso nuevo
o al probar desde otra máquina de la red.

Por eso la URL se resuelve en este orden (`backend/src/common/url-publica.ts`):

1. **`FRONTEND_URL`**, si apunta a algo distinto de `localhost`. Es lo correcto
   cuando el sistema ya tiene dominio propio.
2. **El origen real de la petición** (`X-Forwarded-Proto` / `X-Forwarded-Host`,
   `Origin`, `Referer` o `Host`), siempre que no sea `localhost`. Esto hace que
   **el túnel funcione sin tocar la configuración**: el enlace apunta a la misma
   dirección desde la que el agente está usando la aplicación.
3. **`FRONTEND_URL`** aunque sea `localhost` (desarrollo).

Para acotar el paso 2 en un servidor expuesto, definir `URLS_PERMITIDAS` con los
hosts legítimos (`URLS_PERMITIDAS="*.trycloudflare.com,clases.miescuela.edu"`):
los demás se descartan y se usa `FRONTEND_URL`.

> **Consejo con túneles:** apunta el túnel al **puerto 3000** (`cloudflared tunnel
> --url http://localhost:3000`). Al servir ahí el frontend compilado y la API, todo
> queda en el mismo origen y no hay que tocar CORS. Si en cambio apuntas el túnel
> al `4200` (`ng serve`), el servidor de desarrollo de Angular bloquea los hosts
> desconocidos: habría que añadirlos en `angular.json`
> (`projects.frontend.architect.build.options.security.allowedHosts`).

## La URL del QR de los certificados es otra variable

El enlace del QR **no** usa `resolverUrlPublica()`: sale de **`URL_PUBLICA`**
(`backend/src/certificados/rutas-certificado.ts`), que **no mira las cabeceras de
la petición**. Son dos variables para el mismo concepto y solo una es consciente
del proxy, así que:

* Si se trabaja con un túnel y `URL_PUBLICA` sigue en `http://localhost:3000`,
  **el QR impreso apunta a `localhost`** y no se abrirá desde el móvil del
  alumno, aunque los correos sí salgan con la dirección del túnel.
* En un despliegue con dominio, poner **las dos**: `FRONTEND_URL` y
  `URL_PUBLICA` con el dominio real, y volver a emitir (o reemitir) solo si hace
  falta que los QR ya generados cambien de destino. Los certificados ya emitidos
  guardan su PDF con el QR que tenían.

---

# 🧬 Prisma

El proyecto utiliza Prisma como ORM.

El esquema de la base de datos se encuentra en:

```text
backend/prisma/schema.prisma
```

El cliente de Prisma se genera en:

```text
backend/generated/prisma
```

## Generar el cliente de Prisma

Después de instalar las dependencias o modificar el esquema:

```bash
npx prisma generate
```

> En Windows, `prisma generate` falla con `EPERM` si el backend está corriendo y
> mantiene abierta la DLL del cliente generado. **Detén el servidor antes de
> regenerar.**

## Validar el esquema

```bash
npx prisma validate
```

## Aplicar las migraciones

```bash
npx prisma migrate deploy   # aplica las pendientes (21 en total)
npx prisma migrate status   # dice qué está aplicado y qué falta
npx prisma migrate dev --name <nombre>   # crea una migración nueva (desarrollo)
```

> El proyecto pasó de `db push` a **migraciones versionadas**: el historial está
> en `backend/prisma/migrations/` y la última es
> `20261011173930_cambio_presidencia`.

## Consultar la base de datos

Para abrir Prisma Studio:

```bash
npx prisma studio
```

---

# ▶ Ejecutar el Backend

Modo desarrollo:

```bash
npm run start:dev
```

El servidor debería iniciar correctamente y mostrar:

```text
Nest application successfully started
Backend corriendo en http://localhost:3000
```

Por defecto, la aplicación utiliza:

```text
http://localhost:3000
```

---

# 🏗 Compilar y desplegar el frontend

NestJS sirve el frontend ya compilado desde `backend/public`, de modo que en
producción **todo el sistema corre en un solo puerto** (`3000`).

## 1. Compilar Angular directamente en `backend/public`

Desde `frontend/`:

```bash
npx ng build
```

> El destino del build está configurado en `frontend/angular.json`
> (`outputPath` → `../backend/public`, con los archivos del navegador en la raíz).
> Por eso **no hay que pasar `--output-path`**: si se pasa apuntando a
> `backend/public`, Angular crea una subcarpeta `browser/` y el backend deja de
> encontrar `index.html`. Tampoco hace falta compilar en `frontend/dist`.

## 2. Reiniciar el backend

`main.ts` comprueba si existe `backend/public/index.html` **al arrancar**:

* Si existe, sirve los archivos estáticos y aplica el **fallback SPA** (cualquier
  `GET` sin extensión que no sea una ruta de la API devuelve `index.html`).
* Si no existe, el backend solo expone la API.

Los prefijos de la API se derivan del router de NestJS (más una lista conocida
como red de seguridad), así que **un módulo nuevo no queda "tapado" por el
`index.html`**.

> **Direcciones que son a la vez pantalla y API.** `GET /proyectos/:id` existe en
> la API y `/proyectos/:id` también es una pantalla del frontend. Si alguien abre
> esa dirección en el navegador (o recarga con F5 dentro de una clase espejo), el
> navegador **no manda la cabecera de autenticación** y la API respondería
> `401` en JSON: el usuario vería un texto ilegible en vez de la pantalla. Por eso
> el fallback distingue quién pide: si la petición pide HTML (`Accept:
> text/html`, que es lo que manda una navegación) se entrega la aplicación; si
> pide JSON (las llamadas de la propia app, o un monitor con `*/*`) se entrega la
> API.

## 3. URLs del sistema en producción

| Recurso | URL |
| --- | --- |
| Aplicación (frontend + API) | `http://localhost:3000` |
| API | `http://localhost:3000/<prefijo>` (p. ej. `/auth`) |
| Verificación pública de un certificado | `http://localhost:3000/verificar/<folio>?c=<código>` |
| Evidencias subidas (descarga forzada) | `http://localhost:3000/uploads/<archivo>` |
| Fotos de perfil (en línea) | `http://localhost:3000/avatares/<archivo>` |
| Logos de institución (en línea) | `http://localhost:3000/logos/<archivo>` |
| Logo de la CACE (en línea) | `http://localhost:3000/cace-logo/<archivo>` |
| Imágenes de premios (en línea) | `http://localhost:3000/premios/<archivo>` |
| Fondos de la plantilla del certificado (en línea) | `http://localhost:3000/certificado-fondo/<archivo>` |
| Plantillas descargables (lista de alumnos, zonas, guía) | `http://localhost:3000/plantillas/<archivo>` |
| Certificados emitidos | **No** son estáticos: `/uploads/certificados/…` responde 404 y el PDF se descarga por `/proyectos/:id/certificados/:id/pdf` con sesión |

En desarrollo se puede trabajar con dos servidores (`ng serve` en `4200` +
NestJS en `3000`): los servicios del frontend detectan el puerto y apuntan al
backend automáticamente.

---

# 📜 Comandos principales

Desde `backend/`:

| Comando               | Función                           |
| --------------------- | --------------------------------- |
| `npm install`         | Instala dependencias              |
| `npm run start:dev`   | Ejecuta el servidor en desarrollo |
| `npm run build`       | Compila el backend                |
| `npm run start`       | Ejecuta NestJS                    |
| `npm run start:prod`  | Ejecuta la versión compilada      |
| `npx prisma generate` | Genera el cliente Prisma          |
| `npx prisma validate` | Valida el esquema Prisma          |
| `npx prisma migrate deploy` | Aplica las migraciones pendientes |
| `npx prisma migrate status` | Estado del historial de migraciones |
| `npx prisma studio`   | Abre la interfaz de Prisma        |
| `npm run lint`        | Ejecuta ESLint                    |
| `npm test`            | Ejecuta pruebas                   |
| `node scripts/seed-demo.js` | Limpia y siembra los datos base de demostración |
| `node scripts/seed-demo-clases.js` | Simula clases espejo (proyectos y solicitudes) |
| `node scripts/borrar-demo-clases.js` | Elimina la simulación de clases |
| `node scripts/verificar-flujo.js` | Comprueba el flujo completo por API |
| `node scripts/verificar-navegador.js` | Comprueba la interfaz con un navegador automatizado |

Desde `frontend/`:

| Comando | Función |
| --- | --- |
| `npm install` | Instala dependencias |
| `npm start` | Servidor de desarrollo en `http://localhost:4200` |
| `npm run build` | Compila para producción |
| `npm test` | Ejecuta las pruebas unitarias |

---

## 🎭 Datos de demostración

La siembra se hace en **dos pasos**, ambos desde `backend/`.

### Paso 1 — Datos base

```bash
node scripts/seed-demo.js
```

Crea **2 instituciones**, **5 materias por institución**, **15 docentes**,
las asignaciones docente ↔ materia y las solicitudes de clase espejo.

### Paso 2 — Simulación de clases (opcional, para demos)

```bash
node scripts/seed-demo-clases.js
```

Genera un escenario con **varias clases espejo simultáneas** en todos los
estados posibles, para evaluar la vista del docente cuando tiene trabajo
pendiente y trabajo terminado a la vez:

* **11 proyectos:** 3 *Finalizado*, 3 *En curso*, 4 *En planificación* y 1 *Cancelado*.
* **19 solicitudes:** 4 *Pendiente*, 2 *Aprobada por origen*, 11 *Aprobada* y 2 *Rechazada*.
* **19 sesiones**, **8 evidencias** y **~15 eventos de agenda** en los próximos 21 días
  (con días que llegan a tener 2 coincidencias).
* Fechas calculadas **relativas al día de ejecución**, así que la demo nunca
  queda "vieja".
* Escribe `backend/scripts/demo-clases-ids.json` con los identificadores creados.

Para deshacer únicamente la simulación (respetando los datos base):

```bash
node scripts/borrar-demo-clases.js
```

> ⚠ El script de borrado elimina en orden seguro de claves foráneas y también
> los archivos de evidencia de la simulación.

### Credenciales de prueba

Contraseña común: `Demo1234`

| Rol | Correo |
| --- | --- |
| Agente (México) | `agente.calkini@clasesespejo.mx` |
| Agente (Colombia) | `agente.colombia@clasesespejo.co` || Docente (México) | `roberto.perez@clasesespejo.mx` |
| Docente (México) | `sofia.gomez@clasesespejo.mx` |
| Docente (México) | `carlos.hernandez@clasesespejo.mx` |
| Docente (México) | `ana.sanchez@clasesespejo.mx` |
| Docente (México) | `elena.castro@clasesespejo.mx` |
| Docente (México) | `laura.martinez@clasesespejo.mx` |
| Docente (México) | `jorge.morales@clasesespejo.mx` |
| Docente (México) | `miguel.torres@clasesespejo.mx` |
| Docente (Colombia) | `andres.garcia@clasesespejo.co` |
| Docente (Colombia) | `santiago.giraldo@clasesespejo.co` |
| Docente (Colombia) | `camila.rodriguez@clasesespejo.co` |
| Docente (Colombia) | `isabella.cardenas@clasesespejo.co` |
| Docente (Colombia) | `felipe.ortiz@clasesespejo.co` |
| Docente (Colombia) | `valeria.rojas@clasesespejo.co` |
| Docente (Colombia) | `diego.mendoza@clasesespejo.co` |

> **La presidencia y la secretaría de la CACE no las siembra el script.** La
> cuenta del presidente la crea el **arranque del backend** a partir de
> `PRESIDENTE_CORREO` (con contraseña provisional y cambio obligatorio en el
> primer acceso), y las secretarías las da de alta la presidencia desde su panel.

---

# 🗃 Modelo de datos

El esquema tiene **32 tablas** (`backend/prisma/schema.prisma`, 32 modelos con su
`@@map`). En este mapa se ven las relaciones principales:

```text
USUARIO
    │
    ├── DOCENTE
    │       │
    │       └── DOCENTE_INSTITUCION  ←── INSTITUCION
    │                   │
    │                   └── ASIGNACION_DOCENTE
    │                               │
    │                               ├── MATERIA
    │                               │
    │                               └── SOLICITUD_CLASE_ESPEJO
    │                                       │
    │                                       ├── REVISION_SOLICITUD
    │                                       └── PROYECTO_CLASE_ESPEJO
    │                                               │
    │                                               ├── PROYECTO_DOCENTE
    │                                               │       ├── PARTICIPACION_PLANIFICACION
    │                                               │       └── PARTICIPACION_REPORTE
    │                                               ├── MENSAJE
    │                                               ├── PLANIFICACION_CONJUNTA
    │                                               │       └── REPORTE_PLANIFICACION
    │                                               ├── SESION
    │                                               │       ├── ACTIVIDAD
    │                                               │       ├── EVIDENCIA
    │                                               │       └── REPORTE_CLASE_CONJUNTA
    │                                               ├── EVIDENCIA
    │                                               ├── EVALUACION
    │                                               ├── LISTA_ALUMNOS ── ALUMNO ── CERTIFICADO
    │                                               └── CERTIFICADO
    │
    ├── AGENTE_INTERNACIONALIZACION ── INSTITUCION
    │                                   │
    │                                   ├── MATERIA
    │                                   ├── INVITACION
    │                                   ├── LISTA_ALUMNOS
    │                                   ├── PREMIO
    │                                   └── SOLICITUD_BORRADO_INSTITUCION
    │
    └── MIEMBRO_CACE ── (presidencia, suplencia y secretarías)

INSTITUCION.estado_cace ∈ {PENDIENTE, APROBADA, RECHAZADA, VETADA}

PLANTILLA_CERTIFICADO ── CERTIFICADO ── Alumno / Proyecto
CONFIGURACION_CACE      (una sola fila: lema, descripción, logo y tema)
PAIS_COMUNIDAD          (países de la comunidad CACE)
PREMIO                  (premios y reconocimientos, publicados o en borrador)
CAMBIO_PRESIDENCIA      (historial de transmisiones de la presidencia)
SOLICITUD_BORRADO_INSTITUCION (la secretaría pide, la presidencia autoriza)
```

Notas sobre el modelo:

* **`INSTITUCION`** se relaciona con los docentes a través de
  `DOCENTE_INSTITUCION`; un docente puede pertenecer a más de una institución.
  `estadoCace` (con `motivoCace`, `revisadaPorUsuarioId` y `revisadaEn`) es el
  **estado ante la CACE**, independiente del apagado operativo `activa`.
* **`ASIGNACION_DOCENTE`** es el vínculo real que se usa en las solicitudes y en
  los proyectos (docente + materia + periodo escolar, dentro de una institución).
* **`SOLICITUD_CLASE_ESPEJO`** guarda institución/materia de **origen** y de
  **destino**; cada revisión queda registrada en **`REVISION_SOLICITUD`** con su
  etapa (*origen* o *destino*), el agente que revisó y el motivo.
* **`PROYECTO_CLASE_ESPEJO`** nace automáticamente cuando el **destino** aprueba.
* **`PLANIFICACION_CONJUNTA`** es única por proyecto y guarda las
  participaciones (`PARTICIPACION_PLANIFICACION`) y el reporte de planificación
  (`REPORTE_PLANIFICACION`, único por planificación, con `vistoBueno` y
  `observaciones`).
* **`REPORTE_CLASE_CONJUNTA`** es único por sesión y guarda las firmas de los
  docentes (`PARTICIPACION_REPORTE`) con sus observaciones.
* **`INVITACION`** almacena el token de activación de un docente y su consumo
  (`usadaEn`), lo que impide reutilizarlo.
* **`USUARIO.fotoUrl`** guarda la ruta pública de la foto de perfil
  (`/avatares/…`). Si está vacía, la interfaz muestra las iniciales del usuario.
  `USUARIO.debeCambiarPassword` obliga a cambiar la contraseña provisional (el
  presidente de la CACE y las secretarías nacen así).
* **El rol no es una columna**: se deduce de las filas de `AGENTE_INTERNACIONALIZACION`,
  `DOCENTE` y `MIEMBRO_CACE` (ver la sección de roles).
* **`LISTA_ALUMNOS`** es única por (proyecto, institución): cada institución sube
  la de sus alumnos, y de ahí salen los certificados.
* **`CERTIFICADO`** guarda el PDF emitido (`archivoPdf`) con su `hashSha256`, su
  `folio` único y su `estado` (`EMITIDO` o `ANULADO`). El código de verificación
  **no se guarda**: se deriva del folio con un HMAC.
* **`PLANTILLA_CERTIFICADO` está versionada**: al cambiarla se crea una versión
  nueva y se activa, así que los certificados ya emitidos no cambian nunca.
* **`SOLICITUD_BORRADO_INSTITUCION.institucionId` admite nulos**: la solicitud
  sobrevive al borrado de su institución, para dejar constancia de quién lo pidió
  y quién lo autorizó.
* **`MIEMBRO_CACE.cargo`** (`PRESIDENTE`, `SUPLENTE`, `SECRETARIA`) y su `activo`
  son los que dan el rol de la CACE. Cada transmisión de la presidencia queda en
  **`CAMBIO_PRESIDENCIA`**.

El modelo completo, con los nombres exactos de las columnas, se encuentra en:

```text
backend/prisma/schema.prisma
```

Y su versión gráfica, leída del esquema real, en
[`producto/diagramas/entidad_relacion.md`](producto/diagramas/entidad_relacion.md).

---

# 🔐 Autenticación y roles

El backend utiliza autenticación mediante **JWT**.

El módulo de autenticación se encuentra en `backend/src/auth/` e implementa el flujo de:

* Registro de un agente con su institución (FASE 1). Incluye **estándares internacionales**: país con catálogo ISO 3166, tipo y número de documento, y datos de la institución (estado/provincia, ciudad, teléfono).
* **Buscar antes de crear**: el registro consulta el **directorio público** de instituciones (`GET /instituciones/directorio`, sin sesión) y el agente **se une** a la suya si ya existe; solo crea una nueva si no la encuentra. Así no se duplican instituciones.
* Inicio de sesión y generación de token JWT.
* Invitación de docentes por correo (FASE 2); **el docente completa su propio registro** y crea sus credenciales.
* Activación de la cuenta del docente (FASE 3), consumiendo la invitación de forma atómica (una invitación solo se puede usar una vez).
* **Gate de institución**: el agente debe completar el registro de su institución, y su institución debe estar **aprobada por la CACE**, antes de usar el panel.
* **Correo del presidente de la CACE** (fase 0): al arrancar el backend, si no existe ninguna presidencia y hay `PRESIDENTE_CORREO`, se le crea la cuenta con contraseña provisional y **cambio obligatorio** en el primer acceso.

## Roles

El **rol no es una columna** de `USUARIO`: se deduce de los vínculos. Alguien es
agente si tiene fila en `AGENTE_INTERNACIONALIZACION`, docente si la tiene en
`DOCENTE` y miembro de la CACE si la tiene en `MIEMBRO_CACE` (con `activo`). La
deducción vive en `backend/src/common/capacidades.ts`.

| Rol | Alcance |
| --- | --- |
| **DOCENTE** | Propone clases espejo y, una vez aprobadas, organiza la clase conjunta (planificación, sesiones, actividades, evidencias, reportes y evaluación). Sube la lista de sus alumnos, **emite**, descarga y envía sus certificados, y puede anularlos. |
| **AGENTE** | Agente de internacionalización. Gestiona su institución, sus docentes, sus materias y sus asignaciones. Revisa las solicitudes entrantes, supervisa las clases espejo de su institución y **confirma el alta de los agentes nuevos** que se unen a su institución ya aprobada. |
| **PRESIDENTE_CACE** | Presidencia de la CACE. Aprueba, rechaza, veta y reactiva instituciones; borra definitivamente las rechazadas sin historia y resuelve las solicitudes de borrado; da de alta y activa/desactiva secretarías; **transmite la presidencia**; personaliza la CACE (textos, logo, tema, países y premios) y **diseña y firma la plantilla del certificado**. Puede anular certificados. |
| **SECRETARIA_CACE** | Secretaría de la CACE. Ayuda con la imagen y los premios (personalización, comunidad y premios) y **pide** el borrado de una institución rechazada. **No** aprueba ni veta instituciones, **no** reparte cargos, **no** diseña ni firma la plantilla y **no** emite certificados. |

> La **presidencia se transmite, no se borra ni se desactiva**: quien deja el
> cargo queda como **suplente**, con las mismas capacidades y sin perder el
> acceso, y el cambio queda en `CAMBIO_PRESIDENCIA` (con quién salió, quién entró,
> el motivo y la fecha). Si el sucesor era secretaría, deja de serlo.

## Matriz de permisos

Lo que decide no es el rol sino la **capacidad**. Esta es la tabla real
(`backend/src/common/capacidades.ts`):

| Capacidad (`@Requiere(...)`) | Docente | Agente | Presidencia | Secretaría |
| --- | :---: | :---: | :---: | :---: |
| `emitirCertificados` (emitir, descargar y enviar) | ✅ | ❌ | ❌ | ❌ |
| `anularCertificados` | ✅ | ❌ | ✅ | ❌ |
| `confirmarAgenteInstitucion` (altas de agentes) | ❌ | ✅ | ❌ | ❌ |
| `aprobarInstituciones` (aprobar, rechazar, vetar y reactivar) | ❌ | ❌ | ✅ | ❌ |
| `borrarInstituciones` (borrado definitivo directo) | ❌ | ❌ | ✅ | ❌ |
| `solicitarBorradoInstitucion` (pedir el borrado) | ❌ | ❌ | ❌ | ✅ |
| `resolverSolicitudesBorrado` (autorizar el borrado) | ❌ | ❌ | ✅ | ❌ |
| `gestionarMiembrosCace` (secretarías y presidencia) | ❌ | ❌ | ✅ | ❌ |
| `personalizarCace` (textos, logo, tema y países) | ❌ | ❌ | ✅ | ✅ |
| `publicarPremios` | ❌ | ❌ | ✅ | ✅ |
| `disenarCertificados` (plantilla) | ❌ | ❌ | ✅ | ❌ |
| `firmarCertificados` | ❌ | ❌ | ✅ | ❌ |

Además de las capacidades, cada rol tiene su parte del flujo de la clase espejo
(esas rutas comprueban el rol o la participación, no una capacidad):

| Acción | Docente | Agente |
| --- | :---: | :---: |
| Ver/editar su institución (y su logo) | ❌ | ✅ |
| Invitar, activar/desactivar y eliminar docentes | ❌ | ✅ |
| Crear y editar materias / asignaciones | ❌ | ✅ |
| Crear una solicitud de clase espejo | ✅ | ❌ |
| Editar/cancelar su propia solicitud (Pendiente o Rechazada) | ✅ | ❌ |
| Revisar solicitudes (aprobar/rechazar con motivo) | ❌ | ✅ |
| Ver el proyecto y **todos** sus detalles | ✅ | ✅ (consulta) |
| Agregar/quitar docentes del proyecto | ❌ | ✅ *(solo de su institución)* |
| Datos del proyecto, planificación, sesiones, actividades, evidencias | ✅ | ❌ |
| Chat del proyecto | ✅ | ❌ |
| Reporte de clase conjunto y firmas | ✅ | ❌ |
| Evaluación final y cierre del proyecto | ✅ | ❌ |
| Reporte de planificación | ❌ | ✅ (supervisión) |
| Lista de alumnos y certificados (emisión, ZIP y envío) | ✅ | ❌ |

> **Rol del agente en la clase conjunta (solo consulta).** El agente de internacionalización
> puede ver el proyecto y todos sus detalles y gestionar (agregar/quitar) **únicamente los
> docentes de su propia institución**. Las acciones que organizan la clase —datos del proyecto,
> planificación conjunta, sesiones, actividades, evidencias, reporte de clase y evaluación
> final— son exclusivas de los **docentes participantes**. El reporte de planificación sigue
> correspondiendo al agente, como función de supervisión.
>
> **Quién pide las capacidades.** `GET /cace/capacidades` devuelve el rol y la
> lista de capacidades del usuario que está dentro. La interfaz la usa para
> **esconder** lo que el rol no puede hacer (por ejemplo, la secretaría no ve
> «Instituciones»), y el servidor las vuelve a comprobar en cada ruta con
> `CapacidadesGuard`: esconder un botón no es una medida de seguridad.

## Matriz de capacidades

| Rol | Capacidades (en el orden de la tabla anterior) |
| --- | --- |
| `DOCENTE` | `emitirCertificados`, `anularCertificados` |
| `AGENTE` | `confirmarAgenteInstitucion` |
| `PRESIDENTE_CACE` | `aprobarInstituciones`, `borrarInstituciones`, `resolverSolicitudesBorrado`, `gestionarMiembrosCace`, `personalizarCace`, `publicarPremios`, `disenarCertificados`, `firmarCertificados`, `anularCertificados` |
| `SECRETARIA_CACE` | `personalizarCace`, `publicarPremios`, `solicitarBorradoInstitucion` |

> **La suplencia comparte rol con la presidencia**: el cargo `SUPLENTE` se
> resuelve como `PRESIDENTE_CACE` (las capacidades las reparte esta tabla), y una
> fila de `MIEMBRO_CACE` inactiva no cuenta.

Las contraseñas **no se almacenan directamente**. Se utiliza `bcrypt` para generar hashes.

---

# 🏛 Instituciones ante la CACE

El estado de una institución ante la CACE vive en `INSTITUCION.estadoCace` y es
**independiente** de `activa`, que sigue siendo el apagado operativo.

| Estado | Qué significa | ¿Puede operar? |
| --- | --- | --- |
| **PENDIENTE** | Se acaba de registrar (o alguien se unió a una que estaba pendiente). | No: su agente solo completa los datos de la institución. |
| **APROBADA** | La presidencia la aprobó. | Sí, si además el agente tiene su alta confirmada. |
| **RECHAZADA** | La presidencia la rechazó **con motivo**. | No, y no admite agentes nuevos. El registro se conserva para evitar el bucle de reinscripción. |
| **VETADA** | La presidencia la vetó **con motivo**: es la decisión más grave. | No, y no admite agentes nuevos. Sus clases ya en curso siguen vivas. |

* **Motivo, quién y cuándo.** El rechazo y el veto exigen motivo
  (`motivoCace`), y toda decisión deja `revisadaPorUsuarioId` y `revisadaEn`.
  El motivo viaja en el correo que se le manda al agente de la institución.
* **Reactivar.** Una institución rechazada o vetada vuelve a `APROBADA` con
  `POST /cace/instituciones/:id/reactivar`.
* **Aviso de posible duplicado.** Al listar, el panel marca la institución que se
  parece a otra ya registrada (comparando el nombre sin las palabras genéricas
  como «Universidad» o «Instituto»), para que la presidencia lo mire antes de
  aprobar.
* **Confirmación del alta de un agente.** Cuando alguien se une a una institución
  **ya aprobada**, su alta no la decide la presidencia: la confirman los agentes
  de esa institución (`GET /agentes/confirmaciones` y
  `POST /agentes/confirmaciones/:id/confirmar|rechazar`). Hasta entonces ese
  agente solo puede completar los datos de su institución.
* **Borrado definitivo.** Solo sobre una institución **rechazada y sin historia**
  (sin clases, revisiones ni dependencias). La presidencia puede borrarla
  directamente (`DELETE /cace/instituciones/:id`, capacidad
  `borrarInstituciones`); la secretaría solo puede **pedirlo**
  (`POST /cace/instituciones/:id/solicitud-borrado`), y la presidencia lo
  autoriza (`PATCH /cace/solicitudes-borrado/:id`). Al aprobar, el borrado se
  ejecuta y queda registrado quién lo autorizó. La solicitud sobrevive al
  borrado (`institucionId` puede quedar en `null`).
* **El catálogo de destinos solo muestra aprobadas.** `GET /instituciones` filtra
  por `activa`, `registroCompleto` y `estadoCace = APROBADA`: ofrecer como destino
  una institución que no puede operar sería dejar al docente proponer algo
  imposible.

---

# 🎨 Identidad de la CACE

La identidad de la comunidad se guarda en tres tablas y la mantiene el panel de
la CACE (capacidades `personalizarCace` y `publicarPremios`):

* **`CONFIGURACION_CACE`** (una sola fila): **lema**, **descripción**, **logo** y
  **tema** visual.
* **`PAIS_COMUNIDAD`**: los países que forman la comunidad, con su código ISO de
  dos letras (de ahí sale la bandera), orden y activo. Antes era una lista fija en
  el frontend.
* **`PREMIO`**: premios y reconocimientos (título, descripción, año, a quién se le
  otorgó, institución opcional, imagen, orden y **publicado**).

* **Temas, no color libre.** El tema es una de las **diez** claves de la lista
  cerrada de `backend/src/common/temas-cace.ts`: `AZUL` (por defecto), `VERDE`,
  `VINO`, `OSCURO`, `PRIMAVERA`, `VERANO`, `OTONO`, `INVIERNO`, `NAVIDAD` y
  `ANIVERSARIO`. Un color libre rompería el contraste y la accesibilidad.
* **Lectura pública.** La pantalla de acceso necesita el lema, el logo, el tema y
  las banderas **antes** de que nadie inicie sesión: `GET /cace/publico` y
  `GET /cace/premios-publicos` van **sin guardia** y solo devuelven lo que ya es
  público (nunca premios sin publicar ni países desactivados).
* **Archivos servidos en línea.** El logo de la CACE (`/cace-logo/…`), las
  imágenes de los premios (`/premios/…`), los logos de institución (`/logos/…`),
  las fotos de perfil (`/avatares/…`) y los fondos de la plantilla
  (`/certificado-fondo/…`) se sirven **en línea** (para pintarlos con `<img>`) con
  `nosniff` y CSP restrictiva. Solo se aceptan **PNG, JPG y WEBP**: nunca SVG, que
  puede llevar código dentro y se ejecutaría en el mismo origen que la aplicación.

---

# 🧾 Certificados y verificación pública

## El diseño se hace fuera

El diseño del certificado se hace **fuera** de la aplicación (Canva, Word…,
ver [`guias/guia-diseno-certificado.md`](guias/guia-diseno-certificado.md)) y se
sube como **imagen terminada**: logos, título, textos legales y línea de firma van
dentro de esa imagen. La plataforma solo **estampa los tres datos que cambian**:

| Dato | Detalle |
| --- | --- |
| **`nombre`** | El nombre del alumno, con **autoajuste** de tamaño. |
| **`folio`** | El código único del certificado. |
| **`qr`** | El código QR que abre la verificación pública. |

* **El autoajuste** baja el tamaño de letra hasta un **mínimo legible de 18 pt**;
  si con ese mínimo el nombre no cabe en una línea, lo parte en **dos líneas**
  (nunca corta una palabra). Si aun así no cabe, la emisión avisa diciendo el
  nombre concreto.
* **La plantilla está versionada** (`PLANTILLA_CERTIFICADO`): guardar un diseño
  crea una **versión nueva** y la activa, de modo que dos certificados de la misma
  versión no puedan tener diseños distintos. Se puede volver a activar una versión
  anterior, y borrar una suelta (el servidor se niega si es la activa o si ya se
  emitió algún certificado con ella, y lo dice con el número).

## Reglas de emisión

1. **Solo con la clase cerrada** (`FINALIZADO`). Si no lo está, el mensaje dice en
   qué estado está y qué falta.
2. **Cada docente emite para los alumnos de su institución**, nunca para los de la
   otra: la lista se busca por (proyecto, institución).
3. **El PDF se guarda tal como salió** (`uploads/certificados/<folio>.pdf`) con su
   `hashSha256`, y es **inmutable**: cambiar la plantilla después no toca lo ya
   emitido.
4. **Reemitir** anula el anterior (dejando constancia) y emite uno nuevo.
5. **El folio** es `CACE-<año>-<consecutivo de 4 dígitos>` y es único.

## Entrega

* **Descarga individual** del PDF y **descarga en ZIP** de todos los certificados
  vigentes de la lista.
* **Envío por correo** a los alumnos (a todos o a los que se indiquen), con el PDF
  adjunto y el enlace de verificación. Se guarda `enviadoEn` y `enviadoA`. Un
  fallo del servidor de correo con un alumno **no** tumba el resto del lote: el
  resultado informa de enviados, omitidos, fallidos y de los que no tienen correo.
* **Anulación con motivo obligatorio**, por el docente (para los certificados de
  la lista de su institución) o por la presidencia desde su panel. El PDF se
  conserva (es un documento histórico), pero deja de ser válido en la página
  pública y la página lo explica con el motivo.

## La página pública y el código del QR

`GET /verificar/:folio?c=<código>` — **sin guardia a propósito**: la abre
cualquiera que escanee un certificado, sin cuenta y sin sesión.

* **El folio solo no basta.** Es secuencial y adivinable, así que la página exige
  además un **código de 8 caracteres** (`backend/src/certificados/codigo-verificacion.ts`)
  que va **dentro del QR**. El código se **deriva** con un **HMAC-SHA256** del
  folio usando `JWT_SECRET`: no se guarda en ninguna columna, así que los
  certificados ya emitidos tienen el suyo sin reemitirlos.
* **Alfabeto sin caracteres confundibles** (32 símbolos, sin `I`, `O`, `0` ni `1`)
  y comparación en **tiempo constante**.
* **Siempre responde 200** con uno de cuatro estados: `VALIDO`, `ANULADO`,
  `NO_ENCONTRADO` o `INVALIDO`, y con `Cache-Control: no-store`. Sin el código
  correcto la respuesta es la misma para un folio que existe y para uno que no,
  así que probando folios no se averigua cuáles son reales.
* **No hay ruta que liste certificados**: se pregunta por un folio concreto.
* La página pública enseña **solo** el nombre del alumno y los datos de la clase
  (título, instituciones y fechas); nunca el correo, la matrícula, el hash ni el
  PDF.
* El **enlace del QR** sale de `URL_PUBLICA`
  (`{URL_PUBLICA}/verificar/{folio}?c={código}`) y **no** lee las cabeceras de la
  petición: ver el aviso de la sección de variables de entorno.

---

# 🔄 Flujo de estados

## Solicitud de clase espejo (doble revisión)

```text
                    ┌──────────────────────── RECHAZADA ◄── motivo
                    │                              ▲
PENDIENTE ──────────┤                              │
   ▲                │                              │
   │                └─► APROBADA_POR_ORIGEN ───────┤
   │                        (revisa el agente       │
   │                         de la institución      │
   │                         de ORIGEN)             │
   │                              │                 │
   │                              ▼                 │
   │                        (revisa el agente       │
   │                         de la institución      │
   │                         de DESTINO) ───────────┘
   │                              │
   └── el docente edita una       ▼
       solicitud RECHAZADA   APROBADA  ──► se crea el PROYECTO
       (vuelve a PENDIENTE)
```

* La revisión de **origen** verifica que la propuesta sea viable desde la
  institución que la publica.
* La revisión de **destino** es la aceptación final: al aprobar se crea el
  **proyecto** y su **planificación conjunta**.
* Ambas transiciones usan actualizaciones condicionales (`updateMany`), así que
  dos revisiones simultáneas no pueden pisarse.
* Al **cancelar** una solicitud se eliminan sus revisiones y la solicitud en una
  sola transacción.
* **Caducidad automática:** una solicitud que sigue en *Pendiente* (nadie
  respondió) o en *Aprobada por origen* (nadie confirmó) al cumplirse el plazo
  pasa a **Caducada**. El plazo es la fecha propuesta menos
  `REVISION_DIAS_ANTELACION` días (7 por defecto) y el docente puede reenviarla
  con una fecha nueva. La revisión corre cada 30 minutos y también en cada
  consulta, así que el estado nunca queda desactualizado.
* **Urgencia:** mientras espera respuesta, cada solicitud lleva `fechaLimite`,
  `diasRestantes` y `urgencia` (*crítica* hasta 2 días, *próxima* hasta 7), que
  es lo que alimenta los recordatorios y el calendario.

## Proyecto

```text
EN_PLANIFICACION ──► EN_CURSO ──► FINALIZADO
        │                 │
        └─────────────────┴──► CANCELADO
```

* `FINALIZADO` **no** se puede fijar a mano desde "Datos del proyecto": solo lo
  asigna la acción **Cerrar clase espejo**, que valida los requisitos.
* El cierre exige **al menos una evaluación final** y que **cada sesión no
  cancelada** tenga su reporte de clase confirmado.

## Reporte de clase (por sesión)

```text
BORRADOR ──► EN_REVISION ──► CONFIRMADO
```

* Cada docente **firma** el reporte con sus observaciones.
* Si el contenido del reporte cambia después de firmado, las firmas se reinician
  y el reporte vuelve a `BORRADOR` (se hace en una transacción).

## Sesiones

```text
PROGRAMADA ──► EN_CURSO ──► FINALIZADA
      └──────────────────► CANCELADA
```

## Planificación

```text
BORRADOR ──► EN_REVISION ──► APROBADA
```

## Institución ante la CACE

```text
                       ┌── RECHAZADA ──┐
PENDIENTE ─────────────┤               ├──► APROBADA
                       └── (corregir)  │
APROBADA ──► VETADA ───────────────────┘
RECHAZADA ──► (borrado definitivo, solo sin historia)
```

* El estado vive en `INSTITUCION.estadoCace` y es **independiente** de `activa`.
* Rechazar y vetar exigen **motivo**; aprobar, rechazar, vetar y reactivar dejan
  registrado **quién** y **cuándo**.
* El **alta del agente** de una institución ya aprobada tiene su propio ciclo:
  sin confirmar → confirmada (o rechazada), a cargo de los agentes de esa
  institución.

## Certificado

```text
EMITIDO ──► ANULADO
```

* `EMITIDO` guarda el PDF con su `hashSha256` y su folio: es inmutable.
* `ANULADO` deja de ser válido en la página pública y guarda el **motivo**.
* **Reemitir** el certificado de un alumno anula el anterior y emite uno nuevo.
* La página pública añade sus propios desenlaces: `VALIDO`, `ANULADO`,
  `NO_ENCONTRADO` e `INVALIDO` (este último, también cuando falta el código).

## Solicitud de borrado de institución (y presidencia de la CACE)

```text
PENDIENTE ──► APROBADA   (y entonces se ejecuta el borrado definitivo)
          └─► RECHAZADA  (con motivo; la institución se queda)
```

La **presidencia** no es un estado que se abra y se cierre: **se transmite**. Al
transmitirla, el saliente queda como **suplente** (activo, con las mismas
capacidades) y queda una fila en `CAMBIO_PRESIDENCIA`.

Los estados viven en un solo archivo (`backend/src/common/estados.ts`) para que
DTO y servicios compartan exactamente los mismos valores. La versión gráfica,
con los mismos estados, está en
[`producto/diagramas/estados.md`](producto/diagramas/estados.md).

---

# 🌐 Endpoints de la API

El backend expone **127 rutas** repartidas en **23 controladores** (22 archivos
`.controller.ts`; `instituciones.controller.ts` contiene dos clases). Todas cuelgan
de un prefijo y la lista completa está en las tablas siguientes.

## Autenticación y usuarios

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/` | Estado del servicio (con el frontend compilado, devuelve el `index.html`) | No |
| `GET` | `/health` | Health check del servicio | No |
| `POST` | `/auth/register` | Registra un agente: se **une** a una institución del directorio (`institucionId`) o crea una nueva | No |
| `POST` | `/auth/login` | Inicia sesión y devuelve `access_token` + rol (y `debeCambiarPassword`) | No *(limitado a 10 intentos/min)* |
| `GET` | `/auth/activate?token=...` | Valida un token de invitación | No |
| `POST` | `/auth/activate` | Activa la cuenta del docente (crea credenciales) | No *(limitado a 10 intentos/min)* |
| `GET` | `/usuarios/me` | Perfil del usuario autenticado (rol, institución o cargo en la CACE) | JWT |
| `POST` | `/usuarios/me/password` | Cambia la contraseña (lo exige el primer acceso de la presidencia y las secretarías) | JWT |
| `POST` | `/usuarios/me/foto` | Sube la foto de perfil (PNG/JPG/WEBP, máx. 2 MB) y borra la anterior | JWT |
| `DELETE` | `/usuarios/me/foto` | Quita la foto de perfil y borra el archivo | JWT |

## Panel del agente

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `POST` | `/agentes/invitar-docente` | El agente invita a un docente (envía correo) | JWT (agente) |
| `GET` | `/agentes/docentes` | Lista los docentes de la institución | JWT (agente) |
| `PATCH` | `/agentes/docentes/:id/estado` | Activa/desactiva un docente | JWT (agente) |
| `DELETE` | `/agentes/docentes/:id` | Elimina un docente | JWT (agente) |
| `GET` | `/agentes/docentes/:id/historial` | Historial del docente (sus clases y participaciones) | JWT (agente) |
| `GET` | `/agentes/confirmaciones` | Altas de agentes de mi institución pendientes de confirmar | JWT + `confirmarAgenteInstitucion` |
| `POST` | `/agentes/confirmaciones/:id/confirmar` | Confirma el alta de un agente en la institución | JWT + `confirmarAgenteInstitucion` |
| `POST` | `/agentes/confirmaciones/:id/rechazar` | Rechaza el alta (con motivo) y avisa al agente | JWT + `confirmarAgenteInstitucion` |
| `GET` | `/materias` | Lista las materias de la institución | JWT (agente) |
| `GET` | `/materias/:id` | Detalle de una materia | JWT (agente) |
| `POST` | `/materias` | Crea una materia | JWT (agente) |
| `PATCH` | `/materias/:id` | Edita una materia | JWT (agente) |
| `DELETE` | `/materias/:id` | Elimina una materia (valida dependencias) | JWT (agente) |
| `GET` | `/asignaciones` | Lista las asignaciones de la institución | JWT (agente) |
| `GET` | `/asignaciones/mias` | Lista las asignaciones propias del docente | JWT (docente) |
| `POST` | `/asignaciones` | Asigna docente a materia por periodo | JWT (agente) |
| `DELETE` | `/asignaciones/:id` | Quita una asignación | JWT (agente) |
| `GET` | `/instituciones` | Catálogo de destinos: solo instituciones **aprobadas por la CACE** con registro completo (excepto la propia) | JWT |
| `GET` | `/instituciones/directorio?q=...` | **Directorio público** para el registro: busca antes de crear (nombre, país, logo y estado ante la CACE) | No |
| `GET` | `/instituciones/mia` | Institución del agente (con lo que le falta para operar) | JWT (agente) |
| `PATCH` | `/instituciones/mia` | Edita la institución (marca registro completo) | JWT (agente) |
| `POST` | `/instituciones/mia/logo` | Sube el logo de la institución (PNG/JPG/WEBP, máx. 2 MB) | JWT (agente) |
| `DELETE` | `/instituciones/mia/logo` | Quita el logo de la institución | JWT (agente) |
| `GET` | `/instituciones/:id/materias` | Materias de otra institución | JWT |

## Solicitudes de clase espejo

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `POST` | `/solicitudes` | El docente crea una solicitud de clase espejo | JWT (docente) |
| `GET` | `/solicitudes/mias` | Solicitudes del docente | JWT (docente) |
| `PATCH` | `/solicitudes/:id` | Edita una solicitud pendiente o rechazada (al corregirla vuelve a *Pendiente*) | JWT (docente) |
| `DELETE` | `/solicitudes/:id` | Cancela una solicitud pendiente o rechazada | JWT (docente) |
| `GET` | `/solicitudes/entrantes` | Solicitudes en las que participa la institución (origen o destino) | JWT (agente) |
| `POST` | `/solicitudes/:id/revisar` | Doble revisión: aprueba/rechaza (1.º origen, 2.º destino; al aprobar el destino se crea el proyecto) | JWT (agente) |

## Proyecto, planificación y chat

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/proyectos/mios` | Proyectos en los que participa el docente | JWT (docente) |
| `GET` | `/proyectos/institucion` | Proyectos de la institución del agente | JWT (agente) |
| `GET` | `/proyectos/:id` | Detalle del proyecto (docentes y planificación) | JWT |
| `GET` | `/proyectos/:id/resumen-pdf` | Descarga el resumen de la clase en PDF | JWT |
| `GET` | `/proyectos/:id/calendario.ics` | Descarga el archivo `.ics` de la clase y sus sesiones, con los avisos de 1 hora, 30 y 15 minutos dentro | JWT (docente participante) |
| `POST` | `/proyectos/:id/calendario/enviar` | Manda ese mismo `.ics` por correo a los docentes participantes y devuelve el informe de envíos (`enviados` / `fallidos` con motivo); con la clase cerrada también se permite | JWT (docente participante) |
| `PATCH` | `/proyectos/:id` | Actualiza fechas, plataforma o estado (solo *En planificación* / *En curso*) | JWT (docente) |
| `POST` | `/proyectos/:id/docentes` | Agrega un docente al proyecto (solo de su institución) | JWT (agente) |
| `DELETE` | `/proyectos/:id/docentes/:proyectoDocenteId` | Quita un docente del proyecto (solo de su institución) | JWT (agente) |
| `PUT` | `/proyectos/:id/planificacion` | Crea/actualiza la planificación conjunta | JWT (docente) |
| `POST` | `/proyectos/:id/planificacion/confirmar` | El docente confirma su participación | JWT (docente) |
| `GET` | `/proyectos/:id/reportes` | Lista los reportes de planificación | JWT |
| `POST` | `/proyectos/:id/reportes` | Genera el reporte de planificación | JWT (agente) |
| `GET` | `/proyectos/:id/mensajes` | Lista el chat del proyecto | JWT |
| `POST` | `/proyectos/:id/mensajes` | Envía un mensaje al chat (solo docentes del proyecto y con la clase abierta) | JWT (docente) |

## Sesiones, actividades y evidencias

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/proyectos/:id/sesiones` | Lista las sesiones programadas | JWT |
| `POST` | `/proyectos/:id/sesiones` | Programa una sesión | JWT (docente) |
| `PATCH` | `/proyectos/:id/sesiones/:sesionId` | Edita una sesión | JWT (docente) |
| `DELETE` | `/proyectos/:id/sesiones/:sesionId` | Elimina una sesión | JWT (docente) |
| `GET` | `/proyectos/:id/actividades` | Lista las actividades | JWT |
| `POST` | `/proyectos/:id/actividades` | Crea una actividad | JWT (docente) |
| `PATCH` | `/proyectos/:id/actividades/:actividadId` | Edita una actividad | JWT (docente) |
| `DELETE` | `/proyectos/:id/actividades/:actividadId` | Elimina una actividad | JWT (docente) |
| `GET` | `/proyectos/:id/evidencias` | Lista las evidencias | JWT |
| `POST` | `/proyectos/:id/evidencias` | Sube una evidencia (archivo, máx. 10 MB; `sesionId` opcional) | JWT (docente participante) |

## Reportes de clase, evaluación y cierre

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/proyectos/:id/reportes-clase` | Lista los reportes de clase del proyecto | JWT |
| `GET` | `/proyectos/:id/sesiones/:sesionId/reporte` | Reporte de clase de una sesión | JWT |
| `PUT` | `/proyectos/:id/sesiones/:sesionId/reporte` | Crea/actualiza el reporte de clase de una sesión | JWT (docente) |
| `POST` | `/proyectos/:id/reportes-clase/:reporteId/confirmar` | El docente firma el reporte con sus observaciones | JWT (docente) |
| `GET` | `/proyectos/:id/evaluaciones` | Lista las evaluaciones finales | JWT |
| `POST` | `/proyectos/:id/evaluaciones` | Registra una evaluación final | JWT (docente) |
| `POST` | `/proyectos/:id/cerrar` | Cierra la clase espejo (pasa a *Finalizado*) | JWT (docente) |

## Lista de alumnos

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/proyectos/:id/listas-alumnos` | La lista guardada de la institución del docente (o `null`) | JWT |
| `POST` | `/proyectos/:id/listas-alumnos/previsualizar` | Lee el archivo `.xlsx`/`.csv` o el texto pegado y devuelve la **vista previa**, sin guardar (avisos de repetidos, nombres imposibles y correos mal escritos) | JWT (docente participante) |
| `PUT` | `/proyectos/:id/listas-alumnos` | Guarda la lista revisada (reemplaza la anterior) | JWT (docente participante) |
| `PATCH` | `/proyectos/:id/listas-alumnos/alumnos/:alumnoId` | Corrige un alumno (nombre, matrícula, correo o si entra en los certificados) | JWT (docente participante) |
| `DELETE` | `/proyectos/:id/listas-alumnos/alumnos/:alumnoId` | Saca a un alumno de la lista | JWT (docente participante) |

> La lista se lee **en memoria**: solo se quieren los textos de las celdas, así que
> no quedan archivos temporales en el servidor. Solo se aceptan `.xlsx` y `.csv`.

## Certificados

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/proyectos/:id/certificados` | Estado de la sección: si se puede emitir, qué falta, la lista, los emitidos y el resumen | JWT + `emitirCertificados` |
| `POST` | `/proyectos/:id/certificados/emitir` | Emite uno (`alumnoId`) o todos los alumnos incluidos de mi lista | JWT + `emitirCertificados` |
| `GET` | `/proyectos/:id/certificados/zip` | Todos los certificados vigentes de mi lista, en un ZIP | JWT + `emitirCertificados` |
| `POST` | `/proyectos/:id/certificados/enviar` | Envía por correo a los alumnos (a todos o a los indicados) | JWT + `emitirCertificados` |
| `POST` | `/proyectos/:id/certificados/:certificadoId/enviar` | Envía el certificado de un alumno, con el PDF adjunto | JWT + `emitirCertificados` |
| `POST` | `/proyectos/:id/certificados/:certificadoId/anular` | Anula un certificado de la lista de mi institución, con motivo obligatorio | JWT + `anularCertificados` |
| `GET` | `/proyectos/:id/certificados/:certificadoId/pdf` | Descarga el PDF de un certificado | JWT + `emitirCertificados` |

> Los PDF **no** se sirven como archivos estáticos: llevan el nombre de una
> persona, así que se descargan solo por su ruta y con sesión, y el servicio
> comprueba que el certificado sea de la lista de la institución de quien lo pide.
> `main.ts` corta expresamente cualquier petición a `/uploads/certificados/…`.

## Verificación pública

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/verificar/:folio?c=<código>` | Estado de un certificado: `VALIDO`, `ANULADO`, `NO_ENCONTRADO` o `INVALIDO`. Siempre responde 200 y con `no-store` | **No** (la abre el QR) |

## Panel de la CACE: instituciones

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/cace/capacidades` | Rol, etiqueta del rol y capacidades del usuario que está dentro | JWT |
| `GET` | `/cace/instituciones` | Todas las instituciones (las pendientes primero), con su agente de contacto, quién las revisó y el aviso de posible duplicado | JWT + `aprobarInstituciones` |
| `POST` | `/cace/instituciones/:id/aprobar` | Aprueba la institución y avisa a su agente | JWT + `aprobarInstituciones` |
| `POST` | `/cace/instituciones/:id/rechazar` | Rechaza con **motivo** (obligatorio) y avisa a su agente | JWT + `aprobarInstituciones` |
| `POST` | `/cace/instituciones/:id/vetar` | Veta con **motivo** (obligatorio) y avisa a su agente | JWT + `aprobarInstituciones` |
| `POST` | `/cace/instituciones/:id/reactivar` | Devuelve a *Aprobada* una institución rechazada o vetada | JWT + `aprobarInstituciones` |
| `DELETE` | `/cace/instituciones/:id` | Borrado definitivo de una institución rechazada **sin historia** | JWT + `borrarInstituciones` |

## Panel de la CACE: miembros y presidencia

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/cace/miembros` | Todos los miembros (presidencia, suplencia y secretarías) con su estado | JWT + `gestionarMiembrosCace` |
| `POST` | `/cace/miembros` | Da de alta una secretaría (crea la cuenta con contraseña provisional si el correo es nuevo) | JWT + `gestionarMiembrosCace` |
| `PATCH` | `/cace/miembros/:id` | Activa o desactiva a un miembro | JWT + `gestionarMiembrosCace` |
| `POST` | `/cace/presidencia/cambiar` | Transmite la presidencia (a un miembro que ya está en la CACE o a una persona nueva) | JWT + `gestionarMiembrosCace` |
| `GET` | `/cace/presidencia/historial` | Historial de los cambios de presidencia, con quién preside ahora | JWT + `gestionarMiembrosCace` |

## Panel de la CACE: identidad, comunidad y premios

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/cace/publico` | Lema, descripción, logo, tema y países activos (**lo lee la pantalla de acceso**) | **No** |
| `GET` | `/cace/premios-publicos` | Premios **publicados**, para la sección «Comunidad» | **No** |
| `GET` | `/cace/configuracion` | Configuración completa de la identidad (para el panel) | JWT + `personalizarCace` |
| `PATCH` | `/cace/configuracion` | Guarda lema, descripción y tema | JWT + `personalizarCace` |
| `POST` | `/cace/configuracion/logo` | Sube el logo de la CACE (PNG/JPG/WEBP, máx. 2 MB) | JWT + `personalizarCace` |
| `DELETE` | `/cace/configuracion/logo` | Quita el logo de la CACE | JWT + `personalizarCace` |
| `GET` | `/cace/paises` | Todos los países de la comunidad (incluidos los inactivos), en orden alfabético por nombre (sin acentos ni mayúsculas) | JWT + `personalizarCace` |
| `POST` | `/cace/paises` | Añade un país (código ISO de dos letras y nombre) | JWT + `personalizarCace` |
| `PATCH` | `/cace/paises/:id` | Edita un país (código, nombre o activo). **No hay campo de orden**: la lista se ordena sola por nombre | JWT + `personalizarCace` |
| `DELETE` | `/cace/paises/:id` | Elimina un país de la comunidad | JWT + `personalizarCace` |
| `GET` | `/cace/premios` | Todos los premios (publicados y no) y las instituciones del formulario | JWT + `publicarPremios` |
| `POST` | `/cace/premios` | Crea un premio o reconocimiento | JWT + `publicarPremios` |
| `PATCH` | `/cace/premios/:id` | Edita un premio (incluido publicarlo o dejarlo en borrador) | JWT + `publicarPremios` |
| `DELETE` | `/cace/premios/:id` | Elimina un premio | JWT + `publicarPremios` |
| `POST` | `/cace/premios/:id/imagen` | Sube la imagen del premio (PNG/JPG/WEBP, máx. 2 MB) | JWT + `publicarPremios` |
| `DELETE` | `/cace/premios/:id/imagen` | Quita la imagen del premio | JWT + `publicarPremios` |

## Panel de la CACE: plantilla del certificado

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/cace/certificados/plantilla` | Catálogo de datos, versión activa y todas las versiones | JWT + `disenarCertificados` |
| `GET` | `/cace/certificados/plantilla/qr?folio=...` | El QR de un folio en PNG, para la vista previa del panel | JWT + `disenarCertificados` |
| `POST` | `/cace/certificados/plantilla` | Guarda la plantilla **como versión nueva** y la deja activa | JWT + `disenarCertificados` |
| `POST` | `/cace/certificados/plantilla/fondo` | Sube la imagen del diseño (crea una versión nueva) | JWT + `disenarCertificados` |
| `PATCH` | `/cace/certificados/plantilla/:id/activar` | Vuelve a poner como activa una versión anterior | JWT + `disenarCertificados` |
| `DELETE` | `/cace/certificados/plantilla/:id` | Borra una versión suelta (se niega si es la activa o si ya emitió certificados) | JWT + `disenarCertificados` |
| `POST` | `/cace/certificados/:certificadoId/anular` | Anula un certificado desde el panel de la presidencia, con motivo | JWT + `anularCertificados` |

## Borrado de instituciones

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `POST` | `/cace/instituciones/:id/solicitud-borrado` | La **secretaría** pide el borrado de una institución rechazada, con motivo | JWT + `solicitarBorradoInstitucion` |
| `GET` | `/cace/solicitudes-borrado` | Listado: la presidencia ve las pendientes y el historial; la secretaría, las que pidió ella | JWT + `solicitarBorradoInstitucion` o `resolverSolicitudesBorrado` |
| `PATCH` | `/cace/solicitudes-borrado/:id` | La **presidencia** aprueba (y entonces se ejecuta el borrado) o rechaza con motivo | JWT + `resolverSolicitudesBorrado` |

---

## Recordatorios y calendario

| Método | Ruta | Descripción | Autenticación |
| --- | --- | --- | --- |
| `GET` | `/recordatorios` | Agenda del usuario: solicitudes por caducar con su urgencia, sesiones próximas y tareas pendientes. Antes de responder comprueba los vencimientos y cancela las solicitudes caducadas | JWT |

La respuesta incluye `resumen` (vencidas, críticas, próximas, clases y tareas),
`solicitudes` (con `fechaLimite`, `diasRestantes` y `urgencia`), `clases` y
`tareas`. Los plazos también viajan en los listados de `/solicitudes`.

### El calendario de la clase: descarga o correo

El `.ics` de una clase espejo lo genera `CalendarioIcsService` (iCalendar,
RFC 5545) y **la plataforma no programa recordatorios**: cada evento lleva
dentro sus tres bloques `VALARM` (1 hora, 30 minutos y 15 minutos antes) y quien
avisa es el calendario de cada quien (Google, Apple, Outlook…) al importarlo.
El `UID` es estable por sesión (`sesion-<id>@clasesconjuntas`), así que volver a
importar el archivo **actualiza** los eventos en vez de duplicarlos.

Hay dos formas de entregarlo, y las dos viven en el proyecto:

* **`POST /proyectos/:id/calendario/enviar`** (la cómoda): manda el `.ics`
  adjunto como `text/calendar` a los docentes participantes con
  `MailService.sendCalendarioClase` y devuelve `{ total, enviados, fallidos,
  sesiones, nombreArchivo }`. Cada fallo se recoge con su motivo y **no aborta
  los demás envíos**: el docente ve a quién le llegó y a quién no. Se permite
  también con la clase cerrada (enviar no cambia la clase).
* **`GET /proyectos/:id/calendario.ics`** (la segunda vía): descarga el archivo
  para abrirlo a mano; sirve de respaldo si el correo falla.

---

# 🛡 Seguridad implementada

Medidas presentes hoy en el código (resultado, en buena parte, de las
auditorías):

| Medida | Detalle |
| --- | --- |
| **Hash de contraseñas** | `bcrypt`; el modelo `Usuario` **omite `passwordHash` por defecto** (configuración global de `PrismaService`), y solo el login lo pide explícitamente. |
| **JWT obligatorio en la firma** | La app **no arranca** si `JWT_SECRET` falta o tiene menos de 16 caracteres. El mismo secreto se usa (con HMAC-SHA256 y un contexto propio) para **derivar el código de verificación** de los certificados. |
| **Cuenta vigente por petición** | `JwtAuthGuard` verifica en cada request que el usuario siga activo y que conserve al menos una institución activa. |
| **Autorización por capacidad** | `@Requiere('...')` + `CapacidadesGuard`: la ruta comprueba la **capacidad** (no el nombre del rol) contra la matriz de `common/capacidades.ts`, y el rol se lee de la base en cada petición (no viaja en el token). |
| **Rate limit** | `RateLimitGuard` en `POST /auth/login` y `POST /auth/activate`: 10 intentos por minuto por `ip + correo`. |
| **Invitaciones de un solo uso** | La activación consume la invitación con un `updateMany` condicional (`usadaEn: null`); si ya se usó, la operación se aborta. |
| **Código de verificación del certificado** | Se **deriva** del folio con HMAC-SHA256 (nunca se guarda), con alfabeto de 32 símbolos sin caracteres confundibles, y se compara en **tiempo constante** (`timingSafeEqual`). Sin el código correcto, la página pública no distingue un folio real de uno inventado. |
| **Formatos antes de consultar** | La verificación comprueba el formato del folio (`CACE-AAAA-0000`) **antes** de tocar la base, así que un folio inventado ni provoca una consulta. |
| **Verificación sin caché** | La respuesta de `/verificar/:folio` va con `Cache-Control: no-store`: el estado de un certificado puede cambiar (se anula) y la página tiene que decir la verdad de hoy. |
| **CORS restringido** | Solo los orígenes de `FRONTEND_URL` (lista separada por comas) más `localhost:4200` / `127.0.0.1:4200`. |
| **Lista blanca de archivos** | Las evidencias aceptan solo PDF, imágenes, Office, texto y ZIP; **se rechazan `.html`, `.svg` y `.js`**, que servidos desde el mismo origen podrían ejecutar código. Las listas de alumnos solo aceptan `.xlsx` y `.csv` y se leen en memoria. |
| **Descarga forzada de archivos** | `/uploads` responde con `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y `Content-Security-Policy: default-src 'none'`. |
| **Los certificados no son estáticos** | `/uploads/certificados/…` responde 404 por diseño: los PDF emitidos llevan el nombre de una persona y se descargan solo por su ruta de la API, con sesión y comprobando la institución. |
| **Imágenes en línea, pero sin SVG** | Avatares (`/avatares`), logos de institución (`/logos`), logo de la CACE (`/cace-logo`), premios (`/premios`) y fondos de la plantilla (`/certificado-fondo`) se sirven con `Content-Disposition: inline` (para pintarlos con `<img>`), `nosniff` y CSP restrictiva. Solo se aceptan **PNG, JPG y WEBP**: un SVG puede llevar código dentro y se ejecutaría en el mismo origen que la aplicación. La utilidad `urlDeArchivo()` completa la ruta con el host del backend cuando el frontend corre en `:4200`. |
| **Contraseñas provisionales** | Las de la presidencia y las secretarías se generan con `randomInt` criptográfico (12 caracteres, sin caracteres ambiguos) y obligan a cambiarla al entrar (`debeCambiarPassword`). Si el correo no sale, la contraseña se escribe en el log en vez de dejar la cuenta inaccesible, y el DNI provisional se comprueba para que no choque. |
| **Sin archivos huérfanos** | Al cambiar o quitar una foto, un logo o una imagen de premio se borra la anterior del disco, y el nombre del archivo es aleatorio. |
| **Autorización antes de escribir** | En `POST /proyectos/:id/evidencias`, el `DocenteParticipanteGuard` valida el permiso **antes** de que multer escriba el archivo en disco. |
| **Errores de integridad legibles** | Un filtro global traduce `PrismaClientKnownRequestError`: `P2002`→409, `P2003`→400, `P2025`→404. |
| **Validación de entrada** | `ValidationPipe` global con `whitelist` y `transform`; los DTO usan `class-validator`. |
| **Transiciones atómicas** | Revisiones de solicitudes, consumo de invitaciones, reinicio de firmas, transmisión de la presidencia y el cambio de estado de una institución usan transacciones o `updateMany` condicionales. |

---

# 🧪 Pruebas de API

Durante el desarrollo se utiliza una herramienta de pruebas HTTP como **Thunder Client** para probar los endpoints del backend.

Ejemplo de registro **creando una institución nueva** (sin `institucionId`):

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "nombres": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "López",
  "tipoDocumento": "DNI",
  "dni": "PELJ850101",
  "correo": "agente@universidad.edu",
  "password": "123456",
  "nombreInstitucion": "Universidad de Prueba",
  "pais": "México",
  "codigoPais": "MX",
  "estado": "Campeche",
  "ciudad": "Calkiní",
  "telefono": "+52 981 123 4567",
  "correoInstitucional": "contacto@universidad.edu",
  "cargo": "Coordinador de Internacionalización"
}
```

Ejemplo de inicio de sesión:

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "correo": "agente@universidad.edu",
  "password": "123456"
}
```

Los endpoints disponibles pueden cambiar conforme avance el desarrollo.

> Para **unirse** a una institución que ya existe (el caso normal, que evita
> duplicados) se manda su `institucionId` —el que devuelve
> `GET /instituciones/directorio?q=...`— y se omiten los campos de la institución
> (`nombreInstitucion`, `pais`, `codigoPais`, `estado`, `ciudad`, `telefono` y
> `correoInstitucional`), que en ese caso no se usan.
>
> Si la institución está **aprobada**, la respuesta trae
> `requiereConfirmacion: true`: el alta queda esperando a que la confirme un
> agente de esa institución.

---

# ⚠ Consideraciones importantes para desarrolladores

### 1. No modificar `generated/prisma` manualmente

La carpeta:

```text
backend/generated/prisma/
```

contiene archivos generados automáticamente por Prisma.

Si se modifica `schema.prisma`, utilizar:

```bash
npx prisma generate
```

en lugar de editar manualmente los archivos generados.

> El proyecto **no** usa la ruta por defecto de Prisma: el cliente se genera en
> `backend/generated/prisma` y, al compilar, queda en
> `backend/dist/generated/prisma`. Al ejecutar la versión compilada hay que
> tener eso en cuenta.

---

### 2. No subir `.env`

El archivo:

```text
backend/.env
```

contiene información sensible.

Debe estar incluido en `.gitignore`.

Ejemplo:

```gitignore
.env
```

Tampoco deben versionarse `backend/uploads/` (archivos de los usuarios),
`backend/public/` (frontend compilado) ni `backend/generated/prisma/` (cliente
generado): los cuatro (con `.env`) ya están en `backend/.gitignore`.

---

### 3. Prisma y TypeScript

La configuración actual del proyecto utiliza:

```json
"module": "commonjs",
"moduleResolution": "node10"
```

Esta configuración está relacionada con la compatibilidad actual entre NestJS, Node.js y el cliente generado por Prisma.

**No modificar estas opciones sin comprobar primero la compatibilidad del proyecto.**

---

### 4. Frontend zoneless: todo el estado debe ser `signal()`

El frontend corre **sin zone.js**. Cualquier cambio de estado asíncrono
(respuestas HTTP, temporizadores) debe dispararse a través de `signal()`,
`computed()` o `effect()`. Una variable de clase normal **no** actualizará la
vista.

---

### 5. Los estados del dominio se editan en un solo archivo

Los valores de estado (`PENDIENTE`, `EN_CURSO`, `CONFIRMADO`, `APROBADA`,
`VETADA`, …) están en
`backend/src/common/estados.ts`. **No escribirlos como cadenas sueltas** en
servicios o DTO: agregar el estado en ese archivo y referenciarlo por su
constante.

---

### 6. Los permisos se piden por capacidad, no por rol

Los cuatro roles y lo que puede cada uno están en
`backend/src/common/capacidades.ts`. En los controladores se pide una
**capacidad**:

```ts
@Requiere('aprobarInstituciones')
@Post('instituciones/:id/aprobar')
```

No comparar `rol === 'AGENTE'` a mano: un rol nuevo obligaría a buscar todas las
comparaciones. Si una ruta necesita un permiso nuevo, se añade a la matriz y a la
lista de capacidades, y la interfaz lo sabrá sola porque
`GET /cace/capacidades` lee de la misma tabla.

---

### 7. Después de tocar el proyecto hay que reconstruir el frontend

`backend/public` contiene una **copia compilada** del frontend. Si se cambia el
frontend y no se vuelve a compilar contra `backend/public`, la aplicación servida
en el puerto `3000` seguirá mostrando la versión anterior.

---

# 📌 Estado actual del proyecto

## Backend

### Base

* [x] Configuración inicial de NestJS
* [x] PostgreSQL
* [x] Prisma
* [x] Modelo de datos
* [x] Configuración de variables de entorno

### Autenticación y usuarios

* [x] Módulo de autenticación
* [x] Registro de usuarios (agente + institución)
* [x] **Buscar antes de crear**: directorio público de instituciones y "unirse a la que ya existe"
* [x] Login
* [x] JWT
* [x] Hash de contraseñas
* [x] Invitación de docentes por correo (Nodemailer)
* [x] Activación de cuenta con token de invitación de un solo uso (auto-registro del docente)
* [x] Gate de "completar institución" + institución aprobada por la CACE + alta confirmada
* [x] Verificación de cuenta vigente en cada petición
* [x] Rate limit en login y activación
* [x] Foto de perfil (subida, cambio y borrado, con limpieza del archivo anterior)
* [x] Cambio de contraseña y contraseña provisional con cambio obligatorio
* [x] **Cuatro roles** (docente, agente, presidencia y secretaría de la CACE) con matriz de capacidades y `CapacidadesGuard`

### Catálogos

* [x] Estándares internacionales (país ISO 3166, tipo de documento, datos de institución)
* [x] Validación de texto (anti datos sin sentido)
* [x] Gestión de instituciones (ver/editar la propia + listado + logo)
* [x] Gestión de docentes (invitar, activar, desactivar, eliminar, historial)
* [x] Confirmación del alta de un agente por los agentes de su institución
* [x] Gestión de materias
* [x] Asignación docente ↔ materia

### CACE (presidencia y secretarías)

* [x] Alta automática de la presidencia al arrancar (`PRESIDENTE_CORREO`)
* [x] Instituciones con estado ante la CACE (PENDIENTE, APROBADA, RECHAZADA, VETADA) con motivo, quién y cuándo
* [x] Aprobar, rechazar, vetar y reactivar con aviso por correo al agente
* [x] Aviso de posible duplicado al aprobar
* [x] Borrado definitivo de una institución rechazada sin historia
* [x] Solicitudes de borrado: la secretaría pide, la presidencia autoriza y ejecuta
* [x] Miembros de la CACE: alta de secretarías, activar y desactivar
* [x] Transmisión de la presidencia (el saliente queda como suplente) con historial de cambios
* [x] Identidad de la CACE: lema, descripción, logo y lista cerrada de temas
* [x] Países de la comunidad editables
* [x] Premios y reconocimientos con sección pública
* [x] `GET /cace/capacidades` para que la interfaz esconda lo que el rol no puede hacer

### Certificados

* [x] Lista de alumnos por institución (Excel, CSV o pegado) con vista previa y validaciones
* [x] Plantilla del certificado versionada (el diseño se hace fuera: solo nombre, folio y QR)
* [x] Autoajuste del nombre (mínimo legible de 18 pt y, si hace falta, dos líneas)
* [x] Emisión por el docente, **solo con la clase cerrada**, individual o por lote
* [x] PDF guardado con `hashSha256` e inmutable
* [x] Descarga individual y en ZIP
* [x] Envío por correo a los alumnos, con registro de envíos
* [x] Anulación con motivo (docente y presidencia)
* [x] Reemisión (el anterior queda anulado)
* [x] Verificación pública `/verificar/:folio?c=<código>` con código derivado por HMAC dentro del QR

### Clases espejo

* [x] Solicitudes de clases espejo (crear/listar/editar/cancelar)
* [x] Doble revisión (origen → destino) con motivo y auditoría de revisiones
* [x] Gestión de proyectos (se crea automáticamente al aprobar la solicitud)
* [x] Resumen de la clase en PDF
* [x] Planificación conjunta + confirmación de participación
* [x] Reporte de planificación (supervisión del agente)
* [x] Chat entre docentes del proyecto
* [x] Sesiones
* [x] Actividades
* [x] Evidencias (subida real de archivos con lista blanca y límite de 10 MB)
* [x] Reporte de clase conjunta con firmas de los docentes
* [x] Evaluaciones finales
* [x] Cierre del proyecto con validaciones
* [x] Plazos de respuesta, caducidad automática de solicitudes sin respuesta
* [x] Módulo `recordatorios`: agenda de vencimientos, clases próximas y tareas
* [x] Planificador interno (cada 30 minutos) y revisión de plazos al consultar

### Robustez

* [x] Filtro global de errores de Prisma (respuestas legibles)
* [x] Transiciones de estado atómicas y en transacción donde corresponde
* [x] Autorización por recurso y por capacidad
* [x] CORS restringido y cabeceras seguras en los archivos servidos
* [x] Filtro de evidencias antes de escribir en disco
* [x] **Migraciones formales de Prisma** (23 migraciones versionadas en `backend/prisma/migrations/`)
* [ ] Cobertura de pruebas automatizadas (Jest) del flujo completo

## Frontend

* [x] Autenticación (login, registro, activación)
* [x] Redirección por rol (guards)
* [x] Panel del agente (docentes, materias, asignaciones, institución, solicitudes recibidas)
* [x] Panel del docente (crear/listar solicitudes)
* [x] Identidad visual CACE (logo, paleta institucional y banderas de la comunidad)
* [x] Catálogos desplegables (países, cargos, grados, programas, periodos)
* [x] Validación de formularios con mensajes de ayuda
* [x] Clases espejo: proyectos y planificación conjunta
* [x] Chat entre docentes del proyecto
* [x] Clases espejo: sesiones, actividades y evidencias
* [x] Reporte de clase conjunta, evaluación final y cierre
* [x] **Calendario de la clase por correo o descarga**: «Enviar el calendario por
  correo» manda el `.ics` adjunto a los docentes participantes y enseña a quién
  llegó y a quién no (con el motivo), y la descarga queda como segunda vía. Los
  avisos de 1 hora, 30 y 15 minutos los pone el calendario de cada quien: la
  plataforma no programa recordatorios
* [x] Países de la comunidad sin campo de orden: la lista va alfabética por
  nombre (sin acentos ni mayúsculas) en el panel y en `GET /cace/publico`, y el
  buscador del panel filtra por nombre o por código ISO («peru» encuentra «Perú»)
* [x] Calendario mensual **en una ventana emergente** (con el detalle del día
      elegido) y sección de recordatorios con las listas «lo próximo» y «por
      hacer», más las marcas de urgencia (crítica, próxima, vencida)
* [x] Foto de perfil: se sube desde «Mi perfil», se **recorta y se reduce en el
      navegador** antes de enviarla y se muestra en la barra superior, el menú de
      usuario y la propia ventana; sin foto, iniciales
* [x] Componente de modal accesible (foco, `Escape`, trampa de tabulación, roles ARIA)
* [x] **Guía interactiva por apartado** (`core/constants/guia.ts` +
      `shared/components/guia/`): se lanza desde **Ayuda** y ofrece el recorrido
      del apartado en el que está el usuario (Inicio, Docentes, Materias, la
      clase espejo…), con la lista de los demás; recorre con foco iluminado,
      puede abrir el formulario de solicitud o el calendario para explicarlos, y
      se pasa sola al recorrido del apartado nuevo si el usuario navega
* [x] **Lista de alumnos por institución** (`listas-alumnos.*` +
      `core/services/listas-alumnos.service.ts`): el docente sube la de sus
      alumnos en Excel (`.xlsx`), CSV o pegada; se validan los encabezados, los
      repetidos, los nombres imposibles y los correos mal escritos, se revisa en
      una vista previa editable y se guarda con los endpoints
      `/proyectos/:id/listas-alumnos` (base de los certificados). Plantilla para
      las instituciones en `docs/plantillas/plantilla-lista-alumnos.xlsx`
* [x] Mensajes de error claros y botones de reintento por sección
* [x] Estados de carga en todos los botones de guardado
* [x] Accesibilidad y contraste revisados (foco visible, áreas táctiles)
* [x] **Panel de la CACE** (`features/cace/`): instituciones (aprobar, rechazar,
      vetar, reactivar y borrar), miembros y activar/desactivar, presidencia
      (transmitir el cargo e historial), solicitudes de borrado, personalización,
      comunidad, premios y diseño del certificado; el menú **esconde** lo que el
      rol no puede hacer según `GET /cace/capacidades`
* [x] **Cambio de contraseña obligatorio** del primer acceso en el panel de la CACE
* [x] **Editor del diseño del certificado** (`features/cace/diseno-certificado/`):
      fondo, colocación de los tres huecos (nombre, folio y QR), estilos, versiones,
      vista previa con el QR real y avisos de diseño
* [x] **Alumnos y certificados en la clase espejo**: lista editable con vista
      previa, emisión, descarga en PDF o ZIP, envío por correo, anulación con
      motivo y resumen del estado (emitidos, anulados y pendientes)
* [x] **Página pública de verificación** (`features/verificacion/`, `/verificar/:folio`):
      sin sesión y sin menú, con los cuatro desenlaces (válido, anulado, no
      encontrado e inválido)
* [x] Temas de la CACE (lista cerrada de diez paletas, entre ellas una oscura)
* [ ] Recuperación de contraseña ("olvidé mi contraseña")

---

# 🧾 Auditorías y control de calidad

El proyecto pasó por **cinco rondas de auditoría** documentadas en
`docs/auditorias/`:

| Ronda | Documento | Hallazgos | Estado |
| --- | --- | --- | --- |
| QA 1 | [`reporte-qa-clasesespejo.md`](auditorias/reporte-qa-clasesespejo.md) | 12 hallazgos | Todos corregidos |
| QA 2 | [`reporte-qa-clasesespejo-v2.md`](auditorias/reporte-qa-clasesespejo-v2.md) | 3 hallazgos técnicos + 6 de UX | Todos corregidos |
| QA 3 | [`auditoria-v3-y-analisis-de-diseno.md`](auditorias/auditoria-v3-y-analisis-de-diseno.md) | Problemas de código, diseño y accesibilidad | Todos corregidos |
| QA 4 | [`reporte-qa-clasesespejo-v4.md`](auditorias/reporte-qa-clasesespejo-v4.md) y su [`respuesta`](auditorias/respuesta-auditoria-v4.md) | Revisión del alta pública de agentes y del flujo | Respondida (el alta sigue siendo **pública**: el límite de intentos está solo en el login y la activación, y el alta de un agente en una institución ya aprobada la **confirma un agente** de esa institución) |
| QA 5 | [`auditoria-codigo-muerto-v5.md`](auditorias/auditoria-codigo-muerto-v5.md) | Barrido de código muerto sobre el backend nuevo (CACE y certificados) y el frontend nuevo, con su plan de limpieza priorizado | Documentada (parte corregida, el resto es limpieza no bloqueante) |

Pendientes reconocidos de la tercera ronda (documentados, no bloqueantes):

* `m7` — Agregar restricciones `@@unique` a `ASIGNACION_DOCENTE`,
  `DOCENTE_INSTITUCION` y `MATERIA` (requiere migración de base de datos).
* `m14` — Sustituir métodos de plantilla O(n²) por `computed()`.
* `m15`, `m17`, `m18`, `m19`, `m20` — Mejoras menores de diseño y mantenimiento.

Además, la tercera auditoría incluyó un **análisis de diseño** sobre si hacía
falta un **calendario** y un **sistema de recordatorios**. Conclusión: no existía
una agenda que cruzara proyectos, por lo que un calendario quedaba justificado, y
los recordatorios de mayor valor son:

1. Sesiones cuyo reporte de clase sigue sin firmar.
2. Actividades que vencen en menos de 48 horas.
3. Sesiones próximas.
4. Proyectos atascados en planificación sin ninguna sesión programada.
5. Evaluación final o cierre pendientes.

Ese análisis ya está implementado: el **calendario mensual** en una ventana
emergente y la tarjeta de **recordatorios** con las listas «lo próximo» y «por
hacer» y las marcas de urgencia.

De la quinta ronda (código muerto) siguen abiertos, como limpieza no bloqueante:
los helpers duplicados entre los servicios de la CACE, las dos variables de URL
pública (`FRONTEND_URL` y `URL_PUBLICA`, ver el aviso de la sección de variables
de entorno) y varias reglas CSS y `export` sin uso.

---

# 📅 Plan de desarrollo (metas semanales)

> **Meta:** producto terminado en 8 semanas.
> El **modelo de datos ya está completo** (32 tablas) y el esquema está **migrado y versionado** (21 migraciones). Cada semana termina con un entregable **probable y visible**.
> Al completar una semana, marca sus casillas con `[x]`.

## 🟢 Semana 1 — Catálogo: Materias y asignación docente ↔ materia ✅
- [x] **Backend:** módulo `materias` (CRUD) + `asignaciones` (asignar docente a materia por periodo).
- [x] **Frontend:** panel del agente → listar/crear materias + pantalla de asignación.
- [x] **Entregable:** el agente da de alta materias y las asigna a docentes.

## 🟢 Semana 2 — Catálogo: Docentes, Instituciones y panel real del agente ✅
- [x] **Backend:** docentes (invitar/activar/desactivar/eliminar) + `instituciones` (ver/editar la propia).
- [x] **Frontend:** panel del agente → lista de docentes (activo/desactivado) + datos de institución + gate de registro.
- [x] **Entregable:** panel del agente funcional.

## 🟡 Semana 3 — Solicitudes de clase espejo (lado docente) ✅
- [x] **Backend:** módulo `solicitudes` (crear, listar las del docente, editar/cancelar si está pendiente).
- [x] **Frontend:** panel del docente → crear solicitud + listar "mis solicitudes".
- [x] **Entregable:** el docente crea y consulta solicitudes (estado *Pendiente*).

## 🟡 Semana 4 — Revisión de solicitudes (lado agente) ✅
- [x] **Backend:** revisión de solicitudes (aprobar/rechazar + motivo) en el módulo `solicitudes`.
- [x] **Frontend:** panel del agente → revisar solicitudes (aprobar/rechazar) + el docente ve el estado.
- [x] **Entregable:** flujo de aprobación origen → destino completo.

## 🟡 Semana 5 — Proyecto + Planificación conjunta ✅
- [x] **Backend:** módulo `proyectos` (se crea al aprobar) + `planificaciones`.
- [x] **Frontend:** pantalla de planificación conjunta + reporte de planificación.
- [x] **Entregable:** solicitud aprobada → proyecto → planificación.

## 🟠 Semana 6 — Sesiones, Actividades y Evidencias ✅
- [x] **Backend:** módulos `sesiones`, `actividades`, `evidencias`.
- [x] **Frontend:** agenda de sesiones + actividades + subida de evidencias.
- [x] **Entregable:** el proyecto registra sesiones, actividades y evidencias.

## 🔴 Semana 7 — Reportes y Evaluación ✅
- [x] **Backend:** reporte de clase conjunta por sesión (con firmas de los docentes) + evaluación final + cierre del proyecto.
- [x] **Frontend:** reporte de clase en cada sesión + evaluación final + cierre.
- [x] **Entregable:** ciclo completo hasta *Finalizado*.
- [x] **Extra:** auditorías de código, UX y accesibilidad con sus correcciones (y, más adelante, la QA 4 y la auditoría de código muerto v5).

## 🔵 Semana 8 — Pulido, pruebas y despliegue
- [x] Build de producción del frontend servido por NestJS (`backend/public`).
- [x] Documentación final (este README + manual de usuario).
- [x] Corrección de bugs y validaciones derivadas de las auditorías.
- [x] Simulación de datos para demostración (múltiples clases simultáneas).
- [ ] Recuperación de contraseña (reemplaza el placeholder actual).
- [ ] Prueba integral del flujo completo (de registro a evaluación) sobre la versión compilada.
- [ ] **Entregable:** producto listo para presentar/entregar.

## 🏛 Después de la semana 8: la CACE y los certificados

Las fases posteriores están planificadas en
[`producto/plan-de-accion.md`](producto/plan-de-accion.md) y hoy están
**implementadas**:

| Fase | Contenido | Estado |
| --- | --- | --- |
| **0** | Cimientos de permisos: rol de la CACE, capacidades y `CapacidadesGuard`, alta automática del presidente, cambio de contraseña obligatorio | ✅ |
| **2** | Instituciones: los cuatro estados, buscar antes de crear, logo, panel del presidente, avisos, registro conservado y borrado definitivo | ✅ |
| **3** | Identidad de la CACE: personalización (logo, textos, banderas y temas), premios y sección pública | ✅ |
| **4** | Emisión de certificados: plantilla versionada por la presidencia, emisión individual y por lote en ZIP, PDF con hash | ✅ |
| **5** | Confianza y entrega: folio único, verificación pública con QR, inmutabilidad, reemisión, envío por correo y anulación con motivo | ✅ |
| **6** | Secretarías: rol con permisos fijos, alta por el presidente, activar/desactivar, borrado con autorización y **transmisión de la presidencia** | ✅ |

---

## 🧭 Guía para agentes / futuros desarrolladores

- **Backend:** NestJS 11 + Prisma + PostgreSQL. Módulos en `backend/src/`.
- **Frontend:** Angular 21 standalone + **signals** (modo zoneless) + guards. En `frontend/src/app/`.
- El **schema** (`backend/prisma/schema.prisma`) ya contiene todas las tablas (32) y su historial de migraciones está en `backend/prisma/migrations/` (21).
- Patrón de cada módulo backend: `dto/`, `*.service.ts`, `*.controller.ts`, `*.module.ts`.
- Guard de autorización por recurso: `backend/src/proyectos/guards/docente-participante.guard.ts`.
- Autorización por capacidad: `@Requiere('...')` + `CapacidadesGuard` (`backend/src/auth/capacidades.guard.ts`), con la matriz en `backend/src/common/capacidades.ts`. **Añadir un permiso es añadir una fila a la matriz**, no comparar el rol a mano.
- Endpoints ya existentes: ver la sección **"Endpoints de la API"** (127 rutas).
- Al final de cada semana, hacer un **commit** descriptivo.

---

# 🌱 Flujo general del sistema

El flujo esperado, **de principio a fin**, es:

```text
INSTITUCIÓN
      │
      ▼
El agente busca su institución en el directorio ──► si no está, la crea
      │
      ▼
Pendiente ante la CACE ──► la presidencia aprueba ──► Aprobada
      │                       └── rechaza o veta (con motivo) ──► se puede reactivar
      ▼
El agente invita a sus docentes ──► el docente activa su cuenta
      │
      ▼
Materias y asignaciones (docente ↔ materia por periodo)
      │
      ▼
El docente publica la propuesta (materia, institución destino, objetivo y fecha)
      │
      ▼
Se genera la solicitud (Pendiente)
      │
      ▼
Agente de la institución ORIGEN revisa ──► rechaza (con motivo) ──► el docente corrige
      │
      ▼
Aprobada por origen
      │
      ▼
Agente de la institución DESTINO revisa ──► rechaza (con motivo) ──► el docente corrige
      │
      ▼
Aprobada  ──►  Se crea el PROYECTO (+ planificación conjunta)
      │
      ▼
Planificación conjunta y confirmación de los docentes
      │
      ▼
Docentes agregados de ambas instituciones
      │
      ▼
Sesiones de clase
      │
      ▼
Actividades, evidencias y chat
      │
      ▼
Reporte de clase por sesión (firmas de los docentes)
      │
      ▼
Evaluación final
      │
      ▼
Cierre  ──►  Finalizado
      │
      ▼
Cada docente sube la lista de SUS alumnos (Excel, CSV o pegado)
      │
      ▼
Emisión de los CERTIFICADOS (solo con la clase cerrada)
      │
      ▼
Nombre (autoajustado), folio y QR sobre la plantilla de la CACE
      │
      ├──►  Descarga en PDF o ZIP  ──►  Envío por correo al alumno
      │
      └──►  Verificación pública: el QR abre /verificar/:folio?c=<código>
                    │
                    ▼
            Válido · Anulado (con motivo) · No encontrado · Inválido
```

Y en paralelo, el ciclo de la **CACE**:

```text
Presidencia (se crea al arrancar con PRESIDENTE_CORREO, cambio de contraseña obligatorio)
      │
      ├──► Aprueba, rechaza, veta y reactiva instituciones
      ├──► Da de alta secretarías y las activa o desactiva
      ├──► Autoriza (o ejecuta) el borrado definitivo de una institución rechazada sin historia
      ├──► Personaliza la CACE (lema, descripción, logo, tema y países)
      ├──► Publica premios y reconocimientos
      ├──► Diseña y firma la plantilla del certificado
      └──► Transmite la presidencia (el saliente queda como suplente; queda en el historial)

Secretaría (la crea la presidencia)
      ├──► Ayuda con la personalización, la comunidad y los premios
      └──► Pide el borrado de una institución rechazada (lo autoriza la presidencia)
```

---

# 👨‍💻 Recomendaciones para futuros desarrolladores

Antes de realizar cambios importantes:

1. Revisar el `schema.prisma`.
2. Comprobar las relaciones entre modelos.
3. Revisar los módulos existentes antes de crear uno nuevo.
4. Mantener separada la lógica de controladores y servicios.
5. No almacenar contraseñas directamente.
6. No subir archivos `.env`.
7. Ejecutar `npm run build` después de cambios importantes.
8. Ejecutar `npx prisma validate` después de modificar el esquema.
9. Generar nuevamente Prisma después de modificar `schema.prisma` (con el backend detenido).
10. Recompilar el frontend contra `backend/public` si se cambió el cliente.
11. Crear commits pequeños y descriptivos.
12. Usar las constantes de `common/estados.ts` en lugar de cadenas de estado sueltas.
13. Recordar que el frontend es **zoneless**: el estado asíncrono va en `signal()`.
14. Pedir los permisos por **capacidad** (`@Requiere(...)`), no comparando el rol a mano.
15. Aplicar las migraciones con `npx prisma migrate deploy` (no `db push`) en cualquier base con datos.

---

# 📚 Filosofía del proyecto

El proyecto se encuentra en desarrollo y puede sufrir cambios en su arquitectura.

Se recomienda priorizar:

* Código mantenible.
* Separación de responsabilidades.
* Seguridad.
* Validación de datos.
* Claridad en las relaciones de la base de datos.
* Documentación de cambios importantes.
* Evitar modificaciones innecesarias de la arquitectura existente.

---

# 📄 Licencia

Proyecto académico en desarrollo.

La licencia y condiciones de distribución serán definidas posteriormente.

comunidad de apoyo a clases espejo uniendo mentes corazones y proyectos

---

[↑ Volver al índice](#-índice)
