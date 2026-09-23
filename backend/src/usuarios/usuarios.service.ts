import { Injectable, NotFoundException } from '@nestjs/common';
import { basename, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';

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
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const rol = usuario.agente ? 'AGENTE' : usuario.docente ? 'DOCENTE' : null;

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
    };
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
