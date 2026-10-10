import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ correo: dto.correo }, { dni: dto.dni }] },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo o DNI');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return dto.institucionId != null
      ? this.unirseAInstitucion(dto, passwordHash, peticion)
      : this.crearInstitucionPropia(dto, passwordHash);
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

    const coincide = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
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
