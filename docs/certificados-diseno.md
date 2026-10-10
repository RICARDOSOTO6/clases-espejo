# Certificados de la clase espejo — decisiones y diseño

> **Acordado el 7 de octubre de 2026.** El apartado «Certificados» se construye
> más adelante; este documento deja cerrado *qué* se va a hacer para no volver a
> discutirlo cuando se programe.

## 1. Decisiones

| Tema | Decisión |
| --- | --- |
| **Cuándo se emiten** | **Al final del curso**: solo con la clase espejo **cerrada**. En el dominio eso es `estado = FINALIZADO`, que es justo el que queda reservado al cierre y exige evaluación final y todos los reportes confirmados |
| **Formato de la lista** | **Excel (`.xlsx`)** con plantilla propia que entrega la plataforma. Como respaldo se aceptarán **CSV** y **pegar la lista** en un cuadro de texto (cubre a quien solo tiene el PDF de su sistema escolar) |
| **Plantilla del certificado** | **Universal**: una sola para toda la CACE, no una por institución |
| **Quién firma** | El **presidente de la CACE**. Mientras ese usuario no exista, la línea de firma es un dato configurable |
| **Datos del alumno** | Se imprime **solo el nombre**. La matrícula se guarda (es una columna de la plantilla) porque ayuda a distinguir a dos alumnos que se llamen igual |
| **Quién los emite** | **Los docentes**, cada uno para **sus** alumnos: sube la lista de su institución y genera los certificados |
| **Envío por correo** | **Sí**: el certificado se le puede enviar a cada alumno por correo |
| **Usuario «presidente de la CACE»** | **Aparcado**: se añadirá más adelante y todavía tiene cosas por definir |

### Lo que traerá el usuario presidente (cuando toque)

Un tercer rol que pueda **subir la plantilla, editarla y firmarla**. Está
**aparcado a propósito** hasta que se defina qué más tendrá que hacer. Dos notas
técnicas que lo dejan barato de añadir después:

* En el esquema, `Usuario.rol` es un `String`, **no un enumerado**: agregar
  `PRESIDENTE_CACE` no requiere migrar ningún tipo.
* La plantilla y el certificado ya nacen con los campos que ese rol necesitará
  (`creadaPorUsuarioId`, `firmaNombre`, versionado), así que el rol se suma sin
  rehacer el modelo.

## 2. Cómo queda el flujo

1. La clase espejo se **cierra** (requisitos ya existentes: evaluación final y
   reportes confirmados). En su pantalla aparece el apartado **Certificados**.
2. Cada docente **sube la lista de sus alumnos** (los de su institución) con la
   plantilla de Excel, un CSV o pegando los nombres. La plataforma valida y
   muestra una **vista previa** para corregir o excluir filas antes de guardar.
3. Al generar, se emite **un PDF por alumno** con **folio único**, y se puede
   descargar todo en un **ZIP**.
4. Los PDF quedan **guardados tal como se emitieron**. Si más adelante cambia la
   plantilla, los certificados ya emitidos **no cambian**: la plantilla nueva solo
   se aplica a las emisiones nuevas, y reemitir uno concreto deja anotado el
   motivo y anula el anterior.
5. Si el alumno tiene correo en la lista, se le puede **enviar su certificado**
   desde la misma pantalla, de uno en uno o a todos de golpe. Se guarda **a quién
   se envió y cuándo**, para no repetir el envío sin querer.

## 3. Modelo de datos propuesto

```
ListaAlumnos        una por (proyecto, institución)
  id, proyectoId, institucionId, subidaPorUsuarioId, creadaEn

Alumno
  id, listaId, nombre, matricula?, correo?, orden, incluido

PlantillaCertificado        versionada
  id, nombre, version, imagenFondo, anchoPx, altoPx,
  campos (JSON: posición y estilo de cada dato),
  textosLegales (JSON), firmaNombre, activa, creadaPorUsuarioId

Certificado
  id, folio (único), alumnoId, proyectoId, plantillaId (la versión usada),
  emitidoPorUsuarioId, emitidoEn, archivoPdf, hashSha256,
  estado (EMITIDO | ANULADO), anuladoMotivo?, reemplazaAId?,
  enviadoEn?, enviadoA?
```

**Por qué la lista es por institución y no por clase:** en una clase espejo hay
alumnos de las dos instituciones; los certificados de cada lado se generan desde
la lista de su propia institución, aunque la plantilla sea la misma para todos.

**Por qué se guarda el PDF y no se regenera:** un certificado es un documento
emitido. Si se rehiciera cada vez con la plantilla del momento, el documento de
un alumno cambiaría solo. Se guarda, y se reemite únicamente si alguien lo pide.

