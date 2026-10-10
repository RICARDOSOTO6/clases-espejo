import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capacidad, puede } from '../common/capacidades';
import { PrismaService } from '../prisma/prisma.service';

const CAPACIDADES_CLAVE = 'capacidades';

/**
 * Marca un controlador o una ruta con las capacidades que exige:
 *
 * ```ts
 * @Requiere('aprobarInstituciones')
 * @Post('instituciones/:id/aprobar')
 * ```
 */
export const Requiere = (...capacidades: Capacidad[]) =>
  SetMetadata(CAPACIDADES_CLAVE, capacidades);

/**
 * Comprueba que el usuario autenticado tenga las capacidades que pide la ruta.
 *
 * El rol **no** viaja en el token (el token solo lleva el `sub`), así que se lee
 * de la base. Se comprueba contra la tabla de capacidades, no contra el nombre
 * del rol: así un rol nuevo no obliga a tocar los controladores.
 *
 * Va **después** de `JwtAuthGuard`, que es quien deja el usuario en la petición.
 */
@Injectable()
export class CapacidadesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridas = this.reflector.getAllAndOverride<Capacidad[]>(
      CAPACIDADES_CLAVE,
      [context.getHandler(), context.getClass()],
    );
    // Sin `@Requiere(...)` la ruta solo exige estar autenticado.
    if (!requeridas || requeridas.length === 0) return true;

    const peticion = context.switchToHttp().getRequest();
    const usuarioId = peticion.user?.sub;
    if (!usuarioId) {
      throw new ForbiddenException('No se pudo identificar al usuario.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        activo: true,
        agente: { select: { id: true } },
        docente: { select: { id: true } },
        miembroCace: { select: { cargo: true, activo: true } },
      },
    });
    if (!usuario?.activo) {
      throw new ForbiddenException('La cuenta está desactivada.');
    }

    // El rol **no** es una columna de USUARIO: se deduce de la fila que tenga.
    // Presidencia y suplencia comparten capacidades; la secretaría tiene las
    // suyas.
    const miembro = usuario.miembroCace?.activo ? usuario.miembroCace : null;
    const rol = miembro
      ? miembro.cargo === 'SECRETARIA'
        ? 'SECRETARIA_CACE'
        : 'PRESIDENTE_CACE'
      : usuario.agente
        ? 'AGENTE'
        : usuario.docente
          ? 'DOCENTE'
          : null;

    const faltantes = requeridas.filter(
      (capacidad) => !puede(rol, capacidad),
    );
    if (faltantes.length > 0) {
      throw new ForbiddenException(
        'Tu rol no tiene permiso para esta acción.',
      );
    }
    return true;
  }
}
