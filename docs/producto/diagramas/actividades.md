# 🔀 Diagramas de actividad

Los procesos clave, paso a paso: **quién hace qué** y **en qué orden**, con los
puntos de decisión y sus resultados. Mermaid no tiene un diagrama de actividad
formal, así que se representan con `flowchart` y **subgrafos usados como
carriles** (*swimlanes*): cada subgrafo es quien actúa.

> Las fuentes de cada diagrama están citadas en su apartado. Los estados que
> aparecen son los de `backend/src/common/estados.ts`, dibujados en
> [`estados.md`](estados.md); aquí se ve **cómo se llega** a cada uno.

---

## 1. Aprobación de una institución

Del registro del agente a la decisión de la CACE y sus avisos. Incluye las dos
puertas que tiene una institución: la **decisión de la presidencia** cuando es
nueva o está pendiente, y la **confirmación del alta por un agente de la propia
institución** cuando alguien se une a una ya aprobada.

> Fuentes: `backend/src/cace/instituciones-cace.service.ts` (aprobar, rechazar,
> vetar, reactivar, borrado con autorización y avisos por correo),
> `backend/src/auth/auth.service.ts` (registro y `requiereConfirmacion`) y
> `backend/src/agentes/agentes.service.ts` (confirmaciones de alta).

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#F5F7FA",
        "primaryTextColor": "#1F2937",
        "lineColor": "#64748B",
        "fontFamily": "Arial"
    }
}}%%

flowchart TD

    subgraph AGENTE["Carril · Agente de internacionalización"]
        A0([Inicio: el agente se registra])
        A1{"¿Su institución ya está<br/>en el directorio público?"}
        A2["Se une a ella<br/>POST /auth/register con institucionId"]
        A3["La crea con sus datos<br/>POST /auth/register"]
        A4{"¿La institución a la que se unió<br/>estaba APROBADA?"}
        A5["Completa los datos y el logo<br/>PATCH /instituciones/mia"]
        A6["Su alta queda SIN CONFIRMAR"]
        A7([El agente puede operar])
        A8["Solo ve y completa su institución:<br/>no puede proponer ni recibir clases"]
    end

    subgraph SISTEMA["Carril · Sistema"]
        S1["La institución nace PENDIENTE ante la CACE<br/>estadoCace = PENDIENTE"]
        S2["La campana de la presidencia<br/>muestra las instituciones por decidir"]
        S3["estadoCace = APROBADA<br/>+ revisadaPor y revisadaEn"]
        S4["estadoCace = RECHAZADA o VETADA<br/>con el motivo obligatorio"]
        S5["Correo al agente de la institución<br/>con la decisión y el motivo"]
        S6["Un agente de esa institución<br/>confirma o rechaza el alta"]
    end

    subgraph CACE["Carril · Presidencia (y secretaría) de la CACE"]
        P1["Revisa la lista: pendientes primero<br/>y aviso de posible duplicado"]
        P2{"Decisión"}
        P3["Reactivar: vuelve a APROBADA<br/>y se avisa otra vez"]
        P4{"¿Está RECHAZADA<br/>y sin historia?"}
        P5["Borrado definitivo<br/>(la secretaría lo pide · la presidencia lo autoriza)"]
        P6([Fin: el registro se conserva])
    end

    A0 --> A1
    A1 -- "Sí" --> A2
    A1 -- "No" --> A3
    A3 --> S1
    A2 --> A4
    A4 -- "Sí" --> A6
    A4 -- "No, estaba pendiente" --> A5
    S1 --> A5
    A5 --> S2
    S2 --> P1
    P1 --> P2
    P2 -- "Aprobar" --> S3
    P2 -- "Rechazar o vetar (con motivo)" --> S4
    S3 --> S5
    S4 --> S5
    S5 --> A7
    S4 --> P3
    P3 --> S5
    S4 --> P4
    P4 -- "Sí" --> P5
    P4 -- "No" --> P6
    P5 --> P6
    A6 --> S6
    S6 --> A7
    A5 -. "mientras espera la decisión" .-> A8
    A8 -. "cuando la aprueban" .-> A7

    classDef inicioFin fill:#E2E8F0,stroke:#475569,color:#1E293B,stroke-width:3px
    classDef decision fill:#FEF3C7,stroke:#D97706,color:#78350F,stroke-width:2px
    classDef agente fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
    classDef sistema fill:#F1F5F9,stroke:#64748B,color:#334155,stroke-width:2px
    classDef cace fill:#E0E7FF,stroke:#4F46E5,color:#312E81,stroke-width:2px
    classDef bloqueo fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D,stroke-width:2px

    class A0,A7 inicioFin
    class A1,A4,P2,P4 decision
    class A2,A3,A5,A6 agente
    class S1,S2,S3,S5,S6 sistema
    class S4 bloqueo
    class P1,P3,P5,P6 cace
    class A8 bloqueo
