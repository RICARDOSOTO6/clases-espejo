# Plan de acción — presidente de la CACE, instituciones y certificados

> **Acordado el 10 de octubre de 2026.** Este documento **sustituye al orden de
> trabajo** que quedó al final de `docs/certificados-diseno.md`: une en un solo
> plan lo que falta de los certificados con todo lo del presidente de la CACE.
> Lo que ya está hecho sigue descrito en ese documento.

## 1. Decisiones cerradas

### El usuario presidente

| Tema | Decisión |
| --- | --- |
| Rol | **`PRESIDENTE_CACE`**, un tercer tipo de usuario |
| Cuántos | Uno. *(Pendiente de confirmar si habrá un suplente; hoy el diseño es de uno solo)* |
| Cómo se crea | **Sin inventar tokens nuevos**: al arrancar el servidor, si no existe un presidente y hay `PRESIDENTE_CORREO`, se le manda **una sola vez** el enlace de activación, reutilizando el flujo de activación que ya usan los docentes. Y un comando de mantenimiento para reintentar |
| Primer acceso | **Cambio de contraseña obligatorio** antes de usar el panel |
| Si no existe todavía | La plataforma **no se bloquea**. Solo las cosas que dependen de él (firma de certificados, personalización, premios) muestran «pendiente de configurar al presidente» |
| Permisos | Por **capacidades**, no por comparar el rol en cada sitio (hoy se compara `rol === 'AGENTE'` por todo el código, y con cuatro roles eso se vuelve inmanejable) |
| Secretarías | Rol **`SECRETARIA_CACE`** con permisos **fijos** (sin firma, sin veto) |
| Invitar agentes | **Descartado**: es redundante. El control se ejerce aprobando instituciones |
| Cuenta | Es la de más privilegio del sistema: contraseña larga y cambio en el primer acceso |

### Matriz de capacidades

| Capacidad | Presidente | Secretaría | Agente | Docente |
| --- | --- | --- | --- | --- |
| Aprobar, rechazar y vetar instituciones | ✅ | ❌ | ❌ | ❌ |
| Confirmar el alta de un agente en su institución | ❌ | ❌ | ✅ (la suya) | ❌ |
| Personalizar la CACE (logo, banderas, textos, tema) | ✅ | ✅ | ❌ | ❌ |
| Premios y reconocimientos | ✅ | ✅ | ❌ | ❌ |
| Diseñar la plantilla del certificado | ✅ | ❌ | ❌ | ❌ |
| Firmar y emitir certificados | ✅ | ❌ | ❌ | ❌ |

### Instituciones: registro, aprobación y veto

| Estado | Quién lo pone | Qué puede hacer la institución |
| --- | --- | --- |
| **Pendiente** | Se pone solo al registrarse | Entrar y **completar sus datos** (para que el presidente pueda evaluarla). Todo lo demás bloqueado: no aparece en el catálogo de destinos ni puede proponer ni recibir clases |
| **Aprobada** | El presidente | Todo lo normal |
| **Rechazada** | El presidente, con motivo | Nada. **El registro se conserva** para evitar el bucle de reinscripción, con un botón aparte de borrado definitivo para casos concretos |
| **Vetada** | El presidente, con motivo | Nada nuevo; sus clases en curso siguen vivas. **Se avisa**: la institución aparece marcada como vetada con su motivo y se notifica a su agente |

Decisiones de detalle ya acordadas:

- **Buscar antes de crear**: al registrarse, el agente busca su institución en la
  lista existente y **se une a ella** si ya está, en vez de duplicarla. Es la
  principal defensa contra la información basura.
- **Aviso de posible duplicado** al presidente cuando el nombre y el país se
  parecen a una institución ya aprobada.
- **Si la institución ya está aprobada**, el alta del agente nuevo la **confirma
  el propio agente** de esa institución. Si está pendiente o es nueva, decide el
  **presidente**.
- **Campos nuevos de identificación** (logo de la institución y otros datos que
  ayuden a reconocerla): aparecen en el paso «completar datos», que es el que se
  le pide al agente cuando su institución aún no está aprobada.
- **Avisos**: al presidente le llega a la campana (y por correo) que hay una
  institución por aprobar; al agente, el resultado (aprobada o el motivo del
  rechazo).
- **Estados independientes**: `activa` se queda para lo operativo (una
  institución aprobada pero sin agentes activos); el estado ante la CACE es otra
  cosa y el sistema tiene que poder decir **por qué** no se puede operar.

### Identidad de la CACE

- **Personalización** editable: logo, textos institucionales y **banderas de la
  comunidad** (hoy son una lista fija en el frontend, así que hay que llevarlas a
  la base de datos).
- **Colores**: 3 o 4 **temas predefinidos**, no color libre. Un color libre rompe
  el contraste y la accesibilidad (es justo el fallo que acabamos de arreglar con
  el botón invisible).
