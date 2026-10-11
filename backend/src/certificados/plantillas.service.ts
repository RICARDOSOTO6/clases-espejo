import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPOS_POR_DEFECTO,
  CATALOGO_CAMPOS,
  CamposCertificado,
  LIENZO_POR_DEFECTO,
  LienzoPlantilla,
  normalizarCampos,
} from './campos-certificado';
import { CertificadoPdfService } from './certificado-pdf.service';
import { GuardarPlantillaDto } from './dto/plantilla-certificado.dto';

/** Lo que se devuelve de una plantilla al panel (con los campos ya saneados). */
export interface PlantillaVista {
  id: number;
  version: number;
  activa: boolean;
  fondoUrl: string | null;
  anchoPx: number;
  altoPx: number;
  campos: CamposCertificado;
  creadaPor: string | null;
  creadoEn: Date;
  /** Cuántos certificados salieron con esta versión (para la lista de versiones). */
  certificados: number;
}

/** Los datos con los que se arma una versión nueva (y la plantilla de arranque). */
export interface ContenidoPlantilla {
  fondoUrl: string | null;
  anchoPx: number;
  altoPx: number;
  campos: CamposCertificado;
}

/**
 * La plantilla del certificado, que es **universal y versionada**.
 *
 * Universal: una sola para toda la CACE, no una por institución. Versionada:
 * crear o editar no sobrescribe nada, crea una versión nueva y deja la anterior
 * intacta, porque los certificados ya emitidos apuntan a la versión con la que
 * salieron y no deben cambiar nunca. Solo una versión está activa, y es la que
 * se usa para las emisiones nuevas.
 *
 * La edición **siempre es una creación**: no hay ninguna ruta que modifique una
 * versión existente. Si se pudiera editar la activa, mover el hueco del nombre
 * dejaría sin sentido el PDF de quien ya lo tiene impreso.
 *
 * Desde esta fase una plantilla es **una imagen de diseño más tres huecos**
 * (nombre, folio y QR): todo lo demás va dibujado en la imagen.
 */
