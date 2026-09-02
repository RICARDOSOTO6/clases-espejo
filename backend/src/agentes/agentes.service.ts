import { Injectable, UnauthorizedException } from '@nestjs/common';
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
   * FASE 2: El agente (autenticado) invita a un docente.
   * `agenteId` es el id de Usuario del agente, obtenido del JWT.
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

    const { usuario, token } = await this.prisma.$transaction(async (tx) => {
      let usuario = await tx.usuario.findUnique({
        where: { correo: dto.email },
      });

      if (!usuario) {
        usuario = await tx.usuario.create({
          data: {
            nombres: dto.nombres,
            apellidos: dto.apellidos,
            correo: dto.email,
            activo: false,
          },
        });
      }

      let docente = await tx.docente.findUnique({
        where: { usuarioId: usuario.id },
      });

      if (!docente) {
        docente = await tx.docente.create({
          data: {
            usuarioId: usuario.id,
            gradoAcademico: dto.gradoAcademico,
            especialidad: dto.especialidad,
          },
        });
      }

      await tx.docenteInstitucion.create({
        data: {
          docenteId: docente.id,
          institucionId: agente.institucionId,
          numeroEmpleado: dto.numeroEmpleado,
          activo: true,
        },
      });

      const token = await this.jwtService.signAsync(
        { sub: usuario.id, type: 'invitacion' },
        { expiresIn: (process.env.INVITATION_EXPIRES_IN ?? '7d') as any },
      );

      const tokenExpiracion = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      );

      await tx.usuario.update({
        where: { id: usuario.id },
        data: { tokenInvitacion: token, tokenExpiracion },
      });

      return { usuario, token };
    });

    await this.mailService.sendInvitation(dto.email, token);

    return {
      mensaje: 'Invitación enviada al docente',
      correo: usuario.correo,
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
}