```

**Notas**

* **Completar los datos es la única salida mientras está pendiente.** El
  «gate» de institución deja al agente de una institución no aprobada ver y
  completar `Mi institución` y nada más: ni catálogo, ni solicitudes, ni clases.
* **El motivo es obligatorio al rechazar y al vetar**, y viaja en el correo al
  agente. Aprobar o reactivar también se avisa: la institución pudo dar por
  perdida su alta.
* **El veto es la decisión más grave** y no se hace público: se avisa solo a la
  institución afectada. Las clases ya en curso siguen vivas.
* **Un solo camino borra.** El borrado definitivo exige que la institución esté
  **rechazada y sin historia** (sin clases, revisiones ni dependencias); la
  presidencia lo hace directo y la secretaría solo puede **pedirlo**, y la
  presidencia autoriza (al aprobar, el borrado se ejecuta).
* La institución **no se desaprueba sola**: `activa` (el apagado operativo) es
  otra cosa y no se toca desde este proceso.

---

## 2. Emisión de un certificado

De la lista de alumnos al PDF con folio y QR, y de ahí a la descarga o al correo.
La emisión tiene **cuatro requisitos** y el sistema dice cuál falta.

> Fuentes: `backend/src/proyectos/listas-alumnos.service.ts` (subida y vista
> previa), `backend/src/certificados/certificados.service.ts` (emisión,
> reemisión, anulación, ZIP y envío) y
> `backend/src/certificados/certificado-pdf.service.ts` (el PDF, el QR y el
> autoajuste del nombre). El cierre de la clase que hace falta antes está en
> `backend/src/proyectos/proyectos.service.ts` (`cerrarProyecto`).

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#F5F7FA",
        "primaryTextColor": "#1F2937",
        "lineColor": "#64748B",
        "fontFamily": "Arial"
    }
}}%%

flowchart TD

    subgraph DOCENTE["Carril · Docente de la clase espejo"]
        B0([Inicio: la clase espejo está FINALIZADA])
        B1["Sube la lista de SUS alumnos<br/>Excel, CSV o pegado"]
        B2["Revisa la vista previa editable:<br/>repetidos, nombres imposibles, correos mal escritos"]
        B3["Confirma la lista<br/>PUT /proyectos/:id/listas-alumnos"]
        B4{"¿Se puede emitir?"}
        B5["Pide la emisión (uno o todos)<br/>POST /proyectos/:id/certificados/emitir"]
        B6["Ve el resumen: emitidos, reemitidos y omitidos"]
        B7["Descarga el PDF, baja el ZIP<br/>o envía por correo al alumno"]
        B8["Lee el motivo y lo arregla"]
        B9["Anula un certificado con motivo<br/>(el PDF se conserva)"]
        B10([Fin])
    end

    subgraph SISTEMA["Carril · Sistema"]
        S1["Guarda una lista por (proyecto, institución)<br/>y sus alumnos, cada uno con «incluido»"]
        S2["Comprueba los cuatro requisitos:<br/>clase cerrada, plantilla activa,<br/>lista subida y algún alumno incluido"]
        S3["Pide el siguiente folio del año<br/>CACE-AAAA-0000"]
        S4["Dibuja el PDF sobre la plantilla activa:<br/>nombre autoajustado, folio y QR"]
        S5["Guarda uploads/certificados/«folio».pdf<br/>y calcula su hash SHA-256"]
        S6["Guarda el certificado como EMITIDO"]
        S7{"¿Ese alumno ya tenía<br/>un certificado EMITIDO?"}
        S8["Anula el anterior con el motivo<br/>«Reemitido con el folio nuevo»"]
    end

    B0 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> S1
    S1 --> B4
    B4 -- "No: falta un requisito" --> B8
    B8 -. "lo corrige" .-> B4
    B4 -- "Sí" --> B5
    B5 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S6 --> S7
    S7 -- "No" --> B6
    S7 -- "Sí, y se pidió reemitir" --> S8
    S8 --> B6
    B6 --> B7
    B7 --> B10
    B6 -. "si hay que dejar sin efecto uno emitido" .-> B9
    B9 --> B10

    classDef inicioFin fill:#E2E8F0,stroke:#475569,color:#1E293B,stroke-width:3px
    classDef decision fill:#FEF3C7,stroke:#D97706,color:#78350F,stroke-width:2px
    classDef docente fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
    classDef sistema fill:#F1F5F9,stroke:#64748B,color:#334155,stroke-width:2px
    classDef certificado fill:#FDF4FF,stroke:#A21CAF,color:#701A75,stroke-width:2px

    class B0,B10 inicioFin
    class B4,S7 decision
    class B1,B2,B3,B5,B6,B7,B8 docente
    class S1,S2,S3,S5,S6,S8 sistema
    class B9,S4 certificado
```

