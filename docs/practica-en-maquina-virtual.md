# 🥋 Ensayo general en una máquina virtual

> **Para qué es esto:** para montar Clases Conjuntas en una VM, romperla a
> propósito, arreglarla, y llegar al día del estreno sin miedo.
>
> Es el complemento de la receta (`docs/receta-para-montarlo.md`). Ahí está el
> *cómo*; aquí está el *practícalo sin riesgo*.

```
⏱️  Tiempo:     2 horas la primera vez (con calma)
🍽️  Raciones:   1 máquina virtual de práctica
🔥  Dificultad: principiante, pero con comandos listos para copiar
💥  Riesgo:     CERO. Aquí sí puedes romper cosas: es el punto.
🎯  Objetivo:   que el día que lo hagas en el servidor real ya lo hayas hecho 3 veces
```

---

## Índice

0. [La idea: ensayar sin miedo](#0-la-idea-ensayar-sin-miedo)
1. [Cómo va tu máquina y qué le vamos a dar a la VM](#1-cómo-va-tu-máquina-y-qué-le-vamos-a-dar-a-la-vm)
2. [Elegir el hypervisor](#2-elegir-el-hypervisor)
3. [Crear la máquina virtual](#3-crear-la-máquina-virtual)
4. [Instalar Ubuntu Server](#4-instalar-ubuntu-server)
5. [📸 Snapshot 1: "recién nacida"](#5--snapshot-1-recién-nacida)
6. [Montar el proyecto dentro de la VM](#6-montar-el-proyecto-dentro-de-la-vm)
7. [Probarlo desde el navegador de Windows](#7-probarlo-desde-el-navegador-de-windows)
8. [📸 Snapshot 2: "funcionando"](#8--snapshot-2-funcionando)
9. [Los 12 ejercicios de valentía](#9-los-12-ejercicios-de-valentía)
10. [El día del estreno: qué cambia en el servidor de verdad](#10-el-día-del-estreno-qué-cambia-en-el-servidor-de-verdad)
11. [Apéndices](#11-apéndices)

---

## 0. La idea: ensayar sin miedo

Un servidor real da miedo porque **no tiene botón de deshacer**. Una máquina
virtual **sí**: se llama *snapshot* (o *checkpoint*) y es una foto de la máquina
entera. Si algo se rompe, restauras la foto y estás de vuelta en 30 segundos,
como si nada hubiera pasado.

Eso cambia todo. En la VM puedes:

* Apagar PostgreSQL a media clase.
* Matar el proceso a lo bruto.
* Poner mal el `.env` a propósito.
* Borrar la carpeta de la aplicación.
* Restaurar un respaldo y comprobar que de verdad sirve.

Y después le das al botón y sigue funcionando. **El miedo se va haciendo esto, no
leyendo.** Es como el simulador de vuelo: no aprendes a aterrizar leyendo el
manual, aprendes estrellándote 20 veces en el simulador.

**La única regla:** nunca practiques con la base de datos buena de tu compu. La
VM tiene la suya propia, ahí no se toca nada de tu trabajo.

---

## 1. Cómo va tu máquina y qué le vamos a dar a la VM

Esto es lo que encontré en tu compu:

| Cosa | Tu máquina | Comentario |
| --- | --- | --- |
| Windows | **11, versión 25H2, build 26200, edición Pro** | Ojo: el registro dice "Windows 10 Pro" (Windows 11 arrastra ese nombre viejo), pero el build 26200 y el 25H2 son Windows 11. Lo importante: **edición Pro**, así que Hyper-V está disponible si lo quieres |
| Procesadores | **8 lógicos** | De sobra. A la VM le damos 2 |
| Hypervisor instalado | **ninguno** | Ni VirtualBox, ni VMware, ni Hyper-V activado |
| Docker Desktop | **no instalado** | Bien: no habrá conflictos |
| `ssh`, `scp`, `tar` | **disponibles** | Ya vienen con Windows. Los vamos a usar |
| RAM y disco libre | *(no pude leerlo desde aquí)* | Compruébalo tú, abajo |

### Compruébalo tú (30 segundos)

Abre el **Administrador de tareas** (`Ctrl + Shift + Esc`) → pestaña
**Rendimiento**:

* **Memoria** → fíjate en el total (8, 16, 32 GB…).
* **Disco C:** → cuánto espacio libre queda (necesitas **~35 GB libres**).

Y con eso decides el tamaño de la VM:

| Si tu compu tiene… | Dale a la VM | Compilas el frontend… |
| --- | --- | --- |
| **8 GB** de RAM | 2 GB de RAM, 2 CPU, 25 GB disco | **en Windows** y lo copias (Angular pide ~2 GB y no alcanza) |
| **16 GB** o más | 4 GB de RAM, 2 CPU, 30 GB disco | dentro de la VM, sin problema |

> **Si tienes 8 GB:** no es problema, solo compila la pantalla en Windows con
> `npx ng build` y mándala a la VM con `scp`
> (el comando está en el paso 6.7).

---

## 2. Elegir el hypervisor

Necesitas un programa que simule una computadora. Tienes dos caminos:

| | **VirtualBox** ⭐ recomendado | **Hyper-V** |
| --- | --- | --- |
| Cuánto cuesta | Gratis | Gratis |
| Ya lo tienes | No, hay que instalarlo | Sí (tu Windows es Pro), hay que activarlo |
| Instalación | Un `.exe` y listo | Activar característica + **reiniciar** |
| Snapshots | Botón "Snapshots" muy claro | Se llaman "Checkpoints" |
| Contra | Si algún día activas Hyper-V o Docker Desktop, se pone lento | Si activas Hyper-V, VirtualBox se pone lento (elige uno) |
| Descarga | <https://www.virtualbox.org/wiki/Downloads> → *VirtualBox platform packages* → Windows hosts | Ya está en Windows |

**Mi recomendación para tu caso: VirtualBox.** Como no tienes Hyper-V ni Docker
Desktop activados, VirtualBox corre a velocidad completa, la interfaz de
snapshots es la más fácil de entender para una primera vez, y no tienes que
reiniciar la compu para empezar.

### Instalar VirtualBox

1. Baja el instalador de Windows y ejecútalo (Siguiente, Siguiente, Instalar).
   Te va a preguntar si quieres instalar controladores de red: **sí**.
2. Abre VirtualBox al terminar.
3. **Baja la ISO de Ubuntu Server 24.04 LTS**:
   <https://ubuntu.com/download/server> → *Ubuntu Server 24.04 LTS* → descarga el
   `.iso` (~2.5 GB).

> Guárdala en un lugar fácil, por ejemplo `C:\ISOs\ubuntu-24.04-server.iso`.

### Si prefieres Hyper-V (ya lo tienes)

Abre **PowerShell como Administrador**:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All
```

**Reinicia la computadora** (te lo va a pedir). Después, los pasos de creación
de la VM cambian un poco: están al final, en el [Apéndice B](#apéndice-b-comandos-de-la-vm-desde-windows).

---

## 3. Crear la máquina virtual

### Por la interfaz (más fácil la primera vez)

1. VirtualBox → botón **Nueva**.
2. **Name:** `ClasesEspejo`
   **ISO Image:** elige la ISO de Ubuntu que bajaste
   **Type:** Linux · **Version:** Ubuntu (64-bit)
   Marca **Skip Unattended Installation** *(importante: si no, VirtualBox
   intenta instalarlo solo y te complica la vida)*.
3. **Hardware:**
   * Base Memory: **4096 MB** (o **2048 MB** si tu compu tiene 8 GB)
   * Processors: **2**
4. **Hard Disk:** *Create a Virtual Hard Disk Now* → **30 GB** (o 25 GB) →
   tipo **VDI** → *Dynamically allocated* (así no ocupa los 30 GB de golpe).
5. Pulsa **Finish**.
6. Selecciona la VM → **Configuración** → **Red**:
   * Conectado a: **NAT**
   * Abre **Avanzado** → **Reenvío de puertos** → agrega **dos reglas**:

   | Nombre | Protocolo | Puerto anfitrión | Puerto invitado |
   | --- | --- | --- | --- |
   | `ssh` | TCP | **2222** | **22** |
   | `web` | TCP | **8080** | **3000** |

   Esto significa: "lo que llegue a mi puerto 2222, pásalo al 22 de la VM; y lo
   que llegue al 8080, al 3000 de la VM". Así te conectas desde Windows sin
   pelos.

> **¿Por qué NAT y no "Adaptador puente"?** Con puente la VM saca su propia IP en
> tu red y entras directo a esa IP (más realista, pero depende de tu Wi-Fi/router
> y a veces el firewall de la red lo bloquea). Con NAT + reenvío funciona siempre,
> incluso sin internet. Para practicar, NAT. Para el servidor real, ya será una
> IP de verdad.

### Por línea de comandos (si prefieres copiar y pegar)

En **PowerShell** (ajusta la ruta de la ISO):

```powershell
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
$iso  = "C:\ISOs\ubuntu-24.04-server.iso"

& $vbox createvm --name "ClasesEspejo" --ostype Ubuntu_64 --register
& $vbox modifyvm "ClasesEspejo" --memory 4096 --cpus 2 --vram 16 --nic1 nat
& $vbox modifyvm "ClasesEspejo" --natpf1 "ssh,tcp,,2222,,22"
& $vbox modifyvm "ClasesEspejo" --natpf1 "web,tcp,,8080,,3000"
& $vbox storagectl "ClasesEspejo" --name "SATA" --add sata --controller IntelAhci
& $vbox createmedium disk --filename "$env:USERPROFILE\VirtualBox VMs\ClasesEspejo\ClasesEspejo.vdi" --size 30720
& $vbox storageattach "ClasesEspejo" --storagectl "SATA" --port 0 --device 0 --type hdd --medium "$env:USERPROFILE\VirtualBox VMs\ClasesEspejo\ClasesEspejo.vdi"
& $vbox storageattach "ClasesEspejo" --storagectl "SATA" --port 1 --device 0 --type dvddrive --medium $iso
& $vbox startvm "ClasesEspejo" --type gui
```

---

## 4. Instalar Ubuntu Server

Arranca la VM (botón **Iniciar**) y ve respondiendo. Los puntos donde la gente se
traba están marcados con ⚠️:

1. **Language:** English *(para un servidor es lo más cómodo; da igual para el
   proyecto)*.
2. **Keyboard:** Spanish (Latin American) — o el que corresponda a **tu teclado
   físico**, porque si no, la contraseña que escribas no va a coincidir con la
   que crees.
3. **Type of install:** **Ubuntu Server** (no la "minimized").
4. **Network:** déjalo como está (DHCP). ⚠️ **Apunta o memoriza la IP** que
   aparece (algo como `10.0.2.15`); no la necesitas con NAT, pero no está de más.
5. **Proxy:** vacío → *Done*.
6. **Mirror:** el que propone → *Done*.
7. **Storage:** *Use an entire disk* → el disco de 30 GB → ⚠️ **acepta que se
   borre** (es el disco virtual, no tu disco real, pero asusta la primera vez).
   Deja lo de LVM por defecto.
8. **Profile:**
   * Your name: `Ricardo`
   * Your server's name: `clasesespejo`
   * Username: `ricardo`
   * Password: algo que recuerdes (es de práctica)
9. **Ubuntu Pro:** *Skip for now*.
10. **SSH:** ⚠️ **marca "Install OpenSSH server"**. Si no, no vas a poder
    conectarte desde Windows ni copiar archivos.
11. **Featured Server Snaps:** no marques nada → *Done*.
12. Espera a que instale → **Reboot Now**. Si se queda en "Please remove the
    installation medium", pulsa Enter.

Al reiniciar, entra con tu usuario y contraseña. Ya tienes un servidor Linux. 🎉

Primer mantenimiento:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl unzip
```

### Compruébalo desde Windows (antes de seguir)

Abre **PowerShell** en tu compu:

```powershell
ssh -p 2222 ricardo@localhost
```

Si entra, el "buzón" del puerto 2222 funciona. Escribe `exit` para salir.

> La primera vez te preguntará si confías en la máquina: escribe `yes` y Enter.

---

## 5. 📸 Snapshot 1: "recién nacida"

**Antes de instalar nada del proyecto**, toma la primera foto. Así, si algún día
la lías parda, vuelves aquí en lugar de reinstalar Ubuntu.

### VirtualBox, por la interfaz

1. Apaga la VM limpiamente: dentro de la VM, `sudo poweroff`.
   *(Debe estar apagada para hacer snapshot.)*
2. En VirtualBox, selecciona la VM → menú **Herramientas** → **Snapshots** →
   botón **Tomar** → nombre: **`01-ubuntu-limpio`** → Aceptar.

### Por línea de comandos

```powershell
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
& $vbox controlvm "ClasesEspejo" poweroff
& $vbox snapshot "ClasesEspejo" take "01-ubuntu-limpio" --description "Ubuntu 24.04 recien instalado, sin el proyecto"
& $vbox snapshot "ClasesEspejo" list
```

> **Este es el botón de deshacer.** Grábate estas dos ideas:
> * tomar snapshot = "guardar partida"
> * restaurar snapshot = "cargar partida"

---

## 6. Montar el proyecto dentro de la VM

Enciende la VM (`& $vbox startvm "ClasesEspejo" --type gui`) y entra con tu
usuario. Todo lo que sigue va **dentro de la VM**.

### 6.1 Node 22 y PostgreSQL

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql
node -v      # debe decir v22.x
```

### 6.2 La base de datos

```bash
sudo -u postgres psql -c "CREATE USER clasesespejo WITH PASSWORD 'Practica2026';"
sudo -u postgres psql -c "CREATE DATABASE clasesconjuntas OWNER clasesespejo;"
```

### 6.3 Copiar el código desde Windows

Aquí hay un detalle importante: **tu repo de GitHub le faltan los 9 commits de
hoy** (los tienes solo en tu compu). Así que en lugar de clonar de GitHub, vamos a
exportar tu código **tal como está ahora** — solo lo que está commiteado, sin
`node_modules`, y pesa poquísimo.

En **Windows** (PowerShell, en la carpeta del proyecto):

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
git archive --format=zip -o "$env:TEMP\clasesespejo.zip" HEAD
scp -P 2222 "$env:TEMP\clasesespejo.zip" ricardo@localhost:/home/ricardo/
```

> Si tu contraseña tiene caracteres raros y `scp` se queja, ejecuta primero
> `ssh -p 2222 ricardo@localhost` para autenticarte y ya después el `scp`.

De vuelta **dentro de la VM**:

```bash
sudo mkdir -p /opt/clasesespejo
sudo chown -R $USER:$USER /opt/clasesespejo
unzip -q ~/clasesespejo.zip -d /opt/clasesespejo
ls /opt/clasesespejo          # deben aparecer backend, frontend, docs
cd /opt/clasesespejo/backend
```

> *(Alternativa "más realista": cuando ya hayas hecho `git push`, dentro de la VM
> puedes hacer `git clone https://github.com/RICARDOSOTO6/clases-espejo.git
> /opt/clasesespejo`. Tu repo es público, así que funciona sin credenciales.)*

### 6.4 El archivo `.env`

```bash
cat > /opt/clasesespejo/backend/.env <<'EOF'
DATABASE_URL="postgresql://clasesespejo:Practica2026@localhost:5432/clasesconjuntas?schema=public"
JWT_SECRET="clave-de-practica-1234567890-abcdefghij"
JWT_EXPIRES_IN="1d"
INVITATION_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:8080"
PORT="3000"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="no-reply@clasesespejo.local"
EOF
chmod 600 /opt/clasesespejo/backend/.env
```

Fíjate en dos cosas:

* **`FRONTEND_URL="http://localhost:8080"`** → el 8080 es el puerto de *tu
  Windows* que reenviamos al 3000 de la VM. Así, el enlace del correo de
  invitación te va a funcionar cuando lo abras en tu navegador normal.
* **SMTP vacío a propósito.** Con esto, invitar a un docente va a fallar — y eso
  es el **Ejercicio 4**. Cuando quieras completar el flujo de verdad, copia tu
  correo real de Gmail (el que ya usas) o usa el truco del [Apéndice C](#apéndice-c-smtp-de-mentiras-para-completar-el-flujo).

### 6.5 Instalar, crear tablas y compilar

El orden importa (es lo que más se equivoca la gente):

```bash
cd /opt/clasesespejo/backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

`migrate deploy` debe decir algo como *"9 migrations found"* y aplicarlas. Son las
22 tablas del sistema.

### 6.6 Compilar la pantalla

```bash
cd /opt/clasesespejo/frontend
npm ci
npx ng build
```

Tarda 2-4 minutos. Si tu VM tiene 2 GB de RAM, esto puede morir por falta de
memoria: salta al paso 6.7.

### 6.7 (Alternativa) Compilar la pantalla en Windows

Si le diste poca RAM a la VM, hazlo en Windows y mándalo:

```powershell
# En Windows
cd C:\Users\ricar\Documents\ClasesEspejo\frontend
npm ci
npx ng build
scp -P 2222 -r ..\backend\public ricardo@localhost:/opt/clasesespejo/backend/
```

### 6.8 Usuario del servicio y permisos

```bash
sudo useradd --system --shell /usr/sbin/nologin --home /opt/clasesespejo clasesespejo
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo -u clasesespejo mkdir -p /opt/clasesespejo/backend/uploads
```

> El `chown` va **después** de compilar: si lo haces antes, tu usuario ya no puede
> escribir en `dist/` y el build falla.

### 6.9 Dejarlo corriendo como servicio

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
```

Debe decir **active (running)**. (La línea mágica, otra vez:
`WorkingDirectory=/opt/clasesespejo/backend`.)

---

## 7. Probarlo desde el navegador de Windows

En **Windows**, abre:

```
http://localhost:8080
```

Debe cargar la pantalla de **Iniciar sesión** de Clases Conjuntas. 🎉

Y comprueba la API desde PowerShell:

```powershell
curl.exe http://localhost:8080/health
# {"status":"ok","service":"clases-espejo-backend","timestamp":"..."}
```

> Si no carga: [Apéndice D](#apéndice-d-si-sale-esto-es-esto). Casi siempre es el
> reenvío de puertos o el servicio caído.

**Ya está montado.** Y ahora viene lo bueno.

---

## 8. 📸 Snapshot 2: "funcionando"

Guarda la partida con todo funcionando. Si un ejercicio se te va de las manos,
vuelves aquí y sigues practicando.

Dentro de la VM:

```bash
sudo poweroff
```

En **Windows**:

```powershell
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
& $vbox snapshot "ClasesEspejo" take "02-funcionando" --description "Proyecto montado, base creada, servicio activo"
& $vbox snapshot "ClasesEspejo" list
```

---

## 9. Los 12 ejercicios de valentía

Aquí está el objetivo de todo: **romperlo a propósito**. Cada ejercicio tiene la
misma forma: lo rompes → ves qué pasa → lo arreglas → te quedas con el aprendizaje.

Antes de empezar, memoriza **los 3 comandos que siempre salvan**:

```bash
sudo systemctl status clasesespejo        # ¿está vivo el servicio?
sudo journalctl -u clasesespejo -n 50     # las últimas 50 líneas del log
curl http://localhost:3000/health         # ¿responde la API?
```

> **Tip de oro:** abre **dos terminales SSH** a la vez (dos ventanas de
> PowerShell con `ssh -p 2222 ricardo@localhost`). En una rompes cosas y en la
> otra miras los logs en vivo con:
> `sudo journalctl -u clasesespejo -f`

---

### ☐ Ejercicio 1 — Matar el proceso a lo bruto

**Rómpelo:**

```bash
sudo pkill -9 -f dist/src/main
sudo systemctl status clasesespejo
```

**Qué vas a ver:** el servicio dice `active (running)` otra vez, con un
`Restart=always` que lo levantó en 5 segundos. Abre el navegador: sigue
funcionando.

**Aprendiste:** el servicio se cuida solo. Una caída del proceso no es una caída
del sistema. *(En el servidor real esto te va a salvar a las 3 de la mañana.)*

---

### ☐ Ejercicio 2 — Tumbar la base de datos

**Rómpelo:**

```bash
sudo systemctl stop postgresql
curl http://localhost:3000/health          # sigue diciendo ok
```

Ahora abre `http://localhost:8080` e intenta iniciar sesión.

**Qué vas a ver:** la pantalla carga (el frontend es solo archivos), pero el login
falla. El `/health` **sí** responde: la app está viva, la base no.

**Arréglalo:**

```bash
sudo systemctl start postgresql
sudo systemctl status postgresql
```

**Aprendiste:** a distinguir "se cayó la aplicación" de "se cayó la base de
datos". Son dos problemas distintos y ahora sabes cuál estás viendo.

---

### ☐ Ejercicio 3 — Romper el `.env`

**Rómpelo:**

```bash
sudo nano /opt/clasesespejo/backend/.env
# cambia JWT_SECRET a: "corto"
sudo systemctl restart clasesespejo
sudo systemctl status clasesespejo
```

**Qué vas a ver:** el servicio **no arranca**. Y aquí está lo bonito:

```bash
sudo journalctl -u clasesespejo -n 30
```

Vas a leer el mensaje del propio sistema explicándote que la clave es demasiado
corta. La aplicación se niega a arrancar con un secreto débil — es una protección,
no un capricho.

**Arréglalo:** pon de nuevo una clave larga, guarda y `sudo systemctl restart clasesespejo`.

**Aprendiste:** dónde viven los errores (`journalctl`), que la aplicación avisa en
español, y que **un `.env` mal escrito no arranca el servicio**. En el servidor
real, este es el error número uno.

---

### ☐ Ejercicio 4 — Invitar a un docente sin servidor de correo

Con el SMTP vacío del paso 6.4, entra a `http://localhost:8080` como agente e
intenta **Invitar docente**.

**Qué vas a ver:** un mensaje tipo *"No se pudo enviar el correo de invitación.
Revisa la configuración de correo e inténtalo de nuevo."*

**Aprendiste:** el sistema **no deja la invitación a medias**: si el correo no
sale, borra la invitación y te avisa. Y confirmaste por qué el SMTP es
obligatorio.

**Arréglalo:** completa el flujo de verdad con el
[Apéndice C](#apéndice-c-smtp-de-mentiras-para-completar-el-flujo) (SMTP de
mentiras) o poniendo tu Gmail real.

---

### ☐ Ejercicio 5 — Subir un archivo prohibido

Como docente, dentro de un proyecto, intenta subir una **evidencia** con extensión
`.svg` o `.exe` (renombra cualquier archivo).

**Qué vas a ver:** *"Tipo de archivo no permitido (.svg). Se aceptan PDF,
imágenes, Office, texto y ZIP."*

**Aprendiste:** la lista blanca de archivos te protege de que alguien suba un
`.html` o `.svg` que después se ejecute en el navegador de otro. No es un estorbo,
es seguridad.

---

### ☐ Ejercicio 6 — Subir un archivo demasiado grande

Sube un archivo de **12 MB** (un PDF gordo, un ZIP, un video corto).

**Qué vas a ver:** rechazo por tamaño. El límite son **10 MB**, y ese límite vive
en el **código** (`proyectos.controller.ts`), no en Nginx.

**Aprendiste:** dónde está cada límite. Si algún día alguien necesita subir 30 MB,
sabes exactamente qué archivo tocar. *(Y si pones Nginx delante, recuerda el
`client_max_body_size` del Apéndice E.)*

---

### ☐ Ejercicio 7 — Borrar la pantalla

**Rómpelo:**

```bash
sudo rm -rf /opt/clasesespejo/backend/public
sudo systemctl restart clasesespejo
```

Abre `http://localhost:8080`.

**Qué vas a ver:** la API sigue viva (`/health` responde) pero la pantalla ya no
carga.

**Arréglalo:** recompila el frontend y reinicia:

```bash
cd /opt/clasesespejo/frontend
npx ng build
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo systemctl restart clasesespejo
```

**Aprendiste:** **el ejercicio más valioso de todos.** NestJS lee
`backend/public` *al arrancar*: si recompilas el frontend sin reiniciar, sigues
viendo la versión vieja, y si borras la carpeta, te quedas sin pantalla. Este es el
error que más veces nos pasó en el desarrollo.

---

### ☐ Ejercicio 8 — Actualizar a una versión nueva

Vas a hacer el "recalentado" completo, como si hubieras programado algo nuevo.

**En Windows:** haz un cambio tonto y commitealo:

```powershell
cd C:\Users\ricar\Documents\ClasesEspejo
# cambia un texto cualquiera de docs/readme, por ejemplo
git add -A
git commit -m "prueba de actualizacion en la VM"
git archive --format=zip -o "$env:TEMP\clasesespejo-v2.zip" HEAD
scp -P 2222 "$env:TEMP\clasesespejo-v2.zip" ricardo@localhost:/home/ricardo/
```

**En la VM:**

```bash
sudo systemctl stop clasesespejo                        # 1. apagar
cd /opt/clasesespejo
# (aquí en el servidor real sería: git pull)
unzip -q -o ~/clasesespejo-v2.zip -d /opt/clasesespejo  # 2. traer lo nuevo

cd backend
npm ci                                                  # 3. dependencias
npx prisma generate                                     # 4. solo si cambió el schema
npx prisma migrate deploy                               # 5. solo si hay migraciones
npm run build                                           # 6. compilar backend
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo systemctl start clasesespejo                       # 7. prender
sudo systemctl status clasesespejo
```

**Aprendiste:** el flujo de actualización de 7 pasos, con el punto crítico:
**detener antes de generar Prisma** (en Windows es `EPERM`, en Linux es que el
archivo está en uso).

---

### ☐ Ejercicio 9 — Respaldo y restauración

Este es el que quita el miedo de verdad.

**Respalda:**

```bash
mkdir -p ~/respaldos
pg_dump "postgresql://clasesespejo:Practica2026@localhost:5432/clasesconjuntas" \
  -F c -f ~/respaldos/clasesconjuntas.dump
ls -lh ~/respaldos/
```

**Rómpelo:** borra algo a propósito desde la aplicación (una materia, una
solicitud) o directo en la base:

```bash
sudo -u postgres psql clasesconjuntas -c "DELETE FROM solicitud_clase_espejo WHERE id > 0;"
```

Recarga la aplicación: ya no están.

**Réstoralo:**

```bash
pg_restore -d "postgresql://clasesespejo:Practica2026@localhost:5432/clasesconjuntas" \
  --clean --if-exists ~/respaldos/clasesconjuntas.dump
```

Recarga de nuevo: **volvieron**.

**Aprendiste:** que tu respaldo sí funciona. Un respaldo que nunca restauraste es
solo una esperanza.

---

### ☐ Ejercicio 10 — Borrar las evidencias

**Rómpelo:** sube una evidencia, y después:

```bash
sudo rm -rf /opt/clasesespejo/backend/uploads/*
```

Recarga el proyecto: la base de datos **sigue diciendo** que hay una evidencia,
pero al intentar descargarla da error.

**Aprendiste:** que hay **dos** cosas que respaldar: la base de datos **y** la
carpeta `uploads/`. Si respaldas solo una, tienes registros apuntando al vacío.
*(Y aprende la lección inversa: para arreglarlo, basta con volver a poner los
archivos; la base no se toca.)*

---

### ☐ Ejercicio 11 — Cambiar el puerto

**Rómpelo:**

```bash
sudo nano /opt/clasesespejo/backend/.env
# cambia PORT="3000" por PORT="4000"
sudo systemctl restart clasesespejo
curl http://localhost:3000/health      # ya no responde
curl http://localhost:4000/health      # aquí está
```

Y en Windows, `http://localhost:8080` ya no carga: el reenvío apunta al 3000 de la
VM, que ahora está vacío.

**Arréglalo** de alguna de las dos formas:

* Vuelve a `PORT="3000"`, o
* Cambia el reenvío de puertos del 8080 hacia el **4000**:

```powershell
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
& $vbox controlvm "ClasesEspejo" natpf1 delete "web"
& $vbox controlvm "ClasesEspejo" natpf1 "web,tcp,,8080,,4000"
```

**Aprendiste:** la cadena completa `navegador → puerto 8080 de Windows → puerto
3000 de la VM → aplicación`. Cuando algo no carga, ya sabes en qué eslabón
buscar. *(En el servidor real el eslabón de en medio es el proxy y el 80/443.)*

---

### ☐ Ejercicio 12 — El botón del pánico

**Rompe todo lo que quieras.** Borra la carpeta, tumba servicios, deja el `.env`
hecho un desastre. Después:

Dentro de la VM:

```bash
sudo poweroff
```

En Windows:

```powershell
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
& $vbox snapshot "ClasesEspejo" restore "02-funcionando"
& $vbox startvm "ClasesEspejo" --type gui
```

Abre `http://localhost:8080`.

**Aprendiste:** que siempre hay vuelta atrás. **Esto es lo que te va a quitar el
miedo el día del estreno.**

---

## 10. El día del estreno: qué cambia en el servidor de verdad

Ya montaste el proyecto 3 veces y lo rompiste 12 veces. Ahora la parte fácil.
Diferencias entre la VM de práctica y un servidor real:

| Cosa | En tu VM | En el servidor real |
| --- | --- | --- |
| Acceso | `localhost:8080` reenviado | **Dominio real** o IP pública |
| HTTPS | No (HTTP pelado) | **Sí**, con Caddy/Nginx + certificado (`FRONTEND_URL` con `https://`) |
| Puertos | 8080 → 3000 | **80 y 443** con proxy; el 3000 cerrado |
| Cómo llega el código | `git archive` + `scp` | **`git clone`** (por eso: haz `git push` primero) |
| Servicio | systemd con `Restart=always` | Igual ✅ (lo practicaste) |
| Respaldos | A mano, una vez | **Automáticos** (cron o Programador de tareas) |
| Usuario | `clasesespejo` sin privilegios ✅ | Igual ✅ |
| Firewall | Nada | Solo 22, 80 y 443 |
| Datos | Los que hiciste practicando | **Nada de demo**: `seed-demo.js` **borra toda la base** |
| `JWT_SECRET` | `clave-de-practica-...` | **Uno nuevo y largo**, distinto al de la práctica |
| Botón de deshacer | Snapshot en 30 segundos | Snapshot del proveedor (más lento) o nada: **respaldos** |

### Lo que ya no tienes que temer

- ✅ Sabes montarlo desde cero (lo hiciste completo).
- ✅ Sabes qué hacer si el servicio no arranca (Ejercicio 3).
- ✅ Sabes si el problema es la app o la base (Ejercicio 2).
- ✅ Sabes por qué "mi cambio no se ve" (Ejercicio 7).
- ✅ Sabes actualizar sin romper nada (Ejercicio 8).
- ✅ Sabes que tus respaldos sirven (Ejercicio 9).
- ✅ Sabes cuál es la cadena de puertos y dónde se corta (Ejercicio 11).

### Checklist del estreno

| # | Antes de decir "ya está" | ✔ |
| --- | --- | --- |
| 1 | `git push` hecho (los commits al día) | ☐ |
| 2 | `JWT_SECRET` nuevo, largo, y **no** el de la práctica | ☐ |
| 3 | `FRONTEND_URL` con el dominio real y `https://` | ☐ |
| 4 | SMTP real y probado (invita a alguien de prueba) | ☐ |
| 5 | `chmod 600 .env` | ☐ |
| 6 | Firewall: solo 22, 80, 443 | ☐ |
| 7 | Puerto 3000 **cerrado** hacia afuera | ☐ |
| 8 | Respaldos programados (base **y** `uploads/`) | ☐ |
| 9 | Una restauración probada de verdad | ☐ |
| 10 | `sudo systemctl enable clasesespejo` (que arranque solo al reiniciar) | ☐ |
| 11 | Probado desde **otra** computadora, no solo desde el propio servidor | ☐ |
| 12 | **Cero datos de demo** en la base | ☐ |

---

## 11. Apéndices

### Apéndice A: Repetir la práctica desde cero en 10 minutos

Ya con el snapshot `01-ubuntu-limpio`, puedes practicar el montaje completo todas
las veces que quieras:

```powershell
# Windows: restaurar la VM limpia
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
& $vbox snapshot "ClasesEspejo" restore "01-ubuntu-limpio"
& $vbox startvm "ClasesEspejo" --type gui
```

Y dentro de la VM, la receta resumida (todo copiar y pegar):

```bash
# 1. Software
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql unzip

# 2. Base de datos
sudo -u postgres psql -c "CREATE USER clasesespejo WITH PASSWORD 'Practica2026';"
sudo -u postgres psql -c "CREATE DATABASE clasesconjuntas OWNER clasesespejo;"

# 3. Código (ya copiado antes con scp a ~/clasesespejo.zip)
sudo mkdir -p /opt/clasesespejo && sudo chown -R $USER:$USER /opt/clasesespejo
unzip -q ~/clasesespejo.zip -d /opt/clasesespejo

# 4. .env (vuelve a crearlo como en 6.4)
cd /opt/clasesespejo/backend && chmod 600 .env

# 5. Compilar
npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
cd ../frontend && npm ci && npx ng build

# 6. Servicio
sudo useradd --system --shell /usr/sbin/nologin --home /opt/clasesespejo clasesespejo 2>/dev/null
sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo
sudo systemctl enable --now clasesespejo
sudo systemctl status clasesespejo
```

### Apéndice B: Comandos de la VM desde Windows

```powershell
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"

# Encender / apagar
& $vbox startvm "ClasesEspejo" --type gui
& $vbox startvm "ClasesEspejo" --type headless     # sin ventana (para dejarla corriendo)
& $vbox controlvm "ClasesEspejo" poweroff          # apagón (como desenchufar)
& $vbox controlvm "ClasesEspejo" acpipowerbutton   # apagado limpio

# Snapshots
& $vbox snapshot "ClasesEspejo" list
& $vbox snapshot "ClasesEspejo" take "nombre-del-snapshot"
& $vbox snapshot "ClasesEspejo" restore "nombre-del-snapshot"

# Reenvío de puertos
& $vbox controlvm "ClasesEspejo" natpf1 "ssh,tcp,,2222,,22"
& $vbox controlvm "ClasesEspejo" natpf1 "web,tcp,,8080,,3000"
& $vbox controlvm "ClasesEspejo" natpf1 delete "web"

# Entrar por SSH desde Windows
ssh -p 2222 ricardo@localhost

# Copiar archivos
scp -P 2222 archivo.zip ricardo@localhost:/home/ricardo/
scp -P 2222 -r carpeta ricardo@localhost:/home/ricardo/
```

**Si elegiste Hyper-V**, el equivalente:

```powershell
# (Una sola vez, como Administrador, y reiniciar)
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All

# Crear la VM
New-Item -ItemType Directory -Force C:\VMs | Out-Null
New-VM -Name "ClasesEspejo" -MemoryStartupBytes 4GB -Generation 2 `
  -NewVHDPath C:\VMs\ClasesEspejo.vhdx -NewVHDSizeBytes 30GB `
  -SwitchName "Default Switch"
Set-VMProcessor -VMName "ClasesEspejo" -Count 2
Add-VMDvdDrive -VMName "ClasesEspejo" -Path "C:\ISOs\ubuntu-24.04-server.iso"
Set-VMFirmware -VMName "ClasesEspejo" -FirstBootDevice (Get-VMDvdDrive -VMName "ClasesEspejo")
Start-VM -Name "ClasesEspejo"
vmconnect.exe localhost "ClasesEspejo"        # ver la pantalla de la VM

# Checkpoints (= snapshots)
Checkpoint-VM -Name "ClasesEspejo" -SnapshotName "01-ubuntu-limpio"
Get-VMSnapshot -VMName "ClasesEspejo"
Restore-VMSnapshot -VMName "ClasesEspejo" -Name "01-ubuntu-limpio" -Confirm:$false
```

> Con Hyper-V, para ver la web desde Windows **no uses `localhost:8080`** (no hay
> reenvío). Averigua la IP de la VM dentro de Ubuntu (`ip -4 addr show`) y abre
> `http://ESA_IP:3000`. El host sí llega a la VM por el *Default Switch*.

### Apéndice C: SMTP de mentiras (para completar el flujo)

Si no quieres usar tu Gmail real en la práctica, monta un servidor de correo falso
que acepta todo y lo imprime en pantalla:

```bash
sudo apt install -y python3-aiosmtpd
python3 -m aiosmtpd -n -l 0.0.0.0:2525
```

Déjalo corriendo en una terminal y en `backend/.env` pon:

```env
SMTP_HOST="localhost"
SMTP_PORT="2525"
SMTP_SECURE="false"
SMTP_USER=""
MAIL_FROM="no-reply@clasesespejo.local"
```

```bash
sudo systemctl restart clasesespejo
```

Ahora, cuando invites a un docente, **el correo saldrá impreso en la terminal del
servidor falso**, con el enlace de activación incluido. Cópialo y ábrelo en tu
navegador de Windows (el enlace empieza con `http://localhost:8080/activate?token=…`,
así que funciona directo).

> Si ya tienes tu Gmail configurado, esto es más simple todavía: copia las mismas
> líneas `SMTP_*` de tu `.env` de Windows y el correo llega de verdad.

### Apéndice D: Si sale esto, es esto

| Sale esto | Es esto | Arréglalo así |
| --- | --- | --- |
| `http://localhost:8080` no carga nada | El servicio está caído | `sudo systemctl status clasesespejo` y `journalctl -u clasesespejo -n 50` |
| Ni carga ni responde el `ssh -p 2222` | Reenvío de puertos mal puesto | Revisa las dos reglas en Configuración → Red → Reenvío de puertos |
| Carga la pantalla pero el login falla | PostgreSQL caído | `sudo systemctl start postgresql` |
| `npm ci` o `ng build` mueren sin mensaje | La VM se quedó sin RAM | Dale 4 GB, o compila el frontend en Windows (6.7) |
| `prisma generate` da `EPERM` | Es Windows, no la VM | Detén el backend antes de generar |
| Sale "no encuentro el archivo" al arrancar | El servicio arrancó en otra carpeta | Revisa `WorkingDirectory` en el `.service` |
| Permisos denegados al subir una evidencia | `uploads/` no es del usuario del servicio | `sudo chown -R clasesespejo:clasesespejo /opt/clasesespejo/backend/uploads` |
| La pantalla muestra una versión vieja | Recompilaste y no reiniciaste | `sudo systemctl restart clasesespejo` |
| `scp` pide contraseña y falla | Autentícate primero con `ssh -p 2222 ricardo@localhost` | — |
| Se quedó sin disco | El disco virtual se llenó | `df -h` y borra `node_modules`/`respaldos` viejos |

### Apéndice E: Cuando le pongas proxy (el paso que sigue)

En la práctica no lo necesitas, pero para el servidor real sí: si pones **Nginx**
delante, acuérdate del límite de subida (por defecto 1 MB y tus evidencias pesan
hasta 10 MB → error 413):

```nginx
client_max_body_size 12M;
```

Con **Caddy** no hace falta nada (no limita el tamaño por defecto). El detalle
completo está en `docs/guia-de-despliegue.md`, sección 11.

---

*Laboratorio de práctica de Clases Conjuntas 🥋*
*Los otros documentos: `docs/receta-para-montarlo.md` (la receta),
`docs/guia-de-despliegue.md` (la formal) y `docs/manual-de-usuario.md` (el uso).*
