import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolverUrlPublica } from '../common/url-publica';
import {
  CARGO_PRESIDENTE,
  CARGO_SECRETARIA,
  CARGO_SUPLENTE,
} from '../common/estados';
import {
  generarDniUnico,
  generarPasswordProvisional,
} from './credenciales-cace';
import { CambiarPresidenteDto } from './dto/cambiar-presidente.dto';
import { mensajeDeError } from '../common/mensaje-error';
import { nombreCompleto } from '../common/nombre-completo';

/**
 * La presidencia de la CACE **se transmite** (fase 6).
 *
 * Es la decisión de diseño que sostiene este servicio: la presidencia es una
 * figura central —sin ella nadie aprueba instituciones, autoriza borrados ni
 * firma certificados—, así que **no se borra ni se desactiva**. Lo que existe es
 * «Cambiar de presidente», y lo que hace es esto:
 *
 * - El entrante pasa a `PRESIDENTE` (y a activo).
 * - El saliente queda como **suplente**, y **sigue activo**: el suplente
 *   conserva las capacidades, porque el guardia resuelve el rol por relación y
 *   trata igual a la presidencia y a la suplencia (`common/capacidades.ts`). No
 *   se pierde nada por el camino.
 * - El cambio queda escrito en `CAMBIO_PRESIDENCIA`: quién dejó el cargo, quién
 *   lo tomó, cuándo y por qué.
 *
 * Reglas que se comprueban aquí: el entrante no puede ser el propio saliente,
 * **solo hay un presidente a la vez** (cualquier otro que aparezca queda como
 * suplente) y, si el entrante era secretaría, deja de serlo: el cargo manda. La
 * interfaz avisa de eso antes de confirmar.
 *
 * Todo pasa en **una transacción**: un cambio de presidencia a medias dejaría a
 * la CACE sin nadie que pueda aprobar nada.
 */
@Injectable()
export class PresidenciaCaceService {
  private readonly logger = new Logger(PresidenciaCaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Transmite la presidencia al sucesor que se indique: un miembro que ya está
   * dentro de la CACE (la secretaría o un suplente) o una persona nueva.
   */
  async cambiar(usuarioId: number, dto: CambiarPresidenteDto) {
    const motivo = (dto?.motivo ?? '').trim();
    const miembroId = dto?.miembroId ?? null;

    // Las dos formas de elegir al sucesor son excluyentes: con un `miembroId` no
    // se mandan datos de persona nueva, y sin él son obligatorios. El DTO ya los
    // exige, pero el servicio no se fía: es el único sitio por el que se puede
    // llegar a la transacción.
    if (miembroId !== null && dto?.correo) {
      throw new BadRequestException(
        'Elige al sucesor de una sola forma: o un miembro que ya está en la CACE, o los datos de una persona nueva.',
      );
    }

    const saliente = await this.prisma.miembroCace.findFirst({
      where: { cargo: CARGO_PRESIDENTE },
      // Si hubiera más de una fila de presidencia, la que de verdad está
      // ejerciendo es la activa (y, entre varias, la más antigua).
      orderBy: [{ activo: 'desc' }, { creadoEn: 'asc' }],
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: this.datosUsuario() },
      },
    });
    if (!saliente) {
      throw new BadRequestException(
        'No hay ninguna presidencia a la que suceder: la CACE no tiene presidente registrado. Reinicia el servidor para que se cree con el correo de `PRESIDENTE_CORREO`.',
      );
    }
    const nombreSaliente = nombreCompleto(saliente.usuario);

    // --- Quién entra ---

    type Entrante =
      | {
          forma: 'miembro';
          /** Fila de `MIEMBRO_CACE` que ya existía y se reutiliza. */
          miembroId: number;
          usuarioId: number;
          correo: string;
          nombre: string;
          cargoAnterior: string;
        }
      | {
          forma: 'usuario';
          usuarioId: number;
          correo: string;
          nombre: string;
          /** Ya era usuario de la plataforma pero no miembro de la CACE. */
          miembroId: number | null;
          /** Necesita contraseña provisional (cuenta a medio crear). */
          passwordProvisional: string | null;
          /** Su cuenta estaba apagada: hay que reactivarla para que pueda entrar. */
          cuentaApagada: boolean;
        }
      | {
          forma: 'nueva';
          correo: string;
          nombre: string;
          nombres: string;
          apellidoPaterno: string;
          apellidoMaterno: string;
          passwordProvisional: string;
        };

    let entrante: Entrante;

