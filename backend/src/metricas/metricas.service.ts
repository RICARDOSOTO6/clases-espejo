import { Injectable } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { loadavg, cpus } from 'node:os';

const MAX_MUESTRAS_GLOBALES = 20_000;
const MAX_MUESTRAS_RUTA = 2_000;
const MAX_RUTAS = 100;
const MAX_ULTIMOS_ERRORES = 20;

export interface RegistroPeticion {
  metodo: string;
  ruta: string;
  estado: number;
  duracionMs: number;
  requestId?: string;
}

interface MuestraRuta {
  peticiones: number;
  errores4xx: number;
  errores5xx: number;
  duracionTotalMs: number;
  duracionMaxMs: number;
  duraciones: number[];
}

export interface ErrorReciente {
  fecha: string;
  metodo: string;
  ruta: string;
  estado: number;
  duracionMs: number;
  requestId: string;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function nanosegundosAMs(valor: number): number {
  return Number.isFinite(valor) ? redondear(valor / 1_000_000) : 0;
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(
    ordenados.length - 1,
    Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1),
  );
  return redondear(ordenados[indice]);
}

@Injectable()
export class MetricasService {
  private readonly iniciadoEn = new Date();
  private readonly histogramaBucle = monitorEventLoopDelay({ resolution: 20 });
  private readonly archivo = process.env.METRICAS_ARCHIVO?.trim() ?? '';
  private readonly muestrasGlobales: number[] = [];
  private readonly rutas = new Map<string, MuestraRuta>();
  private readonly ultimosErrores: ErrorReciente[] = [];
  private total = 0;
  private exitosas = 0;
  private errores4xx = 0;
  private errores5xx = 0;
  private colaArchivo: string[] = [];
  private escribiendoArchivo = false;

  constructor() {
    this.histogramaBucle.enable();
  }

  registrar(datos: RegistroPeticion): void {
    const duracion = Math.max(0, datos.duracionMs);
    this.total += 1;
    if (datos.estado >= 500) this.errores5xx += 1;
    else if (datos.estado >= 400) this.errores4xx += 1;
    else this.exitosas += 1;

    this.muestrasGlobales.push(duracion);
    if (this.muestrasGlobales.length > MAX_MUESTRAS_GLOBALES) {
      this.muestrasGlobales.shift();
    }

    const clave = `${datos.metodo} ${datos.ruta}`;
    const muestra = this.rutas.get(clave) ?? {
      peticiones: 0,
      errores4xx: 0,
      errores5xx: 0,
      duracionTotalMs: 0,
      duracionMaxMs: 0,
      duraciones: [],
    };
    muestra.peticiones += 1;
    if (datos.estado >= 500) muestra.errores5xx += 1;
    else if (datos.estado >= 400) muestra.errores4xx += 1;
    muestra.duracionTotalMs += duracion;
    muestra.duracionMaxMs = Math.max(muestra.duracionMaxMs, duracion);
    muestra.duraciones.push(duracion);
    if (muestra.duraciones.length > MAX_MUESTRAS_RUTA) {
      muestra.duraciones.shift();
    }
    this.rutas.set(clave, muestra);

    if (datos.estado >= 500) {
      this.ultimosErrores.unshift({
        fecha: new Date().toISOString(),
        metodo: datos.metodo,
        ruta: datos.ruta,
        estado: datos.estado,
        duracionMs: redondear(duracion),
        requestId: datos.requestId ?? '',
      });
      if (this.ultimosErrores.length > MAX_ULTIMOS_ERRORES) {
        this.ultimosErrores.pop();
      }
    }

    if (this.archivo) {
      this.encolarArchivo({
        fecha: new Date().toISOString(),
        metodo: datos.metodo,
        ruta: datos.ruta,
        estado: datos.estado,
        duracionMs: redondear(duracion),
        requestId: datos.requestId ?? '',
      });
    }
  }

