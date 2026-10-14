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

flowchart LR

    %% =========================
    %% ACTORES
    %% =========================

    Agente([Agente de internacionalización])
    Docente([Docente])
    Presidente([Presidente de la CACE])
    Secretaria([Secretaría de la CACE])
    Publico([Cualquiera con el certificado en la mano])

    %% =========================
    %% SISTEMA
    %% =========================

    subgraph Sistema["Sistema de gestión de clases espejo"]

        %% Autenticación y cuenta
        UC1([Iniciar sesión])
        UC2([Registrarse: unirse a su institución<br/>o crear una nueva])
        UC3([Activar cuenta por invitación])
        UC4([Gestionar foto de perfil])
        UC5([Cambiar la contraseña provisional])

        %% Agente
        UC6([Ver y editar su institución])
        UC7([Invitar docentes por correo])
        UC8([Activar, desactivar o eliminar docentes])
        UC9([Gestionar materias])
        UC10([Asignar docente a materia])
        UC11([Consultar solicitudes de su institución])
        UC12([Revisar solicitud: aprobar o rechazar])
        UC13([Dar seguimiento a proyectos])
        UC14([Agregar o quitar docentes del proyecto])
        UC15([Generar reporte de planificación])
        UC16([Confirmar el alta de un agente<br/>de su institución])

        %% Docente
        UC17([Consultar materias asignadas])
        UC18([Crear solicitud de clase espejo])
        UC19([Editar o cancelar solicitud pendiente])
        UC20([Corregir y reenviar solicitud rechazada])
        UC21([Planificar la clase y confirmar participación])
        UC22([Usar el chat del proyecto])
        UC23([Programar sesiones y actividades])
        UC24([Subir evidencias])
        UC25([Firmar reporte de clase])
        UC26([Registrar evaluación final y cerrar])
        UC27([Consultar agenda y recordatorios])
        UC28([Subir la lista de sus alumnos<br/>(Excel, CSV o pegado)])
        UC29([Emitir los certificados de sus alumnos<br/>(solo con la clase cerrada)])
        UC30([Descargar los certificados (PDF o ZIP)])
        UC31([Enviar los certificados por correo])
        UC32([Anular un certificado con motivo])

        %% Presidencia de la CACE
        UC33([Aprobar, rechazar o vetar instituciones])
        UC34([Reactivar una institución])
        UC35([Borrar definitivamente una institución rechazada])
        UC36([Dar de alta y activar/desactivar secretarías])
        UC37([Transmitir la presidencia])
        UC38([Consultar el historial de cambios de presidencia])
        UC39([Personalizar la CACE<br/>(lema, descripción, logo y tema)])
        UC40([Editar los países de la comunidad])
        UC41([Publicar premios y reconocimientos])
        UC42([Diseñar la plantilla del certificado])
        UC43([Anular un certificado de la CACE])
        UC44([Resolver una solicitud de borrado])

        %% Secretaría de la CACE
        UC45([Personalizar la CACE<br/>y editar la comunidad])
        UC46([Publicar premios y reconocimientos])
        UC47([Pedir el borrado de una institución rechazada])

        %% Público (sin sesión)
        UC48([Verificar un certificado por su folio y su código])

        %% Sistema (interno)
        UC49([Crear proyecto al aprobar])
        UC50([Caducar solicitudes sin respuesta])
        UC51([Enviar correo de invitación])
        UC52([Generar recordatorios y agenda])
        UC53([Dar de alta la presidencia al arrancar])
        UC54([Derivar el código de verificación<br/>y estampar nombre, folio y QR])
        UC55([Calcular el hash del PDF emitido])

    end

    %% =========================
    %% RELACIONES AGENTE
    %% =========================

    Agente --> UC1
    Agente --> UC2
    Agente --> UC4
    Agente --> UC6
    Agente --> UC7
    Agente --> UC8
    Agente --> UC9
    Agente --> UC10
    Agente --> UC11
    Agente --> UC12
    Agente --> UC13
    Agente --> UC14
    Agente --> UC15
    Agente --> UC16
    Agente --> UC27

    %% =========================
    %% RELACIONES DOCENTE
    %% =========================

    Docente --> UC1
    Docente --> UC3
    Docente --> UC4
    Docente --> UC17
    Docente --> UC18
    Docente --> UC19
    Docente --> UC20
    Docente --> UC21
    Docente --> UC22
    Docente --> UC23
    Docente --> UC24
    Docente --> UC25
    Docente --> UC26
    Docente --> UC27
    Docente --> UC28
    Docente --> UC29
    Docente --> UC30
    Docente --> UC31
    Docente --> UC32

    %% =========================
    %% RELACIONES PRESIDENCIA DE LA CACE
    %% =========================

    Presidente --> UC1
    Presidente --> UC5
    Presidente --> UC33
    Presidente --> UC34
    Presidente --> UC35
    Presidente --> UC36
    Presidente --> UC37
    Presidente --> UC38
    Presidente --> UC39
    Presidente --> UC40
    Presidente --> UC41
    Presidente --> UC42
    Presidente --> UC43
    Presidente --> UC44

    %% =========================
    %% RELACIONES SECRETARÍA DE LA CACE
    %% =========================

    Secretaria --> UC1
    Secretaria --> UC5
    Secretaria --> UC45
    Secretaria --> UC46
    Secretaria --> UC47

    %% =========================
    %% RELACIONES DEL PÚBLICO
    %% =========================

    Publico --> UC48

    %% =========================
    %% RELACIONES INTERNAS
    %% =========================

    UC12 -. incluye .-> UC11
    UC12 -. "al aprobar destino" .-> UC49
    UC49 --> UC21

    UC50 -. "vence el plazo" .-> UC27
    UC51 -. "apoya" .-> UC7
    UC52 -. "alimenta" .-> UC27

    UC20 -. "vuelve a" .-> UC18

    UC33 -. "aprobar habilita" .-> UC6
    UC53 -. "crea la cuenta de" .-> Presidente
    UC29 -. "solo si la clase está cerrada" .-> UC26
    UC29 -. incluye .-> UC54
    UC54 -. incluye .-> UC55
    UC34 -. "habilita instituciones" .-> UC6

    UC47 -. "la autoriza" .-> UC44
    UC44 -. "al aprobar ejecuta el borrado de" .-> UC35

    UC48 -. "consume el código de" .-> UC54
    UC32 -. "se refleja en" .-> UC48
    UC43 -. "se refleja en" .-> UC48

    UC28 -. "es la base de" .-> UC29
    UC36 -. "reparte el trabajo de la CACE" .-> Secretaria

    %% =========================
    %% ESTILOS
    %% =========================

    classDef agente fill:#FFEDD5,stroke:#EA580C,color:#7C2D12,stroke-width:3px
    classDef docente fill:#DCFCE7,stroke:#16A34A,color:#14532D,stroke-width:3px
    classDef presidente fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A,stroke-width:3px
    classDef secretaria fill:#E0E7FF,stroke:#4F46E5,color:#312E81,stroke-width:3px
    classDef publico fill:#F3F4F6,stroke:#6B7280,color:#374151,stroke-width:3px

    class Agente agente
    class Docente docente
    class Presidente presidente
    class Secretaria secretaria
    class Publico publico

    classDef casoUso fill:#FFFFFF,stroke:#64748B,color:#1F2937,stroke-width:2px
    classDef sistema fill:#F1F5F9,stroke:#64748B,color:#334155,stroke-width:2px
    classDef proyecto fill:#ECFDF5,stroke:#059669,color:#064E3B,stroke-width:2px
    classDef cace fill:#EFF6FF,stroke:#2563EB,color:#1E3A8A,stroke-width:2px
    classDef certificado fill:#FDF4FF,stroke:#A21CAF,color:#701A75,stroke-width:2px

    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9,UC10,UC11,UC12,UC13,UC14,UC15,UC16,UC17,UC18,UC19,UC20,UC21,UC22,UC23,UC24,UC25,UC26,UC27 casoUso
    class UC33,UC34,UC35,UC36,UC37,UC38,UC39,UC40,UC41,UC44,UC45,UC46,UC47 cace
    class UC28,UC29,UC30,UC31,UC32,UC42,UC43,UC48,UC54,UC55 certificado
    class UC49,UC50,UC51,UC52,UC53 sistema
    class UC21,UC22,UC23,UC24,UC25,UC26,UC49 proyecto