- **Premios y reconocimientos**: título, descripción, año, premiado, imagen,
  orden y publicado. Sección pública en *Comunidad* y, si se quiere, en la
  portada del acceso.

### Certificados (lo que ya estaba decidido)

Se emiten **al cerrar el curso**; plantilla **universal**; el certificado lleva
**solo el nombre** del alumno (la matrícula se guarda para distinguir homónimos);
lo **emiten los docentes** para sus alumnos; el presidente **diseña la plantilla
y la firma**; se puede **enviar por correo** a los alumnos. Detalles y descartes
(Word con marcadores, HTML con Chrome) en `docs/certificados-diseno.md`.

---

## 2. Plan de acción

Ordenado por dependencia y por valor para la demo. Lo hecho se marca ✅.

| Fase | Qué incluye | Entregables | Depende de |
| --- | --- | --- | --- |
| **0. Cimientos de permisos** | Rol `PRESIDENTE_CACE`, capacidades y su comprobación, alta automática del presidente al arrancar, cambio de contraseña obligatorio | Migración, servicio de capacidades, pantalla de primer acceso | — |
| **1. Listas de alumnos** ✅ | Subida en Excel/CSV/pegada, validación, vista previa editable y plantilla descargable | Hecho: tablas `LISTA_ALUMNOS` y `ALUMNO`, 5 endpoints y la sección «Alumnos» | — |
| **2. Instituciones: registro, aprobación y veto** | Los cuatro estados, buscar-antes-de-crear, campos nuevos (logo…), sección «Instituciones» en el panel del presidente, aprobar/rechazar/vetar con motivo, avisos a la campana y por correo, registro conservado + borrado definitivo | Migración de estado y campos, endpoints de gestión, pantalla del presidente, correos | Fase 0 |
| **3. Identidad de la CACE** | Personalización (logo, textos, banderas y temas), premios y reconocimientos con su sección pública | Tablas `ConfiguracionCace`, `PaisComunidad` y `Premio`, pantallas de edición, sección pública | Fase 0 |
| **4. Emisión de certificados** | Plantilla configurable por el presidente (fondo + posiciones), emisión individual y por lote en ZIP, con **fuente Unicode incrustada** para no mutilar nombres | Tablas `PlantillaCertificado` y `Certificado`, servicio de PDF, pantalla de emisión | Fases 0, 2 y 3 (la plantilla lleva el logo y la firma) |
| **5. Confianza y entrega** | Folio único con **verificación pública y QR**, inmutabilidad del PDF emitido y reemisión, y **envío por correo** a los alumnos | Página `/verificar/<folio>`, QR en el PDF, registro de envíos | Fase 4 |
| **6. Secretarías** | Rol `SECRETARIA_CACE` con permisos fijos | Migración, pantalla de alta, ajuste de la matriz | Fase 0 |

**Ruta corta para una demo** (si hay prisa): 0 → 2 → 3 → 4. Con eso el presidente
existe, controla quién entra, personaliza la CACE y emite certificados firmados.
Las fases 5 y 6 mejoran el resultado pero no bloquean la historia.

---

## 3. Decisiones cerradas el 10 de octubre (segunda ronda)

1. **Sí habrá presidente suplente**: el rol admite más de un usuario.
2. El **borrado definitivo** lo hace solo el presidente; la secretaría puede
   hacerlo **con una autorización del presidente** (queda como una solicitud que
   él aprueba).
3. El **veto se avisa solo a la institución afectada** (no es público).
4. Para las instituciones pendientes **basta la campana** del presidente.

## 4. Corrección importante del modelo de datos

Al empezar la fase 0 se comprobó que **`Usuario` no tiene columna `rol`**: el rol
es **relacional** (alguien es agente si tiene fila en `AGENTE`, docente si la
tiene en `DOCENTE`). Lo que decía antes este documento («`Usuario.rol` es un
String») era un error de lectura: la línea `rol String` que se citó es de
`PROYECTO_DOCENTE`, que es el papel del docente dentro de un proyecto.

Consecuencia para el diseño: el presidente **no** se añade como un texto en una
columna, sino como una tabla propia —**`MIEMBRO_CACE`**, con un campo `cargo`
(`PRESIDENTE`, `SUPLENTE`, `SECRETARIA`)—, igual que ya funcionan agentes y
docentes. El rol se deduce de la fila que tenga la persona, **el suplente sale
gratis** (dos filas) y no hay que migrar ninguna columna.

La **matriz de capacidades** (`backend/src/common/capacidades.ts`) y el guardia
`@Requiere(...)` + `CapacidadesGuard` ya están escritos y probados: resuelven el
rol por relación y comprueban la capacidad, que era justo lo que faltaba (el
informe decía «control por rol» y no existía ningún guardia de roles). Lo que
falta es la tabla `MIEMBRO_CACE` para que el presidente y la secretaría existan de
verdad.
