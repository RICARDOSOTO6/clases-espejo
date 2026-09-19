import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InviteDocenteDto } from './dto/invite-docente.dto';

const INVITACION_POR_DEFECTO_DIAS = 7;

/**
 * Convierte una duración tipo `7d`, `12h`, `30m` o `45s` a milisegundos.
 * Así la fecha guardada en la invitación y la del token no se separan.
 */
function duracionEnMs(valor: string): number {
  const coincidencia = /^(\d+)\s*([smhd])$/i.exec(valor.trim());
  if (!coincidencia) {
    return INVITACION_POR_DEFECTO_DIAS * 24 * 60 * 60 * 1000;
  }
  const cantidad = Number(coincidencia[1]);
  const unidad = coincidencia[2].toLowerCase();
  const factor =
    unidad === 's'
      ? 1000
      : unidad === 'm'
        ? 60 * 1000
        : unidad === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  return cantidad * factor;
}

@Injectable()
export class AgentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * FASE 2: El agente envía una invitación al docente (solo correo + número de empleado).
   * El docente se registrará después usando el token de la invitación.
   */
  async invitarDocente(agenteId: number, dto: InviteDocenteDto) {
    const agente = await this.getAgente(agenteId);

    const yaEsUsuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });
    if (yaEsUsuario) {
      throw new ConflictException(
        'Ya existe una cuenta con ese correo: no se puede invitar como docente.',
      );
    }

    const pendiente = await this.prisma.invitacion.findFirst({
      where: { correo: dto.correo, usadaEn: null, expiracion: { gt: new Date() } },
    });
    if (pendiente) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para ese correo. Pídele que revise su bandeja o espera a que caduque.',
      );
    }

    const expiraEn = process.env.INVITATION_EXPIRES_IN ?? '7d';
    const token = await this.jwtService.signAsync(
      { correo: dto.correo, type: 'invitacion' },
      { expiresIn: expiraEn as any },
    );

    // La misma duración del token, para que no queden dos vencimientos distintos.
    const expiracion = new Date(Date.now() + duracionEnMs(expiraEn));

    const invitacion = await this.prisma.invitacion.create({
      data: {
        correo: dto.correo,
        numeroEmpleado: dto.numeroEmpleado,
        institucionId: agente.institucionId,
        token,
        expiracion,
      },
    });

    try {
      await this.mailService.sendInvitation(dto.correo, token);
    } catch {
      // Si el correo no sale, la invitación no debe quedarse bloqueando el
      // reenvío durante días sin que nadie reciba nada.
      await this.prisma.invitacion.delete({ where: { id: invitacion.id } });
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de invitación. Revisa la configuración de correo e inténtalo de nuevo.',
      );
    }

    return {
      mensaje: 'Invitación enviada al docente',
      correo: dto.correo,
    };
  }

  /** Lista los docentes vinculados a la institución del agente. */
  async listarDocentes(agenteId: number) {
    const agente = await this.getAgente(agenteId);

    return this.prisma.docenteInstitucion.findMany({
      where: { institucionId: agente.institucionId },
      include: {
        docente: { include: { usuario: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  /**
   * Activa o desactiva un docente de la institución.
   * El campo `activo` se comprueba en el guard en cada petición, así que
   * desactivar sí quita el acceso.
   */
  async cambiarEstadoDocente(agenteId: number, id: number, activo: boolean) {
    const agente = await this.getAgente(agenteId);

    const docenteInstitucion = await this.prisma.docenteInstitucion.findFirst({
      where: { id, institucionId: agente.institucionId },
    });
    if (!docenteInstitucion) {
      throw new NotFoundException('Docente no encontrado');
    }

    return this.prisma.docenteInstitucion.update({
      where: { id },
      data: { activo },
      include: { docente: { include: { usuario: true } } },
    });
  }

  /** Elimina un docente de la institución (y sus asignaciones). */
  async eliminarDocente(agenteId: number, id: number) {
    const agente = await this.getAgente(agenteId);

    const docenteInstitucion = await this.prisma.docenteInstitucion.findFirst({
      where: { id, institucionId: agente.institucionId },
    });
    if (!docenteInstitucion) {
      throw new NotFoundException('Docente no encontrado');
    }

    // Sin esto, la base de datos rechaza el borrado y el usuario ve un error 500.
    const [solicitudes, proyectos] = await Promise.all([
      this.prisma.solicitudClaseEspejo.count({
        where: {
          OR: [
            { asignacionOrigen: { docenteInstitucionId: id } },
            { asignacionDestino: { docenteInstitucionId: id } },
          ],
        },
      }),
      this.prisma.proyectoDocente.count({
        where: { asignacionDocente: { docenteInstitucionId: id } },
      }),
    ]);
    if (solicitudes > 0 || proyectos > 0) {
      throw new BadRequestException(
        'No se puede eliminar al docente: tiene solicitudes o clases espejo asociadas. Desactívalo en su lugar.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.asignacionDocente.deleteMany({
        where: { docenteInstitucionId: id },
      });
      await tx.docenteInstitucion.delete({ where: { id } });

      const restantes = await tx.docenteInstitucion.count({
        where: { docenteId: docenteInstitucion.docenteId },
      });
      if (restantes === 0) {
        const docente = await tx.docente.findUnique({
          where: { id: docenteInstitucion.docenteId },
        });
        await tx.docente.delete({ where: { id: docenteInstitucion.docenteId } });
        if (docente) {
          await tx.usuario.delete({ where: { id: docente.usuarioId } });
        }
      }
    });

    return { mensaje: 'Docente eliminado' };
  }

  private async getAgente(usuarioId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar docentes',
      );
    }
    return agente;
  }
}
