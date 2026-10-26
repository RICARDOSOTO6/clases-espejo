import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ESTADO_CACE_PENDIENTE } from '../common/estados';
import { VERSION_AVISO_PRIVACIDAD } from '../common/privacidad';
import { exigirPoliticaPassword } from '../common/politica-password';
import { ActivarInvitacionAgenteDto } from './dto/activar-invitacion-agente.dto';

const INVITACION_POR_DEFECTO = '7d';

function duracionEnMs(valor: string): number {
  const coincidencia = /^(\d+)\s*([smhd])$/i.exec(valor.trim());
  if (!coincidencia) return 7 * 24 * 60 * 60 * 1000;
  const cantidad = Number(coincidencia[1]);
  const factor =
    coincidencia[2].toLowerCase() === 's'
      ? 1000
      : coincidencia[2].toLowerCase() === 'm'
        ? 60 * 1000
        : coincidencia[2].toLowerCase() === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  return cantidad * factor;
}

@Injectable()
export class InvitacionesAgenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** La presidencia crea un enlace; no se pide ni se envía correo. */
  async crear(usuarioId: number, urlPublica: string) {
    const expiraEn =
      process.env.INVITATION_EXPIRES_IN ?? INVITACION_POR_DEFECTO;
    const token = await this.jwt.signAsync(
      {
        type: 'invitacion_agente',
        jti: randomUUID(),
      },
      { expiresIn: expiraEn as any },
    );
    const expiracion = new Date(Date.now() + duracionEnMs(expiraEn));
    const invitacion = await this.prisma.invitacionAgente.create({
      data: { creadaPorUsuarioId: usuarioId, token, expiracion },
    });
    return {
      mensaje:
        'Enlace de agente creado. Cópialo y compártelo con la persona que coordinará la institución.',
      id: invitacion.id,
      enlace: `${urlPublica}/activar-agente?token=${encodeURIComponent(token)}`,
      expiracion,
    };
  }

  async listarPendientes() {
    const invitaciones = await this.prisma.invitacionAgente.findMany({
      where: { usadaEn: null, expiracion: { gt: new Date() } },
      select: { id: true, creadoEn: true, expiracion: true },
      orderBy: { creadoEn: 'desc' },
    });
    return invitaciones;
  }

  async revocar(id: number) {
    const resultado = await this.prisma.invitacionAgente.updateMany({
      where: { id, usadaEn: null },
      data: { usadaEn: new Date() },
    });
    if (resultado.count === 0) {
      throw new NotFoundException('Invitación de agente no encontrada');
    }
    return { mensaje: 'Enlace de agente revocado.' };
  }

  async validar(token: string) {
    if (!token?.trim()) {
      throw new BadRequestException('Falta el token de la invitación');
    }
    const invitacion = await this.prisma.invitacionAgente.findUnique({
      where: { token },
    });
    if (!invitacion) {
      throw new NotFoundException('Invitación de agente no válida');
    }
    if (invitacion.usadaEn) {
      throw new BadRequestException('La invitación ya fue usada');
    }
    if (invitacion.expiracion < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }
    return { valido: true };
  }

  async activar(dto: ActivarInvitacionAgenteDto) {
    if (dto.institucionId != null) {
      throw new BadRequestException(
        'Esta invitación es para crear una institución nueva, no para unirse a una existente.',
      );
    }
    const invitacion = await this.prisma.invitacionAgente.findUnique({
      where: { token: dto.token },
    });
    if (!invitacion) {
      throw new NotFoundException('Invitación de agente no válida');
    }
    if (invitacion.usadaEn) {
      throw new BadRequestException('La invitación ya fue usada');
    }
    if (invitacion.expiracion < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }

    const camposInstitucion: [string, string | undefined][] = [
      ['nombreInstitucion', dto.nombreInstitucion],
      ['pais', dto.pais],
      ['codigoPais', dto.codigoPais],
      ['estado', dto.estado],
      ['ciudad', dto.ciudad],
      ['telefono', dto.telefono],
      ['correoInstitucional', dto.correoInstitucional],
    ];
    const faltantes = camposInstitucion
      .filter(([, valor]) => !valor?.trim())
      .map(([campo]) => campo);
    if (faltantes.length > 0) {
      throw new BadRequestException(
        `Faltan datos de la institución: ${faltantes.join(', ')}.`,
      );
    }
    if (!dto.cargo?.trim()) {
      throw new BadRequestException('Falta el cargo del agente.');
    }

    const correo = dto.correo.trim().toLowerCase();
    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ correo }, { dni: dto.dni }] },
      select: { id: true },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo o DNI');
    }

    exigirPoliticaPassword(dto.password, correo);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const ahora = new Date();

    const resultado = await this.prisma.$transaction(async (tx) => {
      const consumo = await tx.invitacionAgente.updateMany({
        where: { id: invitacion.id, usadaEn: null },
        data: { usadaEn: ahora },
      });
      if (consumo.count !== 1) {
        throw new ConflictException('La invitación ya fue usada');
      }

      const usuario = await tx.usuario.create({
        data: {
          nombres: dto.nombres,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          dni: dto.dni,
          tipoDocumento: dto.tipoDocumento,
          correo,
          passwordHash,
          activo: true,
          // El enlace de la presidencia es la prueba de identidad de este alta.
          correoVerificado: true,
          aceptoAvisoVersion: VERSION_AVISO_PRIVACIDAD,
          aceptoAvisoEn: ahora,
        },
      });

      const institucion = await tx.institucion.create({
        data: {
          nombre: dto.nombreInstitucion!.trim(),
          pais: dto.pais!.trim(),
          codigoPais: dto.codigoPais!.trim(),
          estado: dto.estado!.trim(),
          ciudad: dto.ciudad!.trim(),
          telefono: dto.telefono!.trim(),
          correoInstitucional: dto.correoInstitucional!.trim(),
          activa: true,
          registroCompleto: true,
          estadoCace: ESTADO_CACE_PENDIENTE,
        },
      });

      await tx.agenteInternacionalizacion.create({
        data: {
          usuarioId: usuario.id,
          institucionId: institucion.id,
          cargo: dto.cargo.trim(),
          esPrincipal: true,
          confirmadoEn: ahora,
        },
      });

      return { usuario, institucion };
    });

    return {
      mensaje:
        `Cuenta y institución creadas. «${resultado.institucion.nombre}» ` +
        'quedó pendiente de aprobación por la CACE; mientras tanto el agente ' +
        'puede entrar y completar sus datos.',
      usuarioId: resultado.usuario.id,
      institucion: {
        id: resultado.institucion.id,
        nombre: resultado.institucion.nombre,
        estadoCace: ESTADO_CACE_PENDIENTE,
      },
    };
  }
}
