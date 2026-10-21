import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers['authorization'] as
      string | undefined;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const token = authorization.slice(7);

    let payload: { sub?: number; iat?: number };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token de autenticación inválido');
    }

    await this.verificarCuentaVigente(payload?.sub, payload?.iat);

    request.user = payload;
    return true;
  }

  /**
   * Comprueba en cada petición que la cuenta siga vigente: el usuario activo,
   * el vínculo del docente y, desde la Fase 1, que el token se emitiera
   * **después** del último cambio de contraseña. Lo último cierra las sesiones
   * abiertas al cambiarla o restablecerla.
   */
  private async verificarCuentaVigente(
    usuarioId?: number,
    emitidoEn?: number,
  ): Promise<void> {
    if (usuarioId == null) {
      throw new UnauthorizedException('Token de autenticación inválido');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { docente: { include: { instituciones: true } } },
    });

    if (!usuario) {
      throw new UnauthorizedException('Token de autenticación inválido');
    }
    if (!usuario.activo) {
      throw new UnauthorizedException(
        'Tu cuenta está desactivada. Contacta a tu institución.',
      );
    }

    // `iat` va en segundos: se compara al segundo para que un token emitido en
    // el mismo segundo del cambio siga valiendo (por ejemplo, justo después de
    // restablecer la contraseña).
    if (
      emitidoEn != null &&
      Math.floor(usuario.sesionesValidasDesde.getTime() / 1000) > emitidoEn
    ) {
      throw new UnauthorizedException(
        'Tu sesión se cerró al cambiar la contraseña. Vuelve a entrar.',
      );
    }

    const vinculos = usuario.docente?.instituciones ?? [];
    if (vinculos.length > 0 && !vinculos.some((v) => v.activo)) {
      throw new UnauthorizedException(
        'Tu cuenta de docente está desactivada por tu institución.',
      );
    }
  }
}
