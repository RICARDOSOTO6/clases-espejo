import { Controller, Get, ForbiddenException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapacidadesGuard, rolDeUsuario } from '../auth/capacidades.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ETIQUETA_ROL, capacidadesDe } from '../common/capacidades';

/**
 * Las capacidades del usuario que está dentro, tal cual.
 *
 * Es lo que permite que la interfaz **esconda** lo que no se puede hacer en
 * lugar de pintarlo y comerse un 403: hasta ahora el frontend adivinaba los
 * permisos comparando el rol, y cada ruta nueva era una oportunidad de enseñar
 * un botón prohibido (el caso de «Instituciones» en la pantalla de la
 * secretaría). La lista sale de la misma tabla que usa el guardia
 * (`common/capacidades.ts`), así que interfaz y servidor no pueden discrepar.
 *
 * No pide ninguna capacidad: cualquier usuario autenticado puede preguntar por
 * las suyas. Lo que no puede es preguntar por las de otro.
 */
@Controller('cace')
@UseGuards(JwtAuthGuard, CapacidadesGuard)
export class CapacidadesCaceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('capacidades')
  async misCapacidades(@CurrentUser('sub') usuarioId: number) {
    const cuenta = await rolDeUsuario(this.prisma, usuarioId);
    if (!cuenta) {
      throw new ForbiddenException('No se pudo identificar al usuario.');
    }

    return {
      rol: cuenta.rol,
      etiquetaRol: cuenta.rol ? ETIQUETA_ROL[cuenta.rol] : null,
      capacidades: capacidadesDe(cuenta.rol),
    };
  }
}
