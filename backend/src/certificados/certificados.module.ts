import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CertificadoPdfService } from './certificado-pdf.service';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';
import { PlantillasCertificadoController } from './plantillas.controller';
import { PlantillasService } from './plantillas.service';

/**
 * Certificados de la clase espejo (fase 4).
 *
 * Van en su propio módulo y no dentro de `CaceModule` ni de `ProyectosModule`
 * porque son **dos permisos distintos en dos pantallas distintas**: la
 * plantilla la diseña la presidencia desde el panel (`/cace/certificados`),
 * con `disenarCertificados`, y la emisión la hace el docente desde su clase
 * espejo (`/proyectos/:id/certificados`), con `emitirCertificados`. En un
 * módulo compartido, los guardias de uno acabarían aplicándose al otro.
 *
 * `PrismaModule` es global, así que no hay que importarlo.
 */
@Module({
  imports: [AuthModule],
  controllers: [PlantillasCertificadoController, CertificadosController],
  providers: [PlantillasService, CertificadosService, CertificadoPdfService],
})
export class CertificadosModule {}
