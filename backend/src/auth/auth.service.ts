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
  apellidos: string;
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
    const existente = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const { usuario } = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombres: dto.nombres,
          apellidos: dto.apellidos,
          correo: dto.correo,
          passwordHash,
          activo: true,
        },
      });

      const institucion = await tx.institucion.create({
        data: {
          nombre: dto.nombreInstitucion,
          pais: dto.pais,
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

  /** Valida el token de invitación (para mostrar el formulario de contraseña). */
  async validarTokenInvitacion(token: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { tokenInvitacion: token },
    });

    if (!usuario) {
      throw new NotFoundException('Token de invitación no válido');
    }

    if (usuario.tokenExpiracion && usuario.tokenExpiracion < new Date()) {
      throw new BadRequestException('El token de invitación ha expirado');
    }

    return { valido: true, correo: usuario.correo };
  }

  /**
   * FASE 3: El docente activa su cuenta estableciendo su contraseña.
   */
  async activarCuenta(dto: ActivateAccountDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { tokenInvitacion: dto.token },
    });

    if (!usuario) {
      throw new NotFoundException('Token de invitación no válido');
    }

    if (usuario.tokenExpiracion && usuario.tokenExpiracion < new Date()) {
      throw new BadRequestException('El token de invitación ha expirado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        activo: true,
        tokenInvitacion: null,
        tokenExpiracion: null,
      },
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
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      activo: usuario.activo,
      rol,
    };
  }
}
