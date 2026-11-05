import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  codigoValido,
  folioConFirma,
  separarFolio,
} from './codigo-verificacion';
import { certificadoModoDemo } from './modo-demo';

/** Los cuatro desenlaces que puede tener una consulta pública. */
type EstadoVerificacion = 'VALIDO' | 'ANULADO' | 'NO_ENCONTRADO' | 'INVALIDO';

/**
 * Lo que se enseña de un certificado en la página pública. **Solo esto**: el
 * nombre del alumno y los datos de la clase; nada de correo, matrícula, hash ni
 * el PDF. Un certificado es un documento que se enseña, pero la lista de
 * alumnos de una institución no.
 */
interface InstitucionVerificada {
  nombre: string;
  pais: string;
  codigoPais: string;
  logoUrl: string | null;
}

interface CertificadoVerificado {
  folio: string;
  /** Solo el nombre: la matrícula no se publica (sirve para uso interno). */
  alumno: string;
  titulo: string;
  /** Lista completa; un certificado puede unir más de dos instituciones. */
  instituciones: InstitucionVerificada[];
  /** Campos antiguos, conservados para no romper pantallas ya publicadas. */
  institucionOrigen: string;
  institucionDestino: string;
  fechaInicio: Date;
  fechaFin: Date;
  emitidoEn: Date;
  estado: string;
  anuladoMotivo: string;
}

export interface ResultadoVerificacion {
  estado: EstadoVerificacion;
  /** La frase que encabeza la página; el detalle va en `certificado`. */
  mensaje: string;
  /** `null` salvo que el folio exista **y** el código sea el correcto. */
  certificado: CertificadoVerificado | null;
  /** El certificado se emitió en modo DEMO (sin validez oficial). */
  modoDemo: boolean;
}

const ESTADO_ANULADO = 'ANULADO';

/**
 * Verificación pública de un certificado.
 *
 * Dos reglas mandan aquí:
 *
 * 1. **Sin el código correcto no se enseña nada.** Devuelve `INVALIDO` con un
 *    mensaje que invita a escanear el QR, y `certificado: null`. Da igual que el
 *    folio exista o no: la respuesta es la misma, así que probando folios no se
 *    averigua cuáles existen (el folio es consecutivo y se adivina; el código no,
 *    porque sale de un HMAC con el secreto del servidor).
 * 2. **Un certificado anulado se ve como anulado.** Con el código correcto sí se
 *    enseña, pero marcado y con el motivo: quien escanee el QR de un certificado
 *    anulado tiene que entender que ya no vale, no que es falso.
 *
 * La respuesta es siempre un 200 con un estado: no hay forma de distinguir «no
 * existe» de «no me diste el código», y no hay ninguna ruta que liste
 * certificados.
 */
@Injectable()
export class VerificacionService {
  constructor(private readonly prisma: PrismaService) {}

  async verificar(
    folioRecibido: string,
    codigoRecibido?: string,
  ): Promise<ResultadoVerificacion> {
    const partes = separarFolio(folioRecibido);
    if (!partes) {
      return this.invalido();
    }

    // El folio impreso puede traer la firma al final. Si es un enlace viejo,
    // la firma sigue llegando en `?c=`. En ambos casos se valida antes de
    // consultar la base.
    const codigo = partes.codigo ?? codigoRecibido;
    if (!codigoValido(partes.base, codigo)) {
      return this.invalido();
    }

    const certificado = await this.prisma.certificado.findUnique({
      where: { folio: partes.base },
      select: {
        folio: true,
        estado: true,
        anuladoMotivo: true,
        emitidoEn: true,
        institucionesSnapshot: true,
        alumno: { select: { nombre: true } },
        proyecto: {
          select: {
            fechaInicio: true,
            fechaFin: true,
            solicitud: {
              select: {
                titulo: true,
                asignacionOrigen: {
                  select: {
                    docenteInstitucion: {
                      select: { institucion: { select: { nombre: true } } },
                    },
                  },
                },
                institucionDestino: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });

    if (!certificado) {
      return {
        estado: 'NO_ENCONTRADO',
        mensaje:
          'No encontramos ningún certificado con ese folio. Comprueba que esté bien escrito e inténtalo de nuevo.',
        certificado: null,
        modoDemo: certificadoModoDemo(),
      };
    }

    const solicitud = certificado.proyecto.solicitud;
    const origen = solicitud.asignacionOrigen.docenteInstitucion.institucion;
    const destino = solicitud.institucionDestino;
    const snapshot = (certificado.institucionesSnapshot ?? []) as unknown;
    const lista = Array.isArray(snapshot) ? snapshot : [];
    const instituciones: InstitucionVerificada[] = lista
      .filter(
        (item) => !!item && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item) => {
        const fila = item as Record<string, unknown>;
        return {
          nombre: typeof fila.nombre === 'string' ? fila.nombre : '',
          pais: typeof fila.pais === 'string' ? fila.pais : '',
          codigoPais:
            typeof fila.codigoPais === 'string' ? fila.codigoPais : '',
          logoUrl: typeof fila.logoUrl === 'string' ? fila.logoUrl : null,
        };
      })
      .filter((item) => item.nombre);
    if (instituciones.length === 0) {
      instituciones.push(
        {
          nombre: origen.nombre,
          pais: '',
          codigoPais: '',
          logoUrl: null,
        },
        {
          nombre: destino.nombre,
          pais: '',
          codigoPais: '',
          logoUrl: null,
        },
      );
    }

    const datos: CertificadoVerificado = {
      folio: folioConFirma(partes.base),
      alumno: certificado.alumno.nombre,
      titulo: solicitud.titulo,
      instituciones,
      institucionOrigen: origen.nombre,
      institucionDestino: destino.nombre,
      fechaInicio: certificado.proyecto.fechaInicio,
      fechaFin: certificado.proyecto.fechaFin,
      emitidoEn: certificado.emitidoEn,
      estado: certificado.estado,
      anuladoMotivo: certificado.anuladoMotivo,
    };

    if (certificado.estado === ESTADO_ANULADO) {
      return {
        estado: 'ANULADO',
        mensaje:
          'Este certificado fue anulado por la CACE y ya no tiene validez.',
        certificado: datos,
        modoDemo: certificadoModoDemo(),
      };
    }

    return {
      estado: 'VALIDO',
      mensaje: 'Certificado auténtico: lo emitió la CACE y está vigente.',
      certificado: datos,
      modoDemo: certificadoModoDemo(),
    };
  }

  /**
   * La respuesta cuando el enlace no trae el código o trae uno que no es: no se
   * revela nada del certificado ni se dice si el folio existe.
   */
  private invalido(): ResultadoVerificacion {
    return {
      estado: 'INVALIDO',
      mensaje:
        'El folio no es válido. Revisa que lo hayas copiado completo, incluida la terminación después del último guion.',
      certificado: null,
      modoDemo: certificadoModoDemo(),
    };
  }
}
