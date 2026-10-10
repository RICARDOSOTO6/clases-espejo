import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { basename, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { rolDeVinculos } from '../common/capacidades';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';

/** Carpeta donde se guardan las fotos de perfil (dentro de `uploads`). */
export const AVATARES_DIR = join(process.cwd(), 'uploads', 'avatares');

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async getPerfil(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        agente: { include: { institucion: true } },
        docente: {
          include: {
            instituciones: { include: { institucion: true } },
          },
        },
        // La presidencia y la secretaría de la CACE también son miembros.
        miembroCace: { select: { id: true, cargo: true, activo: true } },
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const rol = rolDeVinculos(usuario);

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
      debeCambiarPassword: usuario.debeCambiarPassword,
      rol,
      agente: usuario.agente
        ? {
            id: usuario.agente.id,
            cargo: usuario.agente.cargo,
            institucion: usuario.agente.institucion,
          }
        : null,
      docente: usuario.docente
        ? {
            id: usuario.docente.id,
            gradoAcademico: usuario.docente.gradoAcademico,
            especialidad: usuario.docente.especialidad,
            instituciones: usuario.docente.instituciones.map((di) => ({
              id: di.id,
              numeroEmpleado: di.numeroEmpleado,
              activo: di.activo,
              institucion: di.institucion,
            })),
          }
        : null,
      miembroCace: usuario.miembroCace,
    };
  }

  /**
   * Cambia la contraseña del propio usuario.
   *
   * Es la salida del primer acceso: la presidencia de la CACE entra con una
   * contraseña provisional y `debeCambiarPassword` en verdadero, y este
   * endpoint es lo que le devuelve el control de su cuenta.
   */
  async cambiarPassword(usuarioId: number, dto: CambiarPasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      // El cliente omite `passwordHash`: aquí hace falta para comparar la actual.
      omit: { passwordHash: false },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!usuario.passwordHash) {
      throw new BadRequestException(
        'Tu cuenta todavía no tiene contraseña: pide que te la restablezcan.',
      );
    }

    const coincide = await bcrypt.compare(dto.actual, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    if (dto.actual === dto.nueva) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la actual',
      );
    }

    const passwordHash = await bcrypt.hash(dto.nueva, 10);
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        passwordHash,
        // Cumplido el cambio, el primer acceso deja de estar pendiente.
        debeCambiarPassword: false,
      },
    });

    return { mensaje: 'Contraseña actualizada correctamente' };
  }

  /**
   * Guarda la foto de perfil recién subida y borra la anterior, para no dejar
   * archivos huérfanos en el disco.
   */
  async guardarFoto(usuarioId: number, archivo: { filename: string }) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { fotoUrl: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const fotoUrl = `/avatares/${archivo.filename}`;
    const actualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoUrl },
      select: { id: true, fotoUrl: true },
    });

    borrarAvatar(usuario.fotoUrl);
    return actualizado;
  }

  /** Quita la foto de perfil y borra el archivo del disco. */
  async quitarFoto(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { fotoUrl: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoUrl: null },
    });
    borrarAvatar(usuario.fotoUrl);

    return { mensaje: 'Foto de perfil eliminada', fotoUrl: null };
  }
}

/**
 * Borra un avatar del disco. `basename` evita que una ruta manipulada salga de
 * la carpeta de avatares.
 */
function borrarAvatar(fotoUrl: string | null): void {
  if (!fotoUrl) return;
  const ruta = join(AVATARES_DIR, basename(fotoUrl));
  if (!existsSync(ruta)) return;
  try {
    unlinkSync(ruta);
  } catch {
    // Si el archivo está en uso, la petición no debe fallar por eso.
  }
}
