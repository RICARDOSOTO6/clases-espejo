# 🍳 Receta para montar Clases Conjuntas

> **Versión casera y sin protocolo de la guía de despliegue.**
> La formal está en `docs/guia-de-despliegue.md`. Esta es la misma cosa, pero
> explicada como si estuviéramos cocinando y con los datos de *tu* máquina.
>
> 👉 **¿Primera vez y te da miedo?** Ensáyalo antes en una máquina virtual, donde
> puedes romperlo todo y deshacerlo con un botón:
> `docs/practica-en-maquina-virtual.md`.

```
⏱️  Tiempo:        45 min la primera vez, 10 min las siguientes
🍽️  Raciones:      1 servidor (aguanta un salón completo de usuarios)
🔥  Dificultad:    media-baja
🧼  Se ensucia:    1 carpeta y 1 base de datos
🥡  Se conserva:   con respaldos, para siempre
```

---

## 🗺️ Mapa rápido

1. [Qué vamos a cocinar](#1-qué-vamos-a-cocinar)
2. [La lista del mandado](#2-la-lista-del-mandado)
3. [Mise en place](#3-mise-en-place)
4. [Elige tu hornilla](#4-elige-tu-hornilla)
5. [Receta A: en tu laptop, para enseñarlo](#5-receta-a-en-tu-laptop-para-enseñarlo)
6. [Receta B: en un servidor Windows](#6-receta-b-en-un-servidor-windows)
7. [Receta C: en un servidor Linux](#7-receta-c-en-un-servidor-linux)
8. [La masa: base de datos](#8-la-masa-base-de-datos)
9. [El sazón: archivo .env](#9-el-sazón-archivo-env)
10. [Al horno: compilar](#10-al-horno-compilar)
11. [Emplatar: arrancar y probar](#11-emplatar-arrancar-y-probar)
12. [Dejarlo a fuego lento: que corra solo](#12-dejarlo-a-fuego-lento-que-corra-solo)
13. [El betún: dominio y HTTPS](#13-el-betún-dominio-y-https)
14. [Recalentado: subir una versión nueva](#14-recalentado-subir-una-versión-nueva)
15. [Al refri: respaldos](#15-al-refri-respaldos)
16. [Si se te quema](#16-si-se-te-quema)
17. [Notas del chef](#17-notas-del-chef)
18. [Emplatado final](#18-emplatado-final)

---

## 1. Qué vamos a cocinar

Un solo platillo, servido en un solo plato: **una aplicación Node que hace de
todo**. Cuando alguien entra a la dirección del proyecto, ese único proceso le
entrega el frontend (la pantalla), la API (los datos) y las evidencias que suben
los docentes.

```
Navegador  ──►  puerto 80/443 (Nginx, IIS o Caddy: opcional, es el mesero)
                      │
                      ▼
                puerto 3000  ◄── AQUÍ está TODO (Node/NestJS)
                      │             /          → la pantalla
                      │             /auth…     → la API
                      │             /uploads   → los archivos subidos
                      ▼
                PostgreSQL 5432 (la despensa)
```

**Lo que NO necesitas:** no hay servidor de frontend aparte, no hay SSR, no hay
Redis ni colas, no hace falta Docker. Node + PostgreSQL y ya.

**Las 3 cosas que hay que entender** (esto es el 90 % de los problemas):

| # | Regla | Por qué |
| --- | --- | --- |
| 1 | El proceso Node **siempre** se arranca desde la carpeta `backend/` | De ahí saca `.env`, `public/` y `uploads/` |
| 2 | La pantalla y la API tienen que verse **en el mismo dominio** | El frontend pide los datos a rutas relativas (`/auth/login`) |
| 3 | El frontend **no se sirve solo**: hay que compilarlo dentro de `backend/public` | NestJS lo lee de ahí al arrancar |

---

## 2. La lista del mandado

Marca lo que ya tengas:

### Software

- [ ] **Node.js** — en tu compu ya tienes **v24.21.0** (y todo compiló bien).
      En un servidor, pon **22 LTS** (es la versión con la que se probó el
      proyecto) o 24. **Nunca 18.**
- [ ] **PostgreSQL** — en tu compu ya tienes la **17**, corriendo como servicio
      de Windows llamado `postgresql-x64-17`.
- [ ] **Git**
- [ ] Un lugar donde dejarlo: `C:\clasesespejo` (Windows) o `/opt/clasesespejo` (Linux)

### Datos que vas a necesitar a la mano

- [ ] **El `.env` actual de tu proyecto** — es tu receta secreta. Cópialo tal cual
      y sólo cambia lo que la receta te diga.
- [ ] **La contraseña de tu usuario de PostgreSQL** (en tu compu ya está dentro
      del `DATABASE_URL` del `.env`).
- [ ] **El correo Gmail del sistema** — ya lo tienes configurado:
      `clasesconjuntas.sistema@gmail.com`, con contraseña de aplicación de Gmail.
      **Sin esto no puedes invitar docentes** (el sistema les manda un correo con
      el enlace de activación; si el correo falla, la invitación se cancela sola).
- [ ] **Una URL pública** para `FRONTEND_URL` (solo si vas a servidor con dominio).
- [ ] **Opcional:** un dominio y su DNS apuntando a la IP del servidor.

---

## 3. Mise en place

Antes de encender nada, deja los cacharros en su lugar.

### En Windows

```powershell
# 1. ¿Está la despensa abierta? (PostgreSQL corriendo)
Get-Service *postgres*

# 2. Ojo: psql y pg_dump NO están en el PATH de tu máquina.
#    Usa la ruta completa:
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version

# 3. Deja el código en su lugar
mkdir C:\clasesespejo
cd C:\clasesespejo
git clone <URL_DEL_REPOSITORIO> .
```

### En Linux (Ubuntu/Debian)

```bash
sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git postgresql

sudo mkdir -p /opt/clasesespejo
sudo chown -R $USER:$USER /opt/clasesespejo
git clone <URL_DEL_REPOSITORIO> /opt/clasesespejo
cd /opt/clasesespejo
```

### Truco de cocina: ¿quién está ocupando la cocina?

Esto te va a servir mil veces, sobre todo porque **en tu compu hay un backend
viejo corriendo en el puerto 3000** que a veces se queda ahí estorbando:

```powershell
# Windows: ver quién tiene el puerto 3000
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess

# Windows: matarlo (cambia 1234 por el número que salió)
Stop-Process -Id 1234 -Force
```

```bash
# Linux
sudo lsof -i :3000
sudo kill 1234
```

> **Regla de oro de la limpieza:** en Windows, **detén el backend antes de
> regenerar Prisma y antes de recompilar**. Si no, el comando truena con un
> error `EPERM` porque el archivo está en uso. Es como querer lavar el plato
> mientras alguien sigue comiendo.

---

## 4. Elige tu hornilla

Solo cocinas **una** de estas. Salta a la que te toque:

| Hornilla | Cuándo usarla | Ve a |
| --- | --- | --- |
| 🍳 **Laptop** | Vas a enseñar el proyecto, es para ti o para la presentación | [Receta A](#5-receta-a-en-tu-laptop-para-enseñarlo) |
| 🪟 **Servidor Windows** | La escuela te dio una máquina con Windows Server | [Receta B](#6-receta-b-en-un-servidor-windows) |
| 🐧 **Servidor Linux** | Contrataste un VPS (DigitalOcean, Hetzner, AWS…) | [Receta C](#7-receta-c-en-un-servidor-linux) |

Los pasos 8 al 18 son **los mismos** para las tres. Las recetas A, B y C solo
cambian *dónde* vives y *cómo* dejas el proceso corriendo.

---

## 5. Receta A: en tu laptop, para enseñarlo

**Para qué sirve:** abrir `http://localhost:3000` y que ahí esté TODO servido
por el backend (sin depender de `ng serve`). Es lo que quieres para la demo.

```powershell
# 1. Apaga lo que esté corriendo en el puerto 3000 (ver "Mise en place")
# 2. Ve al backend
cd C:\Users\ricar\Documents\ClasesEspejo\backend

# 3. Por si acaso, deja la despensa al día
npx prisma generate
npx prisma migrate deploy

# 4. Compila el backend
npm run build

# 5. Compila la pantalla DENTRO del backend (esto es lo importante)
cd ..\frontend
npm ci
npx ng build

# 6. Arranca
cd ..\backend
npm run start:prod
```

Abre `http://localhost:3000` y ya está.

### ⚠️ El detalle del correo en modo laptop

Tu `.env` tiene hoy:

```env
FRONTEND_URL="http://localhost:4200"
```

Eso está bien para desarrollo (cuando tienes `ng serve` en el 4200), pero si
sirves todo desde el backend y mandas una invitación, **el docente recibirá un
enlace al puerto 4200** y no va a abrir.

Para la demo, cámbialo a:

```env
FRONTEND_URL="http://localhost:3000"
```

Si solo vas a mostrar el sistema sin invitar docentes, déjalo como está y ya.

### Para que no se apague al cerrar la terminal

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo\backend
$env:NODE_ENV="production"
Start-Process node -ArgumentList "dist/src/main" -WorkingDirectory "C:\Users\ricar\Documents\ClasesEspejo\backend"
```

O si quieres algo más serio desde el principio, usa **NSSM** y sigue la
[Receta B](#6-receta-b-en-un-servidor-windows) (sirve igual en tu laptop).

---

## 6. Receta B: en un servidor Windows

### B.1 Node y PostgreSQL

1. Instala **Node.js 22 LTS** del `.msi` de <https://nodejs.org>.
2. Instala **PostgreSQL 17** de <https://www.postgresql.org/download/windows/>.
   * Anota la contraseña del usuario `postgres`.
   * Puerto `5432`.
   * Deja el *Stack Builder* sin marcar, no lo necesitas.
3. Instala **Git for Windows**.

Verifica en una terminal nueva:

```powershell
node -v
npm -v
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
```

### B.2 Deja el código

```powershell
mkdir C:\clasesespejo
cd C:\clasesespejo
git clone <URL_DEL_REPOSITORIO> .
```

### B.3 Crea la base y el usuario

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE USER clasesespejo WITH PASSWORD 'UnaClaveLarga2026';"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE clasesconjuntas OWNER clasesespejo;"
```

### B.4 Cocina los pasos 8 al 11 de esta receta

Base de datos → `.env` → compilar → probar. Son iguales para todos.

### B.5 Deja el proceso corriendo solo (NSSM)

NSSM convierte cualquier programa en un servicio de Windows, o sea: arranca solo
cuando prendes la máquina y se reinicia si se cae.

1. Baja NSSM de <https://nssm.cc/download> y descomprímelo en `C:\nssm`.
2. Abre **PowerShell como Administrador**:

```powershell
New-Item -ItemType Directory -Force C:\clasesespejo\logs | Out-Null

C:\nssm\win64\nssm.exe install ClasesConjuntas "C:\Program Files\nodejs\node.exe" "dist\src\main.js"
C:\nssm\win64\nssm.exe set ClasesConjuntas AppDirectory "C:\clasesespejo\backend"
C:\nssm\win64\nssm.exe set ClasesConjuntas DisplayName "Clases Conjuntas"
C:\nssm\win64\nssm.exe set ClasesConjuntas Start SERVICE_AUTO_START
C:\nssm\win64\nssm.exe set ClasesConjuntas AppStdout "C:\clasesespejo\logs\app.log"
C:\nssm\win64\nssm.exe set ClasesConjuntas AppStderr "C:\clasesespejo\logs\error.log"
C:\nssm\win64\nssm.exe start ClasesConjuntas
```

3. Compruébalo:

```powershell
Get-Service ClasesConjuntas
Get-Content C:\clasesespejo\logs\app.log -Tail 30
```

La línea clave es `AppDirectory = C:\clasesespejo\backend`. Si eso queda mal, la
aplicación no encuentra `.env`, ni `public`, ni `uploads`, y te vas a volver loco
buscando el error.

**Alternativa con PM2** (si ya lo usas, es más cómodo para ver logs):

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
cd C:\clasesespejo\backend
pm2 start dist/src/main.js --name clasesconjuntas --cwd C:\clasesespejo\backend
pm2 save
pm2 logs clasesconjuntas
```

### B.6 Abre el puerto

```powershell
New-NetFirewallRule -DisplayName "Clases Conjuntas 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

Con eso ya lo ves desde otra compu en `http://IP:3000`. Si quieres dominio y
HTTPS, el betún está en el paso 13.

---

## 7. Receta C: en un servidor Linux

### C.1 Instala todo

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git postgresql postgresql-contrib
node -v
```

### C.2 Deja el código

```bash
sudo mkdir -p /opt/clasesespejo
sudo chown -R $USER:$USER /opt/clasesespejo
git clone <URL_DEL_REPOSITORIO> /opt/clasesespejo
cd /opt/clasesespejo
```

### C.3 Crea la base y el usuario

```bash
sudo -u postgres psql
```

```sql
CREATE USER clasesespejo WITH PASSWORD 'UnaClaveLarga2026';
CREATE DATABASE clasesconjuntas OWNER clasesespejo;
\q
```

### C.4 Cocina los pasos 8 al 11

### C.5 Usuario para el servicio (no lo corras como root)

```bash
sudo useradd --system --shell /usr/sbin/nologin --home /opt/clasesespejo clasesespejo
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo -u clasesespejo mkdir -p /opt/clasesespejo/backend/uploads
```

### C.6 Deja el proceso corriendo solo (systemd)

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
MemoryMax=1G

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clasesespejo
sudo systemctl status clasesespejo
sudo journalctl -u clasesespejo -f        # logs en vivo (Ctrl+C para salir)
```

Otra vez: `WorkingDirectory=/opt/clasesespejo/backend`. Es LA línea.

### C.7 Cortafuegos

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp     # solo si vas a entrar directo sin proxy
sudo ufw enable
```

---

## 8. La masa: base de datos

**Saltar si ya la creaste** en tu receta (A usa la que ya tienes en tu compu).

### Tu caso (laptop)

Ya la tienes: `ClasesconjuntasBD` con datos y todo. No toques nada. Solo asegúrate
de que el servicio esté arriba:

```powershell
Get-Service postgresql-x64-17
```

### Servidor nuevo

```sql
CREATE USER clasesespejo WITH PASSWORD 'UnaClaveLarga2026';
CREATE DATABASE clasesconjuntas OWNER clasesespejo;
```

Prueba que la puerta abre:

```bash
psql "postgresql://clasesespejo:UnaClaveLarga2026@localhost:5432/clasesconjuntas" -c "SELECT 1;"
```

Para crear las tablas **no escribas SQL a mano**: lo hace Prisma (paso 10).
Son 10 migraciones que crean las 22 tablas del sistema.

> El usuario dueño de la base **no necesita** ser superusuario ni tener permiso
> para crear bases: con ser dueño, `prisma migrate deploy` hace todo.

---

## 9. El sazón: archivo .env

El archivo vive en **`backend/.env`** y nunca se sube al repositorio.

### Lo más fácil: copia el tuyo

```powershell
# Windows: copiar tu .env de la compu al servidor
scp C:\Users\ricar\Documents\ClasesEspejo\backend\.env usuario@servidor:C:\clasesespejo\backend\
```

```bash
# Linux
scp backend/.env usuario@servidor:/opt/clasesespejo/backend/
```

Y luego cambias **solo estas dos cosas**:

```env
DATABASE_URL="postgresql://clasesespejo:UnaClaveLarga2026@localhost:5432/clasesconjuntas?schema=public"
FRONTEND_URL="https://clasesespejo.miescuela.edu"
```

### Los 5 ingredientes y para qué sirve cada uno

| Ingrediente | Qué hace | Si lo pones mal… |
| --- | --- | --- |
| `DATABASE_URL` | Dónde está la despensa | No arranca / no ve datos |
| `JWT_SECRET` | Firma las sesiones | **No arranca** si tiene menos de 16 caracteres |
| `FRONTEND_URL` | El enlace que va dentro del correo de invitación (primera opción) | Si es `localhost`, se usa la dirección real de la petición: con túnel funciona igual |
| `SMTP_*` + `MAIL_FROM` | Manda los correos de invitación | No puedes dar de alta docentes |
| `PORT` | Puerto (por defecto 3000) | Nada, es opcional |

### Genera un `JWT_SECRET` decente si vas a producción

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Cuando cambies el `JWT_SECRET`, **todos los usuarios quedan desconectados** y
> tienen que volver a iniciar sesión. Es normal, no es un error.

### Permisos (Linux)

```bash
chmod 600 /opt/clasesespejo/backend/.env
```

**Ojo:** no le pongas comillas raras ni espacios alrededor del `=`. Y si la
contraseña de la base trae caracteres como `@`, `#` o `%`, van codificados
(`%40`, `%23`, `%25`) porque van dentro de una URL.

---

## 10. Al horno: compilar

Aquí es donde se rompe todo si haces las cosas fuera de orden. El orden es:

```
instalar dependencias  →  generar Prisma  →  aplicar migraciones  →  compilar backend  →  compilar frontend
```

### 10.1 Backend

```powershell
cd C:\clasesespejo\backend       # Windows
# cd /opt/clasesespejo/backend   # Linux

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Qué hace cada uno:

* `npm ci` — instala exactamente las versiones del `package-lock.json`.
  (En tu compu ya está hecho; en el servidor es la primera vez.)
* `npx prisma generate` — arma el cliente de base de datos en
  `backend/generated/prisma`. **En Windows, con el backend corriendo, truena con
  `EPERM`.** Detén el servicio primero.
* `npx prisma migrate deploy` — crea las tablas. Se puede repetir sin miedo.
* `npm run build` — compila a `backend/dist`.

### 10.2 Frontend (la pantalla)

```powershell
cd ..\frontend                   # Windows
# cd ../frontend                 # Linux

npm ci
npx ng build
```

Cuando termine, `backend\public` debe tener:

```
index.html
main-XXXXXXXX.js
styles-XXXXXXXX.css
favicon.ico
logo-cace.png
chunks…
```

> **Si tu servidor tiene poca RAM** (1 GB o menos), el build de Angular se queda
> sin aire (pide ~2 GB). Compílalo en tu compu y sube sólo el resultado:
>
> ```powershell
> scp -r C:\Users\ricar\Documents\ClasesEspejo\backend\public usuario@servidor:/opt/clasesespejo/backend/
> ```
>
> Así ni siquiera necesitas instalar las dependencias del frontend en el servidor.

---

## 11. Emplatar: arrancar y probar

```powershell
cd C:\clasesespejo\backend
npm run start:prod
```

Debe decir:

```
Backend corriendo en http://localhost:3000
```

Y en otra terminal:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"clases-espejo-backend","timestamp":"2026-…"}
```

> Usa `/health`, no `/`. Cuando el frontend está compilado, `GET /` devuelve la
> pantalla (el `index.html`), no el JSON.

Abre `http://IP:3000` (o `http://localhost:3000`) y debe salir la pantalla de
**Iniciar sesión**. Si sale, ¡ya cocinaste! Detén con `Ctrl + C` y pasa a
dejarlo a fuego lento.

---

## 12. Dejarlo a fuego lento: que corra solo

Ya está en las recetas B.5 (NSSM) y C.6 (systemd). Los comandos del día a día:

```powershell
# Windows con NSSM
C:\nssm\win64\nssm.exe start ClasesConjuntas
C:\nssm\win64\nssm.exe restart ClasesConjuntas
C:\nssm\win64\nssm.exe stop ClasesConjuntas
Get-Content C:\clasesespejo\logs\app.log -Tail 50
```

```bash
# Linux con systemd
sudo systemctl start clasesespejo
sudo systemctl restart clasesespejo
sudo systemctl stop clasesespejo
sudo systemctl status clasesespejo
sudo journalctl -u clasesespejo -n 50 --no-pager
```

---

## 13. El betún: dominio y HTTPS

Esto es **opcional**. Si vas a usar `http://IP:3000` en una red interna, sáltalo
y quedó rica igual.

| Si tu servidor es… | Usa | Por qué |
| --- | --- | --- |
| Linux con dominio | **Nginx + Certbot** | Lo clásico, certificado gratis |
| Linux o Windows, y quieres cero drama | **Caddy** | Saca el certificado solo, en 3 líneas |
| Windows con IIS ya instalado | **IIS + ARR** | Si la escuela ya tiene IIS |

### Opción Caddy: la más fácil (sirve en ambos sistemas)

Archivo `Caddyfile`:

```text
clasesespejo.miescuela.edu {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
caddy run --config Caddyfile
```

Listo: Caddy pide el certificado, lo renueva y pasa todo al 3000. Y no limita el
tamaño de las subidas.

### Opción Nginx (Linux)

```nginx
server {
    listen 80;
    server_name clasesespejo.miescuela.edu;

    # ⚠️ ESTA LÍNEA ES OBLIGATORIA: por defecto Nginx corta en 1 MB y las
    # evidencias pueden pesar hasta 10 MB (error 413).
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
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d clasesespejo.miescuela.edu
```

Después de tener HTTPS, **actualiza `FRONTEND_URL`** en el `.env` a
`https://clasesespejo.miescuela.edu` y reinicia el servicio.

### Opción IIS (Windows)

1. Instala IIS (Administrador del servidor → Agregar roles → Servidor web).
2. Instala **URL Rewrite** y **ARR** (Application Request Routing).
3. En IIS → nodo del servidor → *Application Request Routing Cache* → *Server
   Proxy Settings* → marca **Enable proxy**.
4. Crea un sitio apuntando a una carpeta vacía (`C:\clasesespejo\iis`) con este
   `web.config`:

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
        <requestLimits maxAllowedContentLength="12582912" />
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
```

### Regla de oro del cortafuegos

El puerto **3000 no se abre a Internet** si tienes proxy. El proxy va por dentro
de la máquina al 3000, y hacia afuera solo salen el 80 y el 443.

---

## 14. Recalentado: subir una versión nueva

Cuando hagas cambios y quieras que el servidor los tenga:

```powershell
# ---------- WINDOWS ----------
C:\nssm\win64\nssm.exe stop ClasesConjuntas        # 1. apagar (obligatorio)

cd C:\clasesespejo
git pull                                            # 2. traer lo nuevo

cd backend
npm ci                                              # 3. solo si cambió package.json
npx prisma generate                                 # 4. solo si cambió el schema
npx prisma migrate deploy                           # 5. solo si hay migraciones
npm run build                                       # 6. backend

cd ..\frontend
npm ci
npx ng build   # 7. pantalla

C:\nssm\win64\nssm.exe start ClasesConjuntas        # 8. prender
```

```bash
# ---------- LINUX ----------
sudo systemctl stop clasesespejo

cd /opt/clasesespejo
git pull

cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

cd ../frontend
npm ci
npx ng build

cd ..
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo systemctl start clasesespejo
```

**Los 3 errores clásicos del recalentado:**

1. Olvidar el **paso 7** (compilar la pantalla) → sigues viendo la versión
   vieja en el navegador y juras que tu cambio no sirvió.
2. Olvidar **reiniciar** → NestJS lee `public/index.html` **al arrancar**. Si
   compilas el frontend con el servicio prendido, no lo ve.
3. En Windows, no apagar antes de `prisma generate` → `EPERM`.

---

## 15. Al refri: respaldos

Hay **dos** cosas que guardar, y la segunda se olvida siempre:

1. **La base de datos** (todo el contenido).
2. **La carpeta `backend/uploads`** (las evidencias que subieron los docentes).
   Si respaldas solo la base, van a quedar registros apuntando a archivos que ya
   no existen.

```powershell
# Windows: respaldo de la base (recuerda la ruta completa de pg_dump)
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U clasesespejo -F c `
  -f "C:\backups\clasesconjuntas-$(Get-Date -Format yyyy-MM-dd).dump" clasesconjuntas

# Windows: respaldo de las evidencias
Compress-Archive -Path C:\clasesespejo\backend\uploads\* `
  -DestinationPath "C:\backups\uploads-$(Get-Date -Format yyyy-MM-dd).zip" -Force
```

```bash
# Linux
pg_dump "postgresql://clasesespejo:CLAVE@localhost:5432/clasesconjuntas" \
  -F c -f /var/backups/clasesconjuntas-$(date +%F).dump

tar czf /var/backups/uploads-$(date +%F).tar.gz -C /opt/clasesespejo/backend uploads
```

Restaurar la base:

```bash
pg_restore -d clasesconjuntas --clean --if-exists respaldo.dump
```

Programa los dos con `cron` (Linux) o el **Programador de tareas** (Windows).
Un respaldo que nunca probaste restaurar no es un respaldo, es una esperanza.

---

## 16. Si se te quema

| Se quema así… | Está pasando esto | Arréglalo así |
| --- | --- | --- |
| **No arranca** y el log dice `JWT_SECRET` | Falta la variable o tiene menos de 16 caracteres | Genera una con `node -e` y reinicia |
| `prisma generate` truena con **`EPERM`** | El backend está corriendo y bloquea el archivo (Windows) | Detén el servicio, genera, arranca otra vez |
| **Errores raros de Prisma al compilar** | Compilaste antes de generar | En orden: `generate` → `build` |
| **Veo la versión vieja** de la pantalla | Compilaste el frontend pero no reiniciaste | Compila y reinicia el servicio |
| La web carga pero **la API no responde** | El proceso Node está caído o en otro puerto | `Get-Service ClasesConjuntas` / `systemctl status clasesespejo` y mira logs |
| **Error 502** en el proxy | Node no está corriendo | Igual que arriba |
| **Error 413** al subir una evidencia | El proxy corta en 1 MB | Nginx: `client_max_body_size 12M`. IIS: `maxAllowedContentLength` |
| *"Tipo de archivo no permitido"* | Es a propósito | Solo PDF, imágenes, Office, texto y ZIP. `.html`, `.svg` y `.js` están bloqueados |
| *"No se pudo enviar el correo de invitación"* | SMTP mal configurado | Gmail: **contraseña de aplicación** (no la de tu cuenta), puerto 587, `SMTP_SECURE="false"` |
| El enlace del correo dice **`localhost`** | Con `FRONTEND_URL` en localhost se usa la dirección de la petición | Revisa que el proxy mande `X-Forwarded-Proto`/`X-Forwarded-Host`, o pon `FRONTEND_URL` con el dominio real |
| **No puedo borrar una materia o un docente** | No es un bug, es protección del historial | El mensaje te dice qué dependencia lo impide |
| `npm ci` truena compilando **`bcrypt`** (Linux) | Faltan herramientas de compilación | `sudo apt-get install -y build-essential python3` |
| **Se queda sin memoria** al compilar Angular | El build pide ~2 GB | Compila en tu compu y sube `backend/public` |
| **Permisos denegados** al subir evidencias (Linux) | La carpeta no es del usuario del servicio | `sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo/backend/uploads` |
| Cambié el `JWT_SECRET` y **todos quedaron fuera** | Comportamiento esperado | Nadie perdió nada: vuelvan a iniciar sesión |
| La pantalla sale **en blanco** | `backend/public/index.html` no existe o está incompleto | Recompila con `npx ng build` (el destino ya está en `angular.json`) y reinicia el servicio |

---

## 17. Notas del chef

Las cosas que ya nos mordieron una vez. Léelas antes de sufrir:

1. **El `WorkingDirectory` manda.** El proceso Node vive en `backend/`. Si lo
   arrancas desde otro lado, no encuentra `.env`, ni `public`, ni `uploads`, y el
   error que sale no dice "estás en la carpeta equivocada".

2. **`backend/public` es una copia, no un enlace.** Si cambias el frontend y no
   recompilas contra `backend/public`, el puerto 3000 sigue sirviendo lo viejo.
   Es el error que más veces nos pasó.

3. **En Windows, apaga antes de generar Prisma y de compilar.** El `EPERM` es
   eso, no otra cosa.

4. **Nunca corras los scripts de demo en la base buena.**
   `backend/scripts/seed-demo.js` **borra toda la base de datos** (usuarios,
   instituciones, proyectos, todo) y la reemplaza con datos falsos. Es la receta
   para quedarte sin tesis. Si quieres demo, usa una base aparte.

5. **Los enlaces de invitación caducan** (7 días) y **solo sirven una vez**. Si
   un docente no lo abrió a tiempo, invítalo de nuevo.

6. **`FRONTEND_URL` es la URL del correo, no la de la API.** Con dominio va
   `https://tu-dominio`; en la laptop sirviendo por el backend, `http://localhost:3000`.
   Si la dejas en localhost, la aplicación usa la dirección desde la que se esté
   usando (por eso un túnel de cloudflared funciona sin cambiar nada).

7. **El puerto 3000 no se expone a Internet** si tienes proxy. Solo 80 y 443.

8. **Los archivos de `uploads` valen tanto como la base.** Respalda los dos o
   ninguno.

9. **Node 18 no sirve** para este proyecto. Tu compu tiene 24 y va bien; en el
   servidor, 22 LTS es la apuesta segura.

10. **Un respaldo sin probar no es un respaldo.** Restaura una vez en una base
    de prueba y duerme tranquilo.

---

## 18. Emplatado final

Pasa esta lista y ya puedes presentar:

| # | Prueba | Debe salir |
| --- | --- | --- |
| 1 | `curl http://localhost:3000/health` | `{"status":"ok",…}` |
| 2 | Abrir el dominio | Pantalla **Iniciar sesión** con el logo CACE |
| 3 | Registrarse como agente | Entra al panel del agente |
| 4 | Invitar a un docente | *"Invitación enviada"* y el correo llega |
| 5 | Abrir el enlace del correo | Pantalla **Completa tu registro** |
| 6 | Activar la cuenta | Panel del docente |
| 7 | Crear materia + asignación + solicitud | Aparece *Pendiente* |
| 8 | Revisar como agente de origen y de destino | Se crea el proyecto |
| 9 | Subir una evidencia de 5 MB | Sube sin error 413 |
| 10 | Reiniciar el servidor | Vuelve a levantar solo |

### Para la demo con datos (con cuidado)

```powershell
cd C:\clasesespejo\backend
node scripts\seed-demo.js           # ⚠️ BORRA TODO: solo en base de demo
node scripts\seed-demo-clases.js    # simula 11 clases en todos los estados
```

Contraseña de todos los usuarios de demo: `Demo1234`
Agentes: `agente.calkini@clasesespejo.mx` y `agente.colombia@clasesespejo.co`.

Para deshacer la simulación: `node scripts\borrar-demo-clases.js`.

---

## 🍽️ Resumen en una servilleta

```text
1. Node 22/24  +  PostgreSQL 17  +  Git
2. Base de datos + usuario dueño
3. git clone  →  C:\clasesespejo   (o /opt/clasesespejo)
4. backend\.env  →  copia el tuyo y cambia DATABASE_URL y FRONTEND_URL
5. npm ci  →  prisma generate  →  prisma migrate deploy  →  npm run build
6. frontend:  npm ci  →  ng build
7. Que corra solo:  NSSM (Windows)  /  systemd (Linux)
8. Opcional: dominio + HTTPS (Caddy es el más fácil)
9. Cortafuegos: 80 y 443 sí, 3000 no
10. Abrir el dominio  →  registrarse como agente  →  invitar docentes
```

---

*Receta casera de Clases Conjuntas 🍳 — la versión formal está en
`docs/guia-de-despliegue.md`, y el uso del sistema día a día en
`docs/manual-de-usuario.md`.*
