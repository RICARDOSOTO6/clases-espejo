import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InviteDocenteDto } from './dto/invite-docente.dto';

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
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId: agenteId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede invitar docentes',
      );
    }

    const token = await this.jwtService.signAsync(
      { correo: dto.correo, type: 'invitacion' },
      { expiresIn: (process.env.INVITATION_EXPIRES_IN ?? '7d') as any },
    );

    const expiracion = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invitacion.create({
      data: {
        correo: dto.correo,
        numeroEmpleado: dto.numeroEmpleado,
        institucionId: agente.institucionId,
        token,
        expiracion,
      },
    });

    await this.mailService.sendInvitation(dto.correo, token);

    return {
      mensaje: 'Invitación enviada al docente',
      correo: dto.correo,
    };
  }

  /** Lista los docentes vinculados a la institución del agente. */
  async listarDocentes(agenteId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId: agenteId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede consultar docentes',
      );
    }

    return this.prisma.docenteInstitucion.findMany({
      where: { institucionId: agente.institucionId },
      include: {
        docente: { include: { usuario: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  /** Activa o desactiva un docente de la institución. */
  async cambiarEstadoDocente(agenteId: number, id: number, activo: boolean) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId: agenteId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar docentes',
      );
    }

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
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId: agenteId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar docentes',
      );
    }

    const docenteInstitucion = await this.prisma.docenteInstitucion.findFirst({
      where: { id, institucionId: agente.institucionId },
    });
    if (!docenteInstitucion) {
      throw new NotFoundException('Docente no encontrado');
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
}
