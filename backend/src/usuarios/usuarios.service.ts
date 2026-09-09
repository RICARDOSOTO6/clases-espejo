import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async getPerfil(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        agente: { include: { institucion: true } },
        docente: {
          include: {
            instituciones: { include: { institucion: true } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const rol = usuario.agente ? 'AGENTE' : usuario.docente ? 'DOCENTE' : null;

    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidoPaterno: usuario.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno,
      dni: usuario.dni,
      tipoDocumento: usuario.tipoDocumento,
      correo: usuario.correo,
      activo: usuario.activo,
      rol,
      agente: usuario.agente
        ? {
            id: usuario.agente.id,
            cargo: usuario.agente.cargo,
            institucion: usuario.agente.institucion,
          }
        : null,
      docente: usuario.docente
        ? {
            id: usuario.docente.id,
            gradoAcademico: usuario.docente.gradoAcademico,
            especialidad: usuario.docente.especialidad,
            instituciones: usuario.docente.instituciones.map((di) => ({
              id: di.id,
              numeroEmpleado: di.numeroEmpleado,
              activo: di.activo,
              institucion: di.institucion,
            })),
          }
        : null,
    };
  }
}
