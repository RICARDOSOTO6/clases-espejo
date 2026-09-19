import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Autoriza ANTES de que multer escriba el archivo: solo un docente que participa
 * en el proyecto de la ruta puede subir evidencias. Sin esto, cualquier cuenta
 * autenticada podía dejar archivos en el servidor aunque no participara.
 */
@Injectable()
export class DocenteParticipanteGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const usuarioId = request.user?.sub;
    const proyectoId = Number(request.params?.id);

    if (usuarioId && Number.isInteger(proyectoId)) {
      const docente = await this.prisma.docente.findUnique({
        where: { usuarioId },
      });
      if (docente) {
        const participa = await this.prisma.proyectoDocente.findFirst({
          where: {
            proyectoId,
            asignacionDocente: {
              docenteInstitucion: { docenteId: docente.id },
            },
          },
        });
        if (participa) return true;
      }
    }

    throw new ForbiddenException(
      'Solo un docente participante puede subir evidencias a este proyecto',
    );
  }
}
