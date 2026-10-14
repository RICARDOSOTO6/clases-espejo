import { Injectable } from '@nestjs/common';
import { nombreCompleto } from '../common/nombre-completo';

/**
 * Genera el archivo `.ics` (iCalendar, RFC 5545) de una clase espejo y sus
 * sesiones.
 *
 * La plataforma **no manda recordatorios**: entrega un archivo y es el
 * calendario del usuario (Google, Apple, Outlook…) el que avisa. Por eso los
 * avisos de 60, 30 y 15 minutos van dentro de cada evento como bloques
 * `VALARM`, y no hay ninguna integración con proveedores ni permisos que pedir.
 *
 * Dos decisiones que evitan los errores clásicos de este formato:
 *
 * - Las fechas van **en UTC, con la `Z`** (`20261015T210000Z`) y nunca con
 *   `TZID`. Entre México y Colombia cada quien ve la hora en su reloj, que es
 *   justo lo que hace falta, y nos ahorramos toda la discusión de zonas.
 * - El `UID` es estable (`sesion-<id>@clasesconjuntas`). Volver a descargar el
 *   archivo y abrirlo **actualiza** el mismo evento en lugar de duplicarlo.
 *
 * El modelo `Sesion` no guarda hora de fin, así que se asume una duración de
 * clase (`MINUTOS_SESION`): sin `DTEND` la mayoría de calendarios inventan una
 * duración peor.
 */

/** Duración asumida de una sesión, en minutos (el modelo no tiene hora de fin). */
const MINUTOS_SESION = 60;

/** Dominio de los `UID`: los identificadores solo tienen que ser únicos y estables. */
const DOMINIO_UID = 'clasesconjuntas';

const PRODID = '-//Clases Conjuntas//Clase Espejo//ES';

/** RFC 5545 §3.1: ninguna línea debería pasar de 75 octetos. */
const LIMITE_OCTETOS = 75;

/** Los tres avisos que pide la fase 1, en minutos antes de empezar. */
const RECORDATORIOS: { minutos: number; texto: string }[] = [
  { minutos: 60, texto: 'Tu clase espejo empieza en una hora' },
  { minutos: 30, texto: 'Tu clase espejo empieza en 30 minutos' },
  { minutos: 15, texto: 'Tu clase espejo empieza en 15 minutos' },
];

/** Lo mínimo que necesita el generador; encaja con `includeProyecto()` + sesiones. */
export interface ProyectoCalendario {
  id: number;
  plataforma?: string | null;
  solicitud: {
    titulo: string;
    objetivo?: string | null;
    institucionDestino: { nombre: string; pais: string };
    asignacionOrigen: {
      docenteInstitucion: {
        institucion: { nombre: string; pais: string };
        docente?: { usuario: UsuarioCalendario } | null;
      };
    };
  };
  docentes?: {
    rol?: string | null;
    asignacionDocente: {
      docenteInstitucion: {
        institucion: { nombre: string; pais: string };
        docente?: { usuario: UsuarioCalendario } | null;
      };
    };
  }[];
  sesiones?: SesionCalendario[];
}

interface UsuarioCalendario {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

export interface SesionCalendario {
  id: number;
  titulo: string;
  fechaHora: Date;
  enlaceVirtual: string | null;
  estado: string;
  actualizadoEn: Date;
}

/**
 * Escapa un texto para una propiedad `TEXT` (RFC 5545 §3.3.11): la barra
 * invertida va primero, porque si no se escaparían dos veces las que introducen
 * los demás reemplazos. Un `;` o una `,` sin escapar parten la propiedad en
 * trozos y el evento se lee mal (o el archivo entero se descarta).
 */
export function escaparTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Pliega una línea a 75 octetos (RFC 5545 §3.1): las continuaciones empiezan
 * con un espacio. Se cuenta en **octetos**, no en caracteres, y se recorren los
 * caracteres completos para no partir un acento por la mitad (que es lo que
 * deja un archivo ilegible).
 */
export function plegarLinea(linea: string): string {
  if (Buffer.byteLength(linea, 'utf8') <= LIMITE_OCTETOS) return linea;

  const partes: string[] = [];
  let actual = '';
  let octetos = 0;

  for (const caracter of linea) {
    const tamano = Buffer.byteLength(caracter, 'utf8');
    if (octetos + tamano > LIMITE_OCTETOS) {
      partes.push(actual);
      // El espacio de continuación cuenta dentro de los 75 octetos.
      actual = ' ';
      octetos = 1;
    }
    actual += caracter;
    octetos += tamano;
  }
  partes.push(actual);

  return partes.join('\r\n');
}

/** Fecha en UTC con la `Z`: `2026-10-15T21:00:00.000Z` -> `20261015T210000Z`. */
export function fechaUtc(fecha: Date | string): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return '';
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

@Injectable()
export class CalendarioIcsService {
  /**
   * Nombre de archivo legible y seguro: `clase-espejo-calidad-y-pruebas.ics`.
   * Se quitan los acentos y todo lo que no sea letra, número o guion, porque el
   * nombre viaja en una cabecera HTTP que solo admite ASCII. Si el título ya
   * empieza por «Clase espejo», no se repite en el nombre.
   */
  nombreArchivo(proyecto: ProyectoCalendario): string {
    const titulo = proyecto?.solicitud?.titulo ?? '';
    const base = titulo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/^clase-espejo-/, '')
      .slice(0, 60)
      .replace(/-+$/g, '');
    return `clase-espejo-${base || proyecto?.id || 'clase'}.ics`;
  }