**Notas**

* **Los cuatro requisitos, en orden de comprobación:** la clase tiene que estar
  `FINALIZADO`; tiene que haber una **plantilla activa** diseñada por la
  presidencia; el docente tiene que haber subido **su** lista; y tiene que haber
  **al menos un alumno incluido**. Si falta alguno, la pantalla explica cuál y
  el botón queda deshabilitado.
* **Cerrar la clase es otro proceso.** `POST /proyectos/:id/cerrar` exige una
  **evaluación final** registrada y que **cada sesión no cancelada** tenga su
  reporte de clase `CONFIRMADO` (las firmas de los docentes). Sin eso no hay
  emisión posible.
* **Cada docente emite para los alumnos de su institución**, nunca para los de la
  otra: la lista se busca por (proyecto, institución).
* **El folio se pide antes de generar** porque va impreso dentro del PDF. El
  PDF se guarda tal como salió, con su `hashSha256`; cambiar la plantilla después
  **no** lo altera.
* **Reemitir no borra nada**: se anula el anterior con el motivo «Reemitido con
  el folio nuevo» y el nuevo queda vigente. Un alumno no puede tener dos
  certificados vigentes del mismo curso.
* **La anulación** la puede hacer el docente de esa clase (para los certificados
  de su institución) o la presidencia (para cualquiera, desde su panel). El PDF
  no se borra: la página pública pasa a mostrarlo como anulado con el motivo.
* **El QR no lleva solo el folio**: lleva también el código de verificación
  (`/verificar/{folio}?c={código}`), que se deriva del folio con un HMAC. El
  folio es consecutivo y se adivina; el código, no.
* **El ZIP no incluye los anulados**: es lo que se entrega a los alumnos.

---

## 3. Verificación pública

Lo que ocurre cuando alguien escanea el QR impreso en un certificado. Es el
único proceso que se ejecuta **sin cuenta y sin sesión**.

> Fuentes: `backend/src/certificados/verificacion.service.ts` (los cuatro
> desenlaces), `backend/src/certificados/codigo-verificacion.ts` (el HMAC, el
> formato del folio y la comparación en tiempo constante) y
> `frontend/src/app/features/verificacion/` (la pantalla).

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#F5F7FA",
        "primaryTextColor": "#1F2937",
        "lineColor": "#64748B",
        "fontFamily": "Arial"
    }
}}%%

