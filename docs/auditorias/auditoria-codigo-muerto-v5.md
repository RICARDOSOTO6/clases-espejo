# Auditoría de código muerto, duplicación y residuos (v5)

**Proyecto:** ClasesEspejo · **Fecha:** 2026-09-23 · **Commit auditado:** `51115a9` (*"La presidencia se transmite (no se borra) y las plantillas se pueden borrar"*) con cambios sin confirmar en `frontend/src/app/features/cace/**`, `layout.component.ts`, `app.routes.ts` y `styles.css` (auditados tal como están en disco).
**Alcance:** `backend/src` (15.531 líneas TS), `frontend/src` (27.100 líneas entre TS, HTML y CSS), `package.json` de ambos paquetes, y todo lo que git tiene versionado (532 archivos).
**Objetivo:** código muerto, funciones y métodos sin uso, exportaciones de más, ramas y cadenas muertas, CSS sin uso, duplicación, dependencias declaradas y nunca cargadas, y residuos (archivos obsoletos, duplicados binarios, comentarios, logs).

## Método (lo que se ejecutó, no lo que se supone)

| Comprobación | Herramienta | Resultado |
|---|---|---|
| Variables, imports y parámetros sin usar (backend) | ESLint 9 con `@typescript-eslint/no-unused-vars`, **sin `--fix`** | 2 hallazgos en 15.531 líneas |
| Exportaciones sin consumidores, archivos huérfanos, CSS sin uso, clases sin estilo, duplicación de bloques y de cuerpos, imports sin usar | 4 scripts propios en Node (sin dependencias): grafo de importaciones, índice de identificadores, hashes de cuerpos normalizados y ventanas de 15 líneas | ver hallazgos |
| Métodos de clase sin ninguna llamada | script propio sobre backend (servicios y utilidades) y frontend (servicios y componentes) | 1 falso positivo / 3 reales |
| Archivos duplicados byte a byte | MD5 de los 532 archivos versionados | 79 grupos, 3 relevantes |
| Código comentado y residuos | script propio con heurística de "línea comentada que parece instrucción" | 1 bloque (un ejemplo en un JSDoc) |
| Barrido dirigido del backend nuevo (CACE y certificados) y del frontend nuevo (CACE, editor de certificado, verificación, guía, layout) | dos auditorías de alcanzabilidad independientes, cruzadas con las anteriores | ver sección 6 |
| Enlaces del sistema de archivos | `Get-Item … LinkType`, `dir /AL` | 2 directorios de *junctions* versionados |

> **Corrección aplicada a mi propio método.** El primer pase de exportaciones comparaba cada símbolo contra **todo** el proyecto, así que un nombre repetido en el otro paquete (por ejemplo `MARGEN_SEGURO`, que existe en backend y en frontend) enmascaraba una exportación muerta. Repetí el pase **por paquete** y los números de la sección 3 son los corregidos: 10 muertas en el backend y 5 en el frontend (antes 9 y 2).

**No se modificó ningún archivo.** Los scripts de análisis viven en `.tmp-audit/` y se eliminaron al terminar.

---

# 1. Resumen ejecutivo

El código **no está podrido**: ESLint encuentra 2 variables sin usar en 15.531 líneas, **no hay ni un método de servicio del backend sin llamadas**, no hay `TODO`/`FIXME`, no hay bloques de código comentado y no hay archivos huérfanos reales. La suciedad está en otro sitio y se concentra en cuatro bolsas:

1. **Duplicación entre las dos pantallas grandes** (`agente` y `docente`): 203 líneas idénticas de plantilla (69,8 % de la menor) y 250 de TypeScript (56,2 %). Son ~450 líneas que se mantienen dos veces.
2. **CSS muerto**: 42 reglas que ya no pinta nadie (16 de ellas restos del rediseño de CACE).
3. **Residuo del repositorio**: 142 archivos duplicados por dos directorios de *junctions* que git siguió y versionó, más ~5,5 MB de documentos ofimáticos obsoletos (cuatro versiones del mismo informe) y tres scripts de un solo uso en la raíz.
4. **Cadenas muertas que esconden funciones sin efecto**: la señal `formularioInvitacion` y su rama en la guía no tienen consumidor, así que el paso "abrir el formulario de invitación" no abre nada.

Y una **dependencia declarada que nunca se carga**: `bootstrap` (532 KB en `node_modules`, ni una línea en el bundle).

| Categoría | Hallazgos | Eliminable | Esfuerzo |
|---|---|---|---|
| Duplicación | 9 | ~740 líneas a unificar | medio |
| Código muerto directo | 16 | ~250 líneas + 142 archivos | bajo |
| CSS | 3 | ~176 líneas (45 reglas) | bajo |
| Repositorio y dependencias | 5 | ~5,5 MB + 1 dependencia | bajo |
| Limpieza ya hecha | — | 0 TODO, 0 código comentado, 0 huérfanos | — |

En total: **~250 líneas se pueden borrar sin cambiar comportamiento** (≈176 de ellas CSS), otras **~740 están duplicadas** y piden consolidación, el árbol del repositorio puede adelgazar **~5,5 MB** más **142 archivos** que git guarda dos veces por culpa de dos *junctions*, y hay **una dependencia fantasma** y **~110 avisos de lint** que desaparecen tipando un único parámetro.

---

# 2. Duplicación

### CM-01 🟠 Las pantallas de agente y docente son en gran parte la misma

**Evidencia (medida, no estimada).** Comparando línea a línea (sin espacios, ignorando vacías):

```
agente.component.html (942 líneas útiles) vs docente.component.html (291)
  → 203 líneas idénticas = 69,8 % del menor
agente.component.ts   (895) vs docente.component.ts (445)
  → 250 líneas idénticas = 56,2 % del menor
```