  snapshot() {
    const memoria = process.memoryUsage();
    const rutas = [...this.rutas.entries()]
      .map(([clave, muestra]) => ({
        clave,
        peticiones: muestra.peticiones,
        errores4xx: muestra.errores4xx,
        errores5xx: muestra.errores5xx,
        promedioMs: redondear(muestra.duracionTotalMs / muestra.peticiones),
        p50Ms: percentil(muestra.duraciones, 50),
        p95Ms: percentil(muestra.duraciones, 95),
        p99Ms: percentil(muestra.duraciones, 99),
        maxMs: redondear(muestra.duracionMaxMs),
      }))
      .sort((a, b) => b.peticiones - a.peticiones)
      .slice(0, MAX_RUTAS);

    return {
      generadoEn: new Date().toISOString(),
      desde: this.iniciadoEn.toISOString(),
      uptimeSegundos: Math.round(process.uptime()),
      proceso: {
        node: process.version,
        plataforma: process.platform,
        rssMb: redondear(memoria.rss / 1024 / 1024),
        heapUsadoMb: redondear(memoria.heapUsed / 1024 / 1024),
        heapTotalMb: redondear(memoria.heapTotal / 1024 / 1024),
        loadAvg1m: redondear(loadavg()[0]),
        nucleos: cpus().length,
        eventLoopDelayMedioMs: nanosegundosAMs(this.histogramaBucle.mean),
        eventLoopDelayMaxMs: nanosegundosAMs(this.histogramaBucle.max),
      },
      peticiones: {
        total: this.total,
        exitosas: this.exitosas,
        errores4xx: this.errores4xx,
        errores5xx: this.errores5xx,
        tasaErrorPct:
          this.total === 0
            ? 0
            : redondear(
                ((this.errores4xx + this.errores5xx) / this.total) * 100,
              ),
      },
      latenciaMs: {
        muestras: this.muestrasGlobales.length,
        promedio: redondear(
          this.muestrasGlobales.length === 0
            ? 0
            : this.muestrasGlobales.reduce((a, b) => a + b, 0) /
                this.muestrasGlobales.length,
        ),
        p50: percentil(this.muestrasGlobales, 50),
        p90: percentil(this.muestrasGlobales, 90),
        p95: percentil(this.muestrasGlobales, 95),
        p99: percentil(this.muestrasGlobales, 99),
        max: redondear(Math.max(0, ...this.muestrasGlobales)),
      },
      rutas,
      ultimosErrores: [...this.ultimosErrores],
    };
  }

  csv(): string {
    const rutas = this.snapshot().rutas;
    const escapar = (valor: string | number): string =>
      `"${String(valor).replace(/"/g, '""')}"`;
    const filas = [
      [
        'metodo',
        'ruta',
        'peticiones',
        'errores4xx',
        'errores5xx',
        'promedioMs',
        'p50Ms',
        'p95Ms',
        'p99Ms',
        'maxMs',
      ],
      ...rutas.map((ruta) => {
        const [metodo, ...resto] = ruta.clave.split(' ');
        return [
          metodo,
          resto.join(' '),
          ruta.peticiones,
          ruta.errores4xx,
          ruta.errores5xx,
          ruta.promedioMs,
          ruta.p50Ms,
          ruta.p95Ms,
          ruta.p99Ms,
          ruta.maxMs,
        ];
      }),
    ];
    return `\uFEFF${filas.map((fila) => fila.map(escapar).join(',')).join('\r\n')}\r\n`;
  }

  private encolarArchivo(datos: object): void {
    this.colaArchivo.push(`${JSON.stringify(datos)}\n`);
    if (this.colaArchivo.length > 1_000) this.colaArchivo.shift();
    if (!this.escribiendoArchivo) void this.vaciarArchivo();
  }

  private async vaciarArchivo(): Promise<void> {
    if (!this.archivo) return;
    this.escribiendoArchivo = true;
    try {
      await mkdir(dirname(this.archivo), { recursive: true });
      while (this.colaArchivo.length > 0) {
        const lote = this.colaArchivo.splice(0, 100).join('');
        await appendFile(this.archivo, lote, 'utf8');
      }
    } catch {
      // La observabilidad no debe tumbar la aplicación si el disco falla.
    } finally {
      this.escribiendoArchivo = false;
      if (this.colaArchivo.length > 0) void this.vaciarArchivo();
    }
  }
}
