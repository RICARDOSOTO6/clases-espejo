# 🚀 Guía de despliegue — Clases Conjuntas

Guía simplificada para montar **todo el proyecto** (base de datos + API + frontend)
en un servidor **Linux** o **Windows**.

> Escrita y verificada contra el proyecto real: los comandos, rutas y nombres de
> archivo que aparecen aquí son los que usa el código.
>
> 🍳 **¿Prefieres la versión sin formalidades?** Está en
> `docs/receta-para-montarlo.md`: los mismos pasos contados como una receta de
> cocina, con los datos de la máquina de desarrollo.
>
> 🥋 **¿Es tu primera vez y prefieres practicar sin riesgo?** En
> `docs/practica-en-maquina-virtual.md` está el ensayo general: montar el sistema
> en una máquina virtual, romperlo a propósito (12 ejercicios) y arreglarlo, con
> snapshots para deshacer todo.

---

## Índice

1. [Cómo funciona el despliegue (léelo primero)](#1-cómo-funciona-el-despliegue-léelo-primero)
2. [Lo que necesitas tener a mano](#2-lo-que-necesitas-tener-a-mano)
3. [Ruta rápida (probar en 10 minutos)](#3-ruta-rápida-probar-en-10-minutos)
4. [Paso 1: Instalar el software base](#4-paso-1-instalar-el-software-base)
5. [Paso 2: Crear la base de datos](#5-paso-2-crear-la-base-de-datos)
6. [Paso 3: Descargar el código](#6-paso-3-descargar-el-código)
7. [Paso 4: Configurar el archivo `.env`](#7-paso-4-configurar-el-archivo-env)
8. [Paso 5: Instalar dependencias, crear tablas y compilar](#8-paso-5-instalar-dependencias-crear-tablas-y-compilar)
9. [Paso 6: Primer arranque y verificación](#9-paso-6-primer-arranque-y-verificación)
10. [Paso 7: Dejarlo corriendo como servicio](#10-paso-7-dejarlo-corriendo-como-servicio)
11. [Paso 8: Publicarlo en el puerto 80/443 con HTTPS](#11-paso-8-publicarlo-en-el-puerto-80443-con-https)
12. [Paso 9: Cortafuegos](#12-paso-9-cortafuegos)
13. [Primer uso del sistema](#13-primer-uso-del-sistema)
14. [Actualizar a una versión nueva](#14-actualizar-a-una-versión-nueva)
15. [Respaldos](#15-respaldos)
16. [Verificación final (checklist)](#16-verificación-final-checklist)
17. [Problemas comunes](#17-problemas-comunes)
18. [Chuleta de comandos](#18-chuleta-de-comandos)

---

## 1. Cómo funciona el despliegue (léelo primero)

Entender esto te ahorra la mitad de los problemas:

```text
                    ┌──────────────────────────────────────────┐
   Usuario  ──────► │  Proxy inverso (Nginx / IIS / Caddy)     │
   (navegador)      │  Puerto 80 / 443  +  certificado HTTPS   │
                    └────────────────────┬─────────────────────┘
                                         │  reenvía TODO a
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │  Un solo proceso Node (NestJS) :3000     │
                    │                                          │
                    │   /            → frontend compilado      │
                    │   /auth, /proyectos, …  → API            │
                    │   /uploads     → evidencias subidas      │
                    └────────────────────┬─────────────────────┘
                                         │
                                         ▼
                              PostgreSQL :5432 (local)
```

**Tres ideas clave:**

1. **No hay dos servidores.** NestJS sirve el frontend ya compilado (desde
   `backend/public`), la API y los archivos subidos. Todo sale del puerto `3000`.
2. **El frontend llama a la API en el mismo origen.** En producción (cualquier
   puerto que no sea el `4200` de desarrollo) las peticiones son relativas
   (`/auth/login`). Por eso **el frontend y la API deben verse en el mismo
   dominio**.
3. **Node se ejecuta con el directorio de trabajo en `backend/`.** Las rutas de
   `public/`, `uploads/` y `.env` se resuelven desde ahí (`.env` se lee con
   `dotenv` desde el directorio actual). Si arrancas el proceso desde otra
   carpeta, la aplicación no encuentra nada.

**Lo que NO hace falta:** SSR (no se usa), nginx/iis obligatorio (es opcional, para
HTTPS y dominio), ni Redis/colas. Solo Node + PostgreSQL.

---

## 2. Lo que necesitas tener a mano

| Dato | Ejemplo | Para qué |
| --- | --- | --- |
| Dominio o IP pública | `clasesespejo.miescuela.edu` | URL de acceso y enlaces de invitación |
| Contraseña para la base de datos | `UnaClaveLarga2026` | Conexión de la aplicación |
| Cuenta de correo SMTP | `no-reply@miescuela.edu` + contraseña de aplicación | **Obligatorio**: enviar invitaciones a docentes |
| Clave secreta JWT | 42 caracteres aleatorios | Firmar las sesiones |
| Acceso al repositorio | URL de Git o un ZIP | Obtener el código |

> ⚠️ **Sin SMTP no se pueden dar de alta docentes.** El sistema los incorpora
> enviándoles una invitación por correo. Si el envío falla, la invitación se
> cancela y la API responde con *"No se pudo enviar el correo de invitación"*.

---

## 3. Ruta rápida (probar en 10 minutos)

Si solo quieres verlo funcionando en una máquina (sin dominio ni HTTPS):

```bash
# 1. Backend
cd backend
npm ci
# crear .env (ver paso 4)
npx prisma generate
npx prisma migrate deploy
npm run build

# 2. Frontend compilado dentro del backend
cd ../frontend
npm ci
npx ng build

# 3. Arrancar
cd ../backend
npm run start:prod        # → http://localhost:3000
```

Abre `http://localhost:3000` y regístrate como agente. Para dejarlo corriendo
siempre (aunque cierres la sesión), sigue desde el **Paso 7**.

---

## 4. Paso 1: Instalar el software base

### 🐧 Linux (Ubuntu 22.04 / 24.04 o Debian 12)

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Comprobar
node -v      # v22.x
npm -v
```

### 🪟 Windows Server 2019/2022 (o Windows 10/11)

1. **Node.js 22 LTS** — descargar el instalador `.msi` de <https://nodejs.org>
   y marcar la opción de agregar al `PATH`.
2. **PostgreSQL 16** — descargar de <https://www.postgresql.org/download/windows/>.
   Durante la instalación:
   * Anota la contraseña del usuario `postgres`.
   * Puerto `5432`.
   * Deja marcado *Stack Builder* desactivado (no hace falta).
3. **Git for Windows** — <https://git-scm.com/download/win>.

Comprueba en una terminal nueva (`cmd` o PowerShell):

```powershell
node -v
npm -v
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" --version
```

> **Nota sobre la versión de Node:** el proyecto se desarrolló y probó con
> **Node 22.16**. Angular 21 necesita Node moderno (20.19+ / 22.12+); no uses
> Node 18.

---

## 5. Paso 2: Crear la base de datos

### 🐧 Linux

```bash
sudo -u postgres psql
```

Dentro de `psql`:

```sql
CREATE USER clasesespejo WITH PASSWORD 'UnaClaveLarga2026';
CREATE DATABASE clasesconjuntas OWNER clasesespejo;
\q
```

### 🪟 Windows

Abre **SQL Shell (psql)** desde el menú Inicio (o usa pgAdmin) y ejecuta lo mismo:

```sql
CREATE USER clasesespejo WITH PASSWORD 'UnaClaveLarga2026';
CREATE DATABASE clasesconjuntas OWNER clasesespejo;
```

También sirve desde `cmd`, sin entrar al shell interactivo:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER clasesespejo WITH PASSWORD 'UnaClaveLarga2026';"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE clasesconjuntas OWNER clasesespejo;"
```

> El usuario de la aplicación **no necesita** permisos de superusuario ni
> `CREATEDB`: como es el dueño de la base, `prisma migrate deploy` crea las tablas
> sin problema (ese comando no usa base de datos "sombra").

**Prueba la conexión** antes de seguir:

```bash
psql "postgresql://clasesespejo:UnaClaveLarga2026@localhost:5432/clasesconjuntas" -c "SELECT 1;"
```

---

## 6. Paso 3: Descargar el código

### 🐧 Linux (recomendado: carpeta `/opt`)

```bash
sudo mkdir -p /opt/clasesespejo
sudo chown -R $USER:$USER /opt/clasesespejo
git clone <URL_DEL_REPOSITORIO> /opt/clasesespejo
cd /opt/clasesespejo
```

### 🪟 Windows

```powershell
mkdir C:\clasesespejo
cd C:\clasesespejo
git clone <URL_DEL_REPOSITORIO> .
```

Al terminar deben existir `backend\`, `frontend\` y `docs\`.

---

## 7. Paso 4: Configurar el archivo `.env`

El archivo va **siempre en `backend/.env`** (nunca se sube al repositorio).

```env
# --- Base de datos ---
DATABASE_URL="postgresql://clasesespejo:UnaClaveLarga2026@localhost:5432/clasesconjuntas?schema=public"

# --- Autenticación ---
JWT_SECRET="cambia-esto-por-42-caracteres-aleatorios-largos"
JWT_EXPIRES_IN="1d"
INVITATION_EXPIRES_IN="7d"

# --- URL PÚBLICA del frontend (¡muy importante!) ---
FRONTEND_URL="https://clasesespejo.miescuela.edu"

# --- Correo (obligatorio para invitar docentes) ---
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="no-reply@miescuela.edu"
SMTP_PASS="clave-de-aplicacion"
MAIL_FROM="no-reply@miescuela.edu"

# --- Opcional ---
PORT="3000"
```

### Reglas que el sistema hace cumplir

| Variable | Regla |
| --- | --- |
| `JWT_SECRET` | **La aplicación no arranca** si falta o tiene menos de 16 caracteres. Genera una con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | Es la URL que se envía **dentro del correo de invitación**. Si dejas `localhost:4200`, los docentes recibirán un enlace que no funciona. |
| `SMTP_SECURE` | `"true"` solo para el puerto `465`. Con `587` va `"false"`. |
| `JWT_EXPIRES_IN` / `INVITATION_EXPIRES_IN` | Formato de duración: `30m`, `1d`, `7d`. |

Si usas Gmail, necesitas una **contraseña de aplicación** (no la de tu cuenta):
se genera en la configuración de seguridad de la cuenta Google.

### Permisos del archivo (Linux)

```bash
chmod 600 /opt/clasesespejo/backend/.env
```

---

## 8. Paso 5: Instalar dependencias, crear tablas y compilar

El orden importa: primero se generan el cliente de Prisma y las tablas, después
se compila (el código compilado incluye una copia del cliente).

### 8.1 Backend

```bash
cd /opt/clasesespejo/backend      # Linux
# cd C:\clasesespejo\backend      # Windows

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

* `npm ci` instala exactamente las versiones del `package-lock.json`.
* `prisma generate` crea el cliente en `backend/generated/prisma`.
  ⚠️ **Windows:** si el servicio ya está corriendo, este comando falla con un
  error `EPERM` sobre una DLL. Detén el servicio antes.
* `prisma migrate deploy` crea las 22 tablas en la base de datos (aplica las 9
  migraciones de `backend/prisma/migrations`). Es idempotente: repetirlo no
  rompe nada.
* `npm run build` compila a `backend/dist`.

### 8.2 Frontend

```bash
cd ../frontend                    # Linux
# cd ..\frontend                  # Windows

npm ci
npx ng build
```

Al terminar, `backend/public` debe contener `index.html` más los archivos
`main-XXXX.js` y `styles-XXXX.css`.

> **Opción B (servidores con poca memoria):** el build de Angular necesita ~2 GB
> de RAM. Si tu servidor no los tiene, compila en tu equipo y sube solo el
> resultado:
>
> ```bash
> # en tu equipo
> cd frontend && npx ng build
> # copiar al servidor (Linux)
> scp -r backend/public usuario@servidor:/opt/clasesespejo/backend/
> ```
>
> En ese caso ya no necesitas instalar las dependencias del frontend en el
> servidor.

⚠️ NestJS decide si sirve el frontend **al arrancar**: busca
`backend/public/index.html`. Si compilas el frontend después de arrancar el
servicio, hay que **reiniciarlo** para que lo tome.

---

## 9. Paso 6: Primer arranque y verificación

```bash
cd /opt/clasesespejo/backend
npm run start:prod
```

Debe aparecer:

```text
Backend corriendo en http://localhost:3000
```

Comprueba desde otra terminal:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"clases-espejo-backend","timestamp":"2026-…"}
```

> Comprueba con `/health` y no con `/`: cuando el frontend está compilado, `GET /`
> devuelve el `index.html` de la aplicación.

Y abre `http://IP_DEL_SERVIDOR:3000` en el navegador: debe cargar la pantalla de
**Iniciar sesión** de Clases Conjuntas.

Si todo funciona, detén el proceso con `Ctrl + C` y pasa al Paso 7.

---

## 10. Paso 7: Dejarlo corriendo como servicio

### 🐧 Linux — systemd (recomendado)

Crea un usuario dedicado para que la aplicación no corra como root:

```bash
sudo useradd --system --shell /usr/sbin/nologin --home /opt/clasesespejo clasesespejo
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo -u clasesespejo mkdir -p /opt/clasesespejo/backend/uploads
```

Crea el servicio:

```bash
sudo nano /etc/systemd/system/clasesespejo.service
```

```ini
[Unit]
Description=Clases Conjuntas (API + frontend)
After=network.target postgresql.service

[Service]
Type=simple
User=clasesespejo
Group=clasesespejo
WorkingDirectory=/opt/clasesespejo/backend
ExecStart=/usr/bin/node dist/src/main
Restart=always
RestartSec=5
Environment=NODE_ENV=production
# Límite de memoria (ajusta según tu servidor)
MemoryMax=1G

[Install]
WantedBy=multi-user.target
```

> La clave está en `WorkingDirectory`: **tiene que ser `backend/`**. No hace falta
> declarar las variables: la aplicación lee `backend/.env` desde ahí.

Actívalo:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clasesespejo
sudo systemctl status clasesespejo      # debe decir active (running)
sudo journalctl -u clasesespejo -f      # ver los registros en vivo
```

### 🪟 Windows — NSSM (recomendado)

**NSSM** convierte cualquier programa en un servicio de Windows.

1. Descarga NSSM de <https://nssm.cc/download> y descomprímelo (por ejemplo en
   `C:\nssm`).
2. Abre **PowerShell como Administrador** y ejecuta:

```powershell
C:\nssm\win64\nssm.exe install ClasesConjuntas "C:\Program Files\nodejs\node.exe" "dist\src\main.js"
C:\nssm\win64\nssm.exe set ClasesConjuntas AppDirectory "C:\clasesespejo\backend"
C:\nssm\win64\nssm.exe set ClasesConjuntas DisplayName "Clases Conjuntas"
C:\nssm\win64\nssm.exe set ClasesConjuntas Description "API y frontend de Clases Conjuntas"
C:\nssm\win64\nssm.exe set ClasesConjuntas Start SERVICE_AUTO_START
C:\nssm\win64\nssm.exe set ClasesConjuntas AppStdout "C:\clasesespejo\logs\app.log"
C:\nssm\win64\nssm.exe set ClasesConjuntas AppStderr "C:\clasesespejo\logs\error.log"
New-Item -ItemType Directory -Force C:\clasesespejo\logs | Out-Null
C:\nssm\win64\nssm.exe start ClasesConjuntas
```

Comprobar y controlar el servicio:

```powershell
Get-Service ClasesConjuntas
C:\nssm\win64\nssm.exe restart ClasesConjuntas
C:\nssm\win64\nssm.exe stop ClasesConjuntas
```

**Alternativa con PM2** (más cómodo si ya lo usas):

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
cd C:\clasesespejo\backend
pm2 start dist/src/main.js --name clasesconjuntas --cwd C:\clasesespejo\backend
pm2 save
```

> El detalle crítico en Windows es el mismo que en Linux: el
> **directorio de trabajo** debe ser `...\backend`.

---

## 11. Paso 8: Publicarlo en el puerto 80/443 con HTTPS

Esta parte es **opcional** si solo vas a acceder por `http://IP:3000`. Se hace
para tener un dominio, HTTPS y no exponer el puerto 3000.

### Elige una opción

| Escenario | Opción recomendada |
| --- | --- |
| Linux con dominio | **Nginx + Certbot** (abajo) |
| Linux o Windows, HTTPS fácil | **Caddy** (2 líneas, certificado automático) |
| Windows con IIS ya instalado | **IIS + ARR** |
| Solo red interna | No hace falta proxy: abre el puerto 3000 en el cortafuegos |

### 🐧 Opción Nginx (Linux)

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/clasesespejo
```

```nginx
server {
    listen 80;
    server_name clasesespejo.miescuela.edu;

    # Las evidencias pueden pesar hasta 10 MB: el valor por defecto de Nginx
    # es 1 MB y haría fallar las subidas con error 413.
    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/clasesespejo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# HTTPS con certificado gratuito
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d clasesespejo.miescuela.edu
```

Después de obtener el certificado, actualiza `FRONTEND_URL` en `.env` a
`https://clasesespejo.miescuela.edu` y reinicia el servicio.

### 🌍 Opción Caddy (Linux o Windows)

Caddy obtiene y renueva el certificado solo. **Caddyfile**:

```text
clasesespejo.miescuela.edu {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
caddy run --config Caddyfile     # o caddy start
```

Caddy no limita el tamaño de subida por defecto, así que las evidencias de 10 MB
pasan sin configuración extra.

### 🪟 Opción IIS (Windows)

1. Instala **IIS** (Administrador del servidor → Agregar roles → Servidor web).
2. Instala **URL Rewrite** y **Application Request Routing (ARR)** desde
   <https://www.iis.net/downloads/microsoft>.
3. En IIS Manager → nodo del servidor → **Application Request Routing Cache** →
   *Server Proxy Settings* → marca **Enable proxy**.
4. Crea un sitio con el dominio deseado apuntando a una carpeta vacía (por
   ejemplo `C:\clasesespejo\iis`) y coloca este `web.config`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ClasesConjuntas" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <!-- 12 MB: deja margen sobre el límite de 10 MB de las evidencias -->
        <requestLimits maxAllowedContentLength="12582912" />
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
```

5. Enlaza el certificado en *Enlaces* del sitio (HTTPS 443).

---

## 12. Paso 9: Cortafuegos

**Regla de oro:** el puerto `3000` **no** debe quedar abierto a Internet; solo lo
consume el proxy desde la propia máquina.

### 🐧 Linux

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Si accedes directo por el 3000 (sin proxy), añade `sudo ufw allow 3000/tcp`
**solo** en redes de confianza.

### 🪟 Windows

```powershell
New-NetFirewallRule -DisplayName "Clases Conjuntas HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "Clases Conjuntas HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## 13. Primer uso del sistema

Con el sistema arriba, **no hay que sembrar datos**: la primera institución se
registra desde la propia aplicación.

1. Abre `https://clasesespejo.miescuela.edu`.
2. Pulsa **Regístrate** y crea la cuenta del **agente de internacionalización**
   con los datos de su institución.
3. Inicia sesión. Si aparece el aviso *"Completa el registro de tu institución"*,
   revisa los datos y pulsa **Guardar**.
4. Invita al primer **docente**: se le enviará un correo con el enlace de
   activación (aquí se prueba de paso que el SMTP quedó bien configurado).
5. Como agente, crea **materias** y **asignaciones** para ese docente.

Para el resto del flujo, consulta el **manual de usuario**:
`docs/manual-de-usuario.md`.

### ⚠️ No ejecutes los scripts de demostración en producción

`backend/scripts/seed-demo.js` **borra toda la base de datos** (usuarios,
instituciones, proyectos…) y la reemplaza por datos falsos. Está pensado
únicamente para demos y desarrollo. Lo mismo aplica a
`seed-demo-clases.js` / `borrar-demo-clases.js`.

Si quieres una demostración sobre el servidor, usa una **base de datos aparte**
(por ejemplo `clasesconjuntas_demo`) y apunta `DATABASE_URL` a ella.

---

## 14. Actualizar a una versión nueva

### 🐧 Linux

```bash
cd /opt/clasesespejo
sudo systemctl stop clasesespejo          # detener: Prisma necesita los archivos libres

git pull
cd backend
npm ci                                  # solo si cambió package.json
npx prisma migrate deploy               # solo si hay migraciones nuevas
npm run build

cd ../frontend
npm ci
npx ng build

cd ..
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo systemctl start clasesespejo
sudo systemctl status clasesespejo
```

### 🪟 Windows

```powershell
C:\nssm\win64\nssm.exe stop ClasesConjuntas

cd C:\clasesespejo
git pull
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

cd ..\frontend
npm ci
npx ng build

C:\nssm\win64\nssm.exe start ClasesConjuntas
```

> Recuerda: en Windows **hay que detener el servicio** antes de `prisma generate`
> y antes de recompilar, porque el cliente generado y `dist/` están en uso.

---

## 15. Respaldos

Hay **dos cosas** que respaldar: la base de datos y los archivos de evidencia.

### Base de datos

```bash
# Linux
pg_dump "postgresql://clasesespejo:CLAVE@localhost:5432/clasesconjuntas" \
  -F c -f /var/backups/clasesconjuntas-$(date +%F).dump
```

```powershell
# Windows
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U clasesespejo -F c `
  -f "C:\backups\clasesconjuntas-$(Get-Date -Format yyyy-MM-dd).dump" clasesconjuntas
```

Restaurar:

```bash
pg_restore -d clasesconjuntas --clean --if-exists respaldo.dump
```

### Evidencias subidas

Copia la carpeta `backend/uploads/` (contiene los archivos que subieron los
docentes). Sin ella, la base de datos apuntaría a archivos inexistentes.

```bash
# Ejemplo: copia diaria a otra carpeta/disco
tar czf /var/backups/uploads-$(date +%F).tar.gz -C /opt/clasesespejo/backend uploads
```

Programa ambos con `cron` (Linux) o el **Programador de tareas** (Windows).

---

## 16. Verificación final (checklist)

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 1 | `curl http://localhost:3000/health` | Respuesta JSON del servicio |
| 2 | Abrir el dominio en el navegador | Pantalla **Iniciar sesión** con el logo CACE |
| 3 | Registrarse como agente | Crea la institución y entra al panel |
| 4 | Invitar a un docente | Mensaje *"Invitación enviada"* y el correo llega |
| 5 | Abrir el enlace del correo | Pantalla **Completa tu registro** (comprueba `FRONTEND_URL`) |
| 6 | Activar la cuenta y entrar | Panel del docente |
| 7 | Crear materia + asignación + solicitud | La solicitud aparece *Pendiente* |
| 8 | Revisar como agente de origen y destino | Se crea el proyecto |
| 9 | Subir una evidencia de ~5 MB | Se sube sin error 413 (si usas Nginx) |
| 10 | Reiniciar el servidor | El sistema vuelve solo (servicio habilitado) |

---

## 17. Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| **La aplicación no arranca y el log menciona `JWT_SECRET`** | Falta la variable o tiene menos de 16 caracteres. Genera una nueva y reinicia. |
| **`prisma generate` falla con `EPERM` (Windows)** | El servicio está corriendo y bloquea la DLL del cliente. Detén el servicio, genera y vuelve a arrancar. |
| **`npm run build` no compila / errores raros de Prisma** | Se compiló antes de `prisma generate`. Hazlo en orden: `generate` → `build`. |
| **La web carga pero muestra una versión vieja del frontend** | NestJS sirve `backend/public` **al arrancar**. Recompila el frontend y **reinicia** el servicio. |
| **Las llamadas a la API devuelven el `index.html`** | Algún `location` del proxy está enviando todo al frontend. Revisa que el proxy reenvíe el prefijo a Node sin reescribir la ruta. |
| **Error 413 al subir una evidencia** | Límite del proxy. Nginx: `client_max_body_size 12M`. IIS: `maxAllowedContentLength`. |
| **La subida falla con "Tipo de archivo no permitido"** | Es intencional: solo PDF, imágenes, Office, texto y ZIP. `.html`, `.svg` y `.js` están bloqueados por seguridad. |
| **`No se pudo enviar el correo de invitación`** | SMTP mal configurado. Con Gmail usa **contraseña de aplicación** y `SMTP_SECURE="false"` en el puerto 587. Revisa que el servidor tenga salida al puerto 587. |
| **El enlace del correo apunta a `localhost:4200`** | `FRONTEND_URL` quedó en el valor de desarrollo. Ponlo en la URL pública y reinicia. |
| **Error 502 del proxy** | El proceso Node no está corriendo o escucha en otro puerto. `systemctl status clasesespejo` / `Get-Service ClasesConjuntas` y revisa los logs. |
| **No puedo eliminar una materia / docente** | No es un fallo: el sistema protege el historial. El mensaje indica la dependencia que lo impide. |
| **`npm ci` falla al compilar `bcrypt`** | Es un módulo nativo. En Linux instala las herramientas: `sudo apt-get install -y build-essential python3`. |
| **`npm ci` falla al compilar el frontend por falta de memoria** | Compila en tu equipo (Opción B del Paso 5) y sube solo `backend/public`. |
| **Los archivos subidos dan error de permisos** | `backend/uploads` debe pertenecer al usuario del servicio: `sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo/backend/uploads`. |
| **Cambié `JWT_SECRET` y todos quedaron fuera** | Es el comportamiento esperado: los tokens anteriores dejan de ser válidos. Vuelve a iniciar sesión. |

---

## 18. Chuleta de comandos

### Linux

```bash
# Servicio
sudo systemctl start|stop|restart|status clasesespejo
sudo journalctl -u clasesespejo -n 100 --no-pager

# Aplicación
cd /opt/clasesespejo/backend
npx prisma migrate deploy && npm run build
cd ../frontend && npx ng build

# Base de datos
sudo -u postgres psql clasesconjuntas
```

### Windows

```powershell
# Servicio
C:\nssm\win64\nssm.exe start|stop|restart ClasesConjuntas
Get-Content C:\clasesespejo\logs\app.log -Tail 100

# Aplicación
cd C:\clasesespejo\backend
npx prisma migrate deploy
npm run build
cd ..\frontend
npx ng build

# Base de datos
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U clasesespejo clasesconjuntas
```

---

# 📌 Resumen en una imagen

```text
1. Instalar Node 22 + PostgreSQL + Git
2. Crear la base: clasesconjuntas (dueño: clasesespejo)
3. git clone  →  /opt/clasesespejo   (o C:\clasesespejo)
4. backend/.env  →  DATABASE_URL, JWT_SECRET, FRONTEND_URL, SMTP_*
5. npm ci  →  npx prisma generate  →  npx prisma migrate deploy  →  npm run build
6. frontend: npm ci  →  ng build
7. Servicio: systemd (Linux) / NSSM (Windows), con WorkingDirectory = backend
8. Proxy + HTTPS: Nginx + Certbot / Caddy / IIS+ARR   (subidas: 12 MB)
9. Cortafuegos: 80 y 443 abiertos, 3000 cerrado
10. Abrir el dominio  →  registrarse como agente  →  invitar docentes
```

---

*Guía de despliegue de Clases Conjuntas · Plataforma CACE*
*Documentos relacionados: `docs/readme` (técnico) y `docs/manual-de-usuario.md` (uso).*
