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