Los bloques copiados son secciones completas: la cabecera con el aviso (`<main class="content">` + `@if (avisoPanel())`), la tarjeta "Recordatorios y próximos eventos" con su calendario y su contador, y la sección "Comunidad" con premios y banderas —`docente.component.html:118-169` y `agente.component.html:249-300` son **las mismas 52 líneas, sin una sola diferencia**—. El analizador encontró además **20 ventanas consecutivas de 15 líneas** idénticas repartidas por ambos archivos.

Y no es solo la plantilla: los mismos miembros están escritos dos veces con el mismo cuerpo.

| Miembro duplicado | Copias |
|---|---|
| `get banderaUrl()` | `docente.component.ts:134-138`, `agente.component.ts:125-129` |
| `get banderaAlt()` | `docente.component.ts:140-141`, `agente.component.ts:131-132` |
| `imagenDe(premio)` | **4**: `docente.component.ts:387`, `agente.component.ts:812`, `cace.component.ts:1814`, `login.component.ts:67` |
| `banderaUrl(codigo)` | `cace.component.ts:1558` (las otras pantallas lo replican en su propio `flagUrl`) |
| `paisesComunidad` / `premiosComunidad` / `lemaComunidad` | `docente.component.ts:122-126`, `agente.component.ts:187-191` |

**Qué hacer.** Extraer componentes compartidos (`app-recordatorios`, `app-premios`, `app-aviso-panel`) y quedarse con un solo componente de panel con `rol` de entrada. Es la limpieza con más retorno: cada arreglo en la agenda hay que hacerlo hoy dos veces (y ya pasó: los dos `cargarAgenda` son idénticos).

### CM-02 🟡 Funciones idénticas repetidas entre componentes

Cuerpos exactamente iguales (normalizados, ≥140 caracteres):

| Función | Copias | Ubicaciones |
|---|---|---|
| Los seis helpers `mensaje*` de CACE | **6 funciones, 62 líneas** | `cace.component.ts:482-488` (`mensajeDe`), `:705-716` (`mensajeMiembro`), `:763-777` (`mensajePresidente`), `:1366-1371` (`mensajePersonalizacion`), `:1546-1555` (`mensajePais`), `:1823-1834` (`mensajePremio`) |
| `estadoProyectoLabel` | **3** | `agente.component.ts:1271-1279`, `docente.component.ts:618-626`, `proyecto.component.ts:1718-1726` |
| `cargarAgenda` | **2** | `agente.component.ts:345-354`, `docente.component.ts:267-276` |
| `siguienteOrden` / `siguienteOrdenPremio` | **2** | `cace.component.ts:1541-1544`, `:1818-1821` (solo cambia la lista que recorren) |

Los seis `mensaje*` repiten el mismo esqueleto (`const control = this.formX.get(campo); if (!control || !control.touched || !control.errors) return null;` más el mapa de textos) y los mismos mensajes literales: "Este campo es obligatorio" aparece 4 veces, "Escribe al menos 2 caracteres" y "El texto es demasiado largo", 2 veces cada uno. Un único `mensajeDeControl(form, campo, mapa)` deja las 62 líneas en ~20. Las 27 líneas de `estadoProyectoLabel` deberían vivir en `core/constants/catalogos.ts`, y las 10 de `cargarAgenda`, en un servicio compartido.

### CM-03 🟡 `API_URL` copiada en los doce servicios

```
auth.service.ts:13   cace.service.ts:25   agentes.service.ts:10   verificacion.service.ts:6
proyectos.service.ts:22   solicitudes.service.ts:12   materias.service.ts:10
recordatorios.service.ts:6   listas-alumnos.service.ts:11
plantilla-certificado.service.ts:10   certificados.service.ts:10   instituciones.service.ts:7
```

Doce copias de `window.location.port === '4200' ? 'http://host:3000' : ''`, más la misma lógica otra vez en `core/utils/url-archivo.util.ts:12`. Además del ruido, es el sitio donde se rompe el renderizado en servidor (`window` en ámbito de módulo) y donde hay que tocar el día que cambie el puerto. Debería ser una constante única (`core/api-url.ts`) o un `HttpInterceptor` con `baseUrl`.

### CM-04 🟡 El mismo algoritmo de ajuste de texto, en backend y en frontend

`backend/src/certificados/certificado-pdf.service.ts:367` y `frontend/src/app/core/utils/certificado-medidas.ts:205` contienen el mismo fragmento (`const palabras = texto.split(/\s+/).filter(Boolean); if (palabras.length < 2) return null; let mejor: [string, string] | null = null; …`): el editor de plantillas del cliente y el generador de PDF del servidor parten las líneas con la misma heurística. Si una cambia, la vista previa y el PDF dejan de coincidir (que es justo lo que el editor promete evitar). Conviene decidir dónde vive la regla y compartirla por contrato (endpoint de medida) o duplicarla a conciencia con un comentario que lo advierta.

### CM-05 🟡 `clave` local frente a `claveLocal` exportada y muerta

`frontend/src/app/shared/components/calendario/calendario.component.ts:44` define `function clave(fecha: Date)` que hace exactamente lo mismo que `claveLocal` en `frontend/src/app/core/utils/fecha.util.ts:30` — y `claveLocal` no la usa nadie (ver CM-10). Sobra una de las dos: lo natural es borrar la local y quedarse con la utilidad compartida.

### CM-06 🟡 DTOs de registro y de activación que empiezan igual

`auth/dto/register.dto.ts:22-25` y `auth/dto/activate-account.dto.ts:6-9` comparten 15 líneas idénticas (`nombres`, `apellidoPaterno`, `apellidoMaterno` con `@IsString`/`@IsNotEmpty`/`@EsTextoValido`), y ambos repiten `tipoDocumento`/`dni`/`password`. Un `DatosPersonaDto` base del que hereden ahorra ~20 líneas y garantiza que las dos altas validen lo mismo (hoy ya divergen en el resto de campos).