    if (miembroId !== null) {
      const miembro = await this.prisma.miembroCace.findUnique({
        where: { id: miembroId },
        select: {
          id: true,
          usuarioId: true,
          cargo: true,
          activo: true,
          usuario: { select: this.datosUsuario() },
        },
      });
      if (!miembro) {
        throw new NotFoundException('Ese miembro de la CACE no existe.');
      }
      if (!miembro.activo) {
        throw new BadRequestException(
          `${nombreCompleto(miembro.usuario)} no está activo en la CACE: actívalo antes de darle la presidencia.`,
        );
      }
      entrante = {
        forma: 'miembro',
        miembroId: miembro.id,
        usuarioId: miembro.usuarioId,
        correo: miembro.usuario.correo,
        nombre: nombreCompleto(miembro.usuario),
        cargoAnterior: miembro.cargo,
      };
    } else {
      const correo = (dto?.correo ?? '').trim().toLowerCase();
      const nombres = (dto?.nombres ?? '').trim();
      const apellidoPaterno = (dto?.apellidoPaterno ?? '').trim();
      const apellidoMaterno = (dto?.apellidoMaterno ?? '').trim();
      if (!correo || !nombres || !apellidoPaterno) {
        throw new BadRequestException(
          'Para traer a una persona nueva hacen falta el correo, el nombre y el apellido paterno.',
        );
      }

      const existente = await this.prisma.usuario.findUnique({
        where: { correo },
        // El cliente omite `passwordHash`: aquí hace falta saber si tiene.
        omit: { passwordHash: false },
        include: { miembroCace: { select: { id: true } } },
      });

      entrante = existente
        ? {
            forma: 'usuario',
            usuarioId: existente.id,
            correo,
            nombre: nombreCompleto({
              nombres: existente.nombres,
              apellidoPaterno: existente.apellidoPaterno,
              apellidoMaterno: existente.apellidoMaterno,
            }),
            miembroId: existente.miembroCace?.id ?? null,
            passwordProvisional: existente.passwordHash
              ? null
              : generarPasswordProvisional(),
            cuentaApagada: !existente.activo,
          }
        : {
            forma: 'nueva',
            correo,
            nombre: `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim(),
            nombres,
            apellidoPaterno,
            apellidoMaterno,
            passwordProvisional: generarPasswordProvisional(),
          };
    }

    const entranteUsuarioId =
      entrante.forma === 'nueva' ? null : entrante.usuarioId;
    if (
      entranteUsuarioId !== null &&
      entranteUsuarioId === saliente.usuarioId
    ) {
      throw new BadRequestException(
        'Ya presides la CACE: elige a otra persona para transmitirle el cargo.',
      );
    }

    // --- La transmisión, en una sola transacción ---

    // El DNI se busca **fuera** de la transacción, como en el alta de
    // secretarías: es único y hace falta consultar la base para no chocar.
    const dniNuevo =
      entrante.forma === 'nueva' ? await generarDniUnico(this.prisma) : null;

    const resultado = await this.prisma.$transaction(async (tx) => {
      let usuarioIdEntrante: number;
      let passwordProvisional: string | null = null;

      if (entrante.forma === 'nueva') {
        passwordProvisional = entrante.passwordProvisional;
        const usuario = await tx.usuario.create({
          data: {
            nombres: entrante.nombres,
            apellidoPaterno: entrante.apellidoPaterno,
            apellidoMaterno: entrante.apellidoMaterno,
            dni: dniNuevo as string,
            // "Otro" porque todavía no hay un documento real que guardar.
            tipoDocumento: 'Otro',
            correo: entrante.correo,
            passwordHash: await bcrypt.hash(passwordProvisional, 10),
            activo: true,
            debeCambiarPassword: true,
          },
          select: { id: true },
        });
        await tx.miembroCace.create({
          data: {
            usuarioId: usuario.id,
            cargo: CARGO_PRESIDENTE,
            activo: true,
          },
        });
        usuarioIdEntrante = usuario.id;
      } else if (entrante.forma === 'usuario') {
        passwordProvisional = entrante.passwordProvisional;
        if (passwordProvisional) {
          await tx.usuario.update({
            where: { id: entrante.usuarioId },
            data: {
              passwordHash: await bcrypt.hash(passwordProvisional, 10),
              debeCambiarPassword: true,
              activo: true,
            },
          });
        } else if (entrante.cuentaApagada) {
          // Sin cuenta activa no podría entrar a ejercer: se reactiva.
          await tx.usuario.update({
            where: { id: entrante.usuarioId },
            data: { activo: true },
          });
        }

        if (entrante.miembroId !== null) {
          await tx.miembroCace.update({
            where: { id: entrante.miembroId },
            data: { cargo: CARGO_PRESIDENTE, activo: true },
          });
        } else {
          await tx.miembroCace.create({
            data: {
              usuarioId: entrante.usuarioId,
              cargo: CARGO_PRESIDENTE,
              activo: true,
            },
          });
        }
        usuarioIdEntrante = entrante.usuarioId;
      } else {
        // El cargo manda: si era secretaría, deja de serlo.
        await tx.miembroCace.update({
          where: { id: entrante.miembroId },
          data: { cargo: CARGO_PRESIDENTE, activo: true },
        });
        usuarioIdEntrante = entrante.usuarioId;
      }

      // El saliente **no se borra ni se apaga**: queda como suplente, activo.
      await tx.miembroCace.update({
        where: { id: saliente.id },
        data: { cargo: CARGO_SUPLENTE, activo: true },
      });

      // Y solo un presidente a la vez: cualquier otra fila que estuviera como
      // PRESIDENTE (una suplencia antigua mal marcada) baja a suplencia.
      await tx.miembroCace.updateMany({
        where: {
          cargo: CARGO_PRESIDENTE,
          usuarioId: { not: usuarioIdEntrante },
        },
        data: { cargo: CARGO_SUPLENTE },
      });

      const cambio = await tx.cambioPresidencia.create({
        data: {
          salienteUsuarioId: saliente.usuarioId,
          entranteUsuarioId: usuarioIdEntrante,
          motivo,
        },
        select: this.seleccionCambio(),
      });

      return { cambio, passwordProvisional };
    });

    // --- Los dos avisos, fuera de la transacción ---
    // Un correo que no sale no puede deshacer la transmisión: queda hecha,
    // escrita en el historial y dicha en la respuesta.
    const avisos = await this.avisar(
      entrante.correo,
      entrante.nombre,
      nombreSaliente,
      saliente.usuario.correo,
      resultado.passwordProvisional,
      motivo,
    );

    const entranteEsSecretaria =
      entrante.forma === 'miembro' &&
      entrante.cargoAnterior === CARGO_SECRETARIA;

    this.logger.warn(
      `Cambio de presidencia de la CACE (lo pidió el usuario ${usuarioId}): ` +
        `«${nombreSaliente}» (usuario ${saliente.usuarioId}) queda como suplente y ` +
        `«${entrante.nombre}» (usuario ${resultado.cambio.entrante.id}) pasa a presidente` +
        `${motivo ? ` · Motivo: ${motivo}` : ''}.`,
    );

    return {
      mensaje:
        `${entrante.nombre} es ahora la presidencia de la CACE. ` +
        `${nombreSaliente} queda como suplente, con las mismas capacidades y sin perder el acceso.` +
        (entranteEsSecretaria
          ? ' Deja de ser secretaría: el cargo de presidencia manda.'
          : '') +
        (entrante.forma === 'nueva'
          ? ' Se creó su cuenta con una contraseña provisional y el sistema le pedirá cambiarla al entrar.'
          : '') +
        ' El cambio queda en el historial.',
      cambio: this.aCambio(resultado.cambio),
      saliente: {
        usuarioId: saliente.usuarioId,
        nombre: nombreSaliente,
        correo: saliente.usuario.correo,
        cargo: CARGO_SUPLENTE,
        activo: true,
      },
      entrante: {
        correo: entrante.correo,
        nombre: entrante.nombre,
        cargo: CARGO_PRESIDENTE,
        activo: true,
        /** Verdadero si hubo que crearle la cuenta. */
        cuentaNueva: entrante.forma === 'nueva',
        /** Verdadero si ya era usuario de la plataforma (no se duplicó). */
        cuentaExistente: entrante.forma === 'usuario',
      },
      correoEnviado: avisos.correoEnviado,
      avisoCorreo: avisos.avisoCorreo,
      // Solo cuando el correo no salió: sin esto, la contraseña no le llegaría
      // a nadie y la cuenta nueva quedaría inaccesible.
      passwordProvisional: avisos.correoEnviado
        ? undefined
        : (resultado.passwordProvisional ?? undefined),
    };
  }

  /**
   * El historial de los cambios: quién dejó el cargo, quién lo tomó, cuándo y el
   * motivo. Va con quién preside ahora, que es lo que se lee primero.
   */
  async historial() {
    const [cambios, presidente] = await Promise.all([
      this.prisma.cambioPresidencia.findMany({
        orderBy: { creadoEn: 'desc' },
        select: this.seleccionCambio(),
      }),
      this.prisma.miembroCace.findFirst({
        where: { cargo: CARGO_PRESIDENTE, activo: true },
        orderBy: { creadoEn: 'asc' },
        select: {
          usuarioId: true,
          usuario: { select: this.datosUsuario() },
        },
      }),
    ]);

    // Los suplentes activos: son los candidatos naturales a recibir el cargo,
    // así que el panel los tiene a mano para el cambio.
    const suplentes = await this.prisma.miembroCace.findMany({
      where: { cargo: CARGO_SUPLENTE, activo: true },
      orderBy: { creadoEn: 'asc' },
      select: {
        usuarioId: true,
        usuario: { select: this.datosUsuario() },
      },
    });

    return {
      cambios: cambios.map((cambio) => this.aCambio(cambio)),
      total: cambios.length,
      presidenteActual: presidente
        ? {
            usuarioId: presidente.usuarioId,
            nombre: nombreCompleto(presidente.usuario),
            correo: presidente.usuario.correo,
          }
        : null,
      suplentes: suplentes.map((suplente) => ({
        usuarioId: suplente.usuarioId,
        nombre: nombreCompleto(suplente.usuario),
        correo: suplente.usuario.correo,
      })),
    };
  }

  // --- Apoyo ---

  /** Avisa al entrante y al saliente. Devuelve si salió el del entrante. */
  private async avisar(
    correoEntrante: string,
    nombreEntrante: string,
    nombreSaliente: string,
    correoSaliente: string,
    passwordProvisional: string | null,
    motivo: string,
  ): Promise<{ correoEnviado: boolean; avisoCorreo: string | null }> {
    const urlPublica = resolverUrlPublica();
    let correoEnviado = true;
    let avisoCorreo: string | null = null;

    try {
      await this.mail.sendCambioPresidenciaEntrante(
        correoEntrante,
        {
          nombreEntrante,
          nombreSaliente,
          password: passwordProvisional ?? undefined,
          motivo,
        },
        urlPublica,
      );
    } catch (error) {
      correoEnviado = false;
      this.logger.error(
        `No se pudo avisar del cambio de presidencia a ${correoEntrante}: ${mensajeDeError(error)}`,
      );
      if (passwordProvisional) {
        this.logger.warn(
          `Contraseña provisional de ${correoEntrante}: ${passwordProvisional} (el sistema pedirá cambiarla al entrar)`,
        );
      }
      avisoCorreo =
        'No se pudo enviar el correo con el aviso al entrante: la contraseña provisional va en esta respuesta para que se la puedas dar a mano.';
    }

    try {
      await this.mail.sendCambioPresidenciaSaliente(
        correoSaliente,
        { nombreEntrante, nombreSaliente, motivo },
        urlPublica,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo avisar del cambio de presidencia a ${correoSaliente}: ${mensajeDeError(error)}`,
      );
      avisoCorreo = avisoCorreo
        ? `${avisoCorreo} Tampoco se pudo avisar a quien dejó el cargo por correo.`
        : 'No se pudo avisar por correo a quien dejó el cargo: el cambio está hecho y consta en el historial.';
    }

