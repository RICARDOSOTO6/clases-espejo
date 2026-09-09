import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
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
  activo: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * FASE 1: Registro de un usuario y su institución, dejándolo vinculado
   * como Agente de Internacionalización de esa institución.
   */
  async register(dto: RegisterDto) {
    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ correo: dto.correo }, { dni: dto.dni }] },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo o DNI');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

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

      const institucion = await tx.institucion.create({
        data: {
          nombre: dto.nombreInstitucion,
          pais: dto.pais,
          codigoPais: dto.codigoPais,
          estado: dto.estado,
          ciudad: dto.ciudad,
          telefono: dto.telefono,
          correoInstitucional: dto.correoInstitucional,
          activa: true,
        },
      });

      await tx.agenteInternacionalizacion.create({
        data: {
          usuarioId: usuario.id,
          institucionId: institucion.id,
          cargo: dto.cargo,
        },
      });

      return { usuario };
    });

    return {
      mensaje: 'Registro exitoso',
      usuario: this.toUsuarioSeguro(usuario, 'AGENTE'),
    };
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
      include: { agente: true, docente: true },
    });

    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException(
        'La cuenta aún no está activa. Revisa tu correo de invitación.',
      );
    }

    const coincide = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const access_token = await this.jwtService.signAsync({
      sub: usuario.id,
      correo: usuario.correo,
    });

    const rol = usuario.agente ? 'AGENTE' : usuario.docente ? 'DOCENTE' : null;

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

      await tx.invitacion.update({
        where: { id: invitacion.id },
        data: { usadaEn: new Date() },
      });

      return { usuario };
    });

    return {
      mensaje: 'Cuenta activada correctamente',
      correo: usuario.correo,
    };
  }

  private toUsuarioSeguro(usuario: UsuarioSeguro, rol: string | null) {
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
    };
  }
}
