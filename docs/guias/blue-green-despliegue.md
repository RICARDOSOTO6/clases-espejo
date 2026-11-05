# Guía de operación Blue-Green — Clases Espejo

> **Estado:** infraestructura preparada, publicación **pendiente** (ver checklist al final).
> **Servidor:** Contabo — Ubuntu Server 24.04
> **Proyecto:** Clases Espejo
> **Fecha de preparación:** 4 de noviembre de 2026
>
> Guardada como referencia operativa. Contiene la dirección del servidor y acceso
> `root`: **no publicar** el repositorio con este documento sin cambiarlas antes.

---

## 1. Objetivo del sistema

El propósito de implementar Blue-Green Deployment es poder modificar, actualizar y probar Clases Espejo sin poner en riesgo la versión que actualmente funciona.

En lugar de modificar directamente la aplicación pública, tendremos dos instancias independientes:

- **BLUE:** versión estable que atiende a los usuarios.
- **GREEN:** laboratorio de desarrollo y pruebas, donde se preparan las nuevas versiones.

Cuando una actualización esté lista, podremos cambiar el tráfico público de BLUE a GREEN mediante Nginx.

Si algo sale mal, podremos regresar el tráfico a BLUE.

## 2. Arquitectura actual

| Elemento | BLUE | GREEN |
|---|---|---|
| Proyecto | `/opt/clasesespejo` | `/opt/clasesespejo-green` |
| Servicio | `clasesespejo.service` | `clasesespejo-green.service` |
| Puerto | 3000 | 3001 |
| Base de datos | `clasesconjuntas` | `clasesconjuntas_bluegreen_test_20261104_1458` |
| Configuración | `.env` propio | `.env` propio |
| JWT | Secreto propio | Secreto independiente |
| Archivos | `backend/uploads` | `backend/uploads` propio |

Nginx actualmente dirige el tráfico público hacia:

`http://127.0.0.1:3000`

Por tanto, BLUE sigue siendo producción.

GREEN escucha únicamente en `127.0.0.1:3001`, por lo que no está expuesta directamente a Internet.

## 3. Estado al finalizar el trabajo

Se verificó lo siguiente:

- Los dos servicios funcionan.
- GREEN conecta correctamente con PostgreSQL.
- La página de GREEN carga en el navegador.
- Los archivos JavaScript y CSS responden correctamente.
- Los endpoints públicos responden con HTTP 200.
- El inicio de sesión funciona en GREEN.
- Se comprobaron las secciones de la aplicación.
- BLUE y GREEN tienen los mismos tres archivos subidos.
- Las tablas comparadas presentan las diferencias esperadas.

### Diferencia de registros

GREEN contiene el conjunto de datos del respaldo de las 14:58.

BLUE conserva cuatro registros adicionales relacionados con una institución que se decidió descartar:

| Tabla | BLUE | GREEN |
|---|---:|---:|
| INSTITUCION | 2 | 1 |
| AGENTE_INTERNACIONALIZACION | 2 | 1 |
| INVITACION_AGENTE | 3 | 2 |
| USUARIO | 3 | 2 |

Los identificadores adicionales son:

- INSTITUCION: ID 2.
- AGENTE_INTERNACIONALIZACION: ID 2.
- INVITACION_AGENTE: ID 3.
- USUARIO: ID 3.

Se decidió conservar GREEN como candidata para producción, porque contiene el conjunto de datos que interesa mantener.

**Importante:** el registro adicional todavía existe en BLUE. Se conservará allí como parte de la copia de recuperación.

## 4. Cómo acceder al servidor

Desde Windows PowerShell:

```powershell
ssh root@169.58.255.24
```

Para acceder a GREEN desde el navegador mediante un túnel SSH, abrir una segunda ventana de PowerShell:

```powershell
ssh -L 3001:127.0.0.1:3001 root@169.58.255.24
```

Mantener esa ventana abierta y visitar:

`http://127.0.0.1:3001`

Para comprobar el estado de los servicios desde el servidor:

