# Guía para diseñar el certificado de la CACE

> **Para quién es esta guía:** para la persona que diseña el certificado (con
> Canva, Word, Illustrator, Photoshop o el programa que prefiera). No hace falta
> saber nada de programación.

## Resumen en 30 segundos

La plataforma **no diseña el certificado**: solo **escribe tres datos encima** de
tu diseño. Por eso tu diseño tiene que dejar **tres huecos vacíos** en sitios
exactos:

| Hueco | Tamaño | Dónde |
| --- | --- | --- |
| **Nombre del alumno** | 20 × 3 cm | centrado, un poco por debajo de la mitad de la hoja |
| **Folio** | 6 × 0,8 cm | abajo a la izquierda |
| **Código QR** | 3 × 3 cm | abajo a la derecha |

Esos tres huecos van **vacíos y con el fondo claro y liso**: nada de textos,
logos, fotos, texturas ni adornos dentro de ellos. Todo lo demás del certificado
(título, leyenda, marco, firmas, escudo…) lo dibujas tú dentro de la imagen.

---

## 1. El lienzo: 3508 × 2480 píxeles

| Concepto | Medida |
| --- | --- |
| Tamaño de la hoja | A4 **horizontal** (apaisado): 29,7 × 21 cm |
| Resolución | 300 ppp (calidad de imprenta) |
| Píxeles exactos | **3508 de ancho × 2480 de alto** |
| Formato recomendado | **PNG** (o JPG si el archivo pesa demasiado) |

- **Crea el documento directamente a 3508 × 2480 px.** Si tu programa trabaja en
  centímetros, pon 29,7 × 21 cm y 300 ppp: son los mismos 3508 × 2480.
- **1 cm = 118,11 px.** Con eso puedes convertir cualquier medida de esta guía.

### ¿Y si entrego la imagen más pequeña?

La plataforma **agranda la imagen hasta tapar la hoja entera**. Si es más
pequeña de 3508 × 2480:

- La imagen se **estira** para llenar la hoja y **pierde nitidez**: en papel se
  ve borrosa o pixelada. En pantalla casi no se nota, impresa sí.
- Por debajo de unos 2000 px de ancho el resultado ya no sirve para imprimir.
- Una imagen **más grande** no molesta (se reduce), pero 3508 × 2480 es el
  tamaño ideal: ni se estira ni se encoge.

### La imagen se recorta, nunca se deforma

Si tu archivo no tiene exactamente la proporción del A4, la plataforma lo escala
hasta cubrir la hoja y **recorta lo que sobra por el centro**. Nunca aplasta ni
estira el dibujo, así que un círculo sigue siendo un círculo. Consecuencia
práctica: **lo que esté pegado a los bordes puede desaparecer**. Usa el margen
seguro de la sección 2 y no pongas nada importante en el filo.

---

## 2. El margen seguro: 1,5 cm por los cuatro lados

Es la franja que puede comerse la impresora al recortar el papel. **Deja 1,5 cm
(177 px) libres en cada lado** para todo lo que importe: textos, logos, el marco
del certificado y, sobre todo, las tres zonas de datos.

- 1,5 cm = **177 px**.
- Las tres zonas ya están calculadas para caer **justo dentro** de ese margen.
- El marco decorativo puede llegar al borde de la hoja si te gusta el efecto,
  pero es más seguro que también quede dentro.
- En la imagen de zonas (`certificado-zonas.png`) el margen va dibujado con una
  **línea discontinua** y su rótulo, para que lo veas sin medir nada.

---

## 3. Las tres zonas, con sus medidas exactas

Origen de coordenadas: **esquina superior izquierda** de la hoja (0,0). La
«izquierda» y «arriba» son las coordenadas de la esquina superior izquierda de
cada hueco.

| Zona | Tamaño en cm | Tamaño en px | Izquierda | Arriba |
| --- | --- | --- | --- | --- |
| **Nombre del alumno** | 20 × 3 cm | 2362 × 354 px | 4,85 cm (573 px) | 9,42 cm (1113 px) |
| **Folio** | 6 × 0,8 cm | 709 × 94 px | 1,5 cm (177 px) | 18,70 cm (2209 px) |
| **Código QR** | 3 × 3 cm | 354 × 354 px | 25,20 cm (2977 px) | 16,50 cm (1949 px) |

Datos útiles de cada una:

