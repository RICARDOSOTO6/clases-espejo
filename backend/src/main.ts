import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

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
  '/health',
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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS restringido a los orígenes conocidos (antes aceptaba cualquiera).
  const origenes = [
    ...(process.env.FRONTEND_URL ?? '').split(','),
    'http://localhost:4200',
    'http://127.0.0.1:4200',
  ]
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origenes, credentials: false });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Los errores de integridad de Prisma salen como respuestas legibles.
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Servir los archivos subidos (evidencias) en /uploads.
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  // Los archivos son datos del usuario, no contenido web: se fuerzan como
  // descarga y sin olfateo de tipo, para que un .html/.svg subido jamás se
  // ejecute en el origen de la aplicación.
  app.use('/uploads', (_req: any, res: any, next: any) => {
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
    app.useStaticAssets(publicDir);

    // Fallback SPA: rutas del frontend (no API) → index.html.
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