```bash
systemctl status clasesespejo --no-pager
systemctl status clasesespejo-green --no-pager
```

Para comprobar los puertos:

```bash
sudo ss -ltnp | grep -E ':3000|:3001'
```

## 5. Procedimiento para realizar cambios en el código

Este será el flujo habitual cuando se quiera implementar una nueva función o corregir un error.

### Paso 1. Conservar una versión estable

Antes de comenzar:

- Comprobar que BLUE funciona.
- Verificar que existe un respaldo reciente de PostgreSQL.
- Comprobar que los archivos de `uploads` también están respaldados.
- Identificar qué versión del código está funcionando en producción.

No comenzar una actualización si no existe una vía de recuperación comprobada.

### Paso 2. Preparar GREEN

Trabajar sobre:

`/opt/clasesespejo-green`

No modificar directamente los archivos de BLUE.

Si se necesita reconstruir GREEN desde una copia reciente de producción, primero respaldar cualquier trabajo que se quiera conservar en GREEN.

La reconstrucción debe incluir:

1. Una copia consistente de la base de datos.
2. Los archivos subidos.
3. El código de la versión que se quiere probar.
4. La configuración independiente de GREEN.

No sobrescribir la base de datos de pruebas sin verificar primero qué información contiene.

### Paso 3. Modificar el código

Realizar los cambios en el proyecto de desarrollo.

Ejemplos:

- Crear módulos nuevos.
- Corregir errores.
- Cambiar componentes Angular.
- Modificar servicios NestJS.
- Agregar campos o relaciones de Prisma.
- Implementar nuevas funciones.

Una vez revisados los cambios, transferirlos a GREEN.

Antes de hacerlo, verificar que no se sobrescriban accidentalmente los archivos `.env`, las credenciales o los archivos de usuarios.

### Paso 4. Instalar dependencias y compilar

En GREEN se deberá:

1. Instalar las dependencias correspondientes a la versión del proyecto.
2. Generar el cliente Prisma cuando corresponda.
3. Ejecutar las migraciones previstas.
4. Compilar el backend.
5. Compilar el frontend.
6. Verificar que el frontend publicado esté dentro de `backend/public`.

Los comandos exactos deben comprobarse con los scripts actuales de `package.json` antes de ejecutarlos.

No ejecutar migraciones contra la base de datos de BLUE durante esta etapa.

### Paso 5. Reiniciar GREEN

Después de compilar:

```bash
sudo systemctl restart clasesespejo-green
```

Comprobar el servicio:

```bash
sudo systemctl status clasesespejo-green --no-pager
```

Revisar los registros:

```bash
sudo journalctl -u clasesespejo-green -n 80 --no-pager
```

Comprobar la salud:

```bash
curl -i http://127.0.0.1:3001/health
```

La respuesta esperada es HTTP 200 con estado `ok`.

### Paso 6. Probar la nueva versión

Abrir:

`http://127.0.0.1:3001`

Comprobar:

- Inicio de sesión.
- Perfil.
- Instituciones.
- Usuarios.
- Invitaciones.
- Clases espejo.
- Administración CACE.
- Archivos e imágenes.
- Funciones nuevas.
- Operaciones de escritura, utilizando datos de prueba.

También revisar los registros del backend y los errores del navegador.

No publicar una versión únicamente porque la página principal carga correctamente.

## 6. Precauciones especiales con PostgreSQL y Prisma

Esta es una de las partes más importantes.

Una actualización de código puede incluir cambios en la estructura de la base de datos.

Por ejemplo:

- Crear una tabla.
- Agregar una columna.
- Cambiar una relación.
- Eliminar un campo.
- Modificar una restricción.

El procedimiento será:

1. Crear un respaldo.
2. Probar la migración en GREEN.
3. Comprobar que la aplicación funciona con el nuevo esquema.
4. Comprobar que los datos anteriores siguen siendo accesibles.
5. Diseñar la migración de producción.
6. Publicar el código y el cambio de esquema de manera coordinada.

**No todas las migraciones permiten regresar simplemente cambiando Nginx.**

