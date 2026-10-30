# Simulación integral de una clase espejo

Esta simulación crea una clase espejo **nueva** con cuatro instituciones y deja
un historial completo para revisar en la aplicación.

## Resultado

- Proyecto: **29**
- Título: *Simulación integral de clase espejo con cuatro instituciones (30-oct-2026)*
- Estado final: **FINALIZADO**
- Instituciones: Calkiní, Colombia, Sevilla y Buenos Aires
- Al cierre: **tres instituciones activas** y **Buenos Aires RETIRADA**

## Qué contiene

| Elemento | Cantidad / estado |
|---|---:|
| Participantes iniciales | 4 |
| Planificación conjunta | APROBADA |
| Participaciones de planificación confirmadas | 4 |
| Sesiones | 4 |
| Reportes de sesión confirmados | 4 |
| Participaciones docentes en cada reporte | 4 |
| Actividades | 3 |
| Evidencias | 6 |
| Evaluaciones | 1 |
| Mensajes | 4 |
| Solicitud de cancelación | RECHAZADA |
| Votos de la solicitud | 1 aprobación y 1 rechazo |
| Instituciones activas al cierre | 3 |
| Instituciones retiradas | 1 (Buenos Aires) |

La solicitud la hizo **Universidad de Sevilla**. **Universidad Nacional de
Colombia** la rechazó, por lo que la clase siguió abierta. Después,
**Universidad de Buenos Aires** se retiró con su motivo. Al quedar tres
instituciones activas, la clase pudo continuar y cerrarse.

La clase conserva:

- eventos `CLASE_SIMULADA`, `CANCELACION_SOLICITADA`,
  `VOTO_CANCELACION_RECHAZADO` y `SALIDA`;
- reportes con desarrollo, asistentes, incidencias y acuerdos;
- evaluación final y actividades;
- PDFs de **acta ejecutiva** y **expediente completo**.

## Cómo revisarla

Abre:

```text
http://localhost:3000/proyectos/29
```

Usa **Ctrl+Shift+R** si la página estaba abierta antes.

Cuentas con contraseña `Demo1234`:

| Institución | Docente | Agente |
|---|---|---|
| Calkiní | `sofia.gomez@clasesespejo.mx` | `agente.calkini@clasesespejo.mx` |
| Colombia | `isabella.cardenas@clasesespejo.co` | `agente.colombia@clasesespejo.co` |
| Sevilla | `docente.sevilla@clasesespejo.es` | `agente.sevilla@clasesespejo.es` |
| Buenos Aires | `docente.uba@clasesespejo.ar` | `agente.uba@clasesespejo.ar` |

El docente ve el botón **Descargar acta ejecutiva (PDF)**. El agente ve
**Descargar expediente completo (PDF)**. Ambos están habilitados porque el
proyecto está `FINALIZADO`.

## Comprobación reproducible

Con el servidor en `:3000`, desde `backend`:

```powershell
node scripts/simular-clase-completa.js
node scripts/verificar-simulacion.js 29
```

El primer comando crea la simulación si no existe. El segundo comprueba los
datos y escribe:

- `release/simulacion-clase-29-verificacion.md`
- `release/simulacion-clase-29-acta.pdf`
- `release/simulacion-clase-29-expediente.pdf`

La verificación cubre el estado final, las cuatro instituciones, la retirada,
la cancelación rechazada, los reportes, las evidencias, la evaluación, la
bitácora y la firma `%PDF` de ambos informes.
