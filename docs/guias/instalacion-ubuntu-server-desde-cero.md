# Instalación desde cero en Ubuntu Server

**Proyecto:** Clases Conjuntas  
**Paquete:** `ClasesEspejo-entrega-2026-10-27.zip`  
**Guía actualizada:** 27 de octubre de 2026  
**Sistema objetivo:** Ubuntu Server 24.04 LTS recién instalado  
**Uso:** ensayo en máquina virtual, antes del piloto

> **Importante:** esta guía está escrita para el paquete congelado de L6. No está
> probada todavía en tu máquina virtual. Los comandos son los mismos que se
> validaron en el entorno local, adaptados a Ubuntu. Si algo falla, no improvises
> cambios en la base ni en el código: copia el error exacto y revísalo con la
> sección de problemas.

> **No uses datos reales de alumnos todavía.** Usa datos ficticios y
> `CERTIFICADO_MODO_DEMO="true"` hasta que la CACE autorice el uso oficial, el
> aviso de privacidad y el servidor definitivo.

---

## Índice

0. [Qué vas a montar](#0-qué-vas-a-montar)
1. [Antes de tocar la VM](#1-antes-de-tocar-la-vm)
2. [Preparar Ubuntu](#2-preparar-ubuntu)
3. [Instalar Node.js 24](#3-instalar-nodejs-24)
4. [Instalar PostgreSQL 17](#4-instalar-postgresql-17)
5. [Crear la base y el usuario de base](#5-crear-la-base-y-el-usuario-de-base)
6. [Crear el usuario del servicio y las carpetas](#6-crear-el-usuario-del-servicio-y-las-carpetas)
7. [Copiar y verificar el paquete](#7-copiar-y-verificar-el-paquete)
8. [Instalar dependencias del backend](#8-instalar-dependencias-del-backend)
9. [Configurar `.env`](#9-configurar-env)
10. [Aplicar migraciones](#10-aplicar-migraciones)
11. [Primer arranque manual](#11-primer-arranque-manual)
12. [Dejarlo como servicio con systemd](#12-dejarlo-como-servicio-con-systemd)
13. [Poner Nginx delante](#13-poner-nginx-delante)
14. [HTTPS con dominio, si ya tienes uno](#14-https-con-dominio-si-ya-tienes-uno)
15. [Primer acceso y alta inicial](#15-primer-acceso-y-alta-inicial)
16. [Correo saliente](#16-correo-saliente)
17. [Verificación completa](#17-verificación-completa)
18. [Respaldos](#18-respaldos)
19. [Actualizar y volver atrás](#19-actualizar-y-volver-atrás)
20. [Problemas frecuentes](#20-problemas-frecuentes)
21. [Seguridad mínima](#21-seguridad-mínima)
22. [Lista final de aceptación](#22-lista-final-de-aceptación)
23. [Anexo: restauración de la base DEMO](#23-anexo-restauración-de-la-base-demo)

---

## 0. Qué vas a montar

La aplicación tiene dos partes:

```text
Navegador
   │
   ├── Nginx (puerto 80/443, opcional pero recomendado)
   │       │
   │       └── Node.js + NestJS (puerto 3000, solo local)
   │               │
   │               └── PostgreSQL 17 (puerto 5432, solo local)
   │
   └── Archivos subidos en /var/lib/clasesespejo/uploads
```

En esta guía:

- el backend se ejecuta con el usuario del sistema `clasesespejo`;
- el código vive en `/opt/clasesespejo`;
- los archivos subidos viven fuera del código, en
  `/var/lib/clasesespejo/uploads`;
- la base se llama `ClasesconjuntasBD`;
- el backend escucha en `127.0.0.1:3000`;
- Nginx publica el puerto 80 y, si tienes dominio, el 443.

La aplicación **no necesita** Apache, Docker, una cuenta de GitHub ni un dominio
para funcionar en una red local. Solo necesita Node, PostgreSQL y el paquete.

---

## 1. Antes de tocar la VM

### 1.1 Elige cómo vas a llegar a la VM

Tienes dos opciones:

| Modo | Ventaja | Inconveniente |
|---|---|---|
| **Adaptador puente** | La VM tiene IP propia en tu red y se ve desde otros equipos | La IP puede cambiar si el router la reasigna |
| **NAT con reenvío de puertos** | La VM queda más aislada | Hay que configurar el reenvío en el hypervisor |

Para probar desde el navegador de tu computadora, lo más simple es **adaptador
puente** con IP fija o reserva DHCP.

### 1.2 Datos que debes tener a mano

Sustituye estos valores en toda la guía:

```text
IP_VM           IP de la máquina virtual, por ejemplo 192.168.1.50
USUARIO_UBUNTU  usuario con sudo, por ejemplo ricardo
DOMINIO         dominio real, si lo tienes; si no, déjalo vacío
DB_PASS         contraseña larga para PostgreSQL
JWT_SECRET      cadena aleatoria de 32 bytes en hexadecimal
CORREO_CACE     correo de la presidencia para la primera cuenta
```

No uses la contraseña de ejemplo `Demo1234`, ni la de la base de demostración,
en una VM que otras personas puedan alcanzar.

### 1.3 Entra a la VM

Desde tu computadora:

```bash
ssh USUARIO_UBUNTU@IP_VM
```

Si acabas de instalar Ubuntu Server, confirma:

```bash
hostnamectl
ip a
```

Anota la IP y comprueba que responde:

```bash
ping -c 3 IP_VM
```

### 1.4 Toma una instantánea

En el hypervisor, crea una instantánea llamada:

```text
ubuntu-limpio-antes-de-clasesconjuntas
```

Así puedes volver al inicio si algo sale mal. No es un respaldo de la base; es
una foto de la VM.

---

## 2. Preparar Ubuntu

Todos los comandos siguientes se ejecutan **dentro de la VM**.

### 2.1 Actualizar el sistema

```bash
sudo apt update
sudo apt -y upgrade
```

Si Ubuntu pide reiniciar:

```bash
sudo reboot
```

Vuelve a entrar por SSH.

### 2.2 Instalar herramientas base

```bash
sudo apt install -y \
  curl \
  ca-certificates \
  unzip \
  build-essential \
  python3 \
  nano \
  htop \
  git \
  openssl \
  dnsutils \
  ufw \
  nginx \
  fontconfig \
  fonts-dejavu-core \
  fonts-liberation
```

`fonts-dejavu-core` y `fonts-liberation` son importantes para que los PDF de los
certificados encuentren una fuente en Linux. Si no están, PDFKit puede caer en
una fuente incorporada que no cubre correctamente todos los acentos.

### 2.3 Configurar zona horaria y nombre

Opcional, pero ayuda a leer los logs:

```bash
sudo timedatectl set-timezone America/Mexico_City
sudo hostnamectl set-hostname clasesespejo-demo
```

Si el servidor será compartido con otros países, es preferible dejarlo en UTC y
mostrar la hora local solo en la aplicación. Para esta prueba no es crítico.

### 2.4 Comprobar la versión de Ubuntu

```bash
. /etc/os-release
echo "Ubuntu: $VERSION_ID ($VERSION_CODENAME)"
```

La guía asume `VERSION_CODENAME=noble` (Ubuntu 24.04). Si es `jammy` (22.04),
los comandos de PostgreSQL funcionan igual cambiando el repositorio que indica
la sección siguiente.

### 2.5 Crear otra instantánea

```text
ubuntu-base-con-herramientas
```

Todavía no hay datos del proyecto; esta instantánea sirve para repetir la
instalación sin volver a actualizar todo.

---

## 3. Instalar Node.js 24

El paquete fue construido con Node.js 24. No uses Node 18 o 20: pueden aparecer
diferencias con Angular, con las dependencias nativas o con Prisma.

### 3.1 Agregar el repositorio de NodeSource

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x \
  -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
```

### 3.2 Instalar Node

```bash
sudo apt install -y nodejs
```

### 3.3 Verificar

```bash
node --version
npm --version
```

Debe mostrar algo como:

```text
v24.x.x
11.x.x
```

Si `node --version` sigue mostrando Node 18 o 20:

```bash
which node
node --version
apt-cache policy nodejs
```

No sigas hasta que sea Node 24.

---

## 4. Instalar PostgreSQL 17

Ubuntu 24.04 puede instalar PostgreSQL 16 por defecto. El proyecto declara
PostgreSQL 17; para una prueba fiel, instala 17 desde el repositorio oficial de
PostgreSQL.

### 4.1 Agregar la llave y el repositorio

```bash
sudo install -d /usr/share/postgresql-common/pgdg

sudo curl -fsSL \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc

. /etc/os-release

echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
```

### 4.2 Instalar PostgreSQL 17

```bash
sudo apt install -y postgresql-17 postgresql-client-17
```

### 4.3 Verificar

```bash
psql --version
pg_lsclusters
sudo systemctl status postgresql --no-pager
```

Debe aparecer un clúster `17 main` en estado `online`.

Si el servicio no está activo:

```bash
sudo systemctl enable --now postgresql
```

### 4.4 Comprobar que escucha solo en local

Para una prueba dentro de la VM, PostgreSQL puede escuchar en `localhost`. No
lo abras a Internet.

```bash
sudo ss -ltnp | grep 5432
```

No necesitas cambiar `postgresql.conf` para esta guía.

---

## 5. Crear la base y el usuario de base

### 5.1 Entrar a psql como administrador de PostgreSQL

```bash
sudo -u postgres psql
```

### 5.2 Crear el rol

Dentro de `psql`:

```sql
CREATE ROLE clasesespejo
  LOGIN
  PASSWORD 'UNA_CONTRASENA_LARGA_Y_SIN_CARACTERES_RAROS';
```

Usa una contraseña alfanumérica larga. Si usas `@`, `#`, `:`, `/` o `%`, tendrás
que codificarla dentro de `DATABASE_URL`; para la primera prueba evítalos.

### 5.3 Crear la base

```sql
CREATE DATABASE "ClasesconjuntasBD"
  OWNER clasesespejo
  ENCODING 'UTF8'
  TEMPLATE template0;
```

### 5.4 Salir y probar la conexión

```sql
\q
```

Prueba con la contraseña:

```bash
PGPASSWORD='UNA_CONTRASENA_LARGA_Y_SIN_CARACTERES_RAROS' \
psql -h 127.0.0.1 -U clasesespejo -d ClasesconjuntasBD -c 'SELECT 1;'
```

Debe devolver una fila con `1`.

Si falla con `password authentication failed`, revisa:

1. que el rol se creó como `LOGIN`;
2. que la contraseña no se escribió mal;
3. que estás usando `127.0.0.1`, no un socket local;
4. que el servicio PostgreSQL está activo.

---

## 6. Crear el usuario del servicio y las carpetas

La aplicación no debe correr como `root`.

### 6.1 Crear el usuario sin login

```bash
sudo adduser \
  --system \
  --group \
  --home /opt/clasesespejo \
  --shell /usr/sbin/nologin \
  clasesespejo
```

Si Ubuntu dice que el usuario ya existe, continúa; solo asegúrate de que
`/opt/clasesespejo` sea su directorio de trabajo.

### 6.2 Crear las carpetas de datos

```bash
sudo mkdir -p /opt/clasesespejo
sudo mkdir -p /var/lib/clasesespejo/uploads
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo chown -R clasesespejo:clasesespejo /var/lib/clasesespejo
sudo chmod 750 /opt/clasesespejo
sudo chmod 750 /var/lib/clasesespejo
sudo chmod 750 /var/lib/clasesespejo/uploads
```

La carpeta `uploads` guarda evidencias y PDFs de certificados. Es datos
persistentes: no debe quedar dentro de una carpeta temporal del ZIP.

---

## 7. Copiar y verificar el paquete

### 7.1 Copiar desde tu computadora

En Windows PowerShell, desde la carpeta del proyecto:

```powershell
scp .\release\ClasesEspejo-entrega-2026-10-27.zip `
  USUARIO_UBUNTU@IP_VM:/tmp/
```

También puedes copiarlo con una carpeta compartida del hypervisor, WinSCP o
`rsync`. Lo importante es que llegue a `/tmp/`.

### 7.2 Verificar el SHA-256

El archivo `.sha256` que acompaña al ZIP trae el hash esperado. En la VM:

```bash
cd /tmp
sha256sum ClasesEspejo-entrega-2026-10-27.zip
cat ClasesEspejo-entrega-2026-10-27.zip.sha256
```

Los dos valores deben coincidir. Si no coinciden, no descomprimas el archivo:
vuelve a copiarlo.

> El hash final de esta entrega está en
> `release/ClasesEspejo-entrega-2026-10-27.zip.sha256`. No lo escribas de
> memoria ni lo tomes de un mensaje antiguo: usa el archivo que acompaña al ZIP.

### 7.3 Descomprimir

```bash
sudo unzip /tmp/ClasesEspejo-entrega-2026-10-27.zip -d /opt/clasesespejo
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
```

Comprueba la estructura:

```bash
ls -la /opt/clasesespejo
ls -la /opt/clasesespejo/backend | head
```

Debe haber, como mínimo:

```text
backend/
  dist/
  prisma/
  public/
  package.json
  package-lock.json
frontend/
docs/
docker-compose.yml
Dockerfile
```

El paquete **no** incluye:

- `node_modules`;
- `.env`;
- `uploads`;
- base de datos;
- certificados ni evidencias reales;
- `docs/tesis` ni el ZIP de diagramas.

### 7.4 Enlazar uploads a la carpeta persistente

```bash
sudo -u clasesespejo ln -sfn \
  /var/lib/clasesespejo/uploads \
  /opt/clasesespejo/backend/uploads

ls -la /opt/clasesespejo/backend/uploads
```

Debe mostrar una flecha hacia `/var/lib/clasesespejo/uploads`.

---

## 8. Instalar dependencias del backend

Entra como el usuario del servicio para que los archivos queden con el dueño
correcto:

```bash
sudo -u clasesespejo -H bash
cd /opt/clasesespejo/backend
npm ci
```

`npm ci` tarda varios minutos. Instala Prisma, NestJS, PDFKit, bcrypt, etc.

### 8.1 Si falla la compilación de `bcrypt`

Instala las herramientas de compilación:

```bash
exit
sudo apt install -y build-essential python3 make g++
sudo -u clasesespejo -H bash
cd /opt/clasesespejo/backend
npm ci
```

### 8.2 Generar el cliente de Prisma para Linux

```bash
cd /opt/clasesespejo/backend
npx prisma generate
```

Esto genera el cliente y el motor de Prisma para Linux. No copies
`node_modules` desde Windows: aunque el código sea JavaScript, las dependencias
nativas y el motor de Prisma son de la plataforma.

### 8.3 No hace falta compilar el frontend

El paquete ya incluye el frontend compilado en `backend/public`. No ejecutes
`npm ci` en `frontend` ni `ng build` para una instalación normal.

Solo si vas a modificar el frontend:

```bash
cd /opt/clasesespejo/frontend
npm ci
npm run build
```

Ese build debe dejar los archivos en `backend/public`. Si no lo hace, revisa
`frontend/angular.json` antes de seguir.

Cuando termines, sal de la shell del usuario del servicio para volver a tu
usuario normal:

```bash
exit
```

---

## 9. Configurar `.env`

### 9.1 Crear el archivo

Hazlo como el usuario del servicio para que el archivo le pertenezca y el
servicio pueda leerlo:

```bash
sudo -u clasesespejo -H bash
cd /opt/clasesespejo/backend
cp .env.example .env
chmod 600 .env
nano .env
```

Cuando termines de editar, sal de esa shell:

```bash
exit
```

Si por error creaste `.env` con tu usuario normal, corrige el dueño:

```bash
sudo chown clasesespejo:clasesespejo /opt/clasesespejo/backend/.env
sudo chmod 600 /opt/clasesespejo/backend/.env
```

### 9.2 Variables obligatorias

Reemplaza los valores. Ejemplo para una VM en red local, sin Nginx todavía:

```env
DATABASE_URL="postgresql://clasesespejo:UNA_CONTRASENA_LARGA_Y_SIN_CARACTERES_RAROS@127.0.0.1:5432/ClasesconjuntasBD?schema=public"

JWT_SECRET="PEGA_AQUI_UNA_CADENA_ALEATORIA_DE_64_CARACTERES_HEXADECIMALES"
JWT_EXPIRES_IN="1d"
INVITATION_EXPIRES_IN="7d"

FRONTEND_URL="http://IP_VM:3000"
URL_PUBLICA="http://IP_VM:3000"

CERTIFICADO_MODO_DEMO="true"

SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="no-reply@clasesespejo.local"

PRESIDENTE_CORREO="CORREO_CACE"
```

Genera `JWT_SECRET` en la VM:

```bash
openssl rand -hex 32
```

Copia el resultado completo. No uses una frase corta: cambiar este valor
invalida las sesiones y los códigos de verificación de certificados ya emitidos.

### 9.3 Qué significa cada URL

| Variable | Para qué sirve | Ejemplo |
|---|---|---|
| `FRONTEND_URL` | Enlaces de activación y CORS | `http://192.168.1.50` si usas Nginx |
| `URL_PUBLICA` | Base del QR de verificación del certificado | `https://certificados.tudominio.org` |
| `DATABASE_URL` | Conexión de Prisma a PostgreSQL | `postgresql://...` |

Si usas Nginx en el puerto 80, las dos URLs deben ser:

```env
FRONTEND_URL="http://IP_VM"
URL_PUBLICA="http://IP_VM"
```

Si pruebas directamente contra Node, sin Nginx:

```env
FRONTEND_URL="http://IP_VM:3000"
URL_PUBLICA="http://IP_VM:3000"
```

**No dejes `localhost` en `URL_PUBLICA` si vas a escanear el QR desde un
teléfono.** El QR apuntaría al teléfono, no a la VM.

### 9.4 Modo DEMO de certificados

Para esta prueba:

```env
CERTIFICADO_MODO_DEMO="true"
```

Así los PDF llevan la marca DEMO y no se presentan como oficiales. No lo cambies
a `false` sin autorización de la CACE.

### 9.5 Presidencia inicial

`PRESIDENTE_CORREO` se usa solo si la base todavía no tiene una presidencia. Al
arrancar, el sistema crea la cuenta, le asigna el cargo y le envía una
contraseña provisional por correo.

Por eso conviene configurar el correo **antes del primer arranque**. Si no
tienes SMTP todavía, puedes usar la base DEMO de la sección 23 o configurar un
SMTP de prueba; no inventes una contraseña ni edites la base a mano.

---

## 10. Aplicar migraciones

Con el `.env` ya configurado:

```bash
cd /opt/clasesespejo/backend
sudo -u clasesespejo -H npx prisma migrate deploy
```

Debe aplicar **35 migraciones** en una base nueva y terminar con:

```text
All migrations have been successfully applied.
```

Verifica:

```bash
sudo -u clasesespejo -H npx prisma migrate status
```

Debe decir:

```text
Database schema is up to date!
```

### 10.1 Regla importante

- En un servidor se usa `prisma migrate deploy`.
- **No uses `prisma migrate dev`** en la VM: puede pedir confirmaciones, crear
  migraciones nuevas o modificar el esquema sin querer.
- No edites tablas a mano para “arreglar” una migración. Si algo falla, guarda el
  mensaje y revisa la sección 20.

### 10.2 Comprobar que la base tiene datos

```bash
PGPASSWORD='UNA_CONTRASENA_LARGA_Y_SIN_CARACTERES_RAROS' \
psql -h 127.0.0.1 -U clasesespejo -d ClasesconjuntasBD \
  -c 'SELECT count(*) AS usuarios FROM "USUARIO";'
```

En una base nueva, la cuenta de presidencia puede aparecer **después** del
primer arranque, no antes.

---

## 11. Primer arranque manual

Antes de crear el servicio, comprueba que el backend arranca y que ve la base.

```bash
cd /opt/clasesespejo/backend
sudo -u clasesespejo -H node dist/src/main.js
```

La consola debe mostrar que Nest arrancó y que escucha en el puerto 3000.

En otra terminal de la VM:

```bash
curl http://127.0.0.1:3000/health
```

Respuesta esperada:

```json
{"status":"ok","service":"clases-espejo-backend"}
```

Si funciona, detén el proceso con `Ctrl+C`. Ya puedes pasarlo a systemd.

Si no funciona:

```bash
sudo -u clasesespejo -H node dist/src/main.js
```

Lee la primera línea del error; casi siempre es:

- `DATABASE_URL` mal escrita;
- PostgreSQL apagado;
- migraciones sin aplicar;
- puerto 3000 ocupado;
- `.env` sin permisos.

---

## 12. Dejarlo como servicio con systemd

### 12.1 Crear el archivo

```bash
sudo nano /etc/systemd/system/clasesespejo.service
```

Contenido:

```ini
[Unit]
Description=Clases Conjuntas - backend NestJS
Documentation=https://localhost
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=clasesespejo
Group=clasesespejo
WorkingDirectory=/opt/clasesespejo/backend
EnvironmentFile=/opt/clasesespejo/backend/.env
ExecStart=/usr/bin/node dist/src/main.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/lib/clasesespejo
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

### 12.2 Activar y arrancar

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clasesespejo
sudo systemctl status clasesespejo --no-pager
```

Debe aparecer `active (running)`.

### 12.3 Ver logs

```bash
sudo journalctl -u clasesespejo -n 100 --no-pager
sudo journalctl -u clasesespejo -f
```

`-f` sigue los logs en vivo; sal con `Ctrl+C`.

### 12.4 Probar

```bash
curl http://127.0.0.1:3000/health
```

### 12.5 Si el servicio no arranca

```bash
sudo systemctl status clasesespejo --no-pager -l
sudo journalctl -u clasesespejo -n 150 --no-pager
```

No sigas con Nginx hasta que `/health` funcione.

### 12.6 Respaldos y salud programados

El paquete incluye plantillas de systemd:

```bash
sudo cp /opt/clasesespejo/backend/scripts/clasesespejo-respaldo.service \
  /etc/systemd/system/
sudo cp /opt/clasesespejo/backend/scripts/clasesespejo-respaldo.timer \
  /etc/systemd/system/
sudo cp /opt/clasesespejo/backend/scripts/clasesespejo-salud.service \
  /etc/systemd/system/
sudo cp /opt/clasesespejo/backend/scripts/clasesespejo-salud.timer \
  /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now clasesespejo-respaldo.timer
sudo systemctl enable --now clasesespejo-salud.timer
sudo systemctl list-timers --all | grep clasesespejo
```

El respaldo se ejecuta a las 02:15 y la salud cada cinco minutos. Comprueba que
el usuario `clasesespejo` puede escribir en `/var/backups/clasesespejo` y que
`APP_URL` apunta a la URL correcta.

---

## 13. Poner Nginx delante

Nginx permite usar una URL limpia, HTTPS y límites de subida. Es opcional para
una prueba directa, pero es lo más cercano al servidor real.

### 13.1 Crear el sitio

```bash
sudo nano /etc/nginx/sites-available/clasesespejo
```

Contenido para HTTP:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;

    client_max_body_size 25m;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;

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

### 13.2 Activar el sitio

```bash
sudo ln -sfn /etc/nginx/sites-available/clasesespejo \
  /etc/nginx/sites-enabled/clasesespejo

sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 13.3 Ajustar `.env`

Ahora la URL pública es el puerto 80, no el 3000:

```env
FRONTEND_URL="http://IP_VM"
URL_PUBLICA="http://IP_VM"
```

Reinicia el backend:

```bash
sudo systemctl restart clasesespejo
```

### 13.4 Probar desde tu computadora

```text
http://IP_VM
```

Si no carga:

```bash
curl -I http://IP_VM
curl http://127.0.0.1:3000/health
sudo tail -n 100 /var/log/nginx/error.log
```

### 13.5 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

No abras el puerto 3000 al exterior. El backend queda escuchando en
`127.0.0.1:3000` o en la interfaz local; Nginx es la puerta.

Si pruebas sin Nginx y solo desde tu red local, limita el puerto 3000 a tu red,
por ejemplo:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
```

No uses `sudo ufw allow 3000` en un servidor con IP pública.

---

## 14. HTTPS con dominio, si ya tienes uno

Esta sección es opcional. Si solo estás probando en una red local, quédate con
HTTP y no expongas la VM a Internet.

### 14.1 Requisitos

- un dominio real, por ejemplo `clases.tudominio.org`;
- un registro DNS tipo `A` que apunte a la IP pública de la VM;
- puertos 80 y 443 accesibles desde Internet;
- Nginx funcionando.

Comprueba el DNS desde la VM:

```bash
dig +short clases.tudominio.org
```

Debe devolver la IP pública correcta.

### 14.2 Instalar Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 14.3 Emitir el certificado

```bash
sudo certbot --nginx -d clases.tudominio.org
```

Certbot modifica la configuración de Nginx y renueva el certificado
automáticamente. Comprueba:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 14.4 Actualizar las URLs

```env
FRONTEND_URL="https://clases.tudominio.org"
URL_PUBLICA="https://clases.tudominio.org"
```

```bash
sudo systemctl restart clasesespejo
```

Abre:

```text
https://clases.tudominio.org
```

### 14.5 Certificados ya emitidos

El QR de un certificado guarda la URL con la que se emitió. Si cambias
`URL_PUBLICA` de HTTP a HTTPS o de IP a dominio, los PDF antiguos seguirán
apuntando a la URL anterior. Para una prueba DEMO no pasa nada; para una entrega
formal, define la URL definitiva antes de emitir.

### 14.6 Si no tienes dominio

No uses un certificado autofirmado para una demostración con personas que no
sean técnicas: el navegador mostrará una advertencia. Para la prueba local,
HTTP en una red de confianza es suficiente.

---

## 15. Primer acceso y alta inicial

### 15.1 Abrir la aplicación

Si usas Nginx:

```text
http://IP_VM
```

Si pruebas directo:

```text
http://IP_VM:3000
```

### 15.2 Primera cuenta de presidencia

Si la base estaba vacía y configuraste `PRESIDENTE_CORREO` y SMTP:

1. el backend crea la cuenta al arrancar;
2. envía una contraseña provisional al correo configurado;
3. al entrar, la aplicación obliga a cambiarla;
4. después aparece el aviso de privacidad;
5. hasta aceptarlo, la cuenta queda detenida en `/aceptar-aviso`.

Si la cuenta no llega:

```bash
sudo journalctl -u clasesespejo -n 200 --no-pager
```

Pero no busques contraseñas en los logs en un servidor real. Lo correcto es
configurar SMTP y verificar el buzón.

### 15.3 Aviso de privacidad

La primera vez que una cuenta anterior o nueva entra, debe aceptar el aviso
vigente. Es un requisito del flujo, no un error.

### 15.4 Crear una institución y un agente

El recorrido de prueba recomendado es:

1. presidencia crea un enlace de agente;
2. el agente abre el enlace y completa su institución;
3. presidencia aprueba la institución;
4. el agente invita a un docente;
5. el docente activa su cuenta;
6. crear materia y asignación;
7. crear solicitud y clase espejo;
8. gestionar sesiones, evidencias, reporte y cierre.

No cargues datos de alumnos reales.

---

## 16. Correo saliente

### 16.1 Por qué importa

Sin SMTP:

- no llega la contraseña provisional de presidencia;
- no se verifica el correo de una cuenta nueva;
- no se puede recuperar contraseña;
- no se envían invitaciones por correo;
- no se envían certificados por correo.

Las invitaciones de agente y docente tienen **enlace copiable**, así que una
parte del flujo puede probarse sin correo. Pero el alta completa y la
recuperación de contraseña necesitan SMTP.

### 16.2 Configuración típica

```env
SMTP_HOST="smtp.tuproveedor.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="usuario-smtp"
SMTP_PASS="clave-o-token-smtp"
MAIL_FROM="no-reply@tudominio.org"
```

- Puerto 587: normalmente `SMTP_SECURE="false"` y STARTTLS.
- Puerto 465: normalmente `SMTP_SECURE="true"`.
- No uses la contraseña personal del correo; usa una contraseña de aplicación o
  un usuario SMTP dedicado.

Después:

```bash
sudo systemctl restart clasesespejo
sudo journalctl -u clasesespejo -n 50 --no-pager
```

### 16.3 Prueba de correo

Crea una cuenta de prueba, invita a un docente o solicita recuperación. Revisa:

- bandeja de entrada;
- spam;
- registro del proveedor SMTP;
- logs del backend.

### 16.4 Si no tienes SMTP todavía

Puedes usar la base DEMO de la sección 23 para probar la interfaz, o instalar un
servidor SMTP de pruebas. No uses la base DEMO con datos reales.

---

## 17. Verificación completa

Haz estas pruebas en orden. Si una falla, no pases a la siguiente.

### 17.1 Servicio y salud

```bash
sudo systemctl status clasesespejo --no-pager
curl -fsS http://127.0.0.1:3000/health
```

### 17.2 Nginx

```bash
sudo nginx -t
curl -I http://IP_VM
```

### 17.3 Base de datos

```bash
cd /opt/clasesespejo/backend
sudo -u clasesespejo -H npx prisma migrate status
```

Debe decir `Database schema is up to date!`.

### 17.4 Login

- abre la URL;
- entra con la cuenta de presidencia;
- acepta el aviso si aparece;
- comprueba que el panel carga.

### 17.5 Panel de desempeño

- entra como presidencia;
- revisa que aparezcan instituciones, clases y actividad;
- entra como agente de una institución;
- revisa que solo aparezcan sus docentes.

### 17.6 Certificado

- crea o usa una plantilla;
- emite un certificado DEMO;
- descarga el PDF;
- revisa que el PDF tenga la marca DEMO;
- abre el QR desde un teléfono;
- verifica que el código de verificación sea válido.

Si el PDF falla por fuentes:

```bash
fc-list | grep -i dejavu
sudo apt install -y fonts-dejavu-core
sudo systemctl restart clasesespejo
```

### 17.7 Archivos subidos

Sube una evidencia pequeña y comprueba:

```bash
ls -la /var/lib/clasesespejo/uploads
```

Debe aparecer el archivo y pertenecer al usuario `clasesespejo`.

### 17.8 Reinicio del servicio

```bash
sudo systemctl restart clasesespejo
sleep 3
curl -fsS http://127.0.0.1:3000/health
```

### 17.9 Reinicio de la VM

```bash
sudo reboot
```

Vuelve a entrar y repite:

```bash
sudo systemctl status clasesespejo --no-pager
curl -fsS http://127.0.0.1:3000/health
```

### 17.10 Logs

```bash
sudo journalctl -u clasesespejo --since today --no-pager | tail -n 100
sudo tail -n 100 /var/log/nginx/error.log
```

No debe haber errores repetidos de base, correo o permisos.

### 17.11 Espacio en disco

```bash
df -h
du -sh /var/lib/clasesespejo/uploads
```

---

## 18. Respaldos

### 18.1 Respaldo de la base

Crea una carpeta fuera de `/opt`:

```bash
sudo mkdir -p /var/backups/clasesespejo
sudo chown postgres:postgres /var/backups/clasesespejo
```

Respaldo comprimido:

```bash
sudo -u postgres pg_dump \
  -Fc \
  -d ClasesconjuntasBD \
  -f /var/backups/clasesespejo/ClasesconjuntasBD-$(date +%F-%H%M).dump
```

Comprueba que el archivo existe y no está vacío:

```bash
sudo ls -lh /var/backups/clasesespejo
```

### 18.2 Respaldo de archivos subidos

```bash
sudo tar -czf \
  /var/backups/clasesespejo/uploads-$(date +%F-%H%M).tar.gz \
  -C /var/lib/clasesespejo uploads
```

### 18.3 Copia fuera de la VM

No dejes el único respaldo dentro de la máquina virtual. Cópialo a tu
computadora:

```powershell
scp USUARIO_UBUNTU@IP_VM:/var/backups/clasesespejo/*.dump .
scp USUARIO_UBUNTU@IP_VM:/var/backups/clasesespejo/*.tar.gz .
```

### 18.4 Probar la restauración

Nunca consideres un respaldo válido hasta haberlo restaurado al menos una vez.

```bash
sudo -u postgres createdb -O clasesespejo ClasesconjuntasBD_prueba
sudo -u postgres pg_restore \
  --no-owner --no-privileges \
  -d ClasesconjuntasBD_prueba \
  /var/backups/clasesespejo/EL_ARCHIVO.dump
```

Verifica:

```bash
sudo -u postgres psql -d ClasesconjuntasBD_prueba -c \
  'SELECT count(*) FROM "USUARIO";'
```

Luego elimina la base temporal:

```bash
sudo -u postgres dropdb ClasesconjuntasBD_prueba
```

### 18.5 Respaldo automático

Puedes crear un script y un `cron`, pero para el piloto basta con respaldar antes
y después de cada sesión. No automatices algo que no hayas probado.

Ejemplo de script `/usr/local/sbin/respaldo-clasesconjuntas.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

FECHA="$(date +%F-%H%M)"
DESTINO="/var/backups/clasesespejo"
mkdir -p "$DESTINO"

sudo -u postgres pg_dump -Fc -d ClasesconjuntasBD \
  -f "$DESTINO/ClasesconjuntasBD-$FECHA.dump"

tar -czf "$DESTINO/uploads-$FECHA.tar.gz" \
  -C /var/lib/clasesespejo uploads
```

```bash
sudo chmod 750 /usr/local/sbin/respaldo-clasesconjuntas.sh
```

No lo pongas en `cron` sin probarlo manualmente.

---

## 19. Actualizar y volver atrás

### 19.1 Antes de actualizar

1. detén el servicio;
2. respalda la base;
3. respalda `uploads`;
4. anota el SHA del paquete actual;
5. conserva el paquete anterior.

```bash
sudo systemctl stop clasesespejo
sudo -u postgres pg_dump -Fc -d ClasesconjuntasBD \
  -f /var/backups/clasesespejo/antes-de-actualizar.dump
```

### 19.2 Instalar una versión nueva

Extrae el paquete nuevo **en otra carpeta**:

```bash
sudo mkdir -p /opt/clasesespejo-nuevo
sudo unzip /tmp/ClasesEspejo-entrega-NUEVA.zip -d /opt/clasesespejo-nuevo
```

No sobrescribas `/opt/clasesespejo` sin respaldo. Compara y después cambia la
ruta del servicio o mueve las carpetas de forma controlada.

Con la versión nueva:

```bash
cd /opt/clasesespejo-nuevo/backend
sudo -u clasesespejo -H npm ci
sudo -u clasesespejo -H npx prisma generate
sudo -u clasesespejo -H npx prisma migrate deploy
```

Copia `.env` y enlaza `uploads`:

```bash
sudo cp /opt/clasesespejo/backend/.env /opt/clasesespejo-nuevo/backend/.env
sudo chown clasesespejo:clasesespejo /opt/clasesespejo-nuevo/backend/.env
sudo chmod 600 /opt/clasesespejo-nuevo/backend/.env
sudo -u clasesespejo ln -sfn /var/lib/clasesespejo/uploads \
  /opt/clasesespejo-nuevo/backend/uploads
```

Ajusta `WorkingDirectory` en systemd a la carpeta nueva y reinicia.

### 19.3 Volver atrás

Si la versión nueva falla:

1. detén el servicio;
2. vuelve a apuntar `WorkingDirectory` a `/opt/clasesespejo`;
3. restaura la base desde el respaldo **anterior** a la migración;
4. restaura `uploads` si hace falta;
5. reinicia.

No intentes “deshacer” una migración de Prisma a mano. La vuelta atrás de base
es una restauración completa del respaldo, no un borrado de columnas.

### 19.4 Etiquetas locales del proyecto

En el repositorio de desarrollo:

```bash
git tag --list
git switch --detach demo-local-2026-10-27
```

La etiqueta no incluye la base. Para volver al código anterior se cambia de
commit; para volver a los datos se restaura el respaldo.

---

## 20. Problemas frecuentes

### “No such file or directory: dist/src/main.js”

Estás en la carpeta equivocada o el ZIP no se descomprimió completo.

```bash
cd /opt/clasesespejo/backend
ls dist/src/main.js
```

### “Cannot find module …”

Faltan dependencias:

```bash
cd /opt/clasesespejo/backend
sudo -u clasesespejo -H npm ci
```

No copies `node_modules` desde Windows.

### “Prisma Client could not locate the Query Engine”

Genera el cliente en Linux:

```bash
sudo -u clasesespejo -H npx prisma generate
sudo systemctl restart clasesespejo
```

### “P1001: Can't reach database server”

Revisa:

```bash
sudo systemctl status postgresql --no-pager
PGPASSWORD='...' psql -h 127.0.0.1 -U clasesespejo -d ClasesconjuntasBD -c 'SELECT 1;'
```

Y revisa `DATABASE_URL`:

- usuario correcto;
- contraseña correcta;
- base `ClasesconjuntasBD`;
- host `127.0.0.1`;
- puerto `5432`.

### “database schema is not in sync”

En un servidor:

```bash
sudo -u clasesespejo -H npx prisma migrate deploy
```

No uses `migrate dev`.

### “EACCES: permission denied, mkdir uploads”

```bash
sudo chown -R clasesespejo:clasesespejo /var/lib/clasesespejo
sudo chmod 750 /var/lib/clasesespejo/uploads
sudo systemctl restart clasesespejo
```

Comprueba el enlace:

```bash
ls -la /opt/clasesespejo/backend/uploads
```

### “502 Bad Gateway” en Nginx

El backend no está escuchando:

```bash
curl http://127.0.0.1:3000/health
sudo systemctl status clasesespejo --no-pager
sudo journalctl -u clasesespejo -n 100 --no-pager
```

### El QR lleva a `localhost`

`URL_PUBLICA` está mal:

```bash
grep URL_PUBLICA /opt/clasesespejo/backend/.env
sudo systemctl restart clasesespejo
```

Los certificados ya emitidos conservan la URL anterior.

### El PDF no muestra acentos o falla por fuente

```bash
sudo apt install -y fonts-dejavu-core fonts-liberation
fc-cache -fv
sudo systemctl restart clasesespejo
```

### No llega el correo

Revisa:

```bash
sudo journalctl -u clasesespejo -n 150 --no-pager
```

y confirma que `SMTP_HOST`, puerto, usuario y contraseña son correctos. Revisa
spam y el panel del proveedor.

### El servicio reinicia en bucle

```bash
sudo journalctl -u clasesespejo -n 200 --no-pager -l
```

Casi siempre es `.env`, base de datos o puerto ocupado.

### “port 3000 already in use”

```bash
sudo ss -ltnp | grep 3000
```

Detén el proceso que esté usando el puerto o cambia `PORT` en `.env` y el
`proxy_pass` de Nginx.

### La VM no se ve desde el host

- comprueba que el adaptador sea puente;
- comprueba la IP con `ip a`;
- desde la VM, `ping` al host;
- desde el host, `ping IP_VM`;
- revisa el firewall de la VM y el del host;
- si usas NAT, configura el reenvío de puertos.

### La aplicación abre, pero no carga datos

Abre las herramientas del navegador y revisa la petición que falla. Luego:

```bash
curl -i http://127.0.0.1:3000/health
sudo journalctl -u clasesespejo -n 100 --no-pager
```

---

## 21. Seguridad mínima

Para una prueba local:

- [ ] La VM no está expuesta directamente a Internet.
- [ ] El puerto 3000 no está abierto en el router.
- [ ] `.env` tiene permisos `600`.
- [ ] `JWT_SECRET` es aleatorio y largo.
- [ ] La contraseña de PostgreSQL no es la de demostración.
- [ ] `CERTIFICADO_MODO_DEMO="true"`.
- [ ] No hay datos reales de alumnos.
- [ ] Hay un respaldo antes de cada prueba.
- [ ] El acceso SSH usa clave, no solo contraseña.
- [ ] `ufw` está activo y solo permite lo necesario.

Para un servidor real, además:

- [ ] HTTPS obligatorio.
- [ ] Correo con SPF/DKIM.
- [ ] Respaldo fuera del servidor.
- [ ] Actualizaciones de seguridad automáticas.
- [ ] Revisión del aviso de privacidad.
- [ ] Cuentas reales y plantilla autorizada.
- [ ] Monitoreo de disco y logs.
- [ ] Copia de `uploads`, no solo de la base.

---

## 22. Lista final de aceptación

Marca cada punto solo cuando lo hayas comprobado:

- [ ] Ubuntu actualizado.
- [ ] Node 24 instalado.
- [ ] PostgreSQL 17 activo.
- [ ] Base `ClasesconjuntasBD` creada.
- [ ] Usuario `clasesespejo` creado.
- [ ] Paquete copiado y SHA verificado.
- [ ] `npm ci` terminado.
- [ ] `prisma generate` terminado.
- [ ] `prisma migrate deploy` aplicado.
- [ ] `.env` configurado y con permisos 600.
- [ ] `/health` responde.
- [ ] systemd deja el servicio activo.
- [ ] Nginx responde.
- [ ] Login de presidencia funciona.
- [ ] Aviso de privacidad funciona.
- [ ] Panel de desempeño carga.
- [ ] Certificado DEMO se genera.
- [ ] QR apunta a la IP correcta.
- [ ] Evidencia subida correctamente.
- [ ] Reinicio del servicio funciona.
- [ ] Reinicio de la VM funciona.
- [ ] Respaldo creado.
- [ ] Restauración probada.
- [ ] Logs sin errores repetidos.

---

## 23. Anexo: restauración de la base DEMO

Esta sección es **solo para una VM aislada de prueba**. La base DEMO contiene
datos ficticios y cuentas conocidas; no la uses para el piloto real.

### 23.1 Copiar el respaldo

Desde tu computadora:

```powershell
scp .\release\l6\ClasesconjuntasBD-2026-10-27.dump `
  USUARIO_UBUNTU@IP_VM:/tmp/
```

### 23.2 Crear una base vacía

```bash
sudo -u postgres createdb -O clasesespejo ClasesconjuntasBD_demo
```

Si la base `ClasesconjuntasBD` ya existe y quieres conservarla, no la borres:
usa otro nombre y cambia `DATABASE_URL` para la prueba.

### 23.3 Restaurar

```bash
sudo -u postgres pg_restore \
  --no-owner \
  --no-privileges \
  -d ClasesconjuntasBD_demo \
  /tmp/ClasesconjuntasBD-2026-10-27.dump
```

### 23.4 Apuntar `.env` a la base DEMO

```env
DATABASE_URL="postgresql://clasesespejo:CONTRASENA@127.0.0.1:5432/ClasesconjuntasBD_demo?schema=public"
```

```bash
sudo systemctl restart clasesespejo
```

### 23.5 Comprobar migraciones

```bash
cd /opt/clasesespejo/backend
sudo -u clasesespejo -H npx prisma migrate status
```

El respaldo de L6 ya tiene las 35 migraciones registradas.

### 23.6 Archivos faltantes

La base DEMO no incluye las imágenes o PDFs que estaban en `uploads`. Las rutas
de evidencias y certificados existirán en la base, pero los archivos pueden no
existir. Para una prueba visual del panel no importa; para probar descargas de
certificados, emite uno nuevo o copia también la carpeta `uploads` de tu
entorno local.

### 23.7 Volver a una base limpia

```env
DATABASE_URL="postgresql://clasesespejo:CONTRASENA@127.0.0.1:5432/ClasesconjuntasBD?schema=public"
```

```bash
sudo systemctl restart clasesespejo
```

---

## Apéndice A: comandos mínimos en orden

Para quien ya sabe lo que hace, este es el resumen. No sustituye las
explicaciones anteriores.

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y curl ca-certificates unzip build-essential python3 nano \
  ufw nginx fontconfig fonts-dejavu-core fonts-liberation

curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource.sh
sudo bash /tmp/nodesource.sh
sudo apt install -y nodejs

sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
. /etc/os-release
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt install -y postgresql-17 postgresql-client-17

sudo -u postgres psql
# CREATE ROLE clasesespejo LOGIN PASSWORD '...';
# CREATE DATABASE "ClasesconjuntasBD" OWNER clasesespejo ENCODING 'UTF8' TEMPLATE template0;
# \q

sudo adduser --system --group --home /opt/clasesespejo \
  --shell /usr/sbin/nologin clasesespejo
sudo mkdir -p /var/lib/clasesespejo/uploads
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo /var/lib/clasesespejo

sudo unzip /tmp/ClasesEspejo-entrega-2026-10-27.zip -d /opt/clasesespejo
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo -u clasesespejo ln -sfn /var/lib/clasesespejo/uploads \
  /opt/clasesespejo/backend/uploads

cd /opt/clasesespejo/backend
sudo -u clasesespejo -H npm ci
sudo -u clasesespejo -H npx prisma generate
sudo -u clasesespejo -H cp .env.example .env
sudo chown clasesespejo:clasesespejo .env
sudo chmod 600 .env
# editar .env
sudo -u clasesespejo -H npx prisma migrate deploy

# systemd y nginx: usar los archivos de las secciones 12 y 13
```

---

## Apéndice B: variables de `.env`

```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=1d
INVITATION_EXPIRES_IN=7d
FRONTEND_URL=
URL_PUBLICA=
CERTIFICADO_MODO_DEMO=true
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
PRESIDENTE_CORREO=
```

No subas `.env` a Git, no lo pegues en un chat y no lo incluyas en el ZIP.
