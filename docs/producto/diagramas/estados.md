# 🔄 Diagrama de estados del sistema

Este documento reúne los **estados** de cada elemento del dominio y las
transiciones permitidas. Es la referencia visual de qué puede pasar de un estado
a otro y por qué.

> Fuente única de verdad en el código: `backend/src/common/estados.ts`.

---

## 1. Solicitud de clase espejo (doble revisión)

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE : docente crea la solicitud

    PENDIENTE --> APROBADA_POR_ORIGEN : origen aprueba
    PENDIENTE --> RECHAZADA : origen rechaza (motivo)
    PENDIENTE --> CADUCADA : nadie responde a tiempo

    APROBADA_POR_ORIGEN --> APROBADA : destino aprueba
    APROBADA_POR_ORIGEN --> RECHAZADA : destino rechaza (motivo)
    APROBADA_POR_ORIGEN --> CADUCADA : nadie confirma a tiempo

    RECHAZADA --> PENDIENTE : docente corrige y reenvía
    CADUCADA --> PENDIENTE : reenvío con fecha nueva

    APROBADA --> [*] : se crea el PROYECTO
```

| Estado | Significado |
| --- | --- |
| **Pendiente** | Espera la primera revisión. |
| **Aprobada por origen** | La institución que propone ya aprobó; falta la de destino. |
| **Aprobada** | Ambas aprobaron; se creó el proyecto. |
| **Rechazada** | Alguna institución la rechazó (con motivo). |
| **Caducada** | Venció el plazo sin respuesta; la cancela el sistema. |

---

## 2. Proyecto (clase espejo)

```mermaid
stateDiagram-v2
    [*] --> EN_PLANIFICACION : se crea al aprobar la solicitud

    EN_PLANIFICACION --> EN_CURSO : docente actualiza el estado
    EN_PLANIFICACION --> CANCELADO : se cancela la clase

    EN_CURSO --> FINALIZADO : cierre (valida requisitos)
    EN_CURSO --> CANCELADO : se cancela la clase

    FINALIZADO --> [*]
    CANCELADO --> [*]
```

> `FINALIZADO` **no** se fija a mano: solo lo asigna la acción **Cerrar clase
> espejo**, que exige al menos una evaluación final y que cada sesión (no
> cancelada) tenga su reporte confirmado.

---

## 3. Sesión

```mermaid
stateDiagram-v2
    [*] --> PROGRAMADA : docente programa la sesión

    PROGRAMADA --> EN_CURSO : se inicia
    PROGRAMADA --> CANCELADA : se cancela

    EN_CURSO --> FINALIZADA : concluye

    FINALIZADA --> [*]
    CANCELADA --> [*]
```

---

## 4. Reporte de clase (por sesión)

```mermaid
stateDiagram-v2
    [*] --> BORRADOR : se captura el contenido

    BORRADOR --> EN_REVISION : primer docente firma
    EN_REVISION --> CONFIRMADO : todos los docentes firman

    EN_REVISION --> BORRADOR : cambia el contenido (se reinician firmas)
    CONFIRMADO --> BORRADOR : cambia el contenido (se reinician firmas)

    CONFIRMADO --> [*]
```

> Si el contenido del reporte cambia **después de firmado**, las firmas se
> reinician y el reporte vuelve a *Borrador*. Así una firma siempre corresponde
> al texto definitivo.

---

## 5. Planificación conjunta

```mermaid
stateDiagram-v2
    [*] --> BORRADOR : los docentes la redactan

    BORRADOR --> EN_REVISION : se envía a revisión
    EN_REVISION --> APROBADA : acuerdo cerrado

    APROBADA --> [*]
```

---

## 6. Participaciones (confirmación)

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE : el docente se suma al proyecto

    PENDIENTE --> CONFIRMADA : confirma planificación o firma reporte

    CONFIRMADA --> [*]
```

> Aplica por igual a la **confirmación de participación** en la planificación y
> a las **firmas** del reporte de clase.

---

## 7. Institución ante la CACE

El estado ante la CACE (`INSTITUCION.estado_cace`) es **independiente** de
`activa`, que sigue siendo el apagado operativo. Es este estado —y no `activa`—
el que explica **por qué** una institución no puede operar.

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE : el agente registra la institución
    [*] --> PENDIENTE : el agente se une a una institución pendiente

    PENDIENTE --> APROBADA : la presidencia aprueba
    PENDIENTE --> RECHAZADA : la presidencia rechaza (motivo)

    APROBADA --> RECHAZADA : la presidencia rechaza (motivo)
    APROBADA --> VETADA : la presidencia veta (motivo)

    RECHAZADA --> APROBADA : la presidencia reactiva
    VETADA --> APROBADA : la presidencia reactiva

    RECHAZADA --> [*] : borrado definitivo (solo si no tiene historia)