### CM-07 🟡 Dos servicios de CACE con un cuarto de código idéntico

`backend/src/cace/miembros-cace.service.ts` (316 líneas útiles) e `instituciones-cace.service.ts` (487) comparten **75 líneas idénticas (23,7 % del menor)**: resolución de la presidencia, avisos por correo y consultas de instituciones. Son los dos servicios más nuevos del proyecto: conviene factorizar el helper común antes de que crezca una tercera copia.

### CM-08 🟢 Helpers triviales y copiados que solo delegan

`docente.component.ts:597`, `agente.component.ts:1267`, `proyecto.component.ts:1742` (`formatearFecha`) y `proyecto.component.ts:1747` (`aFechaInput`) son métodos de una línea que solo llaman a `fechaTexto` o `fechaLarga` de `core/utils/fecha.util.ts`. Funcionan, pero un `FechaPipe` (ya propuesto en la auditoría v3) elimina los cuatro y las 3.000 llamadas de plantilla dejan de depender del componente.

En el mismo saco, `proyecto.component.ts:1059-1066` y `:1604-1611` son dos copias del mismo helper "descargar blob" (`URL.createObjectURL` + `revokeObjectURL`): ~8 líneas que deberían ser una utilidad en `core/utils/`.

---

# 3. Código muerto verificable

### CM-09 🟡 Siete listas de estados exportadas y nunca usadas

`backend/src/common/estados.ts` exporta listas que **ningún archivo del proyecto menciona** (verificado con búsqueda global: solo aparece su definición):

| Línea | Constante |
|---|---|
| 9 | `ESTADOS_SOLICITUD` |
| 32 | `ETAPAS_REVISION` |
| 37 | `ESTADOS_PROYECTO` |
| 58 | `ESTADOS_REPORTE_CLASE` |
| 84 | `ESTADOS_CACE` |
| 101 | `ESTADOS_SOLICITUD_BORRADO` |
| 116 | `CARGOS_MIEMBRO_CACE` |

Los literales sueltos (`ESTADO_CACE_APROBADA`, `CARGO_SECRETARIA`…) **sí** se usan; las listas, no. Tienen pinta de haber nacido para un `@IsIn(...)` que nunca se escribió. Contraste: `ESTADOS_PLANIFICACION`, `ESTADOS_SESION` y `ESTADOS_PROYECTO_EDITABLES` sí los importan los DTO. Decisión: se borran (~49 líneas con sus JSDoc) o se usan en los DTO correspondientes.

### CM-10 🟡 Nueve funciones, constantes y tipos sin uso

| Ubicación | Qué | Nota |
|---|---|---|
| `backend/src/common/plazos.ts:88` | `urgenciaDeFecha()` | nadie la llama; sí se usan `urgenciaSegunDias` y `diasHasta` |
| `frontend/src/app/core/utils/fecha.util.ts:30` | `claveLocal()` | duplicada por la local de `calendario.component.ts` (CM-05) |
| `frontend/src/app/core/utils/fecha.util.ts:70` | `diasHastaFecha()` | 15 líneas; el frontend no calcula plazos (los manda el backend) |
| `frontend/src/app/core/utils/fecha.util.ts:87` | `diasHastaInstante()` | 20 líneas; junto a la anterior deja muerta también la constante `MS_DIA` (`:15`) |
| `frontend/src/app/core/utils/certificado-medidas.ts:25` | `const ALTO_PT` | `ANCHO_PT` sí se usa (`diseno-certificado.component.ts:521`) |
| `frontend/src/app/core/utils/certificado-medidas.ts:83` | `altoDeLineas()` | nadie la llama; la medición real la hacen `medirAncho` y `ajustarNombre` |
| `frontend/src/app/shared/components/layout/layout.component.ts:205-207` | `get capacidades()` | el `@Input() set capacidades` sí lo usa Angular (`cace.component.html:4`); el getter no lo lee nadie (`puedeVer` usa `capacidadesSenal()` directamente) |
| `backend/src/certificados/campos-certificado.ts:90` | `const MARGEN_SEGURO` | el frontend tiene su propia copia **y sí la usa** (`certificado-medidas.ts:49`) |
| `backend/src/certificados/campos-certificado.ts:240` | `MUESTRAS_POR_DEFECTO` | solo se lee en la rama inalcanzable de `:387` (ver CM-30) |
| `backend/src/certificados/certificados.service.ts:86` | `interface AlumnoSinCorreo` | ni siquiera se usa dentro de su archivo |

### CM-11 🟡 Las dos únicas variables que ESLint encuentra

```
backend/src/certificados/certificado-pdf.service.ts:147  'ETIQUETAS' is assigned a value but never used
backend/src/proyectos/resumen-pdf.service.ts:13          'VERDE' is assigned a value but never used
```

### CM-12 🟡 Tres métodos de servicio que nadie llama

| Ubicación | Método | Comentario |
|---|---|---|
| `frontend/src/app/core/services/cace.service.ts:96` | `obtenerConfiguracion()` | el panel escribe la configuración (`actualizarConfiguracion`, `subirLogo`) pero nunca la lee por aquí |
| `frontend/src/app/core/services/proyectos.service.ts:86` | `listarReportes()` | la pantalla usa `listarReportesClase()`; este método quedó del flujo antiguo |
| `frontend/src/app/core/services/ui-state.service.ts:80` | `atenderFormularioInvitacion()` | ver CM-15 |

### CM-13 🟡 Tres miembros de componente muertos

| Ubicación | Miembro | Prueba |
|---|---|---|
| `frontend/src/app/features/cace/cace.component.ts:85` | `private readonly route = inject(ActivatedRoute)` | `this.route` no aparece en el archivo ni en su plantilla (a diferencia de `verificacion`, `proyecto`, `activate` y `login`, que sí lo usan) |
| `frontend/src/app/features/cace/diseno-certificado/diseno-certificado.component.ts:231` | `readonly lienzoPorDefecto = LIENZO_POR_DEFECTO` | solo aparece en su declaración; el componente usa `LIENZO_POR_DEFECTO` importado directamente en `:426-432` |
| `frontend/src/app/features/docente/docente.component.ts:602` | `fechaLegible()` | solo aparece en su declaración; la plantilla usa `formatearFecha` |