    return { correoEnviado, avisoCorreo };
  }

  /** Selección común de un cambio, con los dos usuarios implicados. */
  private seleccionCambio() {
    return {
      id: true,
      motivo: true,
      creadoEn: true,
      saliente: { select: this.datosUsuario() },
      entrante: { select: this.datosUsuario() },
    } as const;
  }

  /** Los datos del usuario que se enseñan en el historial. */
  private datosUsuario() {
    return {
      id: true,
      nombres: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      correo: true,
    } as const;
  }

  /** Fila del historial ya redactada para la interfaz. */
  private aCambio(cambio: {
    id: number;
    motivo: string;
    creadoEn: Date;
    saliente: {
      id: number;
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      correo: string;
    };
    entrante: {
      id: number;
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      correo: string;
    };
  }) {
    return {
      id: cambio.id,
      motivo: cambio.motivo,
      // En ISO: la interfaz la formatea y la lista se ordena por ella.
      creadoEn: cambio.creadoEn.toISOString(),
      saliente: {
        usuarioId: cambio.saliente.id,
        nombre: nombreCompleto(cambio.saliente),
        correo: cambio.saliente.correo,
      },
      entrante: {
        usuarioId: cambio.entrante.id,
        nombre: nombreCompleto(cambio.entrante),
        correo: cambio.entrante.correo,
      },
    };
  }
}