flowchart TD

    subgraph PUBLICO["Carril · Quien tiene el certificado (sin sesión)"]
        C0([Inicio: alguien escanea el QR])
        C1["Abre {URL_PUBLICA}/verificar/{folio}?c={código}"]
        C6["VÁLIDO: ve el nombre del alumno, la clase,<br/>las instituciones y las fechas"]
        C7["ANULADO: ve los datos y el motivo de la anulación"]
        C8["NO VÁLIDO: no se enseña ningún dato<br/>y se invita a escanear el QR del certificado"]
        C9([Fin])
    end

    subgraph SISTEMA["Carril · Sistema (sin sesión)"]
        S1["Normaliza el folio y comprueba su formato<br/>CACE-AAAA-0000"]
        S2{"¿El formato es correcto y el código<br/>coincide con el HMAC del folio?"}
        S3["Busca el folio en CERTIFICADO"]
        S4{"¿Existe?"}
        S5{"¿Su estado es ANULADO?"}
        S6["Responde VALIDO"]
        S7["Responde ANULADO con el motivo"]
        S8["Responde NO_ENCONTRADO"]
        S9["Responde INVALIDO"]
    end

    C0 --> C1
    C1 --> S1
    S1 --> S2
    S2 -- "No" --> S9
    S9 --> C8
    S2 -- "Sí" --> S3
    S3 --> S4
    S4 -- "No" --> S8
    S8 --> C8
    S4 -- "Sí" --> S5
    S5 -- "No" --> S6
    S6 --> C6
    S5 -- "Sí" --> S7
    S7 --> C7
    C6 --> C9
    C7 --> C9
    C8 --> C9

    classDef inicioFin fill:#E2E8F0,stroke:#475569,color:#1E293B,stroke-width:3px
    classDef decision fill:#FEF3C7,stroke:#D97706,color:#78350F,stroke-width:2px
    classDef publico fill:#F3F4F6,stroke:#6B7280,color:#374151,stroke-width:2px
    classDef sistema fill:#F1F5F9,stroke:#64748B,color:#334155,stroke-width:2px
    classDef ok fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:2px
    classDef anulado fill:#FFF7ED,stroke:#F59E0B,color:#7C2D12,stroke-width:2px
    classDef malo fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D,stroke-width:2px

    class C0,C9 inicioFin
    class S2,S4,S5 decision
    class C1,C6,C7,C8 publico
    class S1,S3 sistema
    class S6 ok
    class S7 anulado
    class S8,S9 malo
```

**Notas**

* **El código se comprueba antes de tocar la base.** Si el enlace no trae el
  código o trae uno que no encaja, la respuesta es `INVALIDO` **sin consultar**:
  no se puede averiguar qué folios existen probando números.
* **Los cuatro desenlaces son los del servicio**: `VALIDO`, `ANULADO`,
  `NO_ENCONTRADO` e `INVALIDO`. En pantalla, «no encontrado» e «inválido» se
  presentan como **no válido** y ninguno de los dos enseña dato alguno del
  alumno; la diferencia está en el texto que se lee.
* **Un certificado anulado se enseña como anulado, no como falso**: quien
  escanea el QR de un anulado tiene que entender que ya no vale, con su motivo.
* **Siempre responde `200` con un estado**, y no hay ninguna ruta que liste
  certificados. Lo que se muestra es solo el nombre del alumno y los datos de la
  clase: nunca la matrícula, el correo, el hash ni el PDF.
* **El código no está guardado en ninguna columna**: se deriva del folio. Por eso
  los certificados emitidos antes de que existiera la verificación también
  funcionan.

---

## 4. Transmisión de la presidencia

La presidencia de la CACE **no se borra ni se desactiva: se transmite**. Quien
deja el cargo queda como suplente, con las mismas capacidades.

> Fuentes: `backend/src/cace/presidencia-cace.service.ts` (el cambio, la
> transacción, los avisos y el historial), `backend/src/common/capacidades.ts`
> (suplencia y presidencia comparten rol) y `backend/src/cace/miembros-cace.service.ts`
> (altas de secretarías).

```mermaid
%%{init: {
    "theme": "base",
    "themeVariables": {
        "background": "#F5F7FA",
        "primaryTextColor": "#1F2937",
        "lineColor": "#64748B",
        "fontFamily": "Arial"
    }
}}%%

