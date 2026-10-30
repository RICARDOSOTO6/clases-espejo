# 🚀 Guía de despliegue — de un Ubuntu recién instalado al piloto en línea

La única guía de puesta en marcha del proyecto. Pasos numerados, en orden, con
los comandos listos para copiar.

> **Cómo está escrita:** cada comando y cada ruta se comprobaron contra los
> archivos actuales del proyecto (`Dockerfile`, `backend/.env.example`,
> `backend/src/main.ts`, `frontend/angular.json`, `backend/scripts/`). **No se
> ejecutaron en un Ubuntu real** al escribirla: la prueba de fuego es tu máquina
> virtual. Si algo falla, el mensaje de error dirá en qué paso estás.
>
> **Ensayar antes de arriesgar:** hazlo primero en una máquina virtual y con una
> instantánea tomada. Al final está el [Apéndice A](#apéndice-a-ensayarlo-en-virtualbox)
> con los datos de la VM.

---

## Índice

0. [Qué vas a montar](#0-qué-vas-a-montar)
1. [Preparar Ubuntu](#1-preparar-ubuntu)
2. [Node.js 24](#2-nodejs-24)
3. [PostgreSQL 17](#3-postgresql-17)
4. [La base de datos y su usuario](#4-la-base-de-datos-y-su-usuario)
5. [El usuario del servicio](#5-el-usuario-del-servicio)
6. [Traer el código](#6-traer-el-código)
7. [El archivo `.env`](#7-el-archivo-env)
8. [Dependencias, migraciones y compilación](#8-dependencias-migraciones-y-compilación)
9. [Primer arranque y verificación](#9-primer-arranque-y-verificación)
10. [Dejarlo como servicio](#10-dejarlo-como-servicio)
11. [Nginx delante (puerto 80)](#11-nginx-delante-puerto-80)
12. [HTTPS con dominio](#12-https-con-dominio)
13. [Cortafuegos](#13-cortafuegos)
14. [Primer acceso y alta de la presidencia](#14-primer-acceso-y-alta-de-la-presidencia)
15. [Respaldos automáticos](#15-respaldos-automáticos)
16. [Actualizar el piloto](#16-actualizar-el-piloto)
17. [Problemas frecuentes](#17-problemas-frecuentes)
18. [Lista final de aceptación](#18-lista-final-de-aceptación)
- [Apéndice A: ensayarlo en VirtualBox](#apéndice-a-ensayarlo-en-virtualbox)
- [Apéndice B: Docker](#apéndice-b-docker)
- [Apéndice C: variables de `.env`](#apéndice-c-variables-de-env)

**Tiempo:** 45 minutos la primera vez. **Requisitos:** Ubuntu Server 24.04 LTS,
2 GB de RAM y 20 GB de disco como mínimo (4 GB de RAM si vas a compilar el
frontend en la propia máquina).

---

## 0. Qué vas a montar

Una sola URL sirve **API y frontend compilado**: el frontend de Angular se
compila *dentro* de `backend/public` y NestJS lo entrega.

```text
Navegador
   │
   ├── Nginx (80/443)  ── opcional pero recomendado
   │       │
   │       └── Node 24 + NestJS (127.0.0.1:3000)
   │               │
   │               ├── PostgreSQL 17 (127.0.0.1:5432)
   │               └── uploads/ (evidencias, logos, PDFs emitidos)
```

| Pieza | Dónde |
|---|---|
| Código | `/opt/clasesespejo` |
| Servicio | usuario de sistema `clasesespejo`, unidad `clasesespejo.service` |
| Variables | `/opt/clasesespejo/backend/.env` (permisos 600) |
| Archivos subidos | `/opt/clasesespejo/backend/uploads` |
| Respaldos | `/var/backups/clasesespejo` |

> El backend lee `.env` **desde la carpeta donde se lanza** (`main.ts` hace
> `import 'dotenv/config'`). Por eso el servicio se lanza desde `backend/`.

---

## 1. Preparar Ubuntu

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip ca-certificates build-essential python3 openssl
sudo timedatectl set-timezone America/Mexico_City     # ajusta la tuya
```

`build-essential` y `python3` son la red de seguridad de las dependencias nativas
(`bcrypt`); con un binario precompilado ni se usan.

**📸 Toma una instantánea ahora** si estás en una máquina virtual. Este es el
punto al que vas a querer volver.

---

## 2. Node.js 24

El paquete se construyó con Node 24 (es la versión de la imagen del `Dockerfile`).
Node 18 o 20 no están soportados por Angular 21.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node -v      # v24.x
npm -v
```

---

## 3. PostgreSQL 17

Ubuntu 24.04 instala PostgreSQL 16 por defecto. El proyecto usa 17, así que se
añade el repositorio oficial de PostgreSQL.

```bash
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
. /etc/os-release
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt install -y postgresql-17
```

Comprueba que arranca y que **solo escucha en local**:

```bash
sudo systemctl status postgresql
sudo ss -lntp | grep 5432      # debe decir 127.0.0.1:5432
```

---

## 4. La base de datos y su usuario

Usa una contraseña larga y **sin** `@ : / ?` (rompen la URL de conexión).

```bash
sudo -u postgres psql
```

Dentro de `psql` (cambia la contraseña):

```sql
CREATE ROLE clasesespejo LOGIN PASSWORD 'UNA_CONTRASENA_LARGA_2026';
CREATE DATABASE clasesconjuntas OWNER clasesespejo ENCODING 'UTF8' TEMPLATE template0;
\q
```

Prueba la conexión tal como la usará la aplicación:

```bash
PGPASSWORD='UNA_CONTRASENA_LARGA_2026' psql -h 127.0.0.1 -U clasesespejo -d clasesconjuntas -c '\conninfo'
```

Debe responder con la conexión establecida, no con un error de contraseña.

---

## 5. El usuario del servicio

La aplicación no debe correr como `root` ni con tu usuario personal.

```bash
sudo useradd --system --shell /usr/sbin/nologin --home /opt/clasesespejo clasesespejo
sudo mkdir -p /opt/clasesespejo
sudo chown clasesespejo:clasesespejo /opt/clasesespejo
```

`/opt/clasesespejo` es también su carpeta personal: ahí dejará su caché de `npm`.
Los comandos de instalación y compilación van con **`sudo -H`** para que usen esa
carpeta y no la de `root`.

---

## 6. Traer el código

**Opción A — desde GitHub** (el repositorio es público):

```bash
sudo -H -u clasesespejo git clone https://github.com/RICARDOSOTO6/clases-espejo.git /opt/clasesespejo
```

**Opción B — el código tal como está en tu máquina de desarrollo**, incluido lo
que aún no has subido. Desde PowerShell, en la carpeta del proyecto:

```powershell
git archive --format=zip -o "$env:TEMP\clasesespejo.zip" HEAD
scp "$env:TEMP\clasesespejo.zip" ricardo@IP_DEL_SERVIDOR:/home/ricardo/
```

Y en el servidor:

```bash
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo -H -u clasesespejo unzip -q /home/ricardo/clasesespejo.zip -d /opt/clasesespejo
ls /opt/clasesespejo          # backend  frontend  docs  Dockerfile
```

---

## 7. El archivo `.env`

Genera primero el secreto de sesión. **Mínimo 32 bytes**: si es más corto, la
aplicación se niega a arrancar.

```bash
openssl rand -hex 32
```

Crea el archivo con ese valor:

```bash
sudo -H -u clasesespejo nano /opt/clasesespejo/backend/.env
```

```env
# --- Base de datos (obligatoria) ---
DATABASE_URL="postgresql://clasesespejo:UNA_CONTRASENA_LARGA_2026@localhost:5432/clasesconjuntas?schema=public"

# --- Sesiones y certificados (obligatoria) ---
JWT_SECRET="PEGA_AQUI_LA_SALIDA_DE_openssl_rand_hex_32"
JWT_EXPIRES_IN="1d"
INVITATION_EXPIRES_IN="7d"

# --- URL pública: el dominio real, no localhost ---
FRONTEND_URL="https://clases.tudominio.org"
URL_PUBLICA="https://clases.tudominio.org"

# --- Certificados ---
CERTIFICADO_MODO_DEMO="true"

# --- Correo saliente (obligatorio para invitar y para la presidencia) ---
SMTP_HOST="smtp.tudominio.org"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="usuario@tudominio.org"
SMTP_PASS="la-contrasena-del-correo"
MAIL_FROM="no-reply@tudominio.org"

# --- Presidencia inicial ---
PRESIDENTE_CORREO="presidencia@tudominio.org"

# --- Opcionales ---
PORT="3000"
HSTS="true"
#REVISION_DIAS_ANTELACION="7"
#URLS_PERMITIDAS=""
#ALERTA_WEBHOOK_URL=""
#ALERTA_COOLDOWN_MIN="30"
```

Protege el archivo:

```bash
sudo chmod 600 /opt/clasesespejo/backend/.env
sudo chown clasesespejo:clasesespejo /opt/clasesespejo/backend/.env
```

Tres reglas que no se negocian:

1. **`JWT_SECRET` no se cambia después de emitir certificados**: con él se deriva
   el código de verificación impreso. Cambiarlo invalida los ya emitidos.
2. **`URL_PUBLICA` se fija antes del primer certificado**: es la base del QR.
   Cambiarla después deja inservibles los QR impresos.
3. **`CERTIFICADO_MODO_DEMO` sigue en `true`** hasta que la CACE autorice la
   plantilla y el uso oficial.

---

## 8. Dependencias, migraciones y compilación

El orden importa: primero el cliente de Prisma y las tablas, después la
compilación (el código compilado importa el cliente generado).

**8.1 Backend**

```bash
sudo -H -u clasesespejo bash -lc '
  cd /opt/clasesespejo/backend &&
  npm ci &&
  npx prisma generate &&
  npx prisma migrate deploy &&
  npm run build
'
```

- `npm ci` instala exactamente las versiones de `package-lock.json`.
- `prisma generate` crea el cliente en `backend/generated/prisma`.
- `migrate deploy` aplica las migraciones **existentes**. No crea ni modifica
  migraciones: para eso está `migrate dev`, que en el servidor **no se usa**.
- `npm run build` (`nest build`) deja el ejecutable en `dist/src/main.js`.

**8.2 Frontend**

```bash
sudo -H -u clasesespejo bash -lc '
  cd /opt/clasesespejo/frontend &&
  npm ci &&
  npm run build
'
```

`angular.json` tiene `outputPath` apuntando a **`../backend/public`**: el resultado
no se queda en el frontend, cae directamente donde lo sirve NestJS. Tarda entre 2
y 6 minutos.

> Con 2 GB de RAM el build de Angular puede morir por falta de memoria. Si pasa,
> compílalo en tu equipo y copia el resultado:
> `scp -r .\backend\public\* ricardo@IP_DEL_SERVIDOR:/opt/clasesespejo/backend/public/`
> (en Windows, en PowerShell).

Comprueba que quedó compilado:

```bash
ls /opt/clasesespejo/backend/public | head      # index.html, main-*.js, ...
```

---

## 9. Primer arranque y verificación

Arranca a mano una vez, para ver los errores en pantalla:

```bash
sudo -H -u clasesespejo bash -lc '
  cd /opt/clasesespejo/backend && node dist/src/main
'
```

Debe aparecer el arranque de Nest y que escucha en el 3000. En **otra terminal**:

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok","service":"clases-espejo-backend","timestamp":"..."}
```

Comprueba con **`/health`**, no con `/`: cuando el frontend está compilado, `GET /`
devuelve el `index.html`.

Si todo está bien, `Ctrl+C` y pasa al servicio. Si no, mira
[Problemas frecuentes](#17-problemas-frecuentes).

---

## 10. Dejarlo como servicio

```bash
sudo nano /etc/systemd/system/clasesespejo.service
```

```ini
[Unit]
Description=Clases Conjuntas (API + frontend)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=clasesespejo
Group=clasesespejo
WorkingDirectory=/opt/clasesespejo/backend
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5
TimeoutStopSec=20
Environment=NODE_ENV=production
MemoryMax=1G
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/clasesespejo/backend/uploads

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /opt/clasesespejo/backend/uploads
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo/backend/uploads
sudo systemctl daemon-reload
sudo systemctl enable --now clasesespejo
systemctl status clasesespejo        # active (running)
journalctl -u clasesespejo -f        # registros en vivo
```

`WorkingDirectory=/opt/clasesespejo/backend` es lo que hace que se lea el `.env`
correcto y que `uploads/` exista donde la aplicación lo busca.

---

## 11. Nginx delante (puerto 80)

Opcional para una prueba en red local; imprescindible para HTTPS y para no
exponer el 3000.

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/clasesespejo
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name clases.tudominio.org;      # o la IP si aún no hay dominio

    client_max_body_size 25m;              # las evidencias pesan hasta 10 MB
    proxy_read_timeout 60s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -sfn /etc/nginx/sites-available/clasesespejo /etc/nginx/sites-enabled/clasesespejo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Ajusta el `.env` a la nueva URL y reinicia:

```env
FRONTEND_URL="http://clases.tudominio.org"
URL_PUBLICA="http://clases.tudominio.org"
```

```bash
sudo systemctl restart clasesespejo
curl -s http://127.0.0.1/health
```

> Si las subidas de archivos dan **error 413**, es `client_max_body_size`. Si los
> enlaces de las invitaciones salen con el host equivocado, revisa
> `FRONTEND_URL` y `URLS_PERMITIDAS`.

---

## 12. HTTPS con dominio

Requisitos: dominio con un registro **A** apuntando a la IP del servidor, puertos
80 y 443 abiertos y Nginx funcionando.

```bash
dig +short clases.tudominio.org          # debe devolver la IP correcta
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d clases.tudominio.org
```

Certbot reescribe la configuración y renueva solo. Comprueba:

```bash
sudo nginx -t && sudo systemctl reload nginx
echo | openssl s_client -connect clases.tudominio.org:443 2>/dev/null | grep subject
```

Ahora sí, la URL definitiva en el `.env` **antes de emitir ningún certificado**:

```env
FRONTEND_URL="https://clases.tudominio.org"
URL_PUBLICA="https://clases.tudominio.org"
```

```bash
sudo systemctl restart clasesespejo
```

---

## 13. Cortafuegos

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

**No abras el 3000.** El backend escucha en local y Nginx es la única puerta. Si
pruebas sin Nginx, limita el puerto a tu red:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
```

En un VPS real, cambia además la contraseña de `root` por **clave SSH** y
desactiva el acceso por contraseña en `/etc/ssh/sshd_config`.

---

## 14. Primer acceso y alta de la presidencia

En el primer arranque, si **no existe ninguna presidencia**, la aplicación crea la
cuenta de `PRESIDENTE_CORREO` con una contraseña provisional (cambio obligatorio al
entrar) y la envía por correo.

- Si el SMTP no está configurado, la cuenta se crea igual, pero **la contraseña no
  se imprime en el registro**: habría que restablecerla. Configura el correo antes
  del primer arranque.
- Una base nueva **no** trae datos de demostración.
- Si más adelante hay que cambiar de presidencia, se hace **transmitiendo** el
  cargo desde la aplicación; no se borra la cuenta.

Primer recorrido recomendado:

1. Abre `https://clases.tudominio.org` → pantalla de inicio de sesión.
2. Entra con la presidencia, cambia la contraseña.
3. Registra una institución y apruébala (dos instituciones, si vas a probar una
   clase espejo de verdad).
4. Invita a una secretaría y a un docente: comprueba que **el correo llega**.
5. Sube una evidencia (comprueba el límite de tamaño y que el PDF se descarga).
6. Emite un certificado de prueba y abre el QR: debe resolver en `/verificar/...`.

---

## 15. Respaldos automáticos

El proyecto trae servicios y temporizadores listos, además de los guiones.

```bash
sudo /opt/clasesespejo/backend/scripts/instalar-temporizadores.sh
systemctl list-timers --all | grep clasesespejo
```

Instala dos temporizadores:

| Temporizador | Cuándo | Qué hace |
|---|---|---|
| `clasesespejo-respaldo.timer` | todos los días a las **02:15** | `scripts/respaldo-cron.sh` → `npm run respaldo` (base + `uploads`) en `/var/backups/clasesespejo` |
| `clasesespejo-salud.timer` | al arrancar y **cada 5 minutos** | `scripts/verificar-salud.js` contra `/health` |

El instalador exige que `clasesespejo.service` y el usuario ya existan (pasos 5 y
10). Si no configuras `ALERTA_WEBHOOK_URL` en el `.env`, un fallo solo queda en el
registro: nadie se entera. Vale la pena poner un webhook de Slack, Discord o
Telegram.

Respaldo manual, cuando lo necesites:

```bash
sudo -H -u clasesespejo bash -lc 'cd /opt/clasesespejo/backend && npm run respaldo -- --salida /var/backups/clasesespejo/manual'
```

Y **ensaya la restauración** una vez, en la VM, con `npm run restauracion`. Un
respaldo que nunca se ha restaurado no es un respaldo. Copia después los archivos
fuera del servidor. El detalle está en
[`respaldo-y-restauracion.md`](respaldo-y-restauracion.md).

---

## 16. Actualizar el piloto

```bash
sudo -H -u clasesespejo git -C /opt/clasesespejo pull
sudo -H -u clasesespejo bash -lc 'cd /opt/clasesespejo/backend && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build'
sudo -H -u clasesespejo bash -lc 'cd /opt/clasesespejo/frontend && npm ci && npm run build'
sudo systemctl restart clasesespejo
curl -s http://127.0.0.1:3000/health
```

Orden correcto: **respaldo → código → migraciones → compilar → reiniciar**. Nunca
en medio de una clase ni con `migrate dev`. Si el pull trae un cambio de esquema
que ya se aplicó, el error de *checksum* se resuelve con `migrate resolve`, no
reiniciando la base.

---

## 17. Problemas frecuentes

| Síntoma | Causa habitual | Qué mirar |
|---|---|---|
| El servicio no arranca y habla de `JWT_SECRET` | secreto ausente o de menos de 32 bytes | `openssl rand -hex 32` en el `.env` |
| `Can't reach database server` | PostgreSQL apagado o `DATABASE_URL` con la contraseña/usuario equivocados | `systemctl status postgresql`, probar `psql` a mano (paso 4) |
| `/health` responde pero `/` da 404 | el frontend no se compiló | `ls backend/public`; repetir el paso 8.2 |
| La web carga pero las llamadas a la API fallan (CORS) | `FRONTEND_URL` no coincide con el dominio real | `.env` + reiniciar el servicio |
| Error 413 al subir evidencias | límite de Nginx | `client_max_body_size 25m` |
| El correo no llega | SMTP mal configurado o el proveedor bloquea | probar con una invitación y mirar `journalctl -u clasesespejo` |
| La contraseña provisional de presidencia no llegó | SMTP falló en el primer arranque | restablécela con la recuperación de contraseña |
| Tras actualizar, el `.env` «no se aplica» | `WorkingDirectory` distinta de `backend/` | revisar la unidad |
| Todo era culpa del navegador | `index.html` viejo en caché | `Ctrl+Shift+R` |

---

## 18. Lista final de aceptación

- [ ] `systemctl status clasesespejo` → *active (running)*
- [ ] `curl http://127.0.0.1:3000/health` → `{"status":"ok",...}`
- [ ] `https://dominio` abre la pantalla de inicio de sesión
- [ ] `https://dominio/health` responde por HTTPS (proxy + certificado)
- [ ] `sudo ufw status` → solo OpenSSH y Nginx; **3000 cerrado**
- [ ] Entra la presidencia (contraseña propia, no provisional)
- [ ] Llega un correo de invitación a una cuenta real
- [ ] Se sube una evidencia y se descarga el PDF
- [ ] El QR de un certificado de prueba abre `/verificar/...`
- [ ] `systemctl list-timers --all | grep clasesespejo` → respaldo y salud activos
- [ ] Hay un respaldo en `/var/backups/clasesespejo` **y se probó restaurarlo**
- [ ] `CERTIFICADO_MODO_DEMO="true"` (hasta que la CACE autorice)
- [ ] Los respaldos están copiados fuera del servidor

---

## Apéndice A: ensayarlo en VirtualBox

Con esto puedes repetir toda la guía sin arriesgar nada.

1. **VM nueva:** Ubuntu Server 24.04 LTS, 2 CPU, **4096 MB**, disco VDI de 30 GB
   (dinámico). En el asistente de VirtualBox marca **Skip Unattended
   Installation**.
2. **Red:** adaptador **NAT** y, en *Avanzado → Reenvío de puertos*, dos reglas:

   | Nombre | Protocolo | Anfitrión | Invitado |
   |---|---|---|---|
   | `ssh` | TCP | 2222 | 22 |
   | `web` | TCP | 8080 | 3000 |

   Así `http://localhost:8080` en Windows es el 3000 de la VM, sin depender del
   Wi-Fi ni del cortafuegos de la red.
3. **Instala** Ubuntu Server y marca **Install OpenSSH server** (si no, no hay
   SSH). Comprueba desde PowerShell: `ssh -p 2222 ricardo@localhost`.
4. **Instantánea** con la VM apagada (VirtualBox → Instantáneas → Tomar).
5. **Sigue esta guía** desde el paso 1. Dos diferencias:
   - no necesitas dominio ni HTTPS: quédate en el paso 11 (HTTP) o prueba
     directamente `http://localhost:8080` sin Nginx;
   - `FRONTEND_URL` debe ser `http://localhost:8080` (el puerto de *tu* Windows),
     si quieres que los enlaces del correo abran bien desde tu navegador.
6. **Rómpela a propósito** y arréglala: para el servicio, cambia `JWT_SECRET` por
   uno corto, apaga PostgreSQL, borra `backend/public`. Cada fallo es un error que
   no vas a ver delante de un cliente.

## Apéndice B: Docker

Existe `docker-compose.yml` (PostgreSQL 17 + aplicación en el 3000, aplicando
migraciones al arrancar). Es la vía más corta para una demo.

```bash
sudo apt install -y docker.io docker-compose-v2
cp .env.docker.example .env.docker
nano .env.docker                # mismas variables que el paso 7
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs -f app
```

> **Sin verificar:** la imagen **nunca se ha construido** en la máquina de
> desarrollo (no había Docker). La primera construcción real hay que verla con los
> registros delante, y no el día de la clase. Los datos viven en los volúmenes
> `db-data`, `uploads` y `respaldos`; `docker compose down -v` los borra.

## Apéndice C: variables de `.env`

La lista canónica, con todos los comentarios, está en
[`backend/.env.example`](../../backend/.env.example). Resumen:

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | sí | conexión a PostgreSQL |
| `JWT_SECRET` | sí (≥32 bytes) | firma de sesiones y código de verificación de certificados |
| `JWT_EXPIRES_IN`, `INVITATION_EXPIRES_IN` | no | duración de sesión y de invitación |
| `FRONTEND_URL` | sí | origen permitido y enlaces de los correos |
| `URL_PUBLICA` | sí | base del QR del certificado |
| `CERTIFICADO_MODO_DEMO` | sí | marca DEMO en los certificados |
| `SMTP_*`, `MAIL_FROM` | sí en la práctica | invitaciones, avisos y certificados |
| `PRESIDENTE_CORREO` | sí en una base nueva | crea la presidencia inicial |
| `PORT` | no (3000) | puerto del backend |
| `HSTS` | no | cabecera de seguridad (solo con `NODE_ENV=production`) |
| `REVISION_DIAS_ANTELACION` | no (7) | plazo para responder una solicitud |
| `URLS_PERMITIDAS` | no | hosts aceptados para deducir la URL pública |
| `ENVIOS_INTERVALO_MS` | no (60000) | cada cuánto vacía la cola el worker de correo |
| `ALERTA_WEBHOOK_URL`, `ALERTA_WEBHOOK_TOKEN`, `ALERTA_COOLDOWN_MIN` | no | avisos del temporizador de salud |

---

*Si algo de esta guía no coincide con lo que hace el código, es un error de la
guía: corrígelo y avisa.*
