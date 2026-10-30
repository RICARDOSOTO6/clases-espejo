# Accesibilidad automática de las pantallas

> **Medida el 29 de octubre de 2026** con `axe-core` 4.14 sobre las pruebas del
> frontend (entorno `jsdom` de Vitest). Se ejecuta en cada cambio dentro del job
> `Frontend` del CI.

## Qué comprueba y cómo

`src/app/accesibilidad.spec.ts` monta cuatro pantallas con sus servicios
simulados, deja que Angular pinte el DOM y pasa axe sobre él. La prueba **falla
si aparece una violación de impacto «grave» o «crítico»** (`serious`/`critical`);
las moderadas y menores se informan pero no rompen la build.

Las pantallas cubiertas, elegidas por ser las que se ven sin haber entrado o las
que más gente usa:

| Pantalla | Qué se revisa |
| --- | --- |
| Acceso (`/login`) | formulario, logo de la CACE, enlaces de recuperación y alta |
| Alta de institución (`/registro`) | formulario largo, país, documentos, casilla del aviso |
| Verificación pública (`/verificar/:folio`) | lo que abre el QR del certificado, sin sesión |
| Armazón con el menú (`app-layout`) | cabecera, navegación, botones de la barra superior |

Además hay una prueba de **control**: un `<img>` sin `alt` y un `<button>` vacío
detectados a propósito. Si el detector dejara de funcionar, esa prueba falla y
no se puede confundir «no hay violaciones» con «axe no se ejecutó».

## Resultado del 29-oct

- **0 violaciones graves o críticas** en las cuatro pantallas.
- El control detecta `image-alt` y `button-name` (las dos críticas), como debe.
- Una **incompleta** en el armazón: `label-content-name-mismatch`. axe no puede
  decidirla en `jsdom` (necesita medir el texto visible); queda anotada como
  pendiente de revisión a mano, no como fallo.

## Lo que axe no puede comprobar aquí

- **Contraste de color.** Necesita maquetación real; `jsdom` no la calcula, así
  que la regla `color-contrast` se desactiva a propósito. Los temas de la CACE
  tienen su contraste medido aparte.
- **Orden de tabulación real, foco visible y atajos de teclado.** Se pueden
  recorrer a mano en el navegador; ninguna prueba lo hace todavía.
- **Zoom al 200 % y textos ampliados.** Requiere navegador y medición visual.
- **Lo que dice el lector de pantalla.** axe revisa atributos y estructura, no
  la locución ni si el orden de lectura tiene sentido.

## Lo que no está cubierto todavía

Los paneles del docente, del agente, del proyecto y de la CACE. Montarlos exige
simular media aplicación (ruta, servicios de datos, permisos) y no aporta
todavía: no hay pruebas de comportamiento de esas pantallas que los monten. El
plan es incluir cada pantalla cuando tenga su prueba de comportamiento.

## Cómo se consulta y se repite

```powershell
cd frontend
npm test                 # las 39 pruebas, incluidas las de accesibilidad
npm run test:cov         # además, cobertura
```

En el CI corre en el paso «Pruebas y cobertura» del job `Frontend`; el resumen
de cobertura de ese mismo paso queda en la página del job y en el artefacto
`cobertura-frontend`.

Para añadir una pantalla a la revisión: montarla con `TestBed` (como en la
prueba) y pasarle `violacionesGraves`. Si aparece una violación grave, el
mensaje dice la regla y el elemento.

> El paquete `axe-core` se añadió a `devDependencies` en esta tarea.