@Injectable()
export class PlantillasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: CertificadoPdfService,
  ) {}

  // --- Lectura ---

  /**
   * Todo lo que necesita el panel: el catálogo de datos, la lista de versiones
   * y la plantilla de arranque.
   *
   * Va también `porDefecto`, que son los tres huecos que manda la guía de
   * diseño: sin ella el panel no podría enseñar una vista previa antes de que
   * exista la primera versión.
   */
  async listar() {
    const versiones = await this.prisma.plantillaCertificado.findMany({
      orderBy: { version: 'desc' },
      include: {
        creadaPor: { select: { nombres: true, apellidoPaterno: true } },
        _count: { select: { certificados: true } },
      },
    });

    const vistas = versiones.map((v) => this.aVista(v));

    return {
      catalogo: CATALOGO_CAMPOS,
      porDefecto: this.porDefecto(),
      versiones: vistas,
      activa: vistas.find((v) => v.activa) ?? null,
    };
  }

  /** La versión activa tal cual, que es la que se usa para emitir. */
  async activa() {
    return this.prisma.plantillaCertificado.findFirst({
      where: { activa: true },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * El QR de un folio en PNG, para la vista previa del panel: así lo que se ve
   * en la pantalla es exactamente el código que va a salir impreso.
   */
  qrDeMuestra(folio: string): Promise<Buffer> {
    return this.pdf.qrDeFolio(folio.trim() || 'CACE-2026-0001');
  }

  // --- Escritura (siempre una versión nueva) ---

  /**
   * Crea una versión nueva a partir de la activa (o de la de arranque)
   * aplicando lo que llega. Queda **activa**: es la que se acaba de diseñar y
   * la que se va a usar; para volver a una anterior está `activar`.
   */
  async crear(usuarioId: number, dto: GuardarPlantillaDto) {
    const base = await this.contenidoBase();
    // El lienzo con el que se guarda: el que trae el formulario o el de la
    // versión activa. Es lo que se usa para encajar cada hueco dentro del papel.
    const lienzo: LienzoPlantilla = {
      anchoPx: dto.anchoPx ?? base.anchoPx,
      altoPx: dto.altoPx ?? base.altoPx,
    };

    return this.crearVersion(usuarioId, {
      fondoUrl:
        dto.fondoUrl !== undefined ? dto.fondoUrl || null : base.fondoUrl,
      anchoPx: lienzo.anchoPx,
      altoPx: lienzo.altoPx,
      campos: normalizarCampos(dto.campos, base.campos, lienzo),
    });
  }

  /**
   * Guarda el diseño recién subido **como una versión nueva**.
   *
   * Podría pensarse que una imagen no es «un cambio de plantilla», pero sí lo
   * es: si el diseño se cambiara en la versión activa, dos certificados de la
   * misma versión habrían salido con diseños distintos. El archivo anterior
   * **no se borra**, porque la versión anterior lo sigue usando en su vista
   * previa.
   */
  async guardarFondo(usuarioId: number, archivo: { filename: string }) {
    const base = await this.contenidoBase();
    return this.crearVersion(usuarioId, {
      ...base,
      fondoUrl: `/certificado-fondo/${archivo.filename}`,
    });
  }

  /** Deja activa una versión concreta y desactiva el resto. */
  async activar(id: number) {
    const plantilla = await this.prisma.plantillaCertificado.findUnique({
      where: { id },
    });
    if (!plantilla) throw new NotFoundException('Esa versión no existe.');

    const [, actualizada] = await this.prisma.$transaction([
      this.prisma.plantillaCertificado.updateMany({
        where: { activa: true, id: { not: id } },
        data: { activa: false },
      }),
      this.prisma.plantillaCertificado.update({
        where: { id },
        data: { activa: true },
        include: {
          creadaPor: { select: { nombres: true, apellidoPaterno: true } },
          _count: { select: { certificados: true } },
        },
      }),
    ]);

    return {
      mensaje: `La versión ${plantilla.version} es ahora la activa.`,
      plantilla: this.aVista(actualizada),
    };
  }

  // --- Apoyo ---

  /**
   * Numera y guarda la versión nueva. La numeración y el «solo una activa» van
   * en la misma transacción: si dos peticiones entraran a la vez, sin esto
   * quedarían dos versiones activas y la emisión no sabría cuál usar.
   */
  private async crearVersion(usuarioId: number, datos: ContenidoPlantilla) {
    const guardada = await this.prisma.$transaction(async (tx) => {
      const ultima = await tx.plantillaCertificado.aggregate({
        _max: { version: true },
      });
      const version = (ultima._max.version ?? 0) + 1;

      await tx.plantillaCertificado.updateMany({
        where: { activa: true },
        data: { activa: false },
      });

      return tx.plantillaCertificado.create({
        data: {
          version,
          activa: true,
          fondoUrl: datos.fondoUrl,
          anchoPx: datos.anchoPx,
          altoPx: datos.altoPx,
          // Las dos columnas son `Json` y siguen en el esquema: `campos` lleva
          // los tres huecos y `textosLegales` va vacío, porque los textos
          // legales van dibujados dentro del diseño.
          campos: datos.campos as unknown as Prisma.InputJsonValue,
          textosLegales: [] as unknown as Prisma.InputJsonValue,
          creadaPorUsuarioId: usuarioId,
        },
        include: {
          creadaPor: { select: { nombres: true, apellidoPaterno: true } },
          _count: { select: { certificados: true } },
        },
      });
    });

    return {
      mensaje: `Plantilla guardada como versión ${guardada.version}. Es la versión activa.`,
      plantilla: this.aVista(guardada),
    };
  }

  /** De dónde parte una versión nueva: de la activa o de la de arranque. */
  private async contenidoBase(): Promise<ContenidoPlantilla> {
    const activa = await this.activa();
    if (activa) {
      const lienzo: LienzoPlantilla = {
        anchoPx: activa.anchoPx,
        altoPx: activa.altoPx,
      };
      return {
        fondoUrl: activa.fondoUrl,
        anchoPx: activa.anchoPx,
        altoPx: activa.altoPx,
        // Se encajan al lienzo de la propia versión: una fila vieja con un dato
        // medio fuera del papel se corrige sola al guardar la siguiente versión.
        campos: normalizarCampos(activa.campos, CAMPOS_POR_DEFECTO, lienzo),
      };
    }
    return this.porDefecto();
  }

  /** La plantilla de arranque, que todavía no tiene fila en la base. */
  private porDefecto(): ContenidoPlantilla {
    return {
      fondoUrl: null,
      anchoPx: LIENZO_POR_DEFECTO.anchoPx,
      altoPx: LIENZO_POR_DEFECTO.altoPx,
      campos: CAMPOS_POR_DEFECTO,
    };
  }

  /** De la fila de la base a lo que se devuelve (con el JSON saneado). */
  private aVista(plantilla: {
    id: number;
    version: number;
    activa: boolean;
    fondoUrl: string | null;
    anchoPx: number;
    altoPx: number;
    campos: unknown;
    creadoEn: Date;
    creadaPor?: { nombres: string; apellidoPaterno: string } | null;
    _count?: { certificados: number };
  }): PlantillaVista {
    const lienzo: LienzoPlantilla = {
      anchoPx: plantilla.anchoPx,
      altoPx: plantilla.altoPx,
    };
    return {
      id: plantilla.id,
      version: plantilla.version,
      activa: plantilla.activa,
      fondoUrl: plantilla.fondoUrl,
      anchoPx: plantilla.anchoPx,
      altoPx: plantilla.altoPx,
      campos: normalizarCampos(plantilla.campos, CAMPOS_POR_DEFECTO, lienzo),
      creadaPor: plantilla.creadaPor
        ? `${plantilla.creadaPor.nombres} ${plantilla.creadaPor.apellidoPaterno}`.trim()
        : null,
      creadoEn: plantilla.creadoEn,
      certificados: plantilla._count?.certificados ?? 0,
    };
  }
}