```

---

## Notas

* **Cuatro roles y un público sin sesión.** Los roles del sistema son
  **docente**, **agente de internacionalización**, **presidente de la CACE** y
  **secretaría de la CACE**. La verificación de un certificado es la única
  funcionalidad que usa alguien **sin cuenta ni sesión**: la abre quien tiene el
  certificado en la mano (un alumno, un empleador).
* **Lo que decide no es el rol, sino la capacidad.** La tabla de capacidades
  (`backend/src/common/capacidades.ts`) dice qué puede hacer cada rol, y el
  guardia `@Requiere(...)` + `CapacidadesGuard` lo comprueba en el servidor. La
  interfaz pide `GET /cace/capacidades` y **esconde** lo que el rol no puede
  hacer, en vez de pintar un botón que respondería `403`.
* **Presidencia y suplencia comparten rol.** Quien deja la presidencia queda como
  suplente, con las mismas capacidades y sin perder el acceso.
* **La secretaría no firma, no veta y no aprueba.** Ayuda con la imagen de la
  CACE y con los premios, y **pide** el borrado de una institución rechazada; el
  borrado lo autoriza (y lo ejecuta) la presidencia. Por eso `UC47` lleva a
  `UC44`, y no a `UC35`.
* **Los certificados los emite el docente**, cada uno para los alumnos de **su**
  institución, y solo con la clase espejo **cerrada**. La presidencia **diseña y
  firma** la plantilla, y puede **anular** un certificado; no los emite.