*(Se descartaron como falsos positivos `onEscape`, `atraparFoco`, `alPulsarEscape`, `alAvanzar` y `alRetroceder`: los invoca Angular desde `@HostListener`.)*

### CM-14 🟡 Dos imports declarados y no usados (frontend)

```
frontend/src/app/shared/components/agenda/agenda.component.ts       formatearFechaLarga
frontend/src/app/shared/components/calendario/calendario.component.ts  horaTexto
```

### CM-15 🟠 Cadena muerta: el paso de la guía que abre la invitación no abre nada

Toda esta cadena existe y **ningún componente la lee**:

| Pieza | Ubicación |
|---|---|
| Señal `formularioInvitacion` | `core/services/ui-state.service.ts:66` |
| `solicitarFormularioInvitacion()` | `ui-state.service.ts:76-78` |
| `atenderFormularioInvitacion()` | `ui-state.service.ts:80-82` |
| Ramas `'abrir-invitacion'` / `'cerrar-invitacion'` | `shared/components/layout/layout.component.ts:830-833` y `:838` |
| Variantes del tipo | `core/constants/guia.ts:28-29` |

Búsqueda global de `formularioInvitacion`: aparece **solo** en esos cinco sitios; ningún componente de agente lee la señal. El paso de la guía "Empieza invitando a un docente" (`guia.ts:321`) describe que "se abre un formulario" y el mecanismo no lo abre (la respuesta del docente sí funciona: `formularioSolicitud` se consume en `docente.component.ts:99-103`).

**Qué hacer.** Decidir: o se conecta el componente del agente a la señal (y se borra `atenderFormularioInvitacion` o se usa como en docente), o se elimina la cadena completa (señal, 3 métodos, 2 ramas y 2 variantes del tipo). **No es solo limpieza: hoy hay una función prometida que no ocurre.**

### CM-16 🟢 79 exportaciones que solo se usan dentro de su archivo

43 en el backend y 36 en el frontend exportan símbolos que ningún otro archivo importa (y el frontend nunca importa del backend, así que el uso cruzado no las salva): tipos de retorno internos (`CertificadoVista`, `PlantillaVista`, `ResultadoVerificacion`, `PdfGenerado`, `JwtPayload`…), utilidades de módulo (`origenesConfigurados`, `hostsPermitidos`, `esLocalhost`, `normalizarCodigo`, `situacionCace`, `esRolValido`, `EXTENSIONES_IMAGEN`, `TAMANO_MAXIMO_IMAGEN`, `URGENCIAS`, `ROLES`, `CAPACIDADES`…) y modelos del cliente (`PlazoRevision`, `RevisionSolicitud`, `ChatUi`, `UsuarioResumen`, `ProyectoDocenteItem`, `OpcionTema`, `FilaLista`, `PersonaCambioPresidencia`, `CambioPresidenciaCace`, `AlineacionCertificado`, `EstadoVerificacion`…). No es código muerto, es superficie de API innecesaria: quitar `export` (~55 palabras) hace que el próximo lector sepa qué es contrato y qué es interno. El caso más claro es `certificado-medidas.ts`, que exporta 16 símbolos y solo usa sus funciones internamente: `INTERLINEADO`, `PASO_AJUSTE`, `ANCHO_MINIMO`, `ALTO_MINIMO`, `MARGEN_SEGURO`, `CajaCertificado`, `pxPorPunto`, `dentroDelLienzo`, `tocaMargenSeguro`, `fuenteCss`, `medirAncho`, `NombreAjustado`, `partirEnDos`, `luminancia`, `CONTRASTE_MINIMO` y `RevisionPlantilla`.

### CM-17 🟡 Doce campos de modelo que nadie lee (~20 líneas) — decisión del equipo

Búsqueda global (`.ts` + `.html`, sin `*.spec.ts`): cada uno aparece **una sola vez**, en su declaración. Ninguna plantilla los pinta y ningún servicio los lee.

| Archivo | Campos |
|---|---|
| `core/models/cace-miembros.models.ts` | `etiquetaRol` (20), `estadoInstitucion` (86), `motivoInstitucion` (87), `institucionBorrada` (100), `puedeResolver` (111), `puedeSolicitar` (113), `suplentes` (150) |
| `core/models/certificado.models.ts` | `hashSha256` (124), `codigoVerificacion` (132), `estadoProyecto` (138), `reemitidos` (172), `enviados` (188-194) |
| `core/models/cace-identidad.models.ts` | `actualizadoEn` (33, 59) |

**Advertencia:** son el espejo del contrato del backend, así que borrarlos pierde el tipado el día que se quieran usar. Lo que sí sobra sin discusión es lo sustituido por un diseño posterior: `puedeResolver` y `puedeSolicitar` (los reemplaza `puede('resolverSolicitudesBorrado')`, `cace.component.ts:1095`), `institucionBorrada` y `suplentes` (el flujo de presidencia usa `miembros()`).

---

# 4. CSS muerto y estilos perdidos

### CM-18 🟠 16 reglas muertas en el CSS de CACE (restos del rediseño) — ~121 líneas

`frontend/src/app/features/cace/cace.component.css` define y nadie usa:

| Clase(s) | Líneas | Qué usa la plantilla en su lugar |
|---|---|---|
| `.personalizacion-grid` + su `@media` | 34-39, 41-45 | `personalizacion-layout` / `personalizacion-form` (`html:1181-1182`) |
| `.temas`, `.temas legend` | 49-53, 55-61 | `temas-grid` (`html:1211`) |
| `.tema-opcion`, `:hover`, `.tema-muestra`, `.tema-texto` | 63-76, 78-84, 86-89 | `tema-card*` (`html:1215-1223`) |
| `.logo-vista` | 97-106 | `logo-caja` (`html:1232`) |
| `.premio-bloque`, `.premio-cabecera`, `.premio-imagen` | 245-247, 249-254, 256-262 | `premio-fila` / `premio-thumb-caja` / `premio-info` (`html:1634-1643`) |
| `.cace-pantalla .premio-card .btn` | 342 | `premio-card` no existe en la plantilla |
| `.miembro-identidad`, `.miembro-fila` | 504-509, 511-516 | `miembro-avatar` + `inst-name` (`html:482-486`) |
| `.premios-grid`, `.premio-card`, `.premio-card-head`, `.premio-thumb`, `.premio-card-acciones` | 518-554 | `ul.premios-lista` + `li.premio-fila` (`html:1632-1634`) |

Dos trampas al buscarlas: **`.temas` y `.premio-thumb` no se detectan con una búsqueda por palabra suelta** (la primera coincide con la propiedad `readonly temas = TEMAS_CACE` del TS y la segunda es subcadena de `premio-thumb-caja`); hay que buscarlas como *token de clase*. Y **no hay que borrar** `.estado.vetada` (25-28), `.switch`, `.lista-miembros`, `.grid-4`, `.ayuda*`, `.cace-breadcrumb`, `.pais-*`, `.vista-*` ni `.zoom`: se construyen desde el TS (`claseEstado()` devuelve `'estado vetada'`, `'estado pendiente'`…).

### CM-19 🟡 24 clases muertas en `styles.css`

```
text-aux (la clase; la variable --text-aux sí se usa), text-caption, is-muted,
card-actions, card--elevated,
grupo-head, grupo-pendiente, grupo-aceptada, grupo-rechazada, grupo-activo,
grupo-finalizado, grupo-cancelado
```

Las reglas `.grupo-pendiente .grupo-dot` y compañía esperan un contenedor con esa clase que ninguna plantilla pinta (el agente usa `grupo-dot` y `grupo-count` sueltos). ~55 líneas.

**Descartados tras verificar que se construyen dinámicamente** (no son código muerto): `urgencia--vencida|critica|proxima|normal` (`urgencia.util.ts:23` las arma con `'urgencia--' + …`), `salud-resumen--*`, `salud-mensaje--*`, `icono--ok|aviso|grave` (`diseno-certificado.component.html:427,472,649,682` usan `[class]="'icono icono--' + …"`) y `alert-` (mi analizador lo leyó de un **comentario** de `styles.css:3638`).

### CM-20 🟡 Ocho clases usadas en plantilla que no existen en ningún CSS

`welcome`, `comunidad` (agente y docente), `inst-logo` (registro), `columna` (editor de certificado, `diseno-certificado.component.html:12,238,411`), `caja--qr` (`:315`; el CSS define `.caja-qr`, no `.caja--qr`, así que el binding no aplica nada), `welcome-actions` (proyecto), `guia-siguiente` (guía), `perfil-identidad` (layout `:329`). No es código muerto: es el espejo del problema — se escribió la plantilla esperando un estilo que nunca se definió (o se perdió en el rediseño). Conviene decidir en cada caso si falta el estilo o sobra la clase.

**No es un error y no hay que "arreglarlo":** `guia-siguiente` (`guia.component.html:39`) es un gancho de JavaScript, no una clase de estilo: `guia.component.ts:261` hace `querySelector('.guia-siguiente')` para mover el foco.

---

# 5. Dependencias y repositorio

### CM-21 🟡 `bootstrap` está declarada y nunca se carga

`frontend/package.json:24` declara `bootstrap: ^5.3.8`. No se importa en ningún archivo de `src`, **no está en `angular.json`** (`styles` solo lista `src/styles.css`, verificado) y no hay CDN en `index.html`. El diseño propio vive en `styles.css` (4.521 líneas). Es una dependencia fantasma de ~532 KB en `node_modules` y una trampa para el próximo que lea el `package.json`.

**Requieren juicio (no las borres sin comprobar):** `@prisma/client` **sí** se usa (el cliente generado importa `@prisma/client/runtime/library`, 37 referencias en `backend/generated/prisma`), `reflect-metadata` no se importa en `src` pero `@nestjs/core` la necesita en tiempo de ejecución, y `@angular/platform-server`, `tslib`, `vitest`, `jsdom`, `@types/*`, `eslint*`, `jest`, `ts-*` y `prettier` son herramientas que se usan desde la CLI o desde la configuración, no desde `src`.

### CM-22 🟠 142 archivos duplicados en git por dos directorios de *junctions*

`backend/.claude/skills/*` y `backend/.windsurf/skills/*` no son copias: son **junctions** de Windows que apuntan a `backend/.agents/skills/*`.

```
backend\.claude\skills\prisma-cli    Attributes=Directory, ReparsePoint  LinkType=Junction
                                     Target=…\backend\.agents\skills\prisma-cli
backend\.windsurf\skills\prisma-cli  idem
```

Git no sigue enlaces simbólicos, pero **sí atraviesa junctions**: versiona 71 archivos en cada una de las tres rutas (213 archivos, ~900 KB) cuando solo existe un contenido. Son **142 archivos redundantes** y ~600 KB de objetos repetidos, más el riesgo real de que alguien edite la copia "equivocada" o de que la próxima herramienta que instale skills vuelva a duplicar. **Qué hacer:** quedarse con `.agents/skills`, borrar del índice las otras dos rutas (`git rm -r --cached`), añadirlas a `.gitignore` y recrear las junctions (que siguen haciendo su trabajo en disco). *(También: `.agents/skills` no lo lee DSH, porque la raíz de proyecto es la del `.git` y las skills del arnés viven en `ClasesEspejo/.dsh/skills`; son para las herramientas de IA que las instalaron.)*

