import { Module } from '@nestjs/common';
import { CaceService } from './cace.service';
import { InstitucionesCaceController } from './instituciones-cace.controller';
import { InstitucionesCaceService } from './instituciones-cace.service';
import { IdentidadCaceController } from './identidad-cace.controller';
import { IdentidadCacePublicaController } from './identidad-cace-publica.controller';
import { IdentidadCaceService } from './identidad-cace.service';
import { CapacidadesCaceController } from './capacidades-cace.controller';
import { MiembrosCaceController } from './miembros-cace.controller';
import { MiembrosCaceService } from './miembros-cace.service';
import { SolicitudesBorradoController } from './solicitudes-borrado.controller';
import { SolicitudesBorradoService } from './solicitudes-borrado.service';

/**
 * Panel de la CACE: el alta automática de la presidencia al arrancar
 * (`CaceService`), la gestión de instituciones (`/cace/instituciones`), la
 * identidad de la CACE (textos, logo, tema, banderas y premios) con su parte
 * pública y lo de la fase 6: las **secretarías**
 * (`/cace/miembros`), las capacidades del usuario que está dentro
 * (`/cace/capacidades`) y el **borrado con autorización**
 * (`/cace/solicitudes-borrado`).
 * `PrismaModule` y `MailModule` son globales, así que no hay que importarlos.
 */
@Module({
  controllers: [
    InstitucionesCaceController,
    IdentidadCacePublicaController,
    IdentidadCaceController,
    CapacidadesCaceController,
    MiembrosCaceController,
    SolicitudesBorradoController,
  ],
  providers: [
    CaceService,
    InstitucionesCaceService,
    IdentidadCaceService,
    MiembrosCaceService,
    SolicitudesBorradoService,
  ],
})
export class CaceModule {}
