# Tercera revisión — Auditoría de código y análisis de diseño

> Continúa a [`reporte-qa-clasesespejo.md`](./reporte-qa-clasesespejo.md),
> [`reporte-qa-clasesespejo-v2.md`](./reporte-qa-clasesespejo-v2.md) y
> [`respuesta-auditoria.md`](./respuesta-auditoria.md).
>
> Los 21 hallazgos ya corregidos en las dos revisiones anteriores quedan **excluidos**: aquí solo
> hay cosas nuevas. Todo lo marcado como *verificado* lo comprobé leyendo el fichero o midiéndolo;
> los contrastes se calcularon con la fórmula WCAG 2.x sobre los valores reales del CSS.
> No se modificó ningún fichero del proyecto.

**Resumen**: 2 críticos, 12 importantes y 21 menores en el código, y en diseño 4 bugs visuales
confirmados, 2 problemas de disposición graves y 3 palancas de mejora (estados/color, iconografía
y visualización de datos).

---

# Parte 1 — Auditoría de código

## 1.1 Críticos

### C1. Los hashes de contraseña viajan en casi todas las respuestas
`include: { usuario: true }` trae **todos** los campos de `USUARIO`, incluido `passwordHash`
(`schema.prisma:41`). No hay `ClassSerializerInterceptor` ni `select`, así que el hash bcrypt sale
en `GET /agentes/docentes`, `PATCH /agentes/docentes/:id/estado`, `GET /asignaciones`,
`GET /asignaciones/mias`, `GET /materias`, `GET /solicitudes/entrantes` y prácticamente todos los
endpoints de `/proyectos` (11 puntos en total).

**Verificado en vivo**: la respuesta de `PATCH /proyectos/4` incluye
`"passwordHash":"$2b$10$WwQpN1Sd1wHbM6KFmjOZauq..."` dentro de cada docente participante. Que
`auth.service.toUsuarioSeguro` y `usuarios.getPerfil` **sí** saneen demuestra que la intención era
no exponerlo.

**Arreglo (una línea)**: en `prisma.service.ts`,
`super({ omit: { usuario: { passwordHash: true } } })` (Prisma 6 lo soporta). Alternativa: un
`select` compartido `USUARIO_PUBLICO`.

### C2. Evidencias sin filtrar el tipo + `/uploads` público → XSS almacenado y robo del JWT
`EVIDENCIAS_MULTER` (`proyectos.controller.ts:37-46`) no tiene `fileFilter` y `main.ts:30` sirve
esa carpeta sin autenticación. En el despliegue de un solo origen (el backend sirve el SPA), un
`.html` o `.svg` subido se ejecuta **en el mismo origen que la aplicación**; como el token vive en
`localStorage` (`auth.service.ts:83`), el script puede leerlo. El `target="_blank"` del enlace de
evidencias no protege: `localStorage` es por origen, no por pestaña.

Además, `FileInterceptor` corre **antes** del control de acceso (que está en el servicio,
`proyectos.service.ts:535`): cualquier cuenta autenticada puede escribir ficheros arbitrarios en el
servidor aunque no participe en ningún proyecto.

