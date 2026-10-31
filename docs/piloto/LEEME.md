# Kit para la sesión del piloto

Qué hay aquí, en qué orden se usa y qué produce cada cosa.

---

## 1. Las piezas

| Archivo | Qué es | Qué produce |
| --- | --- | --- |
| `sesion-piloto.xlsx` | El libro de la sesión: participantes, tareas, SUS, incidencias y resumen | Los indicadores de aceptación |
| `checklist-preparacion.md` | Lo que hay que comprobar antes de que llegue nadie | Nada: evita que la sesión se caiga |
| `guion-entrevista.md` | Las preguntas, en orden, con qué se busca en cada una | Lo cualitativo, con citas utilizables |
| `evaluacion-clase-espejo.md` | Ficha de cada clase real impartida en el periodo | La parte académica |
| Las métricas del servidor | `GET /metricas/rendimiento.csv` (ver `docs/producto/rendimiento.md` §12) | La parte técnica |
| `extraer-datos-del-servidor.md` | Sacar todo del servidor rentado antes de dejarlo | El paquete de cierre: `npm run exportar-piloto` |

## 2. El orden de una sesión

1. **Antes.** Recorrer `checklist-preparacion.md` entero. Si algo falla, se arregla antes de que llegue
   el participante: una sesión con la aplicación caída no produce datos, produce excusas.
2. **Al empezar.** Abrir el libro. Una fila por persona en `Participantes`, con **código** (P01, P02…)
   y el consentimiento marcado.
3. **Durante.** El participante hace las tareas que le tocan según su rol. Se rellena `Tareas`: si
   termina, si necesitó ayuda, cuántos errores, de qué tipo y cuánto tardó. **No se le ayuda** salvo que
   se bloquee; si se le ayuda, se anota.
4. **Al cerrar.** Que rellene el SUS (cinco minutos, diez preguntas) y la satisfacción de 1 a 5.
5. **Después.** Entrevista de diez minutos con el guion. Todo lo que salga mal o raro va a
   `Incidencias`, con severidad.
6. **Al terminar el día.** Descargar el CSV de métricas, hacer tres o cuatro capturas de la sesión y
   mirar la hoja `Resumen`.

## 3. Qué alimenta del informe

| Dato | Dónde acaba |
| --- | --- |
| Tareas completadas sin ayuda, errores, tiempos, SUS y satisfacción | Capítulo de resultados y Anexo D |
| Citas de las entrevistas | Capítulo de resultados, como testimonio |
| Incidencias | Lista de defectos, con su corrección |
| Fichas de las clases espejo | Valor académico del piloto |
| CSV de métricas | Rendimiento medido en condiciones reales |

## 4. Dos reglas que no se negocian

**Códigos, no nombres.** En las hojas se usa `P01`, `P02`. La lista que relaciona código y persona, si
hace falta, va aparte y no se adjunta al informe.

**Sin consentimiento no hay fila.** Si alguien no firmó que sus respuestas se pueden usar en el informe,
sus datos no entran. Es una frase incómoda de decir una vez; no decirlo es un problema legal.

## 5. Lo que este kit no recoge

* **Tiempo de red y de navegador.** Las métricas miden el servidor. Para el tiempo percibido, lo que
  vale es el cronómetro de la columna `Minutos`.
* **Datos personales de los alumnos.** Si en la sesión se usan listas reales, fuera del libro.
* **Opiniones sueltas.** Si no está anotado con la tarea o la pregunta a la que responde, no se usa.
