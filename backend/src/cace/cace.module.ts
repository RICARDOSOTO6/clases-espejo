import { Module } from '@nestjs/common';
import { CaceService } from './cace.service';

/**
 * Alta automática de la presidencia de la CACE. No tiene controlador: trabaja
 * sola al arrancar el servidor (`PrismaModule` y `MailModule` son globales).
 */
@Module({
  providers: [CaceService],
})
export class CaceModule {}