**Arreglo**: `fileFilter` con lista blanca real (PDF/JPG/PNG/DOCX/PPTX + MIME), servir `/uploads`
con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`, y autorizar antes de que
multer escriba.

## 1.2 Importantes

| # | Hallazgo | Dónde | Arreglo |
| --- | --- | --- | --- |
| I1 | `quitarDocente` da **500** en cuanto hay planificación o chat: solo cuenta `PROYECTO_DOCENTE`, pero `PARTICIPACION_PLANIFICACION`, `PARTICIPACION_REPORTE` y `MENSAJE` apuntan a `proyectoDocenteId` con `ON DELETE RESTRICT` *(verificado en el schema: líneas 218, 247, 320)* | `proyectos.service.ts:215-226` | Contar también esas dependencias y responder 400 explicativo |
| I2 | Editar el reporte de clase **no invalida las firmas**: `update: datos` no toca `estado` ni los `confirmadoEn`, así que el acta se puede reescribir y sigue `CONFIRMADO` | `proyectos.service.ts:610-616` | Poner `estado: BORRADOR` y limpiar `confirmadoEn` en transacción al cambiar el contenido |
| I3 | Una sesión **CANCELADA imposibilita cerrar el proyecto**: se cuentan todas las sesiones sin excluir las canceladas, que nunca tendrán reporte *(verificado en `:718-731`)* | `proyectos.service.ts:718-731` | `where: { proyectoId: id, estado: { not: 'CANCELADA' } }` y verificar sesión a sesión |
| I4 | Editar una solicitud **borra la materia destino**: `openEditar` llama a `onDestinoChange()`, que hace `patchValue({ materiaDestinoId: null })`, y al guardar se envía `null` (el backend lo interpreta como borrado) | `docente.component.ts:171-184`, `:147`, `:207` | No resetear el control al recargar la lista; omitir la clave si no cambió |
| I5 | El chat hace **polling cada 3 s aunque esté cerrado**, traga los errores, puede dejar respuestas fuera de orden y el error de envío queda **tapado por el propio modal** | `proyecto.component.ts:177-178`, `:201-213` | Arrancar/parar con `chatAbierto()`, `switchMap`/`takeUntilDestroyed`, parar tras N errores y mostrar el error dentro del modal |
| I6 | `rolDeInstitucion()` cae a **DESTINO** si falla `obtenerMia()` (su error se traga) → rol incorrecto **persistido** en el backend | `proyecto.component.ts:190-193`, `:364-369` | Bloquear el alta mientras `miInstitucionId()` sea null y avisar del error |
| I7 | Errores de carga silenciados → **estados vacíos falsos** ("Aún no has creado solicitudes…") sin opción de reintentar | `docente.component.ts:82-107`, `agente.component.ts:145-164` | Señal de error por pantalla con `extraerMensajeError` + botón "Reintentar" |
| I8 | **Modal sin foco inicial, sin trampa de foco, sin `Escape`, sin restaurar foco**, cierra al clic en el fondo (descarta el formulario) y usa `id="modal-title"` fijo | `modal.component.html:1-11`, `modal.component.ts:8-15` | Foco al abrir y al cerrar, ciclo de tabulación, `Escape`, id único y `@Input() cerrarConFondo` |
| I9 | El comentario **"obligatorio si rechazas" no se valida** en cliente aunque el backend lo exige → 400 tras el viaje | `agente.component.ts:134-138`, `:550-565` | Validador condicional o comprobación en `submitRevision` |
| I10 | Si **falla el correo, la invitación queda huérfana**: se crea antes de enviar y sin `try/catch`; el reintento responde 409 "espera a que caduque" → **7 días bloqueado** | `agentes.service.ts:79-89`, `mail.service.ts:25` | Compensar (borrar/expirar si falla) o añadir `enviadaEn` + reenvío; error legible |
| I11 | `JWT_SECRET` con **valor por defecto hardcodeado** (`?? 'dev-secret-inseguro'`): si falta la variable, se pueden forjar tokens | `auth.module.ts:11` | Validar al arrancar y abortar si falta; eliminar el fallback |
| I12 | Consumo de la invitación **no atómico** (TOCTOU): el `usadaEn` se lee fuera de la transacción → `P2002` → 500 | `auth.service.ts:186-198`, `:233-236` | `updateMany({ where: { id, usadaEn: null } })` y mapear `P2002` a 409 |

## 1.3 Menores

| # | Hallazgo | Arreglo |
| --- | --- | --- |
| m1 | `revisar` no es transaccional y `crearProyectoSiNoExiste` hace *check-then-create*: dos aprobaciones a la vez → `P2002` → 500 | `updateMany` condicionado + `$transaction` |
| m2 | No hay filtro global de excepciones de Prisma: `P2002`/`P2003`/`P2025` salen como 500 opacos | `ExceptionFilter` → 409/400/404 |
| m3 | `materias.eliminar` comprueba asignaciones pero **no** `solicitudesDestino` → 500 si la materia es materia destino de una solicitud | Contar también las solicitudes |
| m4 | Al cambiar `institucionDestinoId` sin reenviar la materia, la solicitud **conserva la materia de la institución anterior** | Poner `materiaDestinoId: null` o revalidar |
| m5 | `GET /auth/activate` sin `token` → `PrismaClientValidationError` → **500** | DTO de query con `@IsString() @IsNotEmpty()` |
| m6 | `GET /instituciones/:id/materias` es el único método **sin control de acceso** ni filtro `activa`/`registroCompleto` | Validar la institución destino |
| m7 | Faltan `@@unique` en `ASIGNACION_DOCENTE`, `DOCENTE_INSTITUCION` y `MATERIA(clave)` → duplicados por doble clic | Añadir índices + mapear `P2002` a 409 |
| m8 | `enableCors()` sin `origin`; sin `helmet` | Restringir a `FRONTEND_URL` |
| m9 | `POST /auth/login` y `/auth/activate` **sin límite de intentos** | `@nestjs/throttler` |
| m10 | `API_PREFIXES` en `main.ts` es una lista manual: un módulo nuevo haría que sus GET devolvieran `index.html` | Derivar del router |
| m11 | `http-error.util` devuelve solo el primer mensaje del array de validación | Unir los mensajes |
| m12 | Alerta de error de los paneles **sin `role="alert"`** (login/register/activate sí lo tienen) | Añadir el rol |
| m13 | Cualquier mutación del panel del agente **recarga las 6 fuentes** (parpadeo y formulario pisado) | Recargar solo el recurso afectado |
| m14 | Métodos **O(n²) en plantilla** (`asignacionesDeMateria()` dos veces por materia, `find` en bucles) | `computed()` con `Map` |
| m15 | `activate` ignora `valido` y nunca usa `numeroEmpleado` (señal muerta) | Usarlos o eliminarlos |
| m16 | **3 formatos de fecha** distintos y `toISOString()` en UTC → un `datetime-local` de las 23:00 se muestra al día siguiente | Un `FechaPipe` con `Intl` y extracción local de `yyyy-mm-dd` |
| m17 | Bucle de redirección si `rol === null` (login ↔ roleGuard) | Cerrar sesión y explicar |
| m18 | El aviso "Cuenta creada correctamente" **persiste tras un login fallido** | Limpiarlo en el error |
| m19 | `register` no pide confirmar contraseña y `dni`/`telefono` no tienen formato | Igualar a `activate` |
| m20 | Helpers y `API_URL` **duplicados** (×3 y ×6); andamiaje SSR inerte con `window` en ámbito de módulo | `core/utils` + `apiUrl()` perezoso |
| m21 | `.file-input` solo estiliza `::-webkit-file-upload-button` → en Firefox se ve el botón nativo | Estilizar `::file-selector-button` |

## 1.4 Lo que está bien

1. **Revalidación de la cuenta en cada petición** (`jwt-auth.guard.ts`): desactivar un docente surte
   efecto de inmediato; sin listas negras ni esperar la expiración del token.
2. **Estados centralizados y acotados** (`common/estados.ts` + `@IsIn`): cerrada la clase de bug
   "estados sin acotar".
3. **Autorización multi-tenant consistente**: `getAgente`/`getDocente` + filtros por institución en
   todos los servicios; la etapa de revisión se deduce de la institución del agente, no del cliente.
4. **Estado 100 % con signals y sin mutación en sitio** (verificado: no hay `.push`/`.splice`/
   `Object.assign` sobre señales), el único `setInterval` se limpia en `OnDestroy` y **el 100 % de
   los `@for` tienen `track`**.
5. **Guards que devuelven `UrlTree`** (no `navigate` + `false`), `roleGuard` factorizado e
   interceptor que centraliza el 401.

---

# Parte 2 — Análisis de diseño y disposición

## 2.1 Inventario del sistema visual

### Paleta
Hay **dos bloques `:root`** (`styles.css:5` y `:623`); el segundo ("REBRAND") sobreescribe al
primero, así que media paleta original es código muerto.

| Token | Valor vigente | Nota |
| --- | --- | --- |
| `--bg` / `--surface` | `#f5f7fa` / `#ffffff` | |
| `--text` / `--text-muted` | `#243447` / `#667085` | |
| `--accent` / `--accent-hover` / `--accent-deep` | `#0066aa` / `#004477` / `#003a66` | azul del logo CACE |
| `--secondary` | `#0066aa` | **idéntico a `--accent`**: el token perdió su significado (era `#167d8d`) |
| `--secondary-soft` | `#e6f1f9` | **casi idéntico** a `--accent-soft` `#e8f1fa` |
| `--danger` / `--success` / `--warning` | `#c0392b` / `#198754` / `#d99a00` | |
| `--warning-text` | `#7a5600` | convive con un `#8a6200` a mano para lo mismo |

