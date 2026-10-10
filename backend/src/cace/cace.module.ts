import { Module } from '@nestjs/common';
import { CaceService } from './cace.service';
import { InstitucionesCaceController } from './instituciones-cace.controller';
import { InstitucionesCaceService } from './instituciones-cace.service';

/**
 * Panel de la presidencia de la CACE: el alta automática de la cuenta al
 * arrancar (`CaceService`) y la gestión de instituciones (`/cace/instituciones`).
 * `PrismaModule` y `MailModule` son globales, así que no hay que importarlos.
 */
@Module({
  controllers: [InstitucionesCaceController],
  providers: [CaceService, InstitucionesCaceService],
})
export class CaceModule {}
