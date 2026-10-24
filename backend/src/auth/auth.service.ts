import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolverUrlPublica } from '../common/url-publica';
import { Rol, rolDeVinculos } from '../common/capacidades';
import {
  ESTADO_CACE_APROBADA,
  ESTADO_CACE_PENDIENTE,
  ESTADO_CACE_RECHAZADA,
  ESTADO_CACE_VETADA,
} from '../common/estados';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import {
  BLOQUEO_MINUTOS,
  INTENTOS_MAXIMOS,
  exigirPoliticaPassword,
} from '../common/politica-password';
import {
  VIGENCIA_RECUPERACION_MS,
  VIGENCIA_VERIFICACION_MS,
  generarTokenRecuperacion,
  hashTokenRecuperacion,
} from '../common/token-recuperacion';

type UsuarioSeguro = {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  dni: string;
  tipoDocumento: string;
  correo: string;
  fotoUrl: string | null;
  activo: boolean;
  debeCambiarPassword: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}

  /**
   * FASE 2: Registro de un agente de internacionalización.
   *
   * **Buscar antes de crear**: el agente busca su institución en el directorio
   * y, si ya existe, se **une** a ella en vez de duplicarla (que es la defensa
   * principal contra la información basura). Solo si no está crea una nueva.
   *
   * - Se une a una **aprobada** → su alta queda a la espera de que la confirme
   *   un agente de esa institución (`confirmadoEn` en `null`).
   * - Se une a una **pendiente** → nace confirmado: de la institución ya decide
   *   el presidente al aprobarla.
   * - Se une a una **rechazada** o **vetada** → se rechaza el registro.
   * - Crea una nueva → la institución nace **pendiente** y él queda confirmado
   *   como fundador.
   */
  async register(dto: RegisterDto, peticion?: Request) {
    exigirPoliticaPassword(dto.password, dto.correo);

    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ correo: dto.correo }, { dni: dto.dni }] },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo o DNI');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const resultado =
      dto.institucionId != null
        ? await this.unirseAInstitucion(dto, passwordHash, peticion)
        : await this.crearInstitucionPropia(dto, passwordHash);

    // La cuenta nace sin correo confirmado: se manda el enlace y hasta abrirlo
    // no se puede entrar (login responde 403).
    const enviado = await this.enviarVerificacionCorreo(
      resultado.usuario.id,
      dto.correo,
      peticion,
      'registro',
    );

    return {
      ...resultado,
      mensaje:
        `Registro exitoso. Te enviamos un correo a ${dto.correo} para confirmar tu cuenta; hasta que lo confirmes no podrás entrar.` +
        (enviado
          ? ''
          : ' No se pudo enviar el correo ahora: pide que te lo reenvíen desde el acceso.') +
        ` ${resultado.mensaje}`,
    };
  }

  /** El agente eligió una institución que ya existe en el directorio. */
  private async unirseAInstitucion(
    dto: RegisterDto,
    passwordHash: string,
    peticion?: Request,
  ) {
    const institucion = await this.prisma.institucion.findUnique({
      where: { id: dto.institucionId },
      select: {
        id: true,
        nombre: true,
        estadoCace: true,
        motivoCace: true,
        activa: true,
      },
    });
    if (!institucion) {
      throw new NotFoundException('La institución seleccionada no existe');
    }
    this.exigirInstitucionQueAdmiteRegistros(institucion);

    // Solo hay algo que confirmar cuando la institución ya está aprobada: si
    // está pendiente, el que decide es el presidente al aprobarla.
    const requiereConfirmacion =
      institucion.estadoCace === ESTADO_CACE_APROBADA;

    const { usuario } = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombres: dto.nombres,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          dni: dto.dni,
          tipoDocumento: dto.tipoDocumento,
          correo: dto.correo,
          passwordHash,
          activo: true,
          // Nace sin confirmar: el enlace del correo lo pone en verdadero.
          correoVerificado: false,
        },
      });

      await tx.agenteInternacionalizacion.create({
        data: {
          usuarioId: usuario.id,
          institucionId: institucion.id,
          cargo: dto.cargo,
          confirmadoEn: requiereConfirmacion ? null : new Date(),
        },
      });

      return { usuario };
    });

    if (requiereConfirmacion) {
      await this.avisarAgentesDeLaInstitucion(institucion, usuario, peticion);
    }

    return {
      mensaje: requiereConfirmacion
        ? `Registro exitoso. Tu alta en «${institucion.nombre}» está pendiente de que la confirme un agente de esa institución: hasta entonces solo puedes completar los datos de la institución.`
        : `Registro exitoso. Te uniste a «${institucion.nombre}», que está pendiente de aprobación por la CACE: mientras la revisan, completa sus datos.`,
      usuario: this.toUsuarioSeguro(usuario, 'AGENTE'),
      institucion: {
        id: institucion.id,
        nombre: institucion.nombre,
        estadoCace: institucion.estadoCace,
      },
      requiereConfirmacion,
    };
  }

  /** El agente no encontró su institución y la crea: nace pendiente. */
  private async crearInstitucionPropia(dto: RegisterDto, passwordHash: string) {
    const faltantes = (
      [
        ['nombreInstitucion', dto.nombreInstitucion],
        ['pais', dto.pais],
        ['codigoPais', dto.codigoPais],
        ['estado', dto.estado],
        ['ciudad', dto.ciudad],
        ['telefono', dto.telefono],
        ['correoInstitucional', dto.correoInstitucional],
      ] as [string, string | undefined][]
    )
      .filter(([, valor]) => !valor?.trim())
      .map(([campo]) => campo);

    if (faltantes.length > 0) {
      throw new BadRequestException(
        'Para crear una institución nueva hacen falta sus datos ' +
          `(falta: ${faltantes.join(', ')}). Si tu institución ya existe en la ` +
          'lista, elígela en vez de crearla.',
      );
    }

    const { usuario, institucion } = await this.prisma.$transaction(
      async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            nombres: dto.nombres,
            apellidoPaterno: dto.apellidoPaterno,
            apellidoMaterno: dto.apellidoMaterno,
            dni: dto.dni,
            tipoDocumento: dto.tipoDocumento,
            correo: dto.correo,
            passwordHash,
            activo: true,
            // Nace sin confirmar: el enlace del correo lo pone en verdadero.
            correoVerificado: false,
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
            // Nace pendiente: la aprueba (o no) el presidente de la CACE.
            estadoCace: ESTADO_CACE_PENDIENTE,
          },
        });

        await tx.agenteInternacionalizacion.create({
          data: {
            usuarioId: usuario.id,
            institucionId: institucion.id,
            cargo: dto.cargo,
            // El fundador nace confirmado: de la institución decide el presidente.
            confirmadoEn: new Date(),
          },
        });

        return { usuario, institucion };
      },
    );

    return {
      mensaje:
        `Registro exitoso. «${institucion.nombre}» quedó pendiente de aprobación ` +
        'por la CACE: mientras el presidente la revisa, entra y completa sus ' +
        'datos (incluido el logo).',
      usuario: this.toUsuarioSeguro(usuario, 'AGENTE'),
      institucion: {
        id: institucion.id,
        nombre: institucion.nombre,
        estadoCace: institucion.estadoCace,
      },
      requiereConfirmacion: false,
    };
  }

  /**
   * Una institución rechazada o vetada **no admite registros nuevos**: el
   * registro se conserva justo para evitar el bucle de reinscripción, así que la
   * respuesta tiene que explicar por qué no se puede.
   */
  private exigirInstitucionQueAdmiteRegistros(institucion: {
    nombre: string;
    estadoCace: string;
    motivoCace: string;
    activa: boolean;
  }): void {
    const motivo = institucion.motivoCace?.trim();
    const conMotivo = motivo ? ` Motivo: ${motivo}` : '';

    if (institucion.estadoCace === ESTADO_CACE_RECHAZADA) {
      throw new BadRequestException(
        `La institución «${institucion.nombre}» fue rechazada por la CACE y no admite agentes nuevos.${conMotivo}`,
      );
    }
    if (institucion.estadoCace === ESTADO_CACE_VETADA) {
      throw new BadRequestException(
        `La institución «${institucion.nombre}» fue vetada por la CACE y no admite agentes nuevos.${conMotivo}`,
      );
    }
    if (!institucion.activa) {
      throw new BadRequestException(
        `La institución «${institucion.nombre}» está inactiva y no admite agentes nuevos.`,
      );
    }
  }

  /**
   * Avisa a los agentes de la institución de que hay un alta esperando su
   * confirmación. Un fallo del correo **no** deshace el registro: la fila ya
   * está guardada y la campana del panel lo sigue mostrando.
   */
  private async avisarAgentesDeLaInstitucion(
    institucion: { id: number; nombre: string },
    nuevo: { id: number; nombres: string; apellidoPaterno: string },
    peticion?: Request,
  ): Promise<void> {
    const agentes = await this.prisma.agenteInternacionalizacion.findMany({
      where: {
        institucionId: institucion.id,
        usuarioId: { not: nuevo.id },
        usuario: { activo: true },
      },
      select: { usuario: { select: { correo: true } } },
    });
    if (agentes.length === 0) {
      this.logger.warn(
        `Nadie puede confirmar el alta en «${institucion.nombre}»: no hay otro agente activo.`,
      );
      return;
    }

    const urlPublica = resolverUrlPublica(peticion);
    const nombre = `${nuevo.nombres} ${nuevo.apellidoPaterno}`.trim();
    for (const agente of agentes) {
      try {
        await this.mail.sendAltaAgentePendiente(
          agente.usuario.correo,
          institucion.nombre,
          nombre,
          urlPublica,
        );
      } catch (error) {
        this.logger.error(
          `No se pudo avisar a ${agente.usuario.correo} del alta pendiente en «${institucion.nombre}»: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /**
   * Avisa por correo del bloqueo temporal. Un fallo de SMTP no puede impedir
   * que el login responda: se registra y se sigue.
   */
  private async avisarBloqueo(correo: string): Promise<void> {
    const url =
      process.env.URL_PUBLICA ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000';
    try {
      await this.mail.sendAvisoBloqueo(correo, BLOQUEO_MINUTOS, url);
    } catch (error) {
      this.logger.warn(
        `No se pudo avisar del bloqueo a ${correo}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
      include: {
        agente: true,
        docente: { include: { instituciones: true } },
        // El rol de la CACE también es relacional: sin esta fila el presidente
        // entraría sin rol y el frontend no sabría a qué pantalla mandarlo.
        miembroCace: { select: { cargo: true, activo: true } },
      },
      // El cliente omite `passwordHash` por defecto: aquí hace falta para
      // comparar la contraseña (la respuesta sigue construida con campos fijos).
      omit: { passwordHash: false },
    });

    if (!usuario) {
      // Puede ser un docente invitado que todavía no activó su cuenta.
      const invitacion = await this.prisma.invitacion.findFirst({
        where: {
          correo: dto.correo,
          usadaEn: null,
          expiracion: { gt: new Date() },
        },
      });
      if (invitacion) {
        throw new UnauthorizedException(
          'Tienes una invitación pendiente: revisa tu correo para activar tu cuenta.',
        );
      }
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    if (!usuario.passwordHash) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // Bloqueo temporal por intentos fallidos (política de la Fase 1): ni con la
    // contraseña correcta se entra hasta que pase el plazo.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutos = Math.max(
        1,
        Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60_000),
      );
      throw new UnauthorizedException(
        `La cuenta está bloqueada temporalmente por intentos fallidos. Inténtalo de nuevo en ${minutos} minuto(s) o restablece tu contraseña.`,
      );
    }

    const coincide = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!coincide) {
      const intentos = usuario.intentosFallidos + 1;
      if (intentos >= INTENTOS_MAXIMOS) {
        await this.prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            intentosFallidos: 0,
            bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000),
          },
        });
        await this.avisarBloqueo(usuario.correo);
        throw new UnauthorizedException(
          `Demasiados intentos fallidos: la cuenta queda bloqueada ${BLOQUEO_MINUTOS} minutos por seguridad. Puedes restablecer tu contraseña.`,
        );
      }
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: intentos },
      });
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // Entró con la contraseña correcta: se limpia cualquier resto de bloqueo.
    if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      });
    }

    if (!usuario.activo) {
      throw new UnauthorizedException(
        'Tu cuenta está desactivada. Contacta a tu institución.',
      );
    }

    const vinculos = usuario.docente?.instituciones ?? [];
    if (vinculos.length > 0 && !vinculos.some((v) => v.activo)) {
      throw new UnauthorizedException(
        'Tu cuenta de docente está desactivada por tu institución.',
      );
    }

    // Fase 1: sin correo confirmado no se entra (la contraseña ya se comprobó,
    // así que esto no revela correos que no existan).
    if (!usuario.correoVerificado) {
      throw new ForbiddenException(
        'Antes de entrar, confirma tu correo: revisa el enlace que te enviamos al registrarte. Si no lo encuentras, pide que te lo reenvíen desde el acceso.',
      );
    }

    const access_token = await this.jwtService.signAsync({
      sub: usuario.id,
      correo: usuario.correo,
    });

    const rol = rolDeVinculos(usuario);

    return {
      access_token,
      usuario: this.toUsuarioSeguro(usuario, rol),
    };
  }

  /**
   * Solicita un enlace de recuperación de contraseña (Fase 1).
   *
   * **La respuesta es siempre la misma**, exista o no la cuenta: este
   * formulario no debe servir para averiguar qué correos están registrados. Si
   * la cuenta existe, se crea un token nuevo (se invalida cualquier enlace
   * anterior sin usar), se guarda solo su hash y se envía por correo.
   */
  async recuperarPassword(correo: string, peticion?: Request) {
    const normalizado = (correo ?? '').trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: normalizado },
      // Para decidir si se puede enviar hace falta saber si tiene contraseña.
      omit: { passwordHash: false },
    });

    if (usuario?.activo && usuario.passwordHash) {
      const token = generarTokenRecuperacion();
      const ahora = new Date();
      await this.prisma.$transaction([
        // Un solo enlace válido por cuenta: el anterior deja de servir.
        this.prisma.recuperacionPassword.updateMany({
          where: { usuarioId: usuario.id, usadoEn: null },
          data: { usadoEn: ahora },
        }),
        this.prisma.recuperacionPassword.create({
          data: {
            usuarioId: usuario.id,
            tokenHash: hashTokenRecuperacion(token),
            expira: new Date(ahora.getTime() + VIGENCIA_RECUPERACION_MS),
          },
        }),
      ]);

      const url = peticion
        ? resolverUrlPublica(peticion)
        : (process.env.FRONTEND_URL ?? 'http://localhost:3000');
      try {
        await this.mail.sendRecuperacionPassword(usuario.correo, token, url);
      } catch (error) {
        // Un fallo de correo no puede revelar si la cuenta existe; se registra
        // y la respuesta sigue siendo la misma.
        this.logger.warn(
          `No se pudo enviar el correo de recuperación a ${usuario.correo}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      mensaje:
        'Si ese correo tiene cuenta, te hemos enviado un enlace para restablecer la contraseña. Revisa también la carpeta de spam.',
    };
  }

  /** Comprueba un enlace de recuperación antes de mostrar el formulario. */
  async validarTokenRecuperacion(token: string) {
    const registro = await this.prisma.recuperacionPassword.findUnique({
      where: { tokenHash: hashTokenRecuperacion(token) },
      select: {
        expira: true,
        usadoEn: true,
        usuario: { select: { correo: true } },
      },
    });

    const valido =
      !!registro && !registro.usadoEn && registro.expira > new Date();
    if (!valido) {
      throw new BadRequestException(
        'El enlace no es válido o caducó. Pide otro correo de recuperación.',
      );
    }
    return { valido: true, correo: registro.usuario.correo };
  }

  /**
   * Restablece la contraseña con un enlace de recuperación.
   *
   * El token es de **un solo uso**: se «gasta» con una actualización
   * condicional y, si otra petición se adelantó, esta no cambia nada. Al
   * cambiar la contraseña se cierran las sesiones abiertas
   * (`sesionesValidasDesde`) y se limpia cualquier bloqueo por intentos.
   */
  async restablecerPassword(token: string, password: string) {
    const registro = await this.prisma.recuperacionPassword.findUnique({
      where: { tokenHash: hashTokenRecuperacion(token) },
      include: { usuario: { select: { id: true, correo: true } } },
    });

    if (!registro || registro.usadoEn || registro.expira <= new Date()) {
      throw new BadRequestException(
        'El enlace no es válido o caducó. Pide otro correo de recuperación.',
      );
    }

    exigirPoliticaPassword(password, registro.usuario.correo);
    const passwordHash = await bcrypt.hash(password, 10);
    const ahora = new Date();

    await this.prisma.$transaction(async (tx) => {
      const consumo = await tx.recuperacionPassword.updateMany({
        where: { id: registro.id, usadoEn: null },
        data: { usadoEn: ahora },
      });
      if (consumo.count === 0) {
        throw new BadRequestException(
          'Ese enlace ya se usó. Pide otro correo de recuperación.',
        );
      }

      await tx.usuario.update({
        where: { id: registro.usuario.id },
        data: {
          passwordHash,
          debeCambiarPassword: false,
          // Cierra las sesiones abiertas antes del cambio.
          sesionesValidasDesde: ahora,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      });
    });

    return {
      mensaje: 'Contraseña restablecida. Ya puedes entrar con la nueva.',
    };
  }

  /** Valida el token de invitación (para mostrar el formulario de registro). */
  async validarTokenInvitacion(token: string) {
    const invitacion = await this.prisma.invitacion.findUnique({
      where: { token },
    });

    if (!invitacion) {
      throw new NotFoundException('Token de invitación no válido');
    }
    if (invitacion.usadaEn) {
      throw new BadRequestException('La invitación ya fue usada');
    }
    if (invitacion.expiracion < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }

    return {
      valido: true,
      correo: invitacion.correo,
      numeroEmpleado: invitacion.numeroEmpleado,
    };
  }

  /**
   * FASE 3: El docente se registra con el token de invitación y crea su cuenta.
   */
  async activarCuenta(dto: ActivateAccountDto) {
    const invitacion = await this.prisma.invitacion.findUnique({
      where: { token: dto.token },
    });

    if (!invitacion) {
      throw new NotFoundException('Token de invitación no válido');
    }
    if (invitacion.usadaEn) {
      throw new BadRequestException('La invitación ya fue usada');
    }
    if (invitacion.expiracion < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }

    exigirPoliticaPassword(dto.password, invitacion.correo);

    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ correo: invitacion.correo }, { dni: dto.dni }] },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo o DNI');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const { usuario } = await this.prisma.$transaction(async (tx) => {
      // Consumo atómico: si otra petición ya la usó, esta transacción no crea nada.
      const consumo = await tx.invitacion.updateMany({
        where: { id: invitacion.id, usadaEn: null },
        data: { usadaEn: new Date() },
      });
      if (consumo.count === 0) {
        throw new BadRequestException('La invitación ya fue usada');
      }

      const usuario = await tx.usuario.create({
        data: {
          nombres: dto.nombres,
          apellidoPaterno: dto.apellidoPaterno,
          apellidoMaterno: dto.apellidoMaterno,
          dni: dto.dni,
          tipoDocumento: dto.tipoDocumento,
          correo: invitacion.correo,
          passwordHash,
          activo: true,
          // La invitación llegó a ese correo: queda confirmado de origen.
          correoVerificado: true,
        },
      });

      const docente = await tx.docente.create({
        data: {
          usuarioId: usuario.id,
          gradoAcademico: dto.gradoAcademico,
          especialidad: dto.especialidad,
        },
      });

      await tx.docenteInstitucion.create({
        data: {
          docenteId: docente.id,
          institucionId: invitacion.institucionId,
          numeroEmpleado: invitacion.numeroEmpleado,
          activo: true,
        },
      });

      return { usuario };
    });

    return {
      mensaje: 'Cuenta activada correctamente',
      correo: usuario.correo,
    };
  }

  /**
   * Crea un token de confirmación de correo y lo manda. Devuelve si el correo
   * salió: un fallo no rompe el registro (la cuenta ya existe y el enlace se
   * puede pedir otra vez desde el acceso).
   */
  private async enviarVerificacionCorreo(
    usuarioId: number,
    correo: string,
    peticion: Request | undefined,
    motivo: 'registro' | 'cambio',
  ): Promise<boolean> {
    const token = generarTokenRecuperacion();
    const ahora = new Date();
    await this.prisma.$transaction([
      // Un solo enlace vivo por cuenta.
      this.prisma.verificacionCorreo.updateMany({
        where: { usuarioId, usadoEn: null },
        data: { usadoEn: ahora },
      }),
      this.prisma.verificacionCorreo.create({
        data: {
          usuarioId,
          correo,
          tokenHash: hashTokenRecuperacion(token),
          expira: new Date(ahora.getTime() + VIGENCIA_VERIFICACION_MS),
        },
      }),
    ]);

    const url = peticion
      ? resolverUrlPublica(peticion)
      : (process.env.FRONTEND_URL ?? 'http://localhost:3000');
    try {
      await this.mail.sendConfirmacionCorreo(correo, token, url, motivo);
      return true;
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar la confirmación de correo a ${correo}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  /**
   * Confirma un correo desde el enlace (alta o cambio de dirección).
   *
   * Si el correo del token no es el actual de la cuenta, es un **cambio**: se
   * actualiza `USUARIO.correo` y se cierran las sesiones abiertas. El token es
   * de un solo uso (consumo atómico).
   */
  async confirmarCorreo(token: string) {
    const registro = await this.prisma.verificacionCorreo.findUnique({
      where: { tokenHash: hashTokenRecuperacion(token) },
      include: { usuario: { select: { id: true, correo: true } } },
    });

    if (!registro || registro.usadoEn || registro.expira <= new Date()) {
      throw new BadRequestException(
        'El enlace de confirmación no es válido o caducó. Pide uno nuevo desde el acceso.',
      );
    }

    const esCambio =
      registro.correo.toLowerCase() !== registro.usuario.correo.toLowerCase();
    if (esCambio) {
      const ocupado = await this.prisma.usuario.findUnique({
        where: { correo: registro.correo },
        select: { id: true },
      });
      if (ocupado && ocupado.id !== registro.usuario.id) {
        throw new ConflictException(
          'Ese correo ya está en uso por otra cuenta.',
        );
      }
    }

    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      const uso = await tx.verificacionCorreo.updateMany({
        where: { id: registro.id, usadoEn: null },
        data: { usadoEn: ahora },
      });
      if (uso.count === 0) {
        throw new BadRequestException(
          'Ese enlace ya se usó. Pide uno nuevo desde el acceso.',
        );
      }

      await tx.usuario.update({
        where: { id: registro.usuario.id },
        data: {
          correo: registro.correo,
          correoVerificado: true,
          // Un cambio de correo cierra las sesiones: se vuelve a entrar.
          ...(esCambio ? { sesionesValidasDesde: ahora } : {}),
        },
      });
    });

    return {
      mensaje: esCambio
        ? 'Correo cambiado. Vuelve a entrar con la dirección nueva.'
        : 'Correo confirmado. Ya puedes entrar.',
      tipo: esCambio ? 'CAMBIO' : 'REGISTRO',
      correo: registro.correo,
    };
  }

  /**
   * Reenvía la confirmación a una cuenta que aún no la tiene.
   *
   * La respuesta es siempre la misma: no se revela si el correo existe ni si
   * está pendiente de confirmar.
   */
  async reenviarVerificacionCorreo(correo: string, peticion?: Request) {
    const normalizado = (correo ?? '').trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: normalizado },
      select: {
        id: true,
        correo: true,
        correoVerificado: true,
        activo: true,
      },
    });

    if (usuario?.activo && !usuario.correoVerificado) {
      await this.enviarVerificacionCorreo(
        usuario.id,
        usuario.correo,
        peticion,
        'registro',
      );
    }

    return {
      mensaje:
        'Si ese correo tiene una cuenta sin confirmar, te enviamos un enlace nuevo. Revisa también la carpeta de spam.',
    };
  }

  /**
   * Pide cambiar el correo de la cuenta. No se cambia nada todavía: se manda un
   * enlace a la **dirección nueva** y el cambio se aplica al abrirlo.
   */
  async solicitarCambioCorreo(
    usuarioId: number,
    correoNuevo: string,
    peticion?: Request,
  ) {
    const nuevo = (correoNuevo ?? '').trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { correo: true, correoVerificado: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!usuario.correoVerificado) {
      throw new ForbiddenException(
        'Confirma tu correo actual antes de cambiarlo.',
      );
    }
    if (nuevo === usuario.correo.toLowerCase()) {
      throw new BadRequestException('Ese ya es tu correo actual.');
    }

    const ocupado = await this.prisma.usuario.findUnique({
      where: { correo: nuevo },
      select: { id: true },
    });
    if (ocupado) {
      throw new ConflictException('Ese correo ya está en uso por otra cuenta.');
    }

    const enviado = await this.enviarVerificacionCorreo(
      usuarioId,
      nuevo,
      peticion,
      'cambio',
    );
    if (!enviado) {
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de confirmación. Revisa la configuración de correo e inténtalo de nuevo.',
      );
    }

    return {
      mensaje: `Te enviamos un correo a ${nuevo} para confirmarlo. Tu correo actual sigue siendo el de acceso hasta que lo confirmes.`,
    };
  }

  private toUsuarioSeguro(usuario: UsuarioSeguro, rol: Rol | null) {
    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidoPaterno: usuario.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno,
      dni: usuario.dni,
      tipoDocumento: usuario.tipoDocumento,
      correo: usuario.correo,
      fotoUrl: usuario.fotoUrl,
      activo: usuario.activo,
      // El frontend lo usa para no dejar pasar del primer acceso: mientras sea
      // verdadero, la única pantalla es la de cambio de contraseña.
      debeCambiarPassword: usuario.debeCambiarPassword,
      rol,
    };
  }
}
