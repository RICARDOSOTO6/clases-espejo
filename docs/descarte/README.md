# 🗄️ Descarte: guías anteriores de despliegue

Aquí están las versiones anteriores de la documentación de puesta en marcha,
**fuera del índice** y sin mantenimiento. Se conservan para no perder el trabajo,
pero **no se deben seguir**: cada una describe un proyecto distinto al actual
(otra versión de Node, otra forma de crear la base, otras rutas) y se
contradecían entre sí.

| Archivo | Qué era |
|---|---|
| [`guia-de-despliegue.md`](guia-de-despliegue.md) | La guía "formal" anterior, que mezclaba Linux y Windows y traía una sección de Docker sin construir |
| [`receta-para-montarlo.md`](receta-para-montarlo.md) | La misma cosa contada como receta de cocina |
| [`practica-en-maquina-virtual.md`](practica-en-maquina-virtual.md) | El ensayo en máquina virtual con ejercicios numerados |
| [`instalacion-ubuntu-server-desde-cero.md`](instalacion-ubuntu-server-desde-cero.md) | La instalación en Ubuntu contada de forma muy extensa (1800 líneas) |

## La guía vigente

**[`docs/guias/guia-de-despliegue.md`](../guias/guia-de-despliegue.md)** es la
única que hay que seguir: pasos numerados, comandos en orden y verificados contra
los archivos actuales del proyecto (Node 24, PostgreSQL 17, `prisma migrate deploy`,
`dist/src/main`, `/health`, servicio de systemd, Nginx y Certbot).

Si algo de estas versiones viejas te sirve de referencia puntual (por ejemplo, la
instalación de Windows), úsalo sabiendo que **está desactualizado**.

## Notas

- Las **auditorías** de [`docs/auditorias/`](../auditorias/) son registros históricos y
  citan rutas antiguas (`docs/practica-en-maquina-virtual.md`, etc.). No se tocan:
  son evidencia de lo que se revisó en su momento.
- Si encuentras otra referencia a estas rutas en documentación vigente, es un
  enlace roto: avísalo o cámbialo apuntando a la guía vigente.
