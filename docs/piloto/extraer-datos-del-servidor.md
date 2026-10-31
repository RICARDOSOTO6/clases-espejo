# Extraer los datos del piloto antes de dejar el servidor

El piloto va a correr en un servidor **rentado**. Eso cambia una cosa: todo lo que no se saque de ahí
desaparece el día que se dé de baja. No hay «lo busco luego».

Este documento es el procedimiento. La herramienta que lo hace es `npm run exportar-piloto`.

---

## 1. La regla

> Un dato que solo existe en el servidor no es un dato: es una promesa.

Y el paquete se saca **mientras se paga el servidor**, no el último día. Un contrato que vence un
viernes a medianoche no se negocia el sábado.

---

## 2. Qué hay que sacar, y por qué dos paquetes

| Qué | Dónde vive | Sirve para |
| --- | --- | --- |
| Base de datos completa | PostgreSQL del servidor | Restaurar, migrar, no perder el trabajo |
| Archivos subidos | `uploads/` (evidencias, avatares, logos) | Lo mismo: son parte de la base |
| Métricas de cada petición | `logs/rendimiento.jsonl` | El capítulo de rendimiento |
| Tablas agregadas | Se generan al exportar | Adjuntar al informe |
| Certificados emitidos | Se generan en la base | El anexo de evidencias |
| Fotos y firmas del piloto | **No están en el servidor** | El libro de sesión de `docs/piloto/` |

Fíjate en la separación: el **respaldo** lleva datos personales y no se publica; las **tablas y
métricas** son recuentos y hechos, y se adjuntan al informe. La herramienta los deja en la misma
carpeta pero dice cuál es cuál.

---

## 3. El comando

En el servidor, dentro de `backend`:

```bash
# Paquete completo, con respaldo, tablas y comprimido
npm run exportar-piloto -- --salida /root/piloto --zip

# Solo lo que va al informe, sin respaldo (rápido, para revisar)
npm run exportar-piloto -- --salida /root/piloto-informe --sin-archivos --sin-tablas
```

Deja una carpeta con:

```
piloto-2026-11-05_0930/
├── respaldo/
│   ├── base.dump            volcado completo de PostgreSQL
│   ├── uploads/             archivos subidos
│   └── respaldo.json        datos para restaurar
├── metricas/
│   ├── rendimiento.jsonl    una línea por petición
│   └── rendimiento.md       resumen listo para leer
├── tablas/
│   ├── instituciones.csv    sin correos ni responsables
│   ├── proyectos.csv
│   ├── sesiones.csv
│   ├── evidencias.csv
│   ├── certificados.csv     con folio, sin nombre de alumno
│   └── recuento-tablas.csv  filas por tabla: la cifra que se cita
├── logs/                    lo que dijeron los comandos
├── LEEME.md                 qué es cada cosa y qué se adjunta
└── manifiesto.json          fecha, versión y huella de cada archivo
```

Si algún paso no se puede completar, **el LEEME lo dice**: no se calla. Un paquete incompleto que lo
admite es útil; uno que lo disimula, no.

---

## 4. Lo que hay que hacer ANTES de esto

**Arrancar el servidor con el archivo de métricas encendido.** Sin eso, las métricas solo viven en
memoria y se pierden en cada reinicio:

```bash
# en el .env del servidor
METRICAS_ARCHIVO=/var/log/clasesespejo/rendimiento.jsonl
```

Esto no se puede recuperar después. Si el piloto ya empezó sin él, se puede sacar
`GET /metricas/rendimiento.csv` de la instancia actual, pero no el histórico.

---

## 5. Lo que hay que hacer DESPUÉS

1. **Copiar el paquete fuera del servidor** (a tu equipo, a un disco, a donde sea). Mientras esté solo
   allí, no has sacado nada.
2. **Probar la restauración** con `npm run probar-restauracion` sobre una base de prueba. Un respaldo
   que no se ha restaurado nunca no es un respaldo: es un archivo grande.
3. **Anotar la fecha de baja** del servidor en el LEEME del paquete.
4. Revisar que las cifras de `recuento-tablas.csv` cuadran con lo que dirá el informe.

---

## 6. Cuidado con los datos personales

El paquete incluye en `respaldo/` nombres, correos y listas de alumnos. Eso es necesario para
restaurar, y **no se adjunta al informe ni se sube al repositorio**.

Si vas a pasarle el paquete a alguien (por ejemplo, a quien te ayude con el piloto), dos opciones:

* **Lo que necesita para orientarte**: la carpeta `tablas/`, `metricas/`, `LEEME.md` y `manifiesto.json`.
  Nada de `respaldo/`.
* **Si necesita la base**: que sea una base de prueba restaurada por ti, no el volcado del servidor en
  producción.

Y si vas a publicar algo del piloto, recuerda que las listas de alumnos son datos de **menores o de
terceros que no firmaron nada**. En el informe van recuentos.

---

## 7. Antes de dar de baja el servidor

- [ ] `npm run exportar-piloto -- --salida /root/piloto --zip` terminó sin avisos graves.
- [ ] El paquete está copiado **fuera** del servidor.
- [ ] `npm run probar-restauracion` pasó sobre una base de prueba.
- [ ] Los CSV que van al informe están revisados.
- [ ] Las capturas del piloto y el libro de sesión están en tu equipo.
- [ ] Fecha de baja anotada: ______________.

Con eso, apagar el servidor es una decisión administrativa y no un accidente.
