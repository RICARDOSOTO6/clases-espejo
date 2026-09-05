import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateInstitucionDto } from './dto/update-institucion.dto';

@Injectable()
export class InstitucionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista las instituciones activas, excepto las del propio usuario. */
  async listar(usuarioId: number) {
    const propias = await this.institucionesPropias(usuarioId);
    return this.prisma.institucion.findMany({
      where: { activa: true, id: { notIn: propias } },
      select: { id: true, nombre: true, pais: true, correoInstitucional: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtenerMia(usuarioId: number) {
    const agente = await this.getAgente(usuarioId);
    return this.prisma.institucion.findUnique({
      where: { id: agente.institucionId },
    });
  }

  async actualizarMia(usuarioId: number, dto: UpdateInstitucionDto) {
    const agente = await this.getAgente(usuarioId);
    return this.prisma.institucion.update({
      where: { id: agente.institucionId },
      data: {
        nombre: dto.nombre,
        pais: dto.pais,
        correoInstitucional: dto.correoInstitucional,
      },
    });
  }

  async listarMaterias(id: number) {
    return this.prisma.materia.findMany({
      where: { institucionId: id, activa: true },
      orderBy: { nombre: 'asc' },
    });
  }

  private async getAgente(usuarioId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar su institución',
      );
    }
    return agente;
  }

  private async institucionesPropias(usuarioId: number): Promise<number[]> {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId },
    });
    if (agente) return [agente.institucionId];

    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
      include: { instituciones: true },
    });
    if (docente) return docente.instituciones.map((di) => di.institucionId);

    return [];
  }
}
