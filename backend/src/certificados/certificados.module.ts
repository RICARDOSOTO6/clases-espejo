import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CertificadoPdfService } from './certificado-pdf.service';
import { CertificadosCaceController } from './certificados-cace.controller';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';
import { PlantillasCertificadoController } from './plantillas.controller';
import { PlantillasService } from './plantillas.service';
import { VerificacionController } from './verificacion.controller';
import { VerificacionService } from './verificacion.service';
import { EnviosModule } from '../envios/envios.module';

/**
 * Certificados de la clase espejo (fases 4 y 5).
 *
 * Van en su propio módulo y no dentro de `CaceModule` ni de `ProyectosModule`
 * porque son **dos permisos distintos en dos pantallas distintas**: la
 * plantilla la diseña la presidencia desde el panel (`/cace/certificados`),
 * con `disenarCertificados`, y la emisión la hace el docente desde su clase
 * espejo (`/proyectos/:id/certificados`), con `emitirCertificados`. En un
 * módulo compartido, los guardias de uno acabarían aplicándose al otro.
 *
 * En la fase 5 se suman tres cosas: la **verificación pública**
 * (`/verificar/:folio`, sin guardia, que es lo que abre el QR), la **anulación**
 * (del docente en su clase y de la presidencia en `/cace/certificados`) y el
 * **envío por correo** a los alumnos, que va por la ruta del docente.
 *
 * `PrismaModule` y `MailModule` son globales, así que no hay que importarlos.
 */
@Module({
  imports: [AuthModule, EnviosModule],
  controllers: [
    PlantillasCertificadoController,
    CertificadosCaceController,
    CertificadosController,
    VerificacionController,
  ],
  providers: [
    PlantillasService,
    CertificadosService,
    CertificadoPdfService,
    VerificacionService,
  ],
})
export class CertificadosModule {}