Si una migración elimina columnas o modifica datos de manera irreversible, la versión anterior puede dejar de funcionar con la nueva base de datos.

Por eso conviene utilizar migraciones compatibles hacia atrás siempre que sea posible: primero agregar y adaptar, después retirar los elementos antiguos cuando ya no se necesiten.

## 7. Publicar GREEN como nueva producción

Cuando GREEN haya superado las pruebas:

1. Crear un respaldo nuevo de producción.
2. Verificar que la base de datos de GREEN contiene los datos definitivos.
3. Sincronizar los archivos necesarios.
4. Comprobar las variables de entorno de producción.
5. Revisar certificados, URL pública, QR y correo.
6. Confirmar que los procesos automáticos estén configurados correctamente.
7. Habilitar el arranque automático de GREEN si corresponde.
8. Preparar una copia de la configuración actual de Nginx.
9. Modificar el destino del proxy para que apunte a:

`http://127.0.0.1:3001`

10. Validar la configuración:

```bash
sudo nginx -t
```

11. Si la validación es correcta, recargar Nginx:

```bash
sudo systemctl reload nginx
```

12. Comprobar la aplicación desde la dirección pública.

BLUE debe permanecer disponible durante esta etapa.

No se debe apagar ni eliminar la instancia anterior.

## 8. Cómo regresar a BLUE si algo falla

Si después de publicar GREEN se detecta un problema:

1. Abrir la configuración de Nginx.
2. Restaurar el destino anterior:

`http://127.0.0.1:3000`

3. Validar:

```bash
sudo nginx -t
```

4. Recargar:

```bash
sudo systemctl reload nginx
```

5. Verificar la aplicación pública.

BLUE deberá seguir ejecutándose para permitir este retorno.

**Advertencia:** si GREEN ya recibió escrituras o se aplicaron migraciones incompatibles, regresar el tráfico a BLUE no revierte esos cambios de base de datos. Primero se debe evaluar la compatibilidad y, si corresponde, recuperar un respaldo.

## 9. Reglas permanentes del laboratorio

1. BLUE no se utiliza para experimentar.
2. GREEN es el entorno de desarrollo y pruebas.
3. Cada entorno tiene su propio archivo `.env`.
4. No compartir secretos JWT entre las instancias.
5. No ejecutar migraciones de prueba contra producción.
6. No sobrescribir GREEN sin respaldar el trabajo que contiene.
7. Conservar respaldos independientes de PostgreSQL y `uploads`.
8. Verificar los correos y procesos automáticos antes de publicar.
9. Mantener BLUE disponible para una posible reversión.
10. No eliminar respaldos ni bases temporales sin comprobar primero su utilidad.

## 10. Estado pendiente al cierre de esta etapa

- [x] Crear la instancia GREEN.
- [x] Crear una base de datos independiente.
- [x] Configurar un secreto JWT independiente.
- [x] Separar los procesos automáticos de GREEN.
- [x] Comprobar la conexión con PostgreSQL.
- [x] Comprobar los endpoints públicos.
- [x] Comprobar los archivos estáticos.
- [x] Abrir GREEN mediante túnel SSH.
- [x] Iniciar sesión y revisar los módulos.
- [x] Comparar los conteos de las tablas.
- [x] Identificar los registros adicionales.
- [ ] Completar la revisión de integridad del esquema y las migraciones.
- [ ] Revisar la configuración de certificados y URL pública.
- [ ] Preparar el cambio de Nginx.
- [ ] Publicar GREEN como producción.
- [ ] Verificar el resultado y conservar BLUE como respaldo.

---

## Conclusión

La ventaja principal de Blue-Green es que las actualizaciones dejan de ser una intervención directa sobre el único sistema disponible.

A partir de ahora, el flujo de trabajo será:

**Desarrollar → Probar en GREEN → Respaldar → Validar → Publicar → Verificar → Conservar BLUE para recuperación.**

La meta es que puedas desarrollar nuevas funciones para Clases Espejo sin tener que poner en riesgo la continuidad del servicio cada vez que quieras hacer un cambio.