**Drift real**: `rgba(30, 58, 95, .25)` (línea 344, sombra del botón primario) usa el **azul
anterior al rebrand**; `rgba(20, 42, 67, …)` aparece en el chat; hay **~31 valores `rgba` sueltos**
sin tokenizar y dos ámbares oscuros para la misma función.

### Tipografía
Pila del sistema (`system-ui…`), **sin fuente de marca** (la identidad cambia según el SO).
Escala real de 11 tamaños: `1.8rem` (stat) > `1.7rem` (hero) > `1.5rem` (h1) > `1.25rem` (h2) >
`1.05rem` > `1rem` > `0.95` > `0.9375` > `0.925` > `0.9` > `0.875` > `0.85` > `0.8125` > `0.78` >
`0.75` > `0.72` > `0.7rem`. **Hay seis tamaños por debajo de 13 px** y el dato decorativo
(`.stat-value`, 28.8 px) es **más grande que el título de la pantalla** (h1, 24 px).

### Espaciado, radios y sombras
La escala `--space-1..6` (4/8/12/16/24/32) **está bien usada** en las estructuras, pero hay
decenas de paddings en `rem` fuera de escala. **12 radios distintos** y 9 sombras sueltas además de
`--shadow-card`.

### Componentes
`.card`, `.btn` (+`-primary`/`-secondary`/`-outline`, **sin `-danger` ni `-ghost` ni `-sm` real**),
`.lista`/`.lista-item`, `.alert` ×4, `.estado`, `.stats`/`.stat`, `.meta-grid`, `.form-grid`,
`.form-inline`, `.reporte`, `.chat*` (12 clases), `.auth-*` (12), `.role-badge`, `.flag*`.
**No hay `.badge`, `.toast`, `.skeleton`, `.tabs`, `.stepper`, `.table`, `.tooltip` ni `.empty-state`.**

