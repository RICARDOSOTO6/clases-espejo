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
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InviteDocenteDto } from './dto/invite-docente.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
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

    return this.sanitizeUsuario(usuario);
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });

    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException(
        'La cuenta aún no está activa. Revisa tu correo de invitación.',
      );
    }

    const coincide = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const access_token = await this.jwtService.signAsync({
      sub: usuario.id,
      correo: usuario.correo,
    });

    return { access_token, usuario: this.sanitizeUsuario(usuario) };
  }

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

  private sanitizeUsuario(usuario: {
    id: number;
    nombres: string;
    apellidos: string;
    correo: string;
    activo: boolean;
    creadoEn: Date;
  }) {
    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      activo: usuario.activo,
      creadoEn: usuario.creadoEn,
    };
  }
}