flowchart TD

    subgraph PRESIDENCIA["Carril · Presidencia saliente"]
        D0([Inicio: entra en «Presidencia»<br/>capacidad gestionarMiembrosCace])
        D1["Elige al sucesor y escribe el motivo"]
        D2["Confirma el cambio<br/>POST /cace/presidencia/cambiar"]
        D3([Fin: sigue dentro como suplente])
    end

    subgraph SISTEMA["Carril · Sistema (una sola transacción)"]
        S1{"¿El sucesor es un miembro de la CACE<br/>o una persona nueva?"}
        S2["Miembro existente: no puede ser el saliente<br/>y tiene que estar activo"]
        S3["Persona nueva: se le crea la cuenta con<br/>contraseña provisional (cambio obligatorio)"]
        S4["El entrante pasa a PRESIDENTE y a activo"]
        S5["El saliente pasa a SUPLENTE y sigue activo.<br/>Si el entrante era secretaría, deja de serlo:<br/>solo hay un presidente a la vez"]
        S6["Se escribe CAMBIO_PRESIDENCIA:<br/>quién salió, quién entró, motivo y fecha"]
        S7["Correo al entrante y al saliente<br/>(si el correo falla, la transmisión ya está hecha)"]
        S9["GET /cace/presidencia/historial<br/>muestra quién preside y los cambios"]
    end

    D0 --> D1
    D1 --> D2
    D2 --> S1
    S1 -- "Miembro de la CACE" --> S2
    S1 -- "Persona nueva" --> S3
    S2 --> S4
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S6 --> S7
    S7 --> D3
    S6 -. "queda registrado y se consulta en" .-> S9
    S9 --> D3

    classDef inicioFin fill:#E2E8F0,stroke:#475569,color:#1E293B,stroke-width:3px
    classDef decision fill:#FEF3C7,stroke:#D97706,color:#78350F,stroke-width:2px
    classDef presidente fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
    classDef sistema fill:#EFF6FF,stroke:#2563EB,color:#1E3A8A,stroke-width:2px

    class D0,D3 inicioFin
    class S1 decision
    class D1,D2 presidente
    class S2,S3,S4,S5,S6,S7,S9 sistema
```

**Notas**

* **Todo pasa en una transacción.** Un cambio de presidencia a medias dejaría a
  la CACE sin nadie que pueda aprobar instituciones, autorizar borrados o firmar
  certificados.
* **El suplente no pierde nada**: conserva las capacidades, porque el rol se
  resuelve por relación y presidencia y suplencia se tratan igual
  (`backend/src/common/capacidades.ts`).
* **Solo hay un presidente a la vez.** Si apareciera otra fila con cargo
  `PRESIDENTE`, el cambio la baja a suplencia.
* **El cargo manda**: si el sucesor era secretaría, deja de serlo; la interfaz lo
  avisa antes de confirmar.
* **Un correo que no sale no deshace la transmisión**: queda hecha, escrita en el
  historial y dicha en la respuesta. Si el entrante es nuevo y el correo falla,
  la contraseña provisional viaja en la respuesta para dársela a mano.
* La presidencia se crea sola **al arrancar el servidor** si no existe ninguna y
  hay `PRESIDENTE_CORREO` (con cambio de contraseña obligatorio). Las
  secretarías, en cambio, las da de alta la presidencia desde `/cace/miembros`.

---

## 5. Nota sobre la comprobación de estos diagramas

* Los cuatro son `flowchart`, no diagramas de actividad UML: **no hay carriles
  formales, ni nodos de unión, ni tokens**. Los subgrafos hacen de carril y las
  flechas discontinuas indican un cambio de estado o una consulta, no un paso
  obligatorio del flujo.
* No hay renderizador disponible al escribir esto, así que la comprobación fue
  **a mano**: bloques balanceados, cada nodo declarado antes de usarse, ids
  únicos dentro de cada diagrama y ningún `class` que apunte a un nodo que no
  exista.
* Los pasos y las condiciones están leídos del código; **no** se ha ejecutado el
  flujo para comprobar que el orden dibujado coincide con el orden real de las
  llamadas en todos los casos.