### Iconografía
**No hay sistema.** Mezcla de: 6 SVG en línea (ojo/ojo-tachado **copiado 6 veces**), glifos de
texto como iconos (`✕` del modal, `←`, `→`, `·`) y una única imagen (`logo-cace.png`).

### Estados
Carga = `Cargando…` o `.spinner`; vacío = una línea gris; error/éxito = `.alert` en línea.
**Sin skeletons, sin toasts y sin estados vacíos con acción.**

### Responsive
6 media queries (960/640/520 px + `prefers-reduced-motion`). `.content` sigue con
`max-width: 760px` **en cualquier resolución: en un monitor de 1920 px se usa el 40 % del ancho**.
Sin `@media print`.

### Banderas
`flagcdn.com/w40` pedidas a 40 px y pintadas a 22×16, 24×18 y 28×20 → **deformación del ratio en
casi todas**. 18 banderas en la tarjeta "Comunidad CACE" (duplicada en los dos paneles) con `alt`
completo cada una → ruido para lectores de pantalla, peso extra, CLS y dependencia de un CDN.

## 2.2 Contraste real (WCAG 2.x sobre los valores del CSS)

| Combinación | Ratio | Veredicto |
| --- | --- | --- |
| Texto principal / fondo | 11.81 | AAA |
| Enlace (`--accent`) / tarjeta | 6.03 | AA |
| Blanco sobre `--accent` (botón primario) | 6.03 | AA |
| Pill "pendiente" `#7a5600`/`#fcf4dd` | 6.05 | AA |
| `--warning` `#d99a00` como texto (regla muerta, línea 522) | **2.23** | ✘ |
| `--warning` como borde superior de KPI (necesita 3:1 de UI) | **2.45** | ✘ |
| Pill "rechazada" `#c0392b`/`#fbeae7` | 4.67 | AA (al límite) |
| `--text-muted` / `--bg` | 4.64 | AA (al límite) |
| `--text-muted` / `--hover` | **4.48** | ✘ falla por 0.02 |
| `--text-muted` / `--accent-soft` (`.reporte`) | **4.36** | ✘ |
| **Pill "Activo/Confirmado" `#198754`/`#e7f4ed`** | **4.00** | ✘ (texto de 12 px) |
| **Subtítulo de la topbar (blanco 75 % / `#0066aa`)** | **4.12** | ✘ |
| **Borde de input / tarjeta (`#d9e0e7`)** | **1.33** | ✘ necesita 3:1 (WCAG 1.4.11) |
| **Anillo de foco `rgba(0,102,170,.25)` aplanado** | **1.47** | ✘ necesita 3:1 |
| **`.btn-outline` blanco dentro de `.alert-success`** | **1.13** | ✘ **invisible** |
| **`.chat-toggle-badge` (blanco sobre blanco 25 %)** | **1.47** | ✘ **invisible** |

## 2.3 Bugs visuales confirmados (verificados en el código)

1. **El botón "Cerrar" de los avisos es invisible.** `agente.component.html:37` usa
   `<button class="btn btn-outline">` dentro de `.alert.alert-success`/`-error`; `.btn-outline` es
   texto y borde **blancos** (líneas 790-795) sobre fondo claro: **1.13:1 y 1.17:1**. Es el control
   que descarta el aviso.
2. **El contador del chat es ilegible**: `.chat-toggle-badge` es blanco sobre
   `rgba(255,255,255,.25)` → **1.47:1**.
3. **`[class.aprobada]` se aplica sin regla CSS**: las plantillas usan `[class.aprobada]`
   (`agente:299`, `docente:134`) pero `styles.css` **no define `.estado.aprobada`**, así que
   "Aprobada" cae al verde por defecto, **idéntico a "Activo"**. Lo mismo con `EN_CURSO` y
   `FINALIZADO` (ambos verdes) y con `CANCELADO`, que se pinta con la clase **`.rechazada`**
   (rojo de peligro): **"cancelado" se ve igual que "rechazado"**.
