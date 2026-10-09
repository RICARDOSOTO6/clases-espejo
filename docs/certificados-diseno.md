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
| **Datos del alumno** | **Solo el nombre** |
| **Usuario «presidente de la CACE»** | **Más adelante**, como tercer tipo de usuario: será quien cree y firme las plantillas |

### Lo que traerá el usuario presidente (cuando toque)

Un tercer rol que pueda **subir la plantilla, editarla y firmarla**. Dos notas
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
  estado (EMITIDO | ANULADO), anuladoMotivo?, reemplazaAId?
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

1. **Quién pulsa «emitir».** Con la firma en el presidente, lo más simple es que
   cualquiera de los participantes de la clase pueda generar los certificados al
   cierre (los docentes tienen la lista; los agentes supervisan). Alternativa:
   solo los docentes, o solo los agentes.
2. **¿Folio con verificación pública?** Propuesta: una página
   `/verificar/<folio>`, con el folio y un QR impresos en el certificado, para
   que cualquiera compruebe que es auténtico sin depender de la institución.
3. **¿Se envían por correo a los alumnos?** Se puede reutilizar Nodemailer; haría
   falta la columna de correo en la lista (hoy es opcional y no sale impresa).
4. **Mientras no exista el usuario presidente, ¿quién edita la plantilla?** Opción
   provisional: el agente, o dejarla como configuración del sistema.

## 7. Orden de trabajo previsto

1. **Listas**: modelo, migración, subida de Excel/CSV con validación, pegar texto
   y vista previa editable.
2. **Certificados**: plantilla configurable (fondo + posiciones), emisión
   individual y por lote en ZIP.
3. **Confianza**: folio, verificación pública con QR, inmutabilidad y reemisión.
4. **Usuario presidente** (cuando se pida): rol nuevo que crea y firma plantillas.