- **Nombre:** está **centrado horizontalmente**, así que su centro cae en
  14,85 cm del borde izquierdo (la mitad de 29,7 cm). Su centro vertical está en
  **10,92 cm desde arriba, que es el 52 % del alto de la hoja**. Es decir: la caja
  va de 9,42 cm a 12,42 cm desde arriba, y de 4,85 cm a 24,85 cm desde la
  izquierda.
- **Folio:** pegado abajo a la izquierda, a **1,5 cm del borde izquierdo y 1,5 cm
  del borde inferior**. Su borde inferior queda a 19,50 cm (2303 px) desde arriba.
- **QR:** cuadrado, pegado abajo a la derecha, a **1,5 cm del borde derecho y
  1,5 cm del borde inferior**. También termina a 19,50 cm (2303 px) desde arriba,
  así que el folio y el QR quedan alineados por abajo.

---

## 4. Esquema: dónde cae cada zona

Esquema orientativo (no está a escala exacta; los números buenos son los de la
tabla anterior). La línea discontinua es el margen seguro de 1,5 cm.

```text
     0 cm        7,4             14,9            22,3     29,7 cm
    ┌────────────────────────────────────────────────────────────┐
    │                                                            │
    │   ╎╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╎   │ 1,5 cm
    │   ╎                                                    ╎   │
    │   ╎ (cabecera del diseño)                              ╎   │
    │   ╎                                                    ╎   │
    │   ╎                                                    ╎   │
    │   ╎                                                    ╎   │
    │   ╎   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ╎   │
    │   ╎   ░░░░░░░░░░░░░░NOMBRE · 20 × 3 cm░░░░░░░░░░░░░░   ╎   │ 9,42 cm
    │   ╎   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ╎   │
    │   ╎                                                    ╎   │
    │   ╎                                                 ▓▓▓▓▓▓▓│
    │   ╎                                                 ▓▓QR▓▓▓│
    │ ▒▒▒▒FOLIO▒▒▒▒                                       ▓▓▓▓▓▓▓│
    │   ╎╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╎   │ 19,5 cm
    │                                                            │
    └────────────────────────────────────────────────────────────┘
```

Lectura rápida:

- **░░ NOMBRE ░░** — caja ancha, centrada, un poco por debajo de la mitad.
- **▒▒ FOLIO ▒▒** — caja baja y alargada, abajo a la izquierda.
- **▓▓ QR ▓▓** — cuadro pequeño, abajo a la derecha.
- **╎ ╌ ╎** — margen seguro de 1,5 cm: nada importante fuera de él.

---

## 5. Las tres zonas deben quedar LIBRES

Los tres huecos los rellena la plataforma. Si tú dibujas algo dentro, se
**superpondrá** con el dato real y el certificado saldrá sucio o ilegible.

**No pongas dentro de las tres cajas:**

- La palabra «Nombre:», «Folio:» ni ningún rótulo (si quieres un rótulo, ponlo
  **fuera** de la caja: por ejemplo, la palabra «Folio» justo **encima** de su
  hueco, a más de 1,5 cm del borde izquierdo).
- Un nombre de ejemplo, un folio inventado (tipo `CACE-2026-0001`) ni un dibujo
  de QR: saldrían **duplicados** con los de verdad.
- Líneas, marcos, filigranas, escudos, sellos, cintas o marcas de agua.
- Fotos, degradados fuertes, texturas o tramas.
- Fondos oscuros o de color intenso: el nombre y el folio se escriben en
  **tono oscuro** y el QR necesita **fondo claro** para que un teléfono lo lea.

**Sí puedes (y conviene):** un fondo **blanco, crema o de color muy claro y
liso** detrás de cada hueco. Es lo que hace que el texto se lea bien al imprimir.
Si quieres una línea decorativa bajo el nombre, ponla **por debajo de los
12,42 cm** desde arriba (fuera de la caja de 3 cm).

---

## 6. El nombre se ajusta solo: tú solo deja el hueco

No tienes que calcular el tamaño de letra ni contar cuánto mide un nombre.

- La plataforma mide el nombre real de cada alumno y lo **encaja dentro de la
  caja de 20 × 3 cm**: si es corto, sale con letra grande; si es largo, **baja el
  tamaño de letra automáticamente**.
- Si aun así no cabe en una línea, **lo parte en dos líneas** (siempre dentro de
  la misma caja, centrado).
- Por eso la caja es de 3 cm de alto: ahí caben dos líneas. **No escribas nada
  en esos 3 cm**: ni el nombre de ejemplo, ni adornos.
