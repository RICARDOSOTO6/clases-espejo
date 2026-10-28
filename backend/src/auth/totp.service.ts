import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import {
  generarCodigosRecuperacion,
  generarSecretoTotp,
  hashCodigoRecuperacion,
  uriTotp,
  verificarCodigoTotp,
} from '../common/totp';

type CodigoGuardado = {
  hash: string;
  usadoEn: string | null;
};

@Injectable()
export class TotpService {
  constructor(private readonly prisma: PrismaService) {}

  /** Estado visible para la persona; nunca devuelve el secreto. */
  async estado(usuarioId: number) {
    const usuario = await this.usuarioCace(usuarioId);
    return {
      habilitado: usuario.totpHabilitado,
      confirmadoEn: usuario.totpConfirmadoEn,
      codigosRestantes: this.leerCodigos(
        usuario.totpCodigosRecuperacion,
      ).filter((codigo) => !codigo.usadoEn).length,
    };
  }

  /** Genera un secreto pendiente y el QR para la aplicación autenticadora. */
  async iniciar(usuarioId: number) {
    const usuario = await this.usuarioCace(usuarioId);
    if (usuario.totpHabilitado) {
      throw new ConflictException(
        'El segundo factor ya está activo. Desactívalo antes de configurarlo de nuevo.',
      );
    }

    const secreto = generarSecretoTotp();
    const uri = uriTotp(usuario.correo, secreto);
    const qrDataUrl = await QRCode.toDataURL(uri, {
      margin: 1,
      width: 240,
      color: { dark: '#111827', light: '#ffffff' },
    });

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        totpSecret: secreto,
        totpHabilitado: false,
        totpUltimoPaso: 0,
        totpCodigosRecuperacion: '',
        totpConfirmadoEn: null,
      },
    });

    return {
      secreto,
      uri,
      qrDataUrl,
      mensaje: 'Escanea el QR y confirma con el código de 6 dígitos.',
    };
  }

  /** Confirma el primer código y entrega los códigos de recuperación una vez. */
  async confirmar(usuarioId: number, codigo: string) {
    const usuario = await this.usuarioCace(usuarioId);
    if (usuario.totpHabilitado) {
      throw new ConflictException('El segundo factor ya está activo.');
    }
    if (!usuario.totpSecret) {
      throw new ConflictException(
        'Primero inicia la configuración del segundo factor.',
      );
    }

    const verificacion = verificarCodigoTotp(usuario.totpSecret, codigo, 0);
    if (!verificacion.valido) {
      throw new UnauthorizedException('El código no es válido o ya expiró.');
    }

    const codigos = generarCodigosRecuperacion();
    const guardados: CodigoGuardado[] = codigos.map((codigoPlano) => ({
      hash: hashCodigoRecuperacion(codigoPlano),
      usadoEn: null,
    }));

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        totpHabilitado: true,
        totpConfirmadoEn: new Date(),
        totpUltimoPaso: verificacion.paso,
        totpCodigosRecuperacion: JSON.stringify(guardados),
      },
    });

    return {
      habilitado: true,
      codigosRecuperacion: codigos,
      mensaje:
        'Segundo factor activado. Guarda los códigos de recuperación en un lugar seguro; no se volverán a mostrar.',
    };
  }

  /** Desactiva el segundo factor con contraseña y un código válido. */
  async desactivar(usuarioId: number, password: string, codigo: string) {
    const usuario = await this.usuarioCace(usuarioId, { password: true });
    if (!usuario.passwordHash) {
      throw new UnauthorizedException('No se pudo comprobar la contraseña.');
    }
    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException('La contraseña no es correcta.');
    }
    if (!usuario.totpSecret || !usuario.totpHabilitado) {
      throw new ConflictException('El segundo factor no está activo.');
    }

    const valido = await this.validarCodigo(usuario, codigo);
    if (!valido) {
      throw new UnauthorizedException('El código no es válido o ya expiró.');
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        totpSecret: null,
        totpHabilitado: false,
        totpUltimoPaso: 0,
        totpCodigosRecuperacion: '',
        totpConfirmadoEn: null,
      },
    });

    return { habilitado: false, mensaje: 'Segundo factor desactivado.' };
  }

  /**
   * Verifica el segundo factor en el login. Acepta TOTP o un código de
   * recuperación; estos últimos se consumen al usarse.
   */
  async verificarLogin(usuarioId: number, codigo: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        totpSecret: true,
        totpHabilitado: true,
        totpUltimoPaso: true,
        totpCodigosRecuperacion: true,
      },
    });
    if (!usuario?.totpHabilitado || !usuario.totpSecret) {
      throw new UnauthorizedException('El segundo factor no está activo.');
    }

    const valido = await this.validarCodigo(usuario, codigo);
    if (!valido) {
      throw new UnauthorizedException(
        'Código de segundo factor inválido. Revisa tu aplicación autenticadora.',
      );
    }
  }

  private async validarCodigo(
    usuario: {
      id: number;
      totpSecret: string | null;
      totpUltimoPaso: number;
      totpCodigosRecuperacion: string;
    },
    codigo: string,
  ): Promise<boolean> {
    if (!usuario.totpSecret) return false;

    const verificacion = verificarCodigoTotp(
      usuario.totpSecret,
      codigo,
      usuario.totpUltimoPaso,
    );
    if (verificacion.valido) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { totpUltimoPaso: verificacion.paso },
      });
      return true;
    }

    const codigos = this.leerCodigos(usuario.totpCodigosRecuperacion);
    const hash = hashCodigoRecuperacion(codigo);
    const encontrado = codigos.find(
      (guardado) => !guardado.usadoEn && guardado.hash === hash,
    );
    if (!encontrado) return false;

    encontrado.usadoEn = new Date().toISOString();
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { totpCodigosRecuperacion: JSON.stringify(codigos) },
    });
    return true;
  }

  private leerCodigos(json: string): CodigoGuardado[] {
    if (!json) return [];
    try {
      const datos: unknown = JSON.parse(json);
      if (!Array.isArray(datos)) return [];
      return datos.filter(
        (item): item is CodigoGuardado =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CodigoGuardado).hash === 'string',
      );
    } catch {
      return [];
    }
  }

  private async usuarioCace(
    usuarioId: number,
    opciones: { password?: boolean } = {},
  ) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        correo: true,
        passwordHash: opciones.password ?? false,
        totpSecret: true,
        totpHabilitado: true,
        totpUltimoPaso: true,
        totpCodigosRecuperacion: true,
        totpConfirmadoEn: true,
        miembroCace: { select: { activo: true } },
      },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (!usuario.miembroCace?.activo) {
      throw new ForbiddenException(
        'El segundo factor solo está disponible para la presidencia y la secretaría de la CACE.',
      );
    }
    return usuario;
  }
}
