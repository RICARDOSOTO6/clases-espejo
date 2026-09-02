import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMateriaDto } from './dto/create-materia.dto';
import { UpdateMateriaDto } from './dto/update-materia.dto';

@Injectable()
export class MateriasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(agenteId: number) {
    const agente = await this.getAgente(agenteId);
    return this.prisma.materia.findMany({
      where: { institucionId: agente.institucionId },
      include: {
        asignaciones: {
          include: {
            docenteInstitucion: {
              include: { docente: { include: { usuario: true } } },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtener(agenteId: number, id: number) {
    const agente = await this.getAgente(agenteId);
    const materia = await this.prisma.materia.findFirst({
      where: { id, institucionId: agente.institucionId },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    return materia;
  }

  async crear(agenteId: number, dto: CreateMateriaDto) {
    const agente = await this.getAgente(agenteId);
    return this.prisma.materia.create({
      data: {
        institucionId: agente.institucionId,
        clave: dto.clave,
        nombre: dto.nombre,
        programaEducativo: dto.programaEducativo,
        descripcion: dto.descripcion,
        activa: dto.activa ?? true,
      },
    });
  }

  async actualizar(agenteId: number, id: number, dto: UpdateMateriaDto) {
    const agente = await this.getAgente(agenteId);
    const materia = await this.prisma.materia.findFirst({
      where: { id, institucionId: agente.institucionId },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    return this.prisma.materia.update({ where: { id }, data: dto });
  }

  async eliminar(agenteId: number, id: number) {
    const agente = await this.getAgente(agenteId);
    const materia = await this.prisma.materia.findFirst({
      where: { id, institucionId: agente.institucionId },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const asignaciones = await this.prisma.asignacionDocente.count({
      where: { materiaId: id },
    });
    if (asignaciones > 0) {
      throw new BadRequestException(
        'No se puede eliminar: la materia tiene docentes asignados',
      );
    }

    await this.prisma.materia.delete({ where: { id } });
    return { mensaje: 'Materia eliminada' };
  }

  private async getAgente(agenteId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId: agenteId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar materias',
      );
    }
    return agente;
  }
}
