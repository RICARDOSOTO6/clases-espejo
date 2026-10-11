import { Module } from '@nestjs/common';
import { CaceService } from './cace.service';
import { InstitucionesCaceController } from './instituciones-cace.controller';
import { InstitucionesCaceService } from './instituciones-cace.service';
import { IdentidadCaceController } from './identidad-cace.controller';
import { IdentidadCacePublicaController } from './identidad-cace-publica.controller';
import { IdentidadCaceService } from './identidad-cace.service';

/**
 * Panel de la presidencia de la CACE: el alta automática de la cuenta al
 * arrancar (`CaceService`), la gestión de instituciones
 * (`/cace/instituciones`) y la identidad de la CACE (textos, logo, tema,
 * banderas y premios) con su parte pública.
 * `PrismaModule` y `MailModule` son globales, así que no hay que importarlos.
 */
@Module({
  controllers: [
    InstitucionesCaceController,
    IdentidadCacePublicaController,
    IdentidadCaceController,
  ],
  providers: [CaceService, InstitucionesCaceService, IdentidadCaceService],
})
export class CaceModule {}