- El texto se escribe **centrado** y en un tono oscuro. Sobre un fondo claro y
  liso se lee perfectamente.

Ejemplo: «Juan Pérez» saldrá con letra grande en una línea; «María Fernanda de
Jesús Rodríguez Villanueva» saldrá con letra más pequeña y probablemente en dos
líneas. En los dos casos, dentro de la misma caja de 20 × 3 cm.

---

## 7. El folio y el QR

- **Folio:** un código corto y único por certificado (por ejemplo
  `CACE-2026-0001`). Se escribe en la caja de 6 × 0,8 cm, alineado a la
  izquierda, en tono oscuro. Deja el fondo claro y liso; no dibujes la línea
  donde va.
- **QR:** la plataforma genera un QR de 3 × 3 cm que sirve para comprobar que el
  certificado es auténtico. Solo tiene que estar el hueco **cuadrado, limpio y
  claro**: no pongas marco, ni esquinas decorativas, ni fondo de color, ni tu
  propio QR de ejemplo.

---

## 8. Archivos de apoyo (para descargar)

Los tres archivos están en la carpeta `docs/plantillas/` del proyecto y miden
3508 × 2480 px. El de zonas también queda publicado por la aplicación en
`/plantillas/certificado-zonas.png`.

| Archivo | Para qué sirve |
| --- | --- |
| [certificado-zonas.png](../plantillas/certificado-zonas.png) | **La capa de zonas.** Ponla como **capa superior** de tu diseño: verás dibujadas las tres cajas, el margen seguro de 1,5 cm y las medidas. Tiene **fondo transparente**, así que el diseño se ve debajo. **Ocúltala o bórrala antes de exportar**: es una guía, no se imprime. |
| [certificado-ejemplo-clasica.png](../plantillas/certificado-ejemplo-clasica.png) | Ejemplo «clásico» ya terminado: filete doble, tipografía con serifas, espacio limpio para el nombre y línea de firma. Puedes usarlo tal cual o como referencia. |
| [certificado-ejemplo-moderna.png](../plantillas/certificado-ejemplo-moderna.png) | Ejemplo «moderno»: banda azul de la CACE (`#075985`), tipografía sans y mucho aire. Igual: se puede usar tal cual. |

En los dos ejemplos, las tres cajas están **vacías a propósito**: no llevan
nombre, ni folio, ni QR, porque esos datos los pone la plataforma al emitir.

---

## 9. Antes de entregar: lista de comprobación

- [ ] El documento mide **3508 × 2480 px** (29,7 × 21 cm a 300 ppp).
- [ ] Nada importante queda fuera del **margen de 1,5 cm (177 px)**.
- [ ] La caja del **nombre** (20 × 3 cm, de 4,85 a 24,85 cm de ancho y de 9,42 a
      12,42 cm de alto) está **vacía** y con fondo claro y liso.
- [ ] La caja del **folio** (6 × 0,8 cm, a 1,5 cm de la izquierda y del borde
      inferior) está **vacía** y con fondo claro.
- [ ] La caja del **QR** (3 × 3 cm, a 1,5 cm de la derecha y del borde inferior)
      está **vacía**, cuadrada y con fondo claro y liso.
- [ ] Dentro de las tres cajas no hay textos, rótulos, logos, líneas, texturas
      ni fondos oscuros.
- [ ] No has escrito ningún nombre de alumno, ni ningún folio, ni has dibujado
      un QR de ejemplo.
- [ ] Exportas en PNG (o JPG) a tamaño real, sin marcos ni marcas de agua
      añadidos por el programa.

---

## 10. Preguntas rápidas

**¿Puedo hacer un diseño distinto al de los ejemplos?**
Sí. Los dos ejemplos son solo una ayuda: lo único obligatorio es respetar las
tres zonas, sus medidas y el margen seguro.

**¿Puedo cambiar los colores?**
Sí. Si quieres ir con la identidad de la aplicación, el azul principal es
`#075985` (y los de apoyo `#063b63`, `#0878bd`, `#f0f9ff`).

**¿Y si quiero más datos en el certificado, como las instituciones o las
fechas?**
Escríbelos tú dentro del diseño, como parte de la imagen: son texto fijo. La
plataforma solo escribe **nombre, folio y QR**, que son los tres datos que
cambian en cada certificado.

**¿El certificado sale en papel A4 horizontal?**
Sí: la plataforma genera un PDF de una hoja A4 horizontal con tu imagen de fondo
y los tres datos escritos encima.
