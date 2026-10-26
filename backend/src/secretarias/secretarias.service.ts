import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { exigirAgenteHabilitado } from '../common/institucion-habilitada';
import { ESTADO_CACE_APROBADA } from '../common/estados';
import { VERSION_AVISO_PRIVACIDAD } from '../common/privacidad';
import { exigirPoliticaPassword } from '../common/politica-password';
import { ActivarSecretariaDto } from './dto/activar-secretaria.dto';
import { ActualizarContactoInstitucionDto } from './dto/actualizar-contacto.dto';
import { InvitarDocenteSecretariaDto } from './dto/invitar-docente.dto';

const INVITACION_POR_DEFECTO = '7d';

/** Convierte `7d`, `12h` o `30m` a milisegundos, igual que las invitaciones docentes. */
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
export class SecretariasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  /**
   * La secretaría se invita desde el agente principal de la institución. Solo
   * se devuelve el enlace: no se envía ni se pide correo para la invitación.
   */
  async crearInvitacion(usuarioId: number, urlPublica: string) {
    const agente = await this.agentePrincipal(usuarioId);
    const yaTiene = await this.prisma.secretariaInstitucion.findUnique({
      where: { institucionId: agente.institucionId },
      select: { id: true, activo: true },
    });
    if (yaTiene?.activo) {
      throw new ConflictException(
        'La institución ya tiene una secretaría activa. Desactívala antes de invitar a otra persona.',
      );
    }
    const pendiente = await this.prisma.invitacionSecretaria.findFirst({
      where: {
        institucionId: agente.institucionId,
        usadaEn: null,
        expiracion: { gt: new Date() },
      },
      select: { id: true, token: true, expiracion: true },
    });
    if (pendiente) {
      return {
        mensaje:
          'Ya hay un enlace de secretaría vigente. Se reutiliza para que no se pierda.',
        id: pendiente.id,
        institucion: agente.institucion.nombre,
        enlace: `${urlPublica}/activar-secretaria?token=${encodeURIComponent(pendiente.token)}`,
        expiracion: pendiente.expiracion,
      };
    }

    const expiraEn =
      process.env.INVITATION_EXPIRES_IN ?? INVITACION_POR_DEFECTO;
    const token = await this.jwt.signAsync(
      {
        type: 'invitacion_secretaria',
        institucionId: agente.institucionId,
        // Sin `jti`, dos enlaces del mismo segundo serían idénticos y el
        // segundo chocaría con la clave única de la tabla.
        jti: randomUUID(),
      },
      { expiresIn: expiraEn as any },
    );
    const expiracion = new Date(Date.now() + duracionEnMs(expiraEn));
    const invitacion = await this.prisma.invitacionSecretaria.create({
      data: {
        institucionId: agente.institucionId,
        creadaPorUsuarioId: usuarioId,
        token,
        expiracion,
      },
    });

    return {
      mensaje:
        'Enlace de secretaría creado. Cópialo y compártelo con la persona.',
      id: invitacion.id,
      institucion: agente.institucion.nombre,
      enlace: `${urlPublica}/activar-secretaria?token=${encodeURIComponent(token)}`,
      expiracion,
    };
  }

  /** Estado actual para el agente principal: secretaría y enlace pendiente. */
  async actual(usuarioId: number) {
    const agente = await this.agentePrincipal(usuarioId);
    const [secretaria, pendiente] = await Promise.all([
      this.prisma.secretariaInstitucion.findUnique({
        where: { institucionId: agente.institucionId },
        include: {
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidoPaterno: true,
              apellidoMaterno: true,
              correo: true,
            },
          },
        },
      }),
      this.prisma.invitacionSecretaria.findFirst({
        where: {
          institucionId: agente.institucionId,
          usadaEn: null,
          expiracion: { gt: new Date() },
        },
        select: { id: true, expiracion: true },
      }),
    ]);

    return {
      institucion: agente.institucion.nombre,
      secretaria: secretaria
        ? {
            id: secretaria.id,
            usuarioId: secretaria.usuarioId,
            activo: secretaria.activo,
            nombre:
              `${secretaria.usuario.nombres} ${secretaria.usuario.apellidoPaterno} ${secretaria.usuario.apellidoMaterno}`.trim(),
            correo: secretaria.usuario.correo,
            desde: secretaria.creadoEn,
          }
        : null,
      invitacionPendiente: pendiente
        ? { id: pendiente.id, expiracion: pendiente.expiracion }
        : null,
    };
  }

  /** Desactiva la secretaría y anula cualquier enlace pendiente. */
  async desactivar(usuarioId: number) {
    const agente = await this.agentePrincipal(usuarioId);
    const [resultado] = await this.prisma.$transaction([
      this.prisma.secretariaInstitucion.updateMany({
        where: { institucionId: agente.institucionId, activo: true },
        data: { activo: false },
      }),
      this.prisma.invitacionSecretaria.updateMany({
        where: {
          institucionId: agente.institucionId,
          usadaEn: null,
        },
        data: { usadaEn: new Date() },
      }),
    ]);
    if (resultado.count === 0) {
      throw new NotFoundException(
        'La institución no tiene una secretaría activa que desactivar.',
      );
    }
    return {
      mensaje:
        'Secretaría desactivada. Ya puedes crear un enlace para reemplazarla.',
    };
  }

  /** Anula un enlace pendiente para que no pueda usarse. */
  async revocarInvitacion(usuarioId: number, invitacionId: number) {
    const agente = await this.agentePrincipal(usuarioId);
    const resultado = await this.prisma.invitacionSecretaria.updateMany({
      where: {
        id: invitacionId,
        institucionId: agente.institucionId,
        usadaEn: null,
      },
      data: { usadaEn: new Date() },
    });
    if (resultado.count === 0) {
      throw new NotFoundException('Invitación pendiente no encontrada');
    }
    return { mensaje: 'Enlace revocado. Puedes crear uno nuevo.' };
  }

  /** Valida un token antes de mostrar el cuestionario público. */
  async validarInvitacion(token: string) {
    if (!token?.trim()) {
      throw new BadRequestException('Falta el token de la invitación');
    }
    const invitacion = await this.prisma.invitacionSecretaria.findUnique({
      where: { token },
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
            pais: true,
            estadoCace: true,
          },
        },
      },
    });
    if (!invitacion) {
      throw new NotFoundException('Invitación de secretaría no válida');
    }
    if (invitacion.usadaEn) {
      throw new BadRequestException('La invitación ya fue usada');
    }
    if (invitacion.expiracion < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }
    if (invitacion.institucion.estadoCace !== ESTADO_CACE_APROBADA) {
      throw new BadRequestException(
        'La institución todavía no está aprobada por la CACE.',
      );
    }
    return {
      valido: true,
      institucion: invitacion.institucion,
    };
  }

  /** Crea la cuenta y el vínculo de secretaría en una sola transacción. */
  async activar(dto: ActivarSecretariaDto) {
    const invitacion = await this.prisma.invitacionSecretaria.findUnique({
      where: { token: dto.token },
      include: {
        institucion: { select: { id: true, nombre: true, estadoCace: true } },
      },
    });
    if (!invitacion) {
      throw new NotFoundException('Invitación de secretaría no válida');
    }
    if (invitacion.usadaEn) {
      throw new BadRequestException('La invitación ya fue usada');
    }
    if (invitacion.expiracion < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }
    if (invitacion.institucion.estadoCace !== ESTADO_CACE_APROBADA) {
      throw new BadRequestException(
        'La institución todavía no está aprobada por la CACE.',
      );
    }

    const correo = dto.correo.trim().toLowerCase();
    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ correo }, { dni: dto.dni }] },
      select: { id: true },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo o DNI');
    }
    const secretariaExistente =
      await this.prisma.secretariaInstitucion.findUnique({
        where: { institucionId: invitacion.institucionId },
        select: { id: true, activo: true },
      });
    if (secretariaExistente?.activo) {
      throw new ConflictException(
        'La institución ya tiene una secretaría activa',
      );
    }

    exigirPoliticaPassword(dto.password, correo);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const ahora = new Date();

    const usuario = await this.prisma.$transaction(async (tx) => {
      const consumo = await tx.invitacionSecretaria.updateMany({
        where: { id: invitacion.id, usadaEn: null },
        data: { usadaEn: ahora },
      });
      if (consumo.count !== 1) {
        throw new ConflictException('La invitación ya fue usada');
      }
      const creado = await tx.usuario.create({
        data: {
          nombres: dto.nombres,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          dni: dto.dni,
          tipoDocumento: dto.tipoDocumento,
          correo,
          passwordHash,
          activo: true,
          correoVerificado: true,
          aceptoAvisoVersion: VERSION_AVISO_PRIVACIDAD,
          aceptoAvisoEn: ahora,
        },
      });
      if (secretariaExistente) {
        await tx.secretariaInstitucion.update({
          where: { id: secretariaExistente.id },
          data: { usuarioId: creado.id, activo: true },
        });
      } else {
        await tx.secretariaInstitucion.create({
          data: {
            usuarioId: creado.id,
            institucionId: invitacion.institucionId,
            activo: true,
          },
        });
      }
      return creado;
    });

    return {
      mensaje: `Cuenta de secretaría creada para ${invitacion.institucion.nombre}.`,
      usuarioId: usuario.id,
      institucion: invitacion.institucion.nombre,
    };
  }

  private async agentePrincipal(usuarioId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
      select: {
        institucionId: true,
        esPrincipal: true,
        institucion: {
          select: { nombre: true, estadoCace: true, activa: true },
        },
      },
    });
    if (!agente || !agente.esPrincipal) {
      throw new ForbiddenException(
        'Solo el agente principal puede administrar la secretaría de su institución.',
      );
    }
    await exigirAgenteHabilitado(this.prisma, usuarioId);
    return agente;
  }

  private async contexto(usuarioId: number) {
    const secretaria = await this.prisma.secretariaInstitucion.findUnique({
      where: { usuarioId },
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
            pais: true,
            codigoPais: true,
            estado: true,
            ciudad: true,
            telefono: true,
            correoInstitucional: true,
            logoUrl: true,
            estadoCace: true,
            activa: true,
          },
        },
      },
    });
    if (!secretaria || !secretaria.activo) {
      throw new ForbiddenException(
        'Esta cuenta no es una secretaría activa de institución.',
      );
    }
    if (secretaria.institucion.estadoCace !== ESTADO_CACE_APROBADA) {
      throw new ForbiddenException(
        'La institución no está aprobada por la CACE.',
      );
    }
    return secretaria;
  }

  async perfil(usuarioId: number) {
    const secretaria = await this.contexto(usuarioId);
    return {
      institucion: secretaria.institucion,
      secretaria: { id: secretaria.id, activo: secretaria.activo },
    };
  }

  async actualizarContacto(
    usuarioId: number,
    dto: ActualizarContactoInstitucionDto,
  ) {
    const secretaria = await this.contexto(usuarioId);
    const institucion = await this.prisma.institucion.update({
      where: { id: secretaria.institucionId },
      data: {
        ...(dto.telefono !== undefined
          ? { telefono: dto.telefono.trim() }
          : {}),
        ...(dto.correoInstitucional !== undefined
          ? { correoInstitucional: dto.correoInstitucional.trim() }
          : {}),
        ...(dto.estado !== undefined ? { estado: dto.estado.trim() } : {}),
        ...(dto.ciudad !== undefined ? { ciudad: dto.ciudad.trim() } : {}),
      },
      select: {
        id: true,
        nombre: true,
        pais: true,
        ciudad: true,
        estado: true,
        telefono: true,
        correoInstitucional: true,
        logoUrl: true,
        estadoCace: true,
      },
    });
    return { mensaje: 'Datos de contacto actualizados', institucion };
  }

  async listarDocentes(usuarioId: number) {
    const { institucionId } = await this.contexto(usuarioId);
    const docentes = await this.prisma.docenteInstitucion.findMany({
      where: { institucionId },
      include: { docente: { include: { usuario: true } } },
      orderBy: { id: 'desc' },
    });
    return docentes.map((docente) => ({
      id: docente.id,
      numeroEmpleado: docente.numeroEmpleado,
      activo: docente.activo,
      docenteId: docente.docenteId,
      nombre:
        `${docente.docente.usuario.nombres} ${docente.docente.usuario.apellidoPaterno} ${docente.docente.usuario.apellidoMaterno}`.trim(),
      correo: docente.docente.usuario.correo,
    }));
  }

  async invitarDocente(
    usuarioId: number,
    dto: InvitarDocenteSecretariaDto,
    urlPublica: string,
  ) {
    const { institucionId } = await this.contexto(usuarioId);
    const correo = dto.correo.trim().toLowerCase();
    const yaEsUsuario = await this.prisma.usuario.findUnique({
      where: { correo },
      select: { id: true },
    });
    if (yaEsUsuario) {
      throw new ConflictException(
        'Ya existe una cuenta con ese correo: no se puede invitar como docente.',
      );
    }
    const pendiente = await this.prisma.invitacion.findFirst({
      where: {
        correo,
        usadaEn: null,
        expiracion: { gt: new Date() },
      },
      select: { id: true },
    });
    if (pendiente) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para ese correo.',
      );
    }

    const expiraEn =
      process.env.INVITATION_EXPIRES_IN ?? INVITACION_POR_DEFECTO;
    const token = await this.jwt.signAsync(
      { correo, type: 'invitacion' },
      { expiresIn: expiraEn as any },
    );
    const expiracion = new Date(Date.now() + duracionEnMs(expiraEn));
    const invitacion = await this.prisma.invitacion.create({
      data: {
        correo,
        numeroEmpleado: dto.numeroEmpleado ?? '',
        institucionId,
        token,
        expiracion,
      },
    });

    let correoEnviado = false;
    let avisoCorreo: string | null = null;
    try {
      await this.mail.sendInvitation(correo, token, urlPublica);
      correoEnviado = true;
    } catch {
      avisoCorreo =
        'El correo no salió, pero el enlace está listo para copiar y compartir.';
    }

    return {
      mensaje: correoEnviado
        ? 'Invitación de docente enviada y enlace disponible para copiar.'
        : 'Invitación de docente creada. Copia el enlace y compártelo.',
      id: invitacion.id,
      correo,
      correoEnviado,
      avisoCorreo,
      enlace: `${urlPublica}/activate?token=${encodeURIComponent(token)}`,
      expiracion,
    };
  }

  async cambiarEstadoDocente(
    usuarioId: number,
    docenteInstitucionId: number,
    activo: boolean,
  ) {
    const { institucionId } = await this.contexto(usuarioId);
    const docente = await this.prisma.docenteInstitucion.findFirst({
      where: { id: docenteInstitucionId, institucionId },
      select: { id: true },
    });
    if (!docente) {
      throw new NotFoundException('Docente no encontrado en tu institución');
    }
    return this.prisma.docenteInstitucion.update({
      where: { id: docente.id },
      data: { activo },
      select: { id: true, activo: true, numeroEmpleado: true },
    });
  }

  async resumen(usuarioId: number) {
    const { institucionId } = await this.contexto(usuarioId);
    const [docentes, solicitudes, proyectos] = await Promise.all([
      this.prisma.docenteInstitucion.count({ where: { institucionId } }),
      this.prisma.solicitudClaseEspejo.count({
        where: {
          OR: [
            { institucionDestinoId: institucionId },
            {
              asignacionOrigen: {
                docenteInstitucion: { institucionId },
              },
            },
          ],
        },
      }),
      this.prisma.proyectoClaseEspejo.count({
        where: {
          solicitud: {
            OR: [
              { institucionDestinoId: institucionId },
              {
                asignacionOrigen: {
                  docenteInstitucion: { institucionId },
                },
              },
            ],
          },
        },
      }),
    ]);
    return {
      docentes,
      solicitudes,
      proyectos,
      // La secretaría no recibe nombres de alumnos ni de certificados.
    };
  }
}