### CM-23 🟠 Documentación y utilidades obsoletas versionadas (~5,5 MB)

```
1491 KB  Informe_Tecnico_Clases_Espejo_corregido.docx
1257 KB  Informe_Tecnico_Clases_Espejo_v4.docx
1257 KB  Informe_Tecnico_Clases_Espejo_v3.docx
1256 KB  Informe_Tecnico_Clases_Espejo_v2.docx
 416 KB  borradores no importante/Informe_Tecnico_Clases_Espejo.docx
  33 KB  generar_informe.py        (raíz, script de un solo uso)
  19 KB  corregir_informe.py       (raíz, escribe un .docx fuera del repo)
   4 KB  contraste-certificado.py  (raíz)
```

Cuatro versiones sucesivas del **mismo** informe técnico más una carpeta llamada literalmente "borradores no importante", todas versionadas. El repositorio pesa 18,7 MB y solo estos documentos son ~5,5 MB (el 30 %). Además, los tres `.py` de la raíz son herramientas de un solo uso que escriben en `C:\Users\ricar\Documents\` y no están documentadas en ninguna parte (`grep` en `docs/`: sin referencias). El historial de git no se adelgaza borrándolos (habría que reescribirlo), pero el árbol sí.

### CM-24 🟡 Assets duplicados byte a byte

| Archivos | Tamaño |
|---|---|
| `docs/logos/ChatGPT Image 9 sept 2026, 03_13_37 p.m..png` == `frontend/public/logo-cace.png` | 532 KB |
| `backend/plantillas/certificado-zonas.png` == `docs/plantillas/certificado-zonas.png` | 236 KB |
| `backend/plantillas/plantilla-lista-alumnos.xlsx` == `docs/plantillas/plantilla-lista-alumnos.xlsx` | 7 KB |

El primero es el más llamativo: el logo real que sirve la aplicación y su copia con el nombre que le puso la herramienta que lo generó, versionados los dos (y `docs/logos/` no lo referencia ningún documento). Dejar una sola copia y un nombre humano.

### CM-25 🟢 `multer.d.ts` no es huérfano (falso positivo documentado)

`backend/src/multer.d.ts` es el único archivo que nadie importa, pero **no debe borrarse**: es una declaración global de tipos que el compilador carga por el `include` del `tsconfig`. Lo anoto para que no aparezca en la próxima lista de "archivos sin usar".

---

# 6. Hallazgos del backend nuevo (CACE y certificados)

Un barrido dirigido sobre los módulos recién añadidos (9.100 líneas: `cace/`, `certificados/`, `listas-alumnos`, `resumen-pdf` y los helpers de `common/`) encontró la mayor concentración de duplicación del proyecto. Todo lo de esta sección está verificado con censo de identificadores sobre los 122 archivos de `backend/src`.

### CM-26 🟠 Tres constructores de multer para lo mismo (~46 líneas)

`backend/src/common/imagenes.ts:28-53` define `opcionesImagen(carpeta, prefijo)`, y su propia cabecera dice para qué existe: *"para que la próxima carpeta de imágenes no se deje una puerta abierta por descuido"*. La usan `plantillas.controller.ts:96` e `identidad-cace.controller.ts:77,160`. Pero dos carpetas se quedaron con su copia a mano:

| Copia | Ubicación | Qué repite |
|---|---|---|
| `LOGO_MULTER` | `instituciones/instituciones.controller.ts:27-52` | `diskStorage` + nombre aleatorio + `2 * 1024 * 1024` + la misma lista `.png/.jpg/.jpeg/.webp` |
| `FOTO_MULTER` | `usuarios/usuarios.controller.ts:22-44` | idéntico |

Tres definiciones del mismo límite (`imagenes.ts:21`, `instituciones:28`, `usuarios:24`) es exactamente la "puerta abierta por descuido" que el helper quería evitar: el día que se cambie el tamaño máximo, dos carpetas seguirán con el viejo. **Matiz:** no son idénticos byte a byte (cambian el prefijo del nombre y el mensaje de error, "El logo debe ser…" / "La foto debe ser…"), así que unificar cambia esos dos textos.

### CM-27 🟠 Dos helpers para "la URL pública", con variable y puerto distintos

| Helper | Variable | Valor por defecto | Consumidores |
|---|---|---|---|
| `common/url-publica.ts:51` `resolverUrlPublica(peticion?)` | `FRONTEND_URL` | `http://localhost:4200`, y **sabe deducir el origen del proxy** (`X-Forwarded-Host`) | 14 llamadas (invitaciones, altas, CACE) |
| `certificados/rutas-certificado.ts:33` `urlPublica()` | `URL_PUBLICA` | `http://localhost:3000`, sin mirar cabeceras | solo `direccionVerificacion` (`:53`) |

**Consecuencia, no estilo:** el enlace del QR de un certificado y el de los correos institucionales pueden apuntar a hosts distintos, y el QR ignora el túnel. En este despliegue `backend/.env` tiene `FRONTEND_URL="http://localhost:4200"` y `URL_PUBLICA="http://localhost:3000"`, así que **el QR impreso en cada certificado apunta a `localhost:3000`**: en el móvil del alumno no abre (los correos, en cambio, salen con la dirección del túnel porque usan el helper que sí mira las cabeceras). Está documentado en `docs/certificados-diseno.md:168-169`, pero son dos variables para el mismo concepto y solo una es consciente del proxy. ~20 líneas.

### CM-28 🟡 Ocho copias de dos helpers, cuatro del mismo `select` y otros tantos mapas

