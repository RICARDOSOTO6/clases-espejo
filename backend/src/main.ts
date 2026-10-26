import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { extname, join, sep } from 'path';
import { existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { gzipSync } from 'zlib';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { aplicarCabecerasSeguridad } from './common/seguridad-cabeceras.middleware';

/** Prefijos conocidos de la API (red de seguridad del fallback del SPA). */
const PREFIJOS_API_CONOCIDOS = [
  '/auth',
  '/usuarios',
  '/agentes',
  '/materias',
  '/asignaciones',
  '/instituciones',
  '/solicitudes',
  '/proyectos',
  '/recordatorios',
  '/cace',
  '/secretarias',
  '/health',
  // Cola de correo (Fase 2): el progreso de un lote también es API.
  '/envios',
  // La verificación pública de un certificado se llama igual que su página
  // (`/verificar/<folio>`), así que tiene que estar aquí: si no, la llamada de
  // la propia página recibiría el `index.html` en lugar del JSON. La navegación
  // del navegador sí sigue recibiendo la página, porque esa pide `text/html`.
  '/verificar',
];

/**
 * Prefijos reales de la API: se derivan del router para que un módulo nuevo no
 * acabe devolviendo el index.html, y se suman los conocidos como red de
 * seguridad.
 */
function prefijosApi(app: NestExpressApplication): string[] {
  const express = app.getHttpAdapter().getInstance();
  const capas: any[] = express?._router?.stack ?? [];
  const prefijos = new Set<string>(PREFIJOS_API_CONOCIDOS);
  for (const capa of capas) {
    const ruta = capa?.route?.path;
    if (typeof ruta === 'string' && ruta.startsWith('/')) {
      const segmento = ruta.split('/')[1];
      if (segmento) prefijos.add(`/${segmento}`);
    }
  }
  return [...prefijos];
}

/**
 * Tipos de archivo de texto que se sirven comprimidos. Las imágenes y las
 * fuentes ya vienen comprimidas: volver a comprimirlas solo gasta CPU.
 */
const TIPOS_DE_TEXTO: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * Un nombre con hash de contenido (`main-ABCD1234.js`, `styles-9F8E7D6C.css`)
 * no cambia nunca: el build le cambia el hash justo cuando cambia el contenido.
 * Esos se pueden cachear para siempre; el resto (logo, iconos, favicon), una
 * semana, porque su nombre no cambia aunque el contenido sí.
 */
function esNombreConHash(ruta: string): boolean {
  return /-[A-Za-z0-9_]{6,}\.(?:js|mjs|css)$/.test(ruta);
}

/** Política de caché de un estático según si su nombre lleva hash. */
function cacheDeArchivo(ruta: string): string {
  return esNombreConHash(ruta)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=604800';
}

/**
 * El HTML se revalida siempre, pero puede responder 304 si no cambió: así una
 * segunda visita no vuelve a bajar el `index.html` entero. Se usa
 * `max-age=0, must-revalidate` y no `no-cache` porque `no-cache` desactiva el
 * 304 en Express.
 */
const CACHE_HTML = 'max-age=0, must-revalidate';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cabeceras de seguridad antes de cualquier estático o ruta, para que también
  // las reciba el index.html, los chunks y los archivos de /uploads.
  app.use(aplicarCabecerasSeguridad);

  // CORS restringido a los orígenes conocidos (antes aceptaba cualquiera).
  const origenes = [
    ...(process.env.FRONTEND_URL ?? '').split(','),
    'http://localhost:4200',
    'http://127.0.0.1:4200',
  ]
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origenes,
    credentials: false,
    // El nombre del archivo que se descarga (el .ics del calendario, el PDF del
    // resumen…) viaja en `Content-Disposition`. Sin exponerla, el navegador no
    // deja leerla cuando el frontend está en otro origen (en desarrollo, el
    // 4200) y la descarga acaba con un nombre genérico.
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Los errores de integridad de Prisma salen como respuestas legibles.
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Servir los archivos subidos (evidencias) en /uploads.
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  // Los archivos son datos del usuario, no contenido web: se fuerzan como
  // descarga y sin olfateo de tipo, para que un .html/.svg subido jamás se
  // ejecute en el origen de la aplicación.
  app.use('/uploads', (req: any, res: any, next: any) => {
    // Los certificados emitidos guardan su PDF dentro de `uploads` (es donde
    // están todos los archivos del usuario), pero **no se sirven nunca como
    // estáticos**: llevan el nombre de una persona y se descargan solo por su
    // ruta con sesión. Sin este corte, quien adivine la URL se lleva un
    // certificado ajeno.
    //
    // Lo mismo vale para los certificados de los **premios**: se descargan por
    // `/cace/premios/certificado/<archivo>`, que comprueba que el premio esté
    // publicado y le pone su nombre y su tipo; servidos desde aquí saldrían sin
    // nombre y sin comprobar nada.
    const ruta = String(req.originalUrl ?? req.url ?? '').split('?')[0];
    if (
      /^\/uploads\/certificados\//.test(ruta) ||
      /^\/uploads\/premios-certificados\//.test(ruta)
    ) {
      res.status(404).json({ statusCode: 404, message: 'No encontrado' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    next();
  });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Fotos de perfil: son imágenes, así que se sirven en línea para poder
  // mostrarlas con <img>. La carpeta solo acepta PNG, JPG y WEBP (nunca SVG) y
  // se mantiene el nosniff para que el navegador no adivine el tipo.
  const avataresDir = join(uploadsDir, 'avatares');
  mkdirSync(avataresDir, { recursive: true });
  app.use('/avatares', (_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    // Se permite el incrustado desde otro origen a propósito: en desarrollo el
    // frontend corre en `:4200` y el backend en `:3000`, y con `same-origin` el
    // navegador bloquearía la foto.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.useStaticAssets(avataresDir, { prefix: '/avatares/' });

  // Logos de institución: mismos permisos que las fotos de perfil (se muestran
  // con <img> en el catálogo y en el registro), pero en su propia carpeta. No
  // sirven los `/uploads`: allí todo va forzado como descarga.
  const logosDir = join(uploadsDir, 'instituciones');
  mkdirSync(logosDir, { recursive: true });
  app.use('/logos', (_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.useStaticAssets(logosDir, { prefix: '/logos/' });

  // Logo de la CACE: misma idea que el logo de institución (se pinta con
  // <img> en la pantalla de acceso y en el panel), pero en su propia carpeta y
  // con su propia ruta. No se reutiliza `/logos` para que borrar la carpeta de
  // una institución no se lleve por delante la identidad de la CACE.
  const caceLogoDir = join(uploadsDir, 'cace');
  mkdirSync(caceLogoDir, { recursive: true });
  app.use('/cace-logo', (_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.useStaticAssets(caceLogoDir, { prefix: '/cace-logo/' });

  // Imágenes de los premios y reconocimientos: también se muestran en la web
  // (sección «Comunidad» y portada), así que van en línea y en su carpeta.
  const premiosDir = join(uploadsDir, 'premios');
  mkdirSync(premiosDir, { recursive: true });
  app.use('/premios', (_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.useStaticAssets(premiosDir, { prefix: '/premios/' });

  // Fondos de la plantilla del certificado (fase 4): se pintan con `<img>` en
  // la vista previa del panel, así que van en línea y en su propia carpeta.
  // Los PDF emitidos viven en `uploads/certificados` y **no** se sirven aquí:
  // esos se descargan solo con sesión, desde su ruta de la API.
  const fondosCertificadoDir = join(uploadsDir, 'certificados-fondos');
  mkdirSync(fondosCertificadoDir, { recursive: true });
  app.use('/certificado-fondo', (_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.useStaticAssets(fondosCertificadoDir, { prefix: '/certificado-fondo/' });

  // Plantillas descargables (hoy, la lista de alumnos de ejemplo). Viven en
  // `backend/plantillas` y no en `public/`, porque `public/` es la salida del
  // build de Angular y se vacía en cada compilación. Se fuerzan como descarga:
  // son archivos para guardar, no contenido para mostrar.
  const plantillasDir = join(process.cwd(), 'plantillas');
  if (existsSync(plantillasDir)) {
    app.use('/plantillas', (_req: any, res: any, next: any) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'attachment');
      next();
    });
    app.useStaticAssets(plantillasDir, { prefix: '/plantillas/' });
  }

  // Servir el frontend compilado (carpeta backend/public) si existe.
  const publicDir = join(process.cwd(), 'public');
  const indexHtml = join(publicDir, 'index.html');
  if (existsSync(indexHtml)) {
    // --- Estáticos del frontend: gzip y caché larga ---
    // Los `.js`, `.css` y el `index.html` se sirven comprimidos desde memoria y
    // con ETag. Los que llevan hash en el nombre se cachean un año; la página
    // se revalida siempre (y responde 304 si no cambió). Se hace aquí, sin
    // añadir el paquete `compression`, para no sumar dependencias.
    const comprimidos = new Map<
      string,
      { crudo: Buffer; gz: Buffer; etag: string }
    >();

    /**
     * Sirve un archivo de texto comprimido, con ETag y 304. Devuelve `false`
     * si no es un archivo que este middleware sirva.
     */
    const servirTexto = (
      req: any,
      res: any,
      archivo: string,
      ruta: string,
    ): boolean => {
      const tipo = TIPOS_DE_TEXTO[extname(archivo).toLowerCase()];
      if (!tipo || !existsSync(archivo)) return false;
      const datos = statSync(archivo);
      if (!datos.isFile()) return false;

      const clave = `${archivo}:${datos.mtimeMs}:${datos.size}`;
      let entrada = comprimidos.get(clave);
      if (!entrada) {
        // El mapa se vacía al reconstruir el frontend: los nombres cambian.
        if (comprimidos.size > 200) comprimidos.clear();
        const crudo = readFileSync(archivo);
        entrada = {
          crudo,
          gz: gzipSync(crudo, { level: 9 }),
          etag: `W/"${datos.size.toString(16)}-${datos.mtimeMs.toString(16)}"`,
        };
        comprimidos.set(clave, entrada);
      }

      const aceptaGzip = /(?:^|,)\s*gzip\s*(?:;|,|$)/i.test(
        String(req.headers['accept-encoding'] ?? ''),
      );
      const etag = aceptaGzip ? `${entrada.etag}-gz` : entrada.etag;
      res.setHeader('Content-Type', tipo);
      res.setHeader(
        'Cache-Control',
        extname(archivo).toLowerCase() === '.html'
          ? CACHE_HTML
          : cacheDeArchivo(ruta),
      );
      res.setHeader('ETag', etag);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (String(req.headers['if-none-match'] ?? '') === etag) {
        res.status(304).end();
        return true;
      }

      const cuerpo = aceptaGzip ? entrada.gz : entrada.crudo;
      if (aceptaGzip) res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', String(cuerpo.length));
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(cuerpo);
      }
      return true;
    };

    app.use((req: any, res: any, next: any) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const ruta = decodeURIComponent(String(req.path ?? '/'));
      // La raíz es la página: se sirve como cualquier HTML.
      const archivo = ruta === '/' ? indexHtml : join(publicDir, ruta);
      // Solo archivos de dentro de `public/`: un `../` no sale de aquí.
      if (!archivo.startsWith(publicDir + sep)) return next();
      if (!TIPOS_DE_TEXTO[extname(archivo).toLowerCase()]) return next();
      return servirTexto(req, res, archivo, ruta) ? undefined : next();
    });

    // El resto de estáticos (imágenes, fuentes, favicon) sale por Express, con
    // la misma política de caché.
    app.useStaticAssets(publicDir, {
      setHeaders: (respuesta: any, ruta: string) => {
        respuesta.setHeader(
          'Cache-Control',
          ruta.endsWith('.html') ? CACHE_HTML : cacheDeArchivo(ruta),
        );
      },
    });

    // Fallback SPA: rutas del frontend (no API) → index.html comprimido y con
    // ETag, igual que la raíz.
    const express = app.getHttpAdapter().getInstance();
    const prefijos = prefijosApi(app);
    express.use((req: any, res: any, next: any) => {
      if (req.method !== 'GET' || req.path.includes('.')) return next();

      const esApi = prefijos.some(
        (p) => req.path === p || req.path.startsWith(`${p}/`),
      );
      // Una navegación del navegador (abrir el enlace o recargar con F5) pide
      // HTML; las llamadas de la propia aplicación piden JSON. Si el navegador
      // pide la página se le entrega la aplicación aunque la dirección coincida
      // con una ruta de la API: `/proyectos/24` es a la vez una ruta del
      // frontend y de la API, y sin esto quien recarga dentro de una clase
      // espejo vería un JSON de error en lugar de la pantalla.
      const pideHtml = String(req.headers.accept ?? '').includes('text/html');
      if (!esApi || pideHtml) {
        if (servirTexto(req, res, indexHtml, '/index.html')) return;
        res.setHeader('Cache-Control', CACHE_HTML);
        return res.sendFile(indexHtml);
      }
      return next();
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend corriendo en http://localhost:${port}`);
}

void bootstrap();