## 4. La plantilla, que es lo que «cambia constantemente»

Se usará **una imagen de fondo (PNG o JPG, A4 horizontal) más los datos escritos
encima**, con la posición de cada dato guardada en la base de datos. Así el
diseñador de la CACE rediseña el certificado cuando quiera, sube la imagen nueva
y no hay que tocar código: la plataforma solo escribe el nombre, la clase espejo,
las instituciones, las fechas, el folio y la firma.

Se descartaron, por el momento:

* **Plantilla de Word con marcadores**: obliga a tener LibreOffice en el servidor
  para convertir a PDF (pesado en un servidor pequeño).
* **HTML a PDF con Chrome headless**: da más libertad de diseño, pero mete un
  Chrome en el servidor; en un VPS de poco presupuesto es justo lo que conviene
  evitar.

### Detalle técnico que hay que respetar

`resumen-pdf.service.ts` hoy **filtra los caracteres que la fuente estándar del
PDF no sabe dibujar**. En un certificado eso significaría **mutilar el nombre de
un alumno** sin que nadie se entere. Para los certificados hay que **incrustar
una fuente Unicode** (`pdfkit` lo permite con `registerFont`) y no filtrar nada.

## 5. Tecnología

| Necesidad | Qué se usa |
| --- | --- |
| Generar el PDF | **`pdfkit`**, que ya está instalado (lo usa el resumen de la clase) |
| Leer el Excel | **ExcelJS**. Se evita el paquete `xlsx` de SheetJS, que arrastra avisos de seguridad |
| Guardar los archivos | `uploads/certificados/`, reutilizando el patrón de subida que ya existe para las evidencias |

## 6. Pendiente de decidir

1. **¿Folio con verificación pública?** Propuesta: una página `/verificar/<folio>`,
   con el folio y un QR impresos en el certificado, para que cualquiera compruebe
   que es auténtico sin depender de la institución.
2. **Mientras no exista el usuario presidente, ¿quién edita la plantilla?** Opción
   provisional: el agente, o dejarla como configuración del sistema.
3. **Qué más llevará el usuario presidente.** Aparcado hasta que se defina.

### Cómo queda la columna de correo

El envío por correo **no** convierte el correo en obligatorio: hay grupos donde el
docente no tiene el correo de todos. La lista se acepta igual y la pantalla
mostrará, por alumno, si se le puede enviar o queda «sin correo»; a esos se les
entrega el PDF para imprimir. En la plantilla de Excel la columna va marcada como
**opcional pero recomendada**, justo por esto.

## 7. Orden de trabajo

> El orden de trabajo **vive ahora en [`plan-de-accion.md`](plan-de-accion.md)**,
> que une estos pasos con los del presidente de la CACE. Lo que sigue se conserva
> como referencia de este documento.

1. ✅ **Listas** (hecho): tablas `LISTA_ALUMNOS` y `ALUMNO`, lectura de Excel
   (`.xlsx`), CSV y lista pegada, con validación, vista previa editable y los
   endpoints bajo `/proyectos/:id/listas-alumnos`. La plantilla que se entrega a
   las instituciones vive en `docs/plantillas/plantilla-lista-alumnos.xlsx`.
2. **Certificados**: plantilla configurable (fondo + posiciones), emisión
   individual y por lote en ZIP.
3. **Envío por correo** a los alumnos, con registro de a quién se envió.
4. **Confianza**: folio, verificación pública con QR, inmutabilidad y reemisión.
5. **Usuario presidente** (cuando se pida): rol nuevo que crea y firma plantillas,
   con lo que se le vaya a agregar.

### Lo que hace hoy la lista de alumnos

* La sube **el docente** de cada institución (el agente no la ve: solo acompaña).
  Una lista por (clase espejo, institución), y volver a subir reemplaza la
  anterior.
* Acepta **`.xlsx`, `.csv` o pegar los nombres** (incluso copiando desde Excel,
  con tabuladores). El archivo se lee en memoria: no deja temporales.
* Reconoce los **encabezados** aunque lleven aclaraciones («Matrícula
  (opcional)», «Correo (opcional, para enviar el certificado)»), o la primera
  columna como nombre si no hay encabezados.
* **Avisa en vez de fallar en silencio**: filas repetidas, filas sin nombre o que
  no parecen un nombre se descartan con su motivo, y un correo mal escrito se
  guarda vacío avisando. Tope de 300 alumnos.
* Después de guardar, el docente puede **corregir**, **quitar** a un alumno o
  **dejarle fuera de los certificados** sin borrarlo de la lista.