4. **Clases "hook" sin CSS**: `.welcome` y `.comunidad` se usan en las plantillas pero **no están
   definidas** (solo sus hijos `.welcome-*` y `.comunidad-note`). En cambio `.estado.cancelada`
   **está definida y no se usa** (junto con `.auth-shell`, `.auth-brand*`, `.center`,
   `.card-actions`, `.chat-contador`: CSS muerto).
5. **`.form-grid-actions` no tiene reglas propias**: solo existe `.form-grid .form-grid-actions`
   (línea 1434). Dentro de `.form-grid`, los botones heredan `width: 100%` y el contenedor **no es
   flex** → "Confirmar"/"Cancelar" salen apilados, a ancho completo y sin separación; fuera de
   `.form-grid` (modales de confirmación) quedan sin ningún estilo.

## 2.4 El CSS creció "por adición"

- `:root` **×2**, `.topbar` **×2**, `.estado` **×2** (y sus variantes), `.lista-item` **×2**,
  `.auth-card` **×2**, chips del logo **×3** (con un comentario ">>> AJUSTE MANUAL DE LA
  TRANSPARENCIA <<<" y alfas arbitrarios `0.655`/`0.297`), y **4 media queries `max-width: 520px`**
  + **3 de `640px`** repartidas por el fichero.
- **Regla frágil**: `.btn-primary { width: 100% }` global, con **cuatro** sobreescrituras para los
  casos en que no debe ocupar todo el ancho.
- **CSS de features en un solo fichero de 1497 líneas**: solo existen 3 CSS en todo `src`
  (`styles.css`, `modal.component.css` y `app.css`, que está **vacío**).

## 2.5 Problemas de disposición

**D1 — Todo es una columna apilada y la pantalla más larga no tiene navegación.** El detalle del
proyecto son **10 tarjetas** consecutivas (bienvenida, datos, docentes, planificación, reporte,
sesiones, actividades, evidencias, evaluación, cierre) sin pestañas, anclas ni índice: en escritorio
son **~3.000-4.000 px de scroll** y la única salida es "← Volver al panel". El panel del agente
tiene 7 tarjetas equivalentes.

**D2 — El ancho desaprovecha la pantalla**: `.content` a 760 px para todo. En 1440 px se pierde el
47 % del ancho, justo en listas clave-valor donde una segunda columna o una tabla ahorrarían scroll.

**D3 — Redundancia que empuja la acción fuera de pantalla**: la tarjeta "Comunidad CACE" (18
banderas + lema) está **en los dos paneles entre los KPIs y las listas accionables**, y el lema
"Uniendo mentes, corazones y proyectos" aparece hasta 3 veces en la misma pantalla.

**D4 — Densidad anidada en "Sesiones"**: un `li.lista-item` contiene un `.reporte`, que contiene una
`ul.lista` anidada de firmas y **otro formulario** dentro → 4 niveles de anidación, y como
`.lista-item` es `align-items: center`, los botones de la sesión quedan centrados frente a un bloque
enorme y se desalinean de su título.

**D5 — Registro largo y sin estructura**: 14 campos en una tarjeta, sin secciones ni pasos, con la
ayuda "Solo letras, sin números ni símbolos" repetida **6 veces** y el botón deshabilitado sin decir
qué falta. En móvil, `.row` pasa a columna y el formulario **duplica su altura**.

**D6 — Sin filtros, buscador ni "mostrar más"** en docentes, materias, solicitudes y proyectos; las
materias se pintan con todas sus asignaciones anidadas (crecimiento O(n·m)).

**D7 — Texto libre sin truncar** en las listas (`instrucciones`, `desarrolloClase`, `incidencias`),
sin `line-clamp` → alturas de fila impredecibles.

**D8 — Sin skeletons** (salto de layout), **sin toasts**, **sin estados vacíos con acción** (el
botón "Invitar docente" está 400 px más arriba del texto "Aún no hay docentes invitados") y **sin
`@media print`**, justo cuando los reportes son los entregables imprimibles.

**D9 — Modales destructivos con botón primario azul**: "Eliminar docente/materia/sesión" usan
`.btn-primary`, sin señal de peligro y sin que el foco arranque en "Cancelar".

**D10 — KPIs sin semántica**: como `--secondary` es idéntico a `--accent`, **tres de los cuatro
`.stat` del panel del agente salen del mismo azul**; el cuarto se distingue con un borde que incumple
el 3:1. Ningún KPI muestra variación, unidad ni es clicable hacia la lista que resume.

**D11 — Pantallas de acceso desequilibradas**: `.auth-layout` da el **42 % del ancho** al panel de
marca y fija `height: 100dvh` con scroll interno: los 14 campos del registro obligan a desplazarse
dentro de la tarjeta **sin ningún indicador de que hay más contenido**, mientras la mitad izquierda
queda vacía.

> **Fuera de alcance por decisión del proyecto**: el **modo oscuro**. Se retiró deliberadamente, así
> que no se propone en este informe ni aparece entre las mejoras sugeridas.

## 2.6 Accesibilidad

Además de los contrastes: **foco no conforme** (`input:focus` elimina el outline y lo sustituye por
un anillo de 1.47:1; no hay `.btn:focus-visible` global, así que conviven dos sistemas de foco);
**objetivos táctiles pequeños** (`.link-button` ≈21 px, botones de lista ≈32 px frente al mínimo de
24 px de WCAG 2.2); **errores de validación sin `aria-live`** ni `aria-describedby` a las ayudas;
**el color es el único canal** para distinguir estados; **sin `skip link`, `<nav>` ni
`aria-current`**. Bien: `lang="es"`, `aria-pressed` en los toggles de contraseña, `aria-hidden` en
todos los SVG decorativos, `aria-haspopup` en el FAB y `prefers-reduced-motion`.

---

# Parte 3 — Propuestas de elementos nuevos

Todas se pueden hacer **sin dependencias nuevas** salvo donde se indique. Detallo las tres palancas
principales y luego el resto en tabla.

## 3.1 Color y estados (la base de todo)

**Qué**: fusionar los dos `:root` en uno con capa semántica.

```css
:root {
  --accent: #0066aa; --accent-hover: #004477; --accent-deep: #003a66;
  --accent-soft: #e8f1fa;                /* se elimina --secondary-soft (duplicado) */
  --text-muted: #5b6675;                 /* 5.9:1 sobre --bg */
  --border: #d9e0e7;                     /* decorativo */
  --border-strong: #808b99;              /* 3.46:1 → inputs y .btn-secondary (WCAG 1.4.11) */
  --success: #0f6b41;                    /* el pill verde pasa de 4.00 a 5.80 */
  --warning-text: #7a5600;               /* un solo ámbar oscuro (se borra #8a6200) */
  --warning: #b8860b;                    /* solo bordes/iconos, nunca texto */
  --neutral-bg: #eef1f5; --neutral-text: #4b5565;   /* para CANCELADO / Desactivado */
  --focus: #004477;
  --ring: 0 0 0 3px rgba(0, 68, 119, 0.45);
}
input, select, .btn-secondary { border-color: var(--border-strong); }
:where(a, button, input, select, [tabindex]):focus-visible {
  outline: 2px solid var(--focus); outline-offset: 2px;
}
```

**Vocabulario de estados en un solo sitio**: un mapa
`estado → { etiqueta, variante, icono }` en un `estado.util.ts` compartido que alimente un
`<app-badge>` con **color + icono + texto** (resuelve a la vez el bug `.estado.aprobada`, la
confusión `CANCELADO`/`RECHAZADA` y las 3 copias de `estadoProyectoLabel`, y cumple WCAG 1.4.1 al no
depender solo del color).

## 3.2 Iconografía

**Qué**: sprite SVG + `<app-icon name="calendar" size="18">` (`<svg><use href="/icons.svg#id"/></svg>`).
Path data de **Lucide (ISC)** o **Feather (MIT)**: se copian solo los 15-20 iconos usados → **0 KB
de dependencia**. Sustituye los 6 SVG duplicados, el `✕` del modal y las flechas de texto `→`.

**Los 15 iconos que la app necesita**: `calendar`, `clock`, `users`, `user-plus`, `graduation-cap`,
`building-2`, `book-open`, `check-circle`, `circle-alert`, `triangle-alert`, `info`, `upload-cloud`,
`external-link`, `message-square`, `chevron-right`.
*(Alternativa: `lucide-angular`, ISC, tree-shakeable, ~1-2 KB por icono tras el build. Descartable:
Font Awesome, ~900 KB de fuente.)*

## 3.3 Calendario, fechas y **zona horaria**

Hoy hay 5 `<input type="date">`/`datetime-local` y dos listas planas. Tres piezas, **0 KB**:

1. **`app-date-field`**: mantener el input nativo (accesible y con selector en móvil) y añadir la
   fecha en formato largo (`Intl.DateTimeFormat('es')` → "vie 14 de marzo de 2025"), `min`/`max`
   derivados del proyecto y chips de atajo *Hoy · +7 días · +15 días*.
2. **`app-timezone-note` — la mejora de mayor valor por línea escrita.** En una plataforma entre dos
   países, hoy la sesión se muestra como `fecha · hora` **sin indicar la zona**. Mostrar la
   equivalencia: `10:00 (Ciudad de México) · 12:00 (Bogotá)`, con una tabla
   `paisCodigo → zona IANA` de 18 entradas y `Intl.DateTimeFormat('es', { timeZone })`. Los países
   ya están en `p.solicitud…institucion.pais`.
3. **`app-calendario-mes`** (vista de mes propia, CSS grid de 7 columnas, **de solo lectura**): es el
   mapa del proyecto, no un selector. Punto azul = sesión, ámbar = entrega, anillo verde = cierre,
   banda sombreada = ventana `[inicio, fin]`, y detalle al pulsar un día.
   ~120 líneas TS + ~90 CSS. *Si el tribunal pide un datepicker "de verdad": **flatpickr v4, MIT,
   ~16 KB gzip + 3 KB CSS**. No recomiendo Angular Material (arrastra el CDK y contradice el "sin
   librería de UI", que es parte del mérito del proyecto).*

## 3.4 Visualización de datos

| # | Qué | Dónde | Tipo | Técnica |
| --- | --- | --- | --- | --- |
| 1 | **Avance del proyecto** (5 hitos: planificación, confirmaciones, sesiones con reporte, evaluación, cierre) | cabecera del proyecto | anillo de progreso | `<circle>` con `stroke-dasharray`, ~40 líneas |
| 2 | **Línea de tiempo** de la clase espejo | bajo la cabecera | barras sobre banda temporal | `position: relative` + `left/width` en % |
| 3 | **Asistencia por sesión** (`totalAsistentes`) | tarjeta Sesiones | barras verticales | SVG `<rect>` + línea de media |
| 4 | **Cumplimiento** de actividades y evidencias | tarjeta Actividades | barras horizontales | CSS puro |
| 5 | **Estado de las solicitudes** (4 estados) | panel del agente | barra apilada + leyenda | CSS/SVG |
| 6 | **Evaluación origen vs destino** | tarjeta Evaluación | radar o barras agrupadas | **requiere antes** convertir `resultado` (hoy texto libre) en 3 criterios 1-5 |

**SVG a mano en lugar de librería**: con <30 puntos por gráfico aporta 0 KB, control total del tema
y accesibilidad (`role="img"` + `aria-label` + tabla oculta). Si se pide
interactividad real: **Chart.js v4 (MIT, ~70 KB gzip)** sobre un `<canvas>` del componente; ApexCharts
(MIT, ~135 KB) si priman las animaciones; ECharts descartable (~330 KB).

## 3.5 Resto de propuestas

| Propuesta | Por qué | Técnica |
| --- | --- | --- |
| **Stepper del ciclo de vida** (solicitud → revisión origen → revisión destino → planificación → sesiones → reportes → evaluación/cierre) | hoy los 4 estados del proyecto son un pill: no se ve qué falta | `<ol>` + conectores CSS, `aria-current="step"`, derivado de datos que ya existen |
| **Tabs del proyecto** (`?tab=sesiones` en la URL) | reduce 3.000 px de scroll a una pantalla | `role="tablist"/"tab"`, sincronizado con `queryParams` |
| **Toasts** (`ToastService`) | sustituye el `avisoPanel` y **elimina el bug del botón invisible**; libera la parte alta | `signal<Toast[]>`, `position: fixed`, `aria-live="polite"`, autoclose |
| **Skeletons** (línea, fila, KPI) | elimina el salto de layout | `linear-gradient` animado (`prefers-reduced-motion` ya existe) |
| **`app-empty-state`** con acción | convierte 9 callejones sin salida en el siguiente paso | icono + título + línea + slot de acción |
| **`.btn-danger`** + foco en "Cancelar" | "borrar sesión" hoy es del mismo azul que "guardar" | variante de color + `aria-describedby` |
| **Buscador + filtros + "mostrar más"** | las listas del agente no escalan | `signal` de búsqueda + `computed()` |
| **`app-avatar`** de iniciales | ya existe el patrón en el chat (`iniciales()`) | componente de 20 líneas con color por hash |
| **`app-topbar`** compartido + sticky | hoy está copiado 3 veces y no es fija en paneles largos | componente con `@Input`/`@Output` |
| **`@media print`** | los reportes se imprimen con topbar, FAB y sombras | `.topbar,.chat-toggle,.btn{display:none}` + `break-inside: avoid` |
| **Dropzone de evidencias** | hoy el `input type="file"` se ve distinto en Firefox y no da progreso | `label` con borde punteado + `UploadProgress` |
| **Tooltips** y área táctil ≥24 px | hoy la única pista es `title` y `.link-button` mide ~21 px | `[data-tooltip]` CSS + `min-height` |
| **Tablas responsivas** (docentes, materias) | en escritorio 3 columnas leen mejor | `<table>` + modo tarjeta con `td::before` |
| **Breadcrumbs** | da profundidad y una salida clara | `<nav aria-label="Ruta">` |

## 3.6 Quick wins (menos de una hora cada uno)

1. `.btn-outline` dentro de `.alert` → `.btn-secondary` o una acción oscura (**1.13:1 → visible**).
2. `.chat-toggle-badge`: fondo/texto `--accent-deep` (**1.47:1 → legible**).
3. `--border-strong: #808b99` en inputs y `.btn-secondary` (**1.33 → 3.46:1**).
4. Foco con `outline: 2px solid` en vez de solo `box-shadow` (**1.47 → 6.03:1**).
5. `.form-grid-actions { display: flex; gap: var(--space-3) }` + `.form-grid .btn { width: auto }`.
6. Borrar la regla muerta de la línea 522 (expone `#d99a00` como color de texto, 2.23:1).
7. `--success: #0f6b41` (**4.00 → 5.80**).
8. `role="alert"` en los 8 `.alert-error` que no lo tienen.
9. Un `FechaPipe` único con `Intl` en los tres componentes.
10. Área táctil de `.link-button` y de los botones de lista (WCAG 2.5.8).

---

# Parte 4 — Priorización

| # | Acción | Impacto | Esfuerzo |
| --- | --- | --- | --- |
| 1 | Ocultar `passwordHash` (fuga de datos) | **Alto** | Bajo |
| 2 | Filtrar tipos en evidencias + servir `/uploads` como adjunto | **Alto** | Medio |
| 3 | Excluir sesiones canceladas del cierre (I3) y `quitarDocente` sin 500 (I1) | **Alto** | Bajo |
| 4 | Arreglar el botón "Cerrar" invisible y el contador del chat | **Alto** | Bajo |
| 5 | Consolidar `:root`, borrar CSS muerto y arreglar la sombra con el navy viejo | **Alto** | Bajo |
| 6 | Foco visible conforme (outline 2 px) + `--border-strong` en inputs (1.33 → 3.46) | **Alto** | Bajo |
| 7 | `<app-badge>` + mapa único de estados (arregla `APROBADA`, `EN_CURSO`, `CANCELADO`) | **Alto** | Bajo |
| 8 | `FechaPipe` único en español | **Alto** | Bajo |
| 9 | Etiqueta de **zona horaria** en sesiones + equivalencia origen/destino | **Alto** | Bajo |
| 10 | Editar solicitud sin borrar la materia destino (I4) y validar el comentario de rechazo (I9) | **Alto** | Bajo |
| 11 | Stepper del ciclo de vida | **Alto** | Bajo |
| 12 | `app-empty-state` con acción (9 puntos) | **Alto** | Bajo |
| 13 | Toasts + skeletons | Medio | Bajo |
| 14 | `app-topbar` compartido, sticky, breadcrumbs y `@media print` | Medio | Bajo |
| 15 | Sprite de iconos + `app-icon` | **Alto** | Medio |
| 16 | `.content` a 1120 px y rejilla de 2 columnas en el detalle del proyecto | **Alto** | Medio |
| 17 | Tabs del proyecto con estado en la URL | **Alto** | Medio |
| 18 | Calendario de mes + `app-date-field` + `app-timezone-note` | **Alto** | Medio |
| 19 | Gráficos 1-5 (anillo, línea de tiempo, asistencia, cumplimiento, estados) | **Alto** | Medio |
| 20 | Modal accesible (foco, `Escape`, scroll lock, id único) | **Alto** | Medio |
| 21 | Invalidar firmas al editar el reporte (I2) e invitación atómica/con compensación | Medio | Bajo |
| 22 | Buscador y filtros en el agente; dropzone de evidencias | Medio | Medio |
| 23 | `JWT_SECRET` obligatorio, excepciones de Prisma, `@@unique`, CORS, *throttling* | Medio | Medio |
| 24 | Registro por pasos y tablas responsivas | Medio | Alto |
| 25 | Banderas locales con ratio correcto y `alt` decorativo | Medio | Medio |
| 26 | Dato estructurado de evaluación (3 criterios) + radar comparativo | Medio | Medio |

**Si solo se pudieran hacer tres cosas**: ocultar `passwordHash`, arreglar los dos bugs visuales
invisibles + el mapa de estados, y el **stepper con tabs y dos columnas** del detalle del proyecto.
Con eso se cierra la fuga de datos y el producto deja de parecer un formulario largo: que es
exactamente lo que se recuerda en una defensa de titulación.
