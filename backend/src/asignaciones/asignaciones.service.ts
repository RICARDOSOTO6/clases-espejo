import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';

@Injectable()
export class AsignacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(agenteId: number) {
    const agente = await this.getAgente(agenteId);
    return this.prisma.asignacionDocente.findMany({
      where: { materia: { institucionId: agente.institucionId } },
      include: {
        materia: true,
        docenteInstitucion: {
          include: { docente: { include: { usuario: true } } },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async crear(agenteId: number, dto: CreateAsignacionDto) {
    const agente = await this.getAgente(agenteId);

    const materia = await this.prisma.materia.findFirst({
      where: { id: dto.materiaId, institucionId: agente.institucionId },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const docenteInstitucion = await this.prisma.docenteInstitucion.findFirst({
      where: { id: dto.docenteInstitucionId, institucionId: agente.institucionId },
    });
    if (!docenteInstitucion) throw new NotFoundException('Docente no encontrado');

    return this.prisma.asignacionDocente.create({
      data: {
        docenteInstitucionId: dto.docenteInstitucionId,
        materiaId: dto.materiaId,
        periodoEscolar: dto.periodoEscolar,
      },
      include: {
        materia: true,
        docenteInstitucion: {
          include: { docente: { include: { usuario: true } } },
        },
      },
    });
  }

  async eliminar(agenteId: number, id: number) {
    const agente = await this.getAgente(agenteId);
    const asignacion = await this.prisma.asignacionDocente.findFirst({
      where: { id, materia: { institucionId: agente.institucionId } },
    });
    if (!asignacion) throw new NotFoundException('Asignación no encontrada');
    await this.prisma.asignacionDocente.delete({ where: { id } });
    return { mensaje: 'Asignación eliminada' };
  }

  async listarMias(usuarioId: number) {
    const docente = await this.prisma.docente.findUnique({
      where: { usuarioId },
    });
    if (!docente) {
      throw new UnauthorizedException(
        'Solo un docente puede consultar sus asignaciones',
      );
    }
    return this.prisma.asignacionDocente.findMany({
      where: { docenteInstitucion: { docenteId: docente.id } },
      include: {
        materia: true,
        docenteInstitucion: { include: { institucion: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  private async getAgente(agenteId: number) {
    const agente = await this.prisma.agenteInternacionalizacion.findUnique({
      where: { usuarioId: agenteId },
    });
    if (!agente) {
      throw new UnauthorizedException(
        'Solo un agente de internacionalización puede gestionar asignaciones',
      );
    }
    return agente;
  }
}