| Duplicado | Copias | Ubicaciones |
|---|---|---|
| `private mensajeDe(error)` | **4 idénticas** | `cace.service.ts:172`, `instituciones-cace.service.ts:679`, `miembros-cace.service.ts:429`, `presidencia-cace.service.ts:540` |
| `private nombreCompleto(usuario)` | **4** (+2 inline) | `instituciones-cace.service.ts:668`, `miembros-cace.service.ts:421`, `presidencia-cace.service.ts:532`, `solicitudes-borrado.service.ts:418`; inline en `presidencia:191` y `miembros:108` |
| `usuario: { select: { …7 campos… } }` | **4** (36 líneas) | `miembros-cace.service.ts:68-78`, `:159-169`, `:227-237`, `:329-339`, todos alimentando `aFila`, cuya firma exige exactamente esos 7 campos |
| `esDocenteParticipante(proyectoId, usuarioId)` | **3** | `certificados.service.ts:880-909`, `listas-alumnos.service.ts:470-497`, `proyectos/guards/docente-participante.guard.ts:24-37` |
| Mapa de etiquetas de estado del proyecto | **2** | `certificados.service.ts:48-53` y `resumen-pdf.service.ts:49-63` (4 claves comunes, distinta capitalización) |
| Prefijo `normalize('NFD').replace(/[\u0300-\u036f]/g,'')` | **3** | `instituciones-cace.service.ts:631`, `listas-alumnos.service.ts:67`, `certificados.service.ts:1044` |

≈**80 líneas** que se reducen a tres o cuatro helpers compartidos en `common/`. El `nombreCompleto` es el caso más claro: cinco implementaciones del mismo `nombres + apellidoPaterno + apellidoMaterno`.

### CM-29 🟡 Columnas y campos que se piden y nunca se leen (~11 líneas)

| Dónde | Qué sobra |
|---|---|
| `instituciones-cace.service.ts:86-125` | selecciona `codigoPais`, `estado`, `ciudad`, `telefono`, `correoInstitucional`, `activa`, `registroCompleto`, `creadoEn` y **ninguno se lee**: `aPanel` (`:525-580`) solo usa 9 campos y su firma ni los declara |
| `instituciones-cace.service.ts:432` | `agentes.cargo` — `avisarPorCorreo` solo hace `.map(a => a.usuario.correo)` |
| `instituciones-cace.service.ts:234-236` | `contarHistoria` devuelve `{ bloqueos, usuarios }`; el único llamador (`:213-214`) lee solo `.bloqueos` |
| `certificados.service.ts:70,1036` | `CertificadoVista.archivoPdf` se rellena y **nadie lo lee** (0 apariciones en el frontend); además expone el nombre del fichero del servidor |
| `plantillas.service.ts:299-302` + `schema.prisma:513` | `textosLegales: []` se escribe siempre vacío y **nunca se lee** (el diseño lleva los textos dentro de la imagen) |
| `certificado-pdf.service.ts:114` | `alumno.matricula` se declara y el llamador la rellena (`certificados.service.ts:772`), pero el PDF **nunca imprime la matrícula** |
| `certificado-pdf.service.ts:489-504` | `aPuntos` devuelve `tamano` y `color` que no usa nadie (los 11 usos de `caja.` son `x/y/ancho/alto`; el color sale de `campo`) |

### CM-30 🟡 Ramas redundantes o inalcanzables (~5 líneas)

| Dónde | Por qué |
|---|---|
| `listas-alumnos.service.ts:337` | `if (!hayEncabezado && indiceMatricula === 1)`: `indiceMatricula` se inicializa en `1` (`:257`) y solo cambia dentro de `if (hayEncabezado)` (`:261-265`), así que la segunda mitad es siempre cierta cuando se evalúa la primera |
| `certificados.service.ts:768` | `if (!proyecto) throw …` es inalcanzable: el único llamador (`:315`) ya lo comprobó con el mismo mensaje en `:251`. Se puede borrar solo si la firma deja de admitir `null` (hoy también sirve para estrechar el tipo) |
| `campos-certificado.ts:383,387` | `anterior.cursiva ?? false` y `anterior.muestra ?? MUESTRAS_POR_DEFECTO[clave]`: `anterior` siempre trae esos campos por tipo, así que la rama derecha es muerta (y es la única razón por la que `MUESTRAS_POR_DEFECTO` existe) |
| `presidencia-cace.service.ts:201` | `entranteUsuarioId !== null && entranteUsuarioId === saliente.usuarioId`: si son iguales y `saliente.usuarioId` es `number`, la primera mitad sobra |

### CM-31 🟢 El `any` que apaga el tipado y produce ~110 avisos

`backend/src/proyectos/resumen-pdf.service.ts:71` — `async generar(proyecto: any): Promise<Buffer>`. Su único llamador (`proyectos.controller.ts:112`) le pasa el resultado tipado de `includeProyectoCompleto()`, así que el `any` no compra nada: es la causa de ~110 de los 117 avisos `no-unsafe-member-access` / `no-unsafe-call` de ese archivo. No es borrado, es tipado (y el `doc: any` de `certificado-pdf.service.ts` en 13 firmas **sí** es pragmático: `pdfkit` no publica tipos utilizables para ese uso).

### Negativo relevante de este barrido

**Los 12 métodos de `MailService` tienen exactamente un llamador** (`sendInvitation`←agentes, `sendCredencialesPresidente`←cace, `sendCredencialesSecretaria`←miembros-cace, `sendCambioPresidencia*`←presidencia-cace, `sendInstitucion*`←instituciones-cace, `sendAltaAgente*`←auth/agentes, `sendCertificadoAlumno`←certificados): **ninguno muerto**, y el servicio creció de 45 a 378 líneas sin dejar residuos. Tampoco hay archivos huérfanos en el ámbito (`resumen-pdf.service.ts` lo importan el controlador y el módulo; `rutas-certificado.ts`, cuatro archivos; `credenciales-cace.ts`, tres) ni imports sin usar, ni código comentado, ni `console.*`, `TODO` o `FIXME`.