  /** Devuelve el archivo completo, con fin de línea CRLF como manda el RFC. */
  generar(proyecto: ProyectoCalendario): string {
    const sesiones = proyecto.sesiones ?? [];
    const lineas: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:${PRODID}`,
      'CALSCALE:GREGORIAN',
      // PUBLISH y no REQUEST: el archivo es una copia para el calendario del
      // usuario, no una invitación con invitados a la que haya que responder.
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escaparTexto(this.tituloConEtiqueta(proyecto))}`,
    ];

    for (const sesion of sesiones) {
      lineas.push(...this.evento(proyecto, sesion));
    }

    lineas.push('END:VCALENDAR');

    return lineas.map(plegarLinea).join('\r\n') + '\r\n';
  }

  /** Un `VEVENT` por sesión, con sus tres `VALARM`. */
  private evento(
    proyecto: ProyectoCalendario,
    sesion: SesionCalendario,
  ): string[] {
    const inicio = new Date(sesion.fechaHora);
    const fin = new Date(inicio.getTime() + MINUTOS_SESION * 60 * 1000);
    // El sello y la secuencia salen del `actualizadoEn` de la sesión: así el
    // archivo es reproducible (dos descargas seguidas dan lo mismo) y la
    // secuencia sube sola cuando la sesión cambia, que es lo que hace que los
    // calendarios acepten la actualización en vez de descartarla.
    const modificado = new Date(sesion.actualizadoEn ?? inicio);
    const secuencia = Math.floor(modificado.getTime() / 1000) % 2147483647;

    const lineas: string[] = [
      'BEGIN:VEVENT',
      `UID:sesion-${sesion.id}@${DOMINIO_UID}`,
      `DTSTAMP:${fechaUtc(modificado)}`,
      `LAST-MODIFIED:${fechaUtc(modificado)}`,
      `SEQUENCE:${secuencia}`,
      `DTSTART:${fechaUtc(inicio)}`,
      `DTEND:${fechaUtc(fin)}`,
      `SUMMARY:${escaparTexto(this.resumen(proyecto, sesion))}`,
      `DESCRIPTION:${escaparTexto(this.descripcion(proyecto, sesion))}`,
    ];

    // El enlace solo se pone si la sesión lo tiene: una `LOCATION` vacía deja a
    // los calendarios mostrando un hueco sin sentido.
    const enlace = (sesion.enlaceVirtual ?? '').trim();
    if (enlace) {
      lineas.push(`LOCATION:${escaparTexto(enlace)}`);
      lineas.push(`URL:${escaparTexto(enlace)}`);
    }

    // Los tres avisos de esta fase: 60, 30 y 15 minutos antes.
    for (const recordatorio of RECORDATORIOS) {
      lineas.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escaparTexto(recordatorio.texto)}`,
        `TRIGGER:-PT${recordatorio.minutos}M`,
        'END:VALARM',
      );
    }

    lineas.push('END:VEVENT');
    return lineas;
  }

  /**
   * El título de la clase con la etiqueta «Clase espejo:» delante, salvo que el
   * título ya la lleve (hay clases que se llaman «Clase espejo: Calidad y
   * Pruebas de Software» y no queremos leerlo dos veces).
   */
  private tituloConEtiqueta(proyecto: ProyectoCalendario): string {
    const titulo = (proyecto.solicitud?.titulo ?? '').trim();
    if (!titulo) return 'Clase espejo';
    return /^clase\s+espejo\b/i.test(titulo)
      ? titulo
      : `Clase espejo: ${titulo}`;
  }

  /** `Calidad y pruebas — Sesión 2: Pruebas de caja negra`. */
  private resumen(
    proyecto: ProyectoCalendario,
    sesion: SesionCalendario,
  ): string {
    const tituloClase = this.tituloConEtiqueta(proyecto);
    const tituloSesion = (sesion.titulo ?? '').trim();
    return tituloSesion
      ? `${tituloClase} — ${tituloSesion}`
      : `${tituloClase} — Sesión ${sesion.id}`;
  }

  /** Las dos instituciones y los docentes de la clase espejo. */
  private descripcion(
    proyecto: ProyectoCalendario,
    sesion: SesionCalendario,
  ): string {
    const solicitud = proyecto.solicitud;
    const origen = solicitud?.asignacionOrigen?.docenteInstitucion?.institucion;
    const destino = solicitud?.institucionDestino;

    const instituciones = [origen, destino]
      .filter(Boolean)
      .map((i) => `${i!.nombre} (${i!.pais})`)
      .join(' · ');

    const docentes = (proyecto.docentes ?? [])
      .map((pd) => {
        const di = pd.asignacionDocente?.docenteInstitucion;
        const usuario = di?.docente?.usuario;
        if (!usuario) return '';
        return `${nombreCompleto(usuario)} — ${di.institucion.nombre} (${di.institucion.pais})`;
      })
      .filter(Boolean)
      .join(' · ');

    const partes = [
      this.tituloConEtiqueta(proyecto),
      `Sesión: ${(sesion.titulo ?? '').trim() || `Sesión ${sesion.id}`}`,
      `Instituciones: ${instituciones}`,
    ];
    if (docentes) partes.push(`Docentes: ${docentes}`);
    if (proyecto.plataforma) partes.push(`Plataforma: ${proyecto.plataforma}`);
    if (solicitud?.objetivo) partes.push(`Objetivo: ${solicitud.objetivo}`);

    // Saltos reales: `escaparTexto` los convierte en `\n`, que es como el RFC
    // representa un salto de línea dentro de una propiedad.
    return partes.join('\n');
  }
}