```

| Estado | Significado | ¿Puede operar? |
| --- | --- | --- |
| **Pendiente** | Acaba de registrarse; espera la decisión de la presidencia. | No: su agente solo completa los datos de la institución. |
| **Aprobada** | La CACE la aceptó. | Sí (si el agente, además, tiene su alta confirmada). |
| **Rechazada** | La presidencia la rechazó con motivo. | No, y **no admite agentes nuevos** (el registro se conserva para evitar el bucle de reinscripción). |
| **Vetada** | La presidencia la vetó con motivo: es la decisión más grave. | No, y no admite agentes nuevos. Las clases ya en curso siguen vivas. |

> Las instituciones que ya existían antes de que se añadiera este estado quedaron
> **aprobadas** en la migración, para no dejarlas fuera.
>
> El estado guarda además **quién** lo decidió (`revisada_por_usuario_id`) y
> **cuándo** (`revisada_en`), y el motivo del rechazo o del veto
> (`motivo_cace`). Ese motivo es obligatorio en los dos casos y viaja en el
> correo que se le manda al agente de la institución.

### 7.1 Alta del agente de una institución ya aprobada

Cuando alguien se **une** a una institución que ya está aprobada, su alta no la
decide la presidencia: la confirma un agente de esa misma institución.

```mermaid
stateDiagram-v2
    [*] --> SIN_CONFIRMAR : el agente se une a una institución APROBADA
    SIN_CONFIRMAR --> CONFIRMADA : un agente de la institución confirma el alta
    SIN_CONFIRMAR --> RECHAZADA : un agente de la institución la rechaza (motivo)
    CONFIRMADA --> [*]
    RECHAZADA --> [*]
```

> El **agente fundador** (el que crea la institución) y el que se une a una
> institución **pendiente** nacen confirmados: de la institución decide la
> presidencia al aprobarla. Un agente sin confirmar solo puede ver y completar
> los datos de su institución.

---

## 8. Certificado

```mermaid
stateDiagram-v2
    [*] --> EMITIDO : el docente lo emite con la clase cerrada (FINALIZADO)
    EMITIDO --> ANULADO : se anula con motivo (docente del certificado o presidencia)
    EMITIDO --> ANULADO : se reemite el mismo alumno (el anterior queda anulado)
    ANULADO --> [*]
```

| Estado | Significado |
| --- | --- |
| **Emitido** | El PDF está guardado con su `hash_sha256` y su folio. Es inmutable: cambiar la plantilla después **no** lo altera. |
| **Anulado** | Deja de ser válido en la página pública, con el motivo guardado. El PDF se conserva (es un documento histórico). |

> El **folio** (`CACE-<año>-<consecutivo>`) es único. La **verificación
> pública** (`GET /verificar/:folio?c=<código>`, sin sesión) tiene cuatro
> desenlaces: `VALIDO`, `ANULADO`, `NO_ENCONTRADO` e `INVALIDO`. El código de 8
> caracteres se **deriva** del folio con un HMAC del secreto del servidor, así
> que no se guarda en ninguna columna y los certificados ya emitidos tienen el
> suyo sin reemitirlos. Va dentro del QR.

---

## 9. Solicitud de borrado de institución

El borrado definitivo de una institución **rechazada** tiene dos caminos: la
presidencia lo hace directo, o la secretaría lo **pide** y la presidencia lo
autoriza. La petición queda registrada.

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE : la secretaría pide el borrado (motivo)
    PENDIENTE --> APROBADA : la presidencia aprueba (y entonces se ejecuta el borrado)
    PENDIENTE --> RECHAZADA : la presidencia rechaza (motivo)
    APROBADA --> [*]
    RECHAZADA --> [*]
```

> La solicitud **sobrevive** al borrado de su institución: la columna
> `institucion_id` admite nulos justo para que quede constancia de quién pidió y
> quién autorizó. Solo se puede pedir sobre una institución **rechazada**, y
> solo se resuelve una vez (aprobada o rechazada).

---

## 10. Miembros de la CACE y transmisión de la presidencia

```mermaid
stateDiagram-v2
    [*] --> PRESIDENTE : alta automática al arrancar (PRESIDENTE_CORREO)
    [*] --> SECRETARIA : la presidencia da de alta una secretaría

    PRESIDENTE --> SUPLENTE : transmite la presidencia
    SUPLENTE --> PRESIDENTE : recibe la presidencia

    SECRETARIA --> PRESIDENTE : la presidencia se le transmite (deja de ser secretaría)
    SECRETARIA --> INACTIVA : la presidencia la desactiva
    INACTIVA --> SECRETARIA : la presidencia la reactiva
```

| Cargo (`MIEMBRO_CACE.cargo`) | Qué es |
| --- | --- |
| **PRESIDENTE** | Quien preside la CACE. Hay uno solo a la vez. |
| **SUPLENTE** | Quien dejó la presidencia. **Conserva las capacidades** (presidencia y suplencia comparten rol) y no pierde el acceso. |
| **SECRETARIA** | Ayuda con la imagen y los premios y **pide** el borrado de instituciones; no firma, ni veta, ni aprueba, ni reparte cargos. |

> La presidencia **no se borra ni se desactiva**: se **transmite**. Al transmitirla
> el saliente queda como suplente activo y se escribe una fila en
> `CAMBIO_PRESIDENCIA` con quién salió, quién entró, el motivo y la fecha. Si el
> entrante era secretaría, **deja de serlo**: el cargo de presidencia manda. Los
> cuatro roles del sistema y lo que puede cada uno están en la matriz de
> capacidades (`backend/src/common/capacidades.ts`), que es la fuente única:
> el código pregunta por la **capacidad**, nunca por el nombre del rol.
