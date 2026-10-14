```mermaid
sequenceDiagram
    actor UsuarioNuevo as Usuario (nuevo)
    actor Agente as Agente Internacionalización
    actor DocenteInv as Docente (invitado)
    actor Presidente as Presidencia de la CACE
    actor Secretaria as Secretaría de la CACE
    actor Alumno as Alumno / quien verifica
    participant Sistema as Sistema (Backend)
    participant BD as Base de Datos
    participant Correo as Servicio de Correo

    %% ==================== FASE 1: REGISTRO DE AGENTE E INSTITUCIÓN ====================
    rect rgb(200, 230, 255)
        Note over UsuarioNuevo,BD: FASE 1: El usuario se registra, busca su institución y —si no está— la crea (queda como Agente)

        UsuarioNuevo->>Sistema: 1. Buscar su institución en el directorio (sin sesión)
        Sistema->>BD: 2. Consultar INSTITUCION por nombre o país
        BD-->>UsuarioNuevo: 3. Coincidencias (nombre, país, logo y estado ante la CACE)

        alt La institución ya existe
            UsuarioNuevo->>Sistema: 4. Registrarse uniéndose a ella
            Sistema->>BD: 5. Crear Usuario (activo = true, password = hash)
            Sistema->>BD: 6. Crear AgenteInternacionalizacion (confirmado_en = null si está APROBADA)
            Sistema->>Correo: 7. Avisar a los agentes de la institución del alta pendiente
        else No existe: la crea
            UsuarioNuevo->>Sistema: 8. Registrarse con los datos de la institución
            Sistema->>BD: 9. Crear Usuario + Institucion (estado_cace = PENDIENTE) + Agente (fundador, confirmado)
        end

        alt Se unió a una institución RECHAZADA o VETADA
            Sistema-->>UsuarioNuevo: 10. "Esa institución no admite agentes nuevos" (con el motivo)
        end

        Note over Sistema,BD: Todo ocurre en una sola transacción: si algo falla, no queda nada a medias.
    end

    %% ==================== FASE 1b: ALTA DEL AGENTE CONFIRMADA POR LA INSTITUCIÓN ====================
    rect rgb(225, 240, 255)
        Note over Agente,BD: FASE 1b: Un agente de la institución aprueba el alta (solo si la institución ya estaba aprobada)

        Agente->>Sistema: 11. Ver sus altas pendientes (GET /agentes/confirmaciones)
        Sistema-->>Agente: 12. Altas por confirmar
        alt Confirma
            Agente->>Sistema: 13. POST /agentes/confirmaciones/:id/confirmar
            Sistema->>BD: 14. confirmado_en = ahora, confirmado_por_usuario_id = quien confirma
            Sistema->>Correo: 15. Avisar al agente nuevo
        else Rechaza
            Agente->>Sistema: 16. POST /agentes/confirmaciones/:id/rechazar (motivo)
            Sistema->>Correo: 17. Avisar al agente nuevo con el motivo
        end

        Note over Sistema,BD: Con `confirmado_en` en null, el agente solo puede ver y completar los datos de su institución.
    end

    %% ==================== FASE 2: INVITACIÓN DEL DOCENTE ====================
    rect rgb(255, 235, 200)
        Note over Agente,Correo: FASE 2: El agente invita a un docente (solo correo + número de empleado)

        Agente->>Sistema: 18. Invitar docente (correo, numeroEmpleado)
        Sistema->>BD: 19. Verificar que no exista una cuenta con ese correo
        Sistema->>BD: 20. Verificar que no haya una invitación pendiente válida
        Sistema->>Sistema: 21. Generar token único de invitación (con expiración)
        Sistema->>BD: 22. Crear Invitacion (correo, numeroEmpleado, token, expiracion)
        Sistema->>Correo: 23. Enviar correo con el enlace de activación

        alt El correo no sale
            Sistema->>BD: 24. Borrar la invitación (no dejar un enlace que nadie recibió)
            Sistema-->>Agente: 25. "No se pudo enviar el correo"
        else El correo sale
            Sistema-->>Agente: 26. "Invitación enviada al docente"
        end

        Note over Sistema,BD: En esta fase NO se crea Usuario ni Docente: solo queda la invitación pendiente.
    end

    %% ==================== FASE 3: ACTIVACIÓN DEL DOCENTE ====================
    rect rgb(220, 255, 220)
        Note over DocenteInv,BD: FASE 3: El docente abre el enlace y completa su propio registro

        DocenteInv->>Sistema: 27. Abrir enlace (token)
        Sistema->>BD: 28. Validar token (existe, no usado, no expirado)
        Sistema-->>DocenteInv: 29. Mostrar formulario (correo y número de empleado precargados)

        DocenteInv->>Sistema: 30. Completar registro (nombres, documento, grado, especialidad, contraseña)
        Sistema->>BD: 31. Consumir invitación (usadaEn = ahora) de forma atómica
        Sistema->>BD: 32. Crear Usuario (activo = true, password = hash)
        Sistema->>BD: 33. Crear Docente (usuario_id, gradoAcademico, especialidad)
        Sistema->>BD: 34. Crear DocenteInstitucion (docente_id, institucion_id, numeroEmpleado, activo = true)
        BD-->>Sistema: 35. Transacción confirmada
        Sistema-->>DocenteInv: 36. "Cuenta activada correctamente" → inicia sesión

        Note over Sistema,BD: El consumo de la invitación es condicional: si otro ya la usó, no se crea nada.
    end

    %% ==================== FASE 4: INSTITUCIÓN ANTE LA CACE ====================
    rect rgb(225, 225, 255)
        Note over Presidente,Correo: FASE 4: La presidencia aprueba, rechaza o veta la institución

        Presidente->>Sistema: 37. Ver las instituciones (las PENDIENTES primero)
        alt Aprobar
            Presidente->>Sistema: 38. POST /cace/instituciones/:id/aprobar
            Sistema->>BD: 39. estado_cace = APROBADA, revisada_por_usuario_id, revisada_en
            Sistema->>Correo: 40. Avisar al agente de la institución
        else Rechazar o vetar (con motivo obligatorio)
            Presidente->>Sistema: 41. POST /cace/instituciones/:id/rechazar | /vetar
            Sistema->>BD: 42. estado_cace = RECHAZADA | VETADA + motivo_cace
            Sistema->>Correo: 43. Avisar al agente con el motivo
        else Reactivar
            Presidente->>Sistema: 44. POST /cace/instituciones/:id/reactivar
            Sistema->>BD: 45. estado_cace = APROBADA
        end

        Note over Sistema,BD: `estado_cace` es independiente de `activa`: es lo que explica por qué una institución no puede operar.
    end

    %% ==================== FASE 4b: BORRADO CON AUTORIZACIÓN ====================
    rect rgb(240, 225, 255)
        Note over Secretaria,Presidente: FASE 4b: La secretaría pide el borrado y la presidencia lo autoriza

        Secretaria->>Sistema: 46. POST /cace/instituciones/:id/solicitud-borrado (motivo)
        Sistema->>BD: 47. Crear SolicitudBorradoInstitucion (estado = PENDIENTE)
        Presidente->>Sistema: 48. PATCH /cace/solicitudes-borrado/:id (aprobar o rechazar)
        alt Aprueba
            Sistema->>BD: 49. resuelta_por_usuario_id, resuelta_en y ejecuta el borrado definitivo
        else Rechaza
            Sistema->>BD: 50. Estado RECHAZADA con el motivo (la institución se queda)
        end

        Note over Sistema,BD: Solo cabe sobre una institución RECHAZADA sin historia; la solicitud sobrevive al borrado (institucion_id puede quedar en null).
    end

    %% ==================== FASE 5: CLASE ESPEJO Y CIERRE ====================
    rect rgb(255, 245, 215)
        Note over DocenteInv,BD: FASE 5: De la solicitud aprobada al cierre de la clase

        DocenteInv->>Sistema: 51. Crear solicitud de clase espejo (Pendiente)
        Sistema->>BD: 52. Doble revisión: origen → destino
        Sistema->>BD: 53. Al aprobar el destino: crear ProyectoClaseEspejo (EN_PLANIFICACION)
        DocenteInv->>Sistema: 54. Planificación conjunta y confirmación de cada docente
        DocenteInv->>Sistema: 55. Sesiones, actividades, evidencias y chat
        DocenteInv->>Sistema: 56. Firmar el reporte de clase de cada sesión
        DocenteInv->>Sistema: 57. Registrar la evaluación final y cerrar
        Sistema->>BD: 58. Validar (evaluación final + reportes confirmados) y pasar a FINALIZADO

        Note over Sistema,BD: Una solicitud sin respuesta a tiempo pasa a CADUCADA (la cancela el sistema, no una institución).
    end

    %% ==================== FASE 6: LISTA DE ALUMNOS Y CERTIFICADOS ====================
    rect rgb(255, 230, 250)
        Note over DocenteInv,Correo: FASE 6: Lista de alumnos, emisión, envío y anulación

        DocenteInv->>Sistema: 59. Subir la lista de SUS alumnos (Excel, CSV o pegado)
        Sistema-->>DocenteInv: 60. Vista previa con avisos (repetidos, nombres imposibles, correos mal escritos)
        DocenteInv->>Sistema: 61. Guardar la lista revisada
        Sistema->>BD: 62. ListaAlumnos (proyecto + institución) y Alumno (orden, incluido)

        DocenteInv->>Sistema: 63. Emitir (uno o todos los alumnos incluidos)
        Sistema->>Sistema: 64. Comprobar que la clase esté FINALIZADA
        Sistema->>BD: 65. Estampar nombre (autoajuste), folio y QR sobre la plantilla activa
        Sistema->>BD: 66. Guardar el PDF (uploads/certificados) con hash_sha256 y estado EMITIDO
        Sistema-->>DocenteInv: 67. Folio, código de verificación y enlace para el QR

        DocenteInv->>Sistema: 68. Descargar el PDF o todos en ZIP
        DocenteInv->>Sistema: 69. Enviar por correo a los alumnos
        Sistema->>Correo: 70. Adjuntar el PDF y el enlace de verificación
        Sistema->>BD: 71. Registrar enviado_en y enviado_a

        alt Se anula (docente del certificado, o la presidencia desde su panel)
            DocenteInv->>Sistema: 72. POST /proyectos/:id/certificados/:id/anular (motivo obligatorio)
            Sistema->>BD: 73. estado = ANULADO con anulado_motivo (el PDF se conserva)
        end

        Note over Sistema,BD: El diseño se hace FUERA de la aplicación: la plataforma solo escribe nombre, folio y QR.
    end

    %% ==================== FASE 7: VERIFICACIÓN PÚBLICA ====================
    rect rgb(230, 250, 250)
        Note over Alumno,BD: FASE 7: Verificación pública (sin sesión, sin cuenta)

        Alumno->>Sistema: 74. Abrir el enlace del QR: GET /verificar/:folio?c=<código>
        Sistema->>Sistema: 75. Comprobar el formato del folio y derivar el código por HMAC del folio
        alt El código no es el correcto (o falta)
            Sistema-->>Alumno: 76. INVALIDO (no se revela nada, ni siquiera si el folio existe)
        else El código es correcto
            Sistema->>BD: 77. Buscar CERTIFICADO por folio
            alt No existe
                Sistema-->>Alumno: 78. NO_ENCONTRADO
            else Está anulado
                Sistema-->>Alumno: 79. ANULADO, con el motivo (sigue explicando que ya no vale)
            else Está vigente
                Sistema-->>Alumno: 80. VALIDO: alumno, clase, instituciones, fechas y emisión
            end
        end

        Note over Sistema,BD: La respuesta es siempre 200 con un estado y `no-store`; no hay ninguna ruta que liste certificados.
    end
```

---

## Notas sobre este diagrama

* **Quién es quién.** Los cuatro roles del sistema son *docente*, *agente de
  internacionalización*, *presidencia de la CACE* y *secretaría de la CACE*; el
  actor *Alumno / quien verifica* es el único que actúa **sin sesión**, en la
  página pública de verificación.
* **La presidencia se transmite, no se borra.** Al arrancar el servidor, si no
  existe ninguna presidencia y hay `PRESIDENTE_CORREO`, se le crea la cuenta con
  contraseña provisional y cambio obligatorio (`POST /cace/presidencia/cambiar`
  y `GET /cace/presidencia/historial` son el resto del ciclo). El saliente queda
  como **suplente**, con las mismas capacidades.
* **Todo lo que se decide queda firmado.** Las revisiones de solicitud, el estado
  de una institución (`revisada_por_usuario_id`, `revisada_en`), la resolución de
  un borrado y cada cambio de presidencia se guardan con quién y cuándo.
* **La lista de alumnos y los certificados los lleva el docente**, cada uno para
  los alumnos de **su** institución; la plantilla la diseña la presidencia. La
  presidencia **no** emite ni envía certificados, pero sí puede anularlos.
