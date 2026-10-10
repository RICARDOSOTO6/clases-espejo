import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ESTADO_CACE_APROBADA,
  ESTADO_CACE_PENDIENTE,
  ESTADO_CACE_RECHAZADA,
  ESTADO_CACE_VETADA,
} from './estados';

/**
 * ¿Puede operar un agente de internacionalización?
 *
 * Un agente recién registrado puede estar en dos situaciones que lo dejan
 * **solo** con el paso de «completar datos» de su institución:
 *
 * 1. Su institución todavía no está aprobada por la CACE (nació pendiente).
 * 2. Su institución ya estaba aprobada, así que su alta la confirma un agente
 *    de esa misma institución (`confirmadoEn` en `null` hasta entonces).
 *
 * La condición estaba repitiéndose en cada servicio; vive aquí, en un solo
 * sitio, y los servicios solo llaman a `exigirAgenteHabilitado` (o preguntan por
 * `estadoHabilitacion` para enseñarlo en la pantalla).
 */

/** Datos mínimos de la institución y del agente para decidir si puede operar. */
export type InstitucionDelAgente = {
  nombre: string;
  estadoCace: string;
  motivoCace: string;
};

export type ResultadoHabilitacion = {
  /** Verdadero si el agente puede usar el resto del panel. */
  puedeOperar: boolean;
  /**
   * Por qué no puede operar, ya redactado para enseñarlo. `null` cuando sí
   * puede.
   */
  motivoBloqueo: string | null;
};

/** Frase que explica la situación de la institución ante la CACE. */
export function situacionCace(estadoCace: string): string {
  switch (estadoCace) {
    case ESTADO_CACE_PENDIENTE:
      return 'todavía está pendiente de aprobación por la CACE';
    case ESTADO_CACE_RECHAZADA:
      return 'fue rechazada por la CACE';
    case ESTADO_CACE_VETADA:
      return 'fue vetada por la CACE';
    case ESTADO_CACE_APROBADA:
      return 'está aprobada por la CACE';
    default:
      return 'no está aprobada por la CACE';
  }
}

/**
 * Lo que le falta a un agente para poder operar. Devuelve `null` cuando no le
 * falta nada (es decir, cuando puede invitar docentes, crear materias y
 * asignaciones, y proponer o recibir clases espejo).
 */
export function estadoHabilitacion(
  institucion: InstitucionDelAgente,
  agente: { confirmadoEn: Date | null },
): ResultadoHabilitacion {
  const bloqueoComun =
    'Mientras tanto solo puedes ver y completar los datos de tu institución ' +
    '(nombre, país, estado, ciudad, teléfono, correo institucional y logo): ' +
    'no puedes invitar docentes, ni crear materias o asignaciones, ni proponer ' +
    'clases espejo.';

  if (institucion.estadoCace !== ESTADO_CACE_APROBADA) {
    const motivo = institucion.motivoCace?.trim();
    return {
      puedeOperar: false,
      motivoBloqueo:
        `Tu institución «${institucion.nombre}» ${situacionCace(institucion.estadoCace)}` +
        `${motivo ? ` (motivo: ${motivo})` : ''}. ${bloqueoComun}`,
    };
  }

  if (!agente.confirmadoEn) {
    return {
      puedeOperar: false,
      motivoBloqueo:
        `Tu alta como agente de «${institucion.nombre}» todavía no la ha ` +
        `confirmado un agente de esa institución. ${bloqueoComun}`,
    };
  }

  return { puedeOperar: true, motivoBloqueo: null };
}

/**
 * Corta la petición si el agente autenticado no puede operar todavía.
 *
 * Si el usuario no es agente no hace nada: cada servicio decide con sus propias
 * reglas quién puede entrar (por ejemplo, un docente proponiendo una clase
 * espejo), y la comprobación de la institución de un docente ya la hacen las
 * solicitudes.
 */
export async function exigirAgenteHabilitado(
  prisma: PrismaService,
  usuarioId: number,
): Promise<void> {
  const agente = await prisma.agenteInternacionalizacion.findUnique({
    where: { usuarioId },
    select: {
      confirmadoEn: true,
      institucion: {
        select: { nombre: true, estadoCace: true, motivoCace: true },
      },
    },
  });
  if (!agente) return;

  const { puedeOperar, motivoBloqueo } = estadoHabilitacion(
    agente.institucion,
    agente,
  );
  if (!puedeOperar) {
    throw new ForbiddenException(motivoBloqueo);
  }
}
