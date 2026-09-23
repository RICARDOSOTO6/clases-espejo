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

  // Servir el frontend compilado (carpeta backend/public) si existe.
  const publicDir = join(process.cwd(), 'public');
  const indexHtml = join(publicDir, 'index.html');
  if (existsSync(indexHtml)) {
    app.useStaticAssets(publicDir);

    // Fallback SPA: rutas del frontend (no API) → index.html.
    const express = app.getHttpAdapter().getInstance();
    const prefijos = prefijosApi(app);
    express.use((req: any, res: any, next: any) => {
      const esApi = prefijos.some(
        (p) => req.path === p || req.path.startsWith(`${p}/`),
      );
      if (req.method === 'GET' && !esApi && !req.path.includes('.')) {
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
