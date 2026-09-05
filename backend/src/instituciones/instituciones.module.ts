import { Module } from '@nestjs/common';
import { InstitucionesController } from './instituciones.controller';
import { InstitucionesService } from './instituciones.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InstitucionesController],
  providers: [InstitucionesService],
})
export class InstitucionesModule {}
