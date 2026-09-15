import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

const API_PREFIXES = [
  '/auth',
  '/usuarios',
  '/agentes',
  '/materias',
  '/asignaciones',
  '/instituciones',
  '/solicitudes',
  '/proyectos',
  '/health',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Servir los archivos subidos (evidencias) en /uploads.
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Servir el frontend compilado (carpeta backend/public) si existe.
  const publicDir = join(process.cwd(), 'public');
  const indexHtml = join(publicDir, 'index.html');
  if (existsSync(indexHtml)) {
    app.useStaticAssets(publicDir);

    // Fallback SPA: rutas del frontend (no API) → index.html.
    const express = app.getHttpAdapter().getInstance();
    express.use((req: any, res: any, next: any) => {
      const esApi = API_PREFIXES.some(
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
