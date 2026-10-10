import { Module } from '@nestjs/common';
import {
  DirectorioInstitucionesController,
  InstitucionesController,
} from './instituciones.controller';
import { InstitucionesService } from './instituciones.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InstitucionesController, DirectorioInstitucionesController],
  providers: [InstitucionesService],
})
export class InstitucionesModule {}