---

# 7. Lo que ya está limpio (verificado, no lo toques)

- **ESLint sobre 15.531 líneas de backend: 2 hallazgos** (`ETIQUETAS` y `VERDE`). No hay imports ni parámetros muertos.
- **Ningún método de servicio del backend sin llamadas**: revisé todas las clases de `backend/src` (servicios, utilidades, guardias) y no hay ni una función privada o pública huérfana. Los controladores quedaron fuera a propósito (los llama el framework).
- **Frontend: 4 miembros muertos sobre 449 declarados** en las cinco pantallas grandes (`cace`, `diseno-certificado`, `verificacion`, `guia`, `layout`). Y los candidatos que una búsqueda ingenua señala como muertos están vivos, invocados dentro del propio archivo: `cargarSegunCapacidades` (`cace:556`, llamado en `:543`), `cargarIdentidad` (`:1203`, en `:571`), `siguienteOrden` (`:1541`, en `:1402`), `siguienteOrdenPremio` (`:1818`, en `:1596`), `nombreLargoDisponible` (`diseno:333`, en `:713`) y `gravesPorVersion` (`:425`, en `:447`).
- **Cero `TODO`, `FIXME`, `HACK` o `XXX`** en todo el proyecto (backend y frontend).
- **Cero bloques de código comentado**: el único acierto de la heurística es un ejemplo de uso dentro de un JSDoc (`backend/src/auth/capacidades.guard.ts:18-19`); los nueve comentarios HTML largos del frontend son documentación en prosa.
- **Un solo `console.log`**, y es legítimo: el arranque del servidor SSR (`frontend/src/server.ts:61`). Cero `console.*` en `frontend/src/app`.
- **Sin plantillas muertas**: ningún `@if` con condición constante ni `@else` inalcanzable; los 12 `input()` y 8 `output()` de `diseno-certificado` los enlaza su padre (`cace.component.html:1836-1857`) y las condiciones por rol del layout son alcanzables por los cuatro roles que lo usan.
- **Sin componentes importados de más**: los `imports: []` de los componentes standalone coinciden con lo que usan sus plantillas.
- **Sin archivos huérfanos** salvo el `.d.ts` global (CM-25): en el backend nuevo, `resumen-pdf.service.ts` lo importan el controlador y el módulo, `rutas-certificado.ts` cuatro archivos y `credenciales-cace.ts` tres.
- **Los 12 métodos de `MailService` tienen llamador** y los métodos públicos del panel CACE también: el crecimiento del backend (de 5.397 a 15.531 líneas) no dejó funciones sueltas.
- **CSS limpio en `diseno-certificado.component.css` y `verificacion.component.css`**: cero clases sin uso.
- **Los assets del cliente se usan**: `favicon.ico` (`index.html:8`) y `logo-cace.png` (registro, activación y panel CACE).

---

# 8. Plan de limpieza sugerido

| Orden | Qué | Ahorro | Riesgo |
|---|---|---|---|
| 1 | **CM-15**: decidir si el paso de la guía se arregla o se borra la cadena | ~40 líneas o una función | bajo, pero es una decisión de producto |
| 2 | **CM-22**: sacar del índice las dos rutas de *junctions* y dejarlas en `.gitignore` | 142 archivos (~600 KB) | bajo (las junctions siguen en disco) |
| 3 | **CM-23**: mover los informes a `docs/informes/` (o al `.gitignore`) y los `.py` a `scripts/` | ~5,5 MB del árbol | ninguno para el código |
| 4 | **CM-09, CM-10, CM-11, CM-12, CM-13, CM-14, CM-17, CM-29, CM-30**: borrado directo (listas y símbolos muertos, variables, métodos, miembros, imports, columnas que no se leen, ramas redundantes) | ~200 líneas | bajo |
| 5 | **CM-18 y CM-19**: borrar las 45 reglas CSS muertas | ~176 líneas | bajo (verificar CACE en pantalla) |
| 6 | **CM-28**: tres helpers compartidos para `mensajeDe`, `nombreCompleto` y el `select` de usuario del CACE | ~80 líneas | bajo |
| 7 | **CM-26**: migrar `instituciones` y `usuarios` a `opcionesImagen` | ~46 líneas | bajo (cambia dos mensajes de error) |
| 8 | **CM-27**: unificar la URL pública (o documentar `URL_PUBLICA` en la guía de despliegue) | ~20 líneas | **medio**: el QR de los certificados cambia de destino |
| 9 | **CM-01, CM-02 y CM-08**: componentes compartidos de `agente`/`docente` y un `FechaPipe` | ~600 líneas a unificar | **medio** (cambia plantillas; hacerlo con pruebas) |
| 10 | **CM-03, CM-05, CM-06, CM-07**: constantes y helpers únicos (`api-url`, `claveLocal`, DTO base, helper CACE) | ~120 líneas | bajo |
| 11 | **CM-21, CM-16 y CM-31**: quitar `bootstrap`, quitar los `export` de más y tipar `generar(proyecto)` | 1 dependencia, ~110 avisos de lint | bajo |

**Antes de borrar cualquier cosa:** `npm run build` en `backend/` y `ng build` en `frontend/` (el `strictTemplates` de Angular detecta plantillas rotas), y `npm test`. Ninguna de las eliminaciones propuestas en los puntos 2-5 y 8 puede romper la compilación si se hacen con el buscador del IDE; las de los puntos 1 y 6 sí tocan comportamiento visible.

---

*Auditoría de solo lectura sobre el commit `51115a9` más los cambios sin confirmar en `frontend/src/app/features/cace/**`, `layout.component.ts`, `app.routes.ts` y `styles.css`. Cada hallazgo se comprobó con búsqueda global o medición; los falsos positivos descartados se indican en el texto (CSS dinámico, `@HostListener`, `.d.ts` global, dependencias de herramienta).*
