import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolverUrlPublica } from '../common/url-publica';
import { exigirAgenteHabilitado } from '../common/institucion-habilitada';
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
  private readonly logger = new Logger(AgentesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * FASE 2: El agente envía una invitación al docente (solo correo + número de empleado).
   * El docente se registrará después usando el token de la invitación.
   *
   * `urlPublica` es la dirección desde la que el docente abrirá el enlace: con
   * un túnel o un proxy cambia, así que la calcula el controlador a partir de la
   * petición en vez de leer una variable fija.
   */
  async invitarDocente(
    agenteId: number,
    dto: InviteDocenteDto,
    urlPublica: string,
  ) {
    const agente = await this.getAgente(agenteId);
    // Invitar docentes es de las cosas que quedan bloqueadas mientras la
    // institución no esté aprobada o el alta del agente no esté confirmada.
    await exigirAgenteHabilitado(this.prisma, agenteId);

    const yaEsUsuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });
    if (yaEsUsuario) {
      throw new ConflictException(
        'Ya existe una cuenta con ese correo: no se puede invitar como docente.',
      );
    }

    const pendiente = await this.prisma.invitacion.findFirst({
      where: {
        correo: dto.correo,
        usadaEn: null,
        expiracion: { gt: new Date() },
      },
      select: {
        id: true,
        institucionId: true,
        token: true,
        expiracion: true,
      },
    });
    if (pendiente) {
      if (pendiente.institucionId === agente.institucionId) {
        return {
          mensaje:
            'Ya existe una invitación vigente para ese correo. Se reutiliza para que no se pierda.',
          correo: dto.correo,
          correoEnviado: false,
          avisoCorreo:
            'El correo pudo no haberse enviado; comparte el enlace que aparece abajo.',
          enlace: `${urlPublica}/activate?token=${encodeURIComponent(pendiente.token)}`,
          expiracion: pendiente.expiracion,
        };
      }
      throw new ConflictException(
        'Ya existe una invitación pendiente para ese correo.',
      );
    }

    const expiraEn = process.env.INVITATION_EXPIRES_IN ?? '7d';
    const token = await this.jwtService.signAsync(
      { correo: dto.correo, type: 'invitacion' },
      { expiresIn: expiraEn as any },
    );

    // La misma duración del token, para que no queden dos vencimientos distintos.
    const expiracion = new Date(Date.now() + duracionEnMs(expiraEn));

    await this.prisma.invitacion.create({
      data: {
        correo: dto.correo,
        numeroEmpleado: dto.numeroEmpleado,
        institucionId: agente.institucionId,
        token,
        expiracion,
      },
    });

    let correoEnviado = false;
    let avisoCorreo: string | null = null;
    try {
      await this.mailService.sendInvitation(dto.correo, token, urlPublica);
      correoEnviado = true;
    } catch {
      avisoCorreo =
        'El correo no salió, pero la invitación sigue vigente: copia el enlace y compártelo.';
    }

    return {
      mensaje: correoEnviado
        ? 'Invitación enviada al docente y enlace disponible para copiar.'
        : 'Invitación creada. Copia el enlace y compártelo con el docente.',
      correo: dto.correo,
      correoEnviado,
      avisoCorreo,
      enlace: `${urlPublica}/activate?token=${encodeURIComponent(token)}`,
      expiracion,
    };
  }

  /**
   * Invitaciones pendientes de la institución del agente.
   *
   * Se devuelven también las caducadas (`caducada: true`): son las que más
   * interesa reenviar, y esconderlas dejaría al agente sin forma de saber que
   * hay un docente esperando un enlace que ya no sirve.
   */
  async listarInvitaciones(agenteId: number) {
    const agente = await this.getAgente(agenteId);
    const invitaciones = await this.prisma.invitacion.findMany({
      where: { institucionId: agente.institucionId, usadaEn: null },
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        correo: true,
        numeroEmpleado: true,
        expiracion: true,
        creadoEn: true,
      },
    });

    return invitaciones.map((invitacion) => ({
      ...invitacion,
      caducada: invitacion.expiracion.getTime() < Date.now(),
    }));
  }

  /**
   * Reenvía una invitación pendiente (Fase 1).
   *
   * Genera un token **nuevo**: el anterior deja de valer en el acto, que es lo
   * que se quiere si el primero pudo acabar en una bandeja equivocada. Si el
   * correo no sale, la invitación se conserva con el token nuevo y el enlace se
   * devuelve para copiarlo; así el alta no depende del correo.
   */
  async reenviarInvitacion(
    agenteId: number,
    invitacionId: number,
    urlPublica: string,
  ) {
    const agente = await this.getAgente(agenteId);
    await exigirAgenteHabilitado(this.prisma, agenteId);

    const invitacion = await this.prisma.invitacion.findFirst({
      where: { id: invitacionId, institucionId: agente.institucionId },
    });
    if (!invitacion) {
      throw new NotFoundException('Invitación no encontrada');
    }
    if (invitacion.usadaEn) {
      throw new BadRequestException(
        'Esa invitación ya se usó: la cuenta del docente ya existe.',
      );
    }

    const yaEsUsuario = await this.prisma.usuario.findUnique({
      where: { correo: invitacion.correo },
    });
    if (yaEsUsuario) {
      throw new ConflictException(
        'Ese correo ya tiene cuenta: no hace falta reenviar la invitación.',
      );
    }

    const expiraEn = process.env.INVITATION_EXPIRES_IN ?? '7d';
    // `jti` único: sin él, un reenvío dentro del mismo segundo produce el mismo
    // token y el enlace viejo seguiría valiendo.
    const token = await this.jwtService.signAsync(
      { correo: invitacion.correo, type: 'invitacion', jti: randomUUID() },
      { expiresIn: expiraEn as any },
    );
    const expiracion = new Date(Date.now() + duracionEnMs(expiraEn));

    await this.prisma.invitacion.update({
      where: { id: invitacion.id },
      data: { token, expiracion },
    });

    let correoEnviado = false;
    let avisoCorreo: string | null = null;
    try {
      await this.mailService.sendInvitation(
        invitacion.correo,
        token,
        urlPublica,
      );
      correoEnviado = true;
    } catch {
      avisoCorreo =
        'El correo no salió, pero el enlace nuevo está vigente: cópialo y compártelo.';
    }

    return {
      mensaje: correoEnviado
        ? 'Invitación reenviada al docente y enlace disponible para copiar.'
        : 'Enlace renovado. Copia el enlace y compártelo con el docente.',
      correo: invitacion.correo,
      correoEnviado,
      avisoCorreo,
      enlace: `${urlPublica}/activate?token=${encodeURIComponent(token)}`,
      expiracion,
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
    await exigirAgenteHabilitado(this.prisma, agenteId);

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
    await exigirAgenteHabilitado(this.prisma, agenteId);

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
        await tx.docente.delete({
          where: { id: docenteInstitucion.docenteId },
        });
        if (docente) {
          await tx.usuario.delete({ where: { id: docente.usuarioId } });
        }
      }
    });

    return { mensaje: 'Docente eliminado' };
  }

  /**
   * Historial de clases espejo de un docente (archivero digital). Devuelve las
   * clases en las que ha participado con su estado, la institución contraparte
   * y cómo le fue (evaluaciones y reportes confirmados).
   */
  async historialDocente(agenteId: number, docenteInstitucionId: number) {
    const agente = await this.getAgente(agenteId);

    const di = await this.prisma.docenteInstitucion.findFirst({
      where: { id: docenteInstitucionId, institucionId: agente.institucionId },
      include: { docente: { include: { usuario: true } } },
    });
    if (!di) throw new NotFoundException('Docente no encontrado');

    const participaciones = await this.prisma.proyectoDocente.findMany({
      where: { asignacionDocente: { docenteInstitucionId: di.id } },
      include: {
        proyecto: {
          include: {
            solicitud: {
              include: {
                institucionDestino: true,
                asignacionOrigen: {
                  include: {
                    docenteInstitucion: { include: { institucion: true } },
                  },
                },
              },
            },
            evaluaciones: true,
            sesiones: { include: { reporte: true } },
          },
        },
        asignacionDocente: { include: { materia: true } },
      },
      orderBy: { proyecto: { creadoEn: 'desc' } },
    });

    const clases = participaciones.map((p) => {
      const proyecto = p.proyecto;
      const origenInst =
        proyecto.solicitud.asignacionOrigen.docenteInstitucion.institucion;
      const destinoInst = proyecto.solicitud.institucionDestino;
      const contraparte =
        p.rol === 'ORIGEN' ? destinoInst.nombre : origenInst.nombre;
      const sesiones = proyecto.sesiones ?? [];
      const confirmadas = sesiones.filter(
        (s) => s.reporte?.estado === 'CONFIRMADO',
      ).length;

      return {
        proyectoId: proyecto.id,
        titulo: proyecto.solicitud.titulo,
        estado: proyecto.estado,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
        plataforma: proyecto.plataforma,
        rol: p.rol,
        materia: p.asignacionDocente?.materia?.nombre ?? null,
        contraparte,
        sesiones: sesiones.length,
        reportesConfirmados: confirmadas,
        evaluaciones: proyecto.evaluaciones.map((e) => ({
          instrumento: e.instrumento,
          resultado: e.resultado,
          observaciones: e.observaciones,
        })),
      };
    });

    return {
      docente: {
        id: di.id,
        nombres: di.docente.usuario.nombres,
        apellidoPaterno: di.docente.usuario.apellidoPaterno,
        apellidoMaterno: di.docente.usuario.apellidoMaterno,
        correo: di.docente.usuario.correo,
        gradoAcademico: di.docente.gradoAcademico,
        especialidad: di.docente.especialidad,
        numeroEmpleado: di.numeroEmpleado,
      },
      resumen: {
        total: clases.length,
        finalizadas: clases.filter((c) => c.estado === 'FINALIZADO').length,
        enCurso: clases.filter((c) => c.estado === 'EN_CURSO').length,
        enPlanificacion: clases.filter((c) => c.estado === 'EN_PLANIFICACION')
          .length,
        canceladas: clases.filter((c) => c.estado === 'CANCELADO').length,
      },
      clases,
    };
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

  // --- Confirmación del agente que se une (Fase 2, segunda parte) ---

  /**
   * Altas pendientes de confirmar **en mi institución**.
   *
   * Cuando alguien se registra eligiendo una institución ya aprobada, no lo
   * aprueba el presidente: lo confirma un agente de esa institución. Estas son
   * las filas que esperan esa confirmación.
   */
  async listarAltasPendientes(usuarioId: number) {
    const agente = await this.getAgente(usuarioId);

    const altas = await this.prisma.agenteInternacionalizacion.findMany({
      where: {
        institucionId: agente.institucionId,
        confirmadoEn: null,
        id: { not: agente.id },
        usuario: { activo: true },
      },
      select: {
        id: true,
        cargo: true,
        creadoEn: true,
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            correo: true,
            dni: true,
            tipoDocumento: true,
          },
        },
      },
      orderBy: { creadoEn: 'asc' },
    });

    return altas.map((alta) => ({
      id: alta.id,
      cargo: alta.cargo,
      creadoEn: alta.creadoEn,
      usuarioId: alta.usuario.id,
      nombre:
        `${alta.usuario.nombres} ${alta.usuario.apellidoPaterno} ${alta.usuario.apellidoMaterno}`.trim(),
      correo: alta.usuario.correo,
      documento: `${alta.usuario.tipoDocumento} ${alta.usuario.dni}`,
    }));
  }

  /** Da por bueno el alta: desde ese momento el agente puede operar. */
  async confirmarAlta(usuarioId: number, id: number, peticion?: Request) {
    const { alta, institucion } = await this.altaDeMiInstitucion(usuarioId, id);
    if (alta.confirmadoEn) {
      throw new BadRequestException('Esa alta ya estaba confirmada');
    }
    if (!alta.usuario.activo) {
      throw new BadRequestException(
        'Esa cuenta está desactivada: no se puede confirmar su alta.',
      );
    }

    const actualizada = await this.prisma.agenteInternacionalizacion.update({
      where: { id },
      data: {
        confirmadoEn: new Date(),
        confirmadoPorUsuarioId: usuarioId,
      },
      select: { id: true, confirmadoEn: true },
    });

    try {
      await this.mailService.sendAltaAgenteConfirmada(
        alta.usuario.correo,
        institucion.nombre,
        resolverUrlPublica(peticion),
      );
    } catch (error) {
      // La confirmación ya está guardada: el correo es un aviso, no un requisito.
      this.logger.error(
        `No se pudo avisar a ${alta.usuario.correo} de su alta confirmada: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      mensaje: `Alta de ${alta.usuario.nombres} ${alta.usuario.apellidoPaterno} confirmada`,
      id: actualizada.id,
      confirmadoEn: actualizada.confirmadoEn,
    };
  }

  /**
   * Rechaza el alta: la fila **se queda** (es el registro de lo ocurrido) y lo
   * que se desactiva es el usuario, así que no puede entrar. El correo es lo
   * único que le explica por qué.
   */
  async rechazarAlta(
    usuarioId: number,
    id: number,
    motivo: string,
    peticion?: Request,
  ) {
    const { alta, institucion } = await this.altaDeMiInstitucion(usuarioId, id);
    if (alta.confirmadoEn) {
      throw new BadRequestException(
        'Esa alta ya estaba confirmada: no se puede rechazar.',
      );
    }

    await this.prisma.usuario.update({
      where: { id: alta.usuario.id },
      data: { activo: false },
    });

    const texto = motivo?.trim() ?? '';
    try {
      await this.mailService.sendAltaAgenteRechazada(
        alta.usuario.correo,
        institucion.nombre,
        texto,
        resolverUrlPublica(peticion),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo avisar a ${alta.usuario.correo} del alta rechazada: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      mensaje: `Alta de ${alta.usuario.nombres} ${alta.usuario.apellidoPaterno} rechazada: su cuenta quedó desactivada`,
      id: alta.id,
      activo: false,
    };
  }

  /** Comprueba que el alta pertenece a mi institución antes de tocarla. */
  private async altaDeMiInstitucion(usuarioId: number, id: number) {
    const agente = await this.getAgente(usuarioId);

    const alta = await this.prisma.agenteInternacionalizacion.findFirst({
      where: { id, institucionId: agente.institucionId },
      select: {
        id: true,
        confirmadoEn: true,
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidoPaterno: true,
            correo: true,
            activo: true,
          },
        },
      },
    });
    if (!alta) {
      throw new NotFoundException(
        'Esa alta no existe o no es de tu institución',
      );
    }

    const institucion = await this.prisma.institucion.findUniqueOrThrow({
      where: { id: agente.institucionId },
      select: { nombre: true },
    });

    return { alta, institucion };
  }
}
