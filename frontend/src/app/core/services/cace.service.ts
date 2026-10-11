import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CacePublico,
  ConfiguracionCace,
  ConfiguracionCaceDto,
  PaisComunidad,
  PaisComunidadDto,
  Premio,
  PremioDto,
  PremiosCace,
} from '../models/cace-identidad.models';

const API_URL = window.location.port === '4200' ? `http://${window.location.hostname}:3000` : '';

/** Agente de la institución: es a quien se le avisa de la decisión. */
export interface AgenteContacto {
  nombre: string;
  correo: string;
  cargo: string;
}

/** Fila del panel de instituciones de la presidencia. */
export interface InstitucionCace {
  id: number;
  nombre: string;
  pais: string;
  /** Logo de la institución (`/logos/…`), si lo tiene. */
  logoUrl: string | null;
  /** PENDIENTE, APROBADA, RECHAZADA o VETADA. */
  estadoCace: string;
  /** Motivo del rechazo o del veto (vacío si no lo hay). */
  motivoCace: string;
  revisadaEn: string | null;
  revisadaPor: string | null;
  agentes: AgenteContacto[];
  /**
   * Institución ya aprobada que se llama casi igual en el mismo país. Es solo un
   * aviso para que el presidente mire antes de decidir.
   */
  posibleDuplicadoDe: { id: number; nombre: string; pais: string } | null;
}

/** Resultado de aprobar, rechazar, vetar o reactivar. */
export interface DecisionCace {
  mensaje: string;
  id: number;
  nombre: string;
  estadoCace: string;
  motivoCace: string;
  revisadaEn: string | null;
  revisadaPor: string | null;
}

/**
 * Instituciones vistas desde la presidencia de la CACE. Va aparte de
 * `InstitucionesService`, que es el catálogo de agentes y docentes.
 *
 * Incluye también la identidad de la CACE (fase 3): los textos, el logo, el
 * tema, las banderas de la comunidad y los premios. Van en el mismo servicio
 * porque son el mismo panel y las mismas dos capacidades
 * (`personalizarCace` y `publicarPremios`).
 */
@Injectable({ providedIn: 'root' })
export class CaceService {
  private readonly http = inject(HttpClient);

  // --- Lectura pública (sin token) ---

  /**
   * Textos, logo, tema y banderas activas. La usa la portada del acceso, que
   * tiene que verse antes de que nadie inicie sesión.
   */
  obtenerPublico(): Observable<CacePublico> {
    return this.http.get<CacePublico>(`${API_URL}/cace/publico`);
  }

  /** Premios publicados, para la sección «Comunidad». */
  premiosPublicos(): Observable<Premio[]> {
    return this.http.get<Premio[]>(`${API_URL}/cace/premios-publicos`);
  }

  // --- Configuración: textos, tema y logo ---

  obtenerConfiguracion(): Observable<ConfiguracionCace> {
    return this.http.get<ConfiguracionCace>(`${API_URL}/cace/configuracion`);
  }

  actualizarConfiguracion(
    dto: ConfiguracionCaceDto,
  ): Observable<ConfiguracionCace> {
    return this.http.patch<ConfiguracionCace>(
      `${API_URL}/cace/configuracion`,
      dto,
    );
  }

  /** Sube el logo de la CACE (PNG, JPG o WEBP, hasta 2 MB). */
  subirLogo(archivo: File): Observable<ConfiguracionCace> {
    const datos = new FormData();
    datos.append('logo', archivo);
    return this.http.post<ConfiguracionCace>(
      `${API_URL}/cace/configuracion/logo`,
      datos,
    );
  }

  /** Quita el logo: la aplicación vuelve al logo de respaldo. */
  quitarLogo(): Observable<{ mensaje: string; logoUrl: null }> {
    return this.http.delete<{ mensaje: string; logoUrl: null }>(
      `${API_URL}/cace/configuracion/logo`,
    );
  }

  // --- Banderas de la comunidad ---

  /** Todos los países (incluidos los desactivados): es la lista del panel. */
  listarPaises(): Observable<PaisComunidad[]> {
    return this.http.get<PaisComunidad[]>(`${API_URL}/cace/paises`);
  }

  crearPais(dto: PaisComunidadDto): Observable<PaisComunidad> {
    return this.http.post<PaisComunidad>(`${API_URL}/cace/paises`, dto);
  }

  actualizarPais(
    id: number,
    dto: PaisComunidadDto,
  ): Observable<PaisComunidad> {
    return this.http.patch<PaisComunidad>(`${API_URL}/cace/paises/${id}`, dto);
  }

  eliminarPais(id: number): Observable<{ mensaje: string; id: number }> {
    return this.http.delete<{ mensaje: string; id: number }>(
      `${API_URL}/cace/paises/${id}`,
    );
  }

  // --- Premios y reconocimientos ---

  /** Todos los premios (publicados y no) y las instituciones del formulario. */
  listarPremios(): Observable<PremiosCace> {
    return this.http.get<PremiosCace>(`${API_URL}/cace/premios`);
  }

  crearPremio(dto: PremioDto): Observable<Premio> {
    return this.http.post<Premio>(`${API_URL}/cace/premios`, dto);
  }

  actualizarPremio(id: number, dto: PremioDto): Observable<Premio> {
    return this.http.patch<Premio>(`${API_URL}/cace/premios/${id}`, dto);
  }

  eliminarPremio(id: number): Observable<{ mensaje: string; id: number }> {
    return this.http.delete<{ mensaje: string; id: number }>(
      `${API_URL}/cace/premios/${id}`,
    );
  }

  /** Imagen del premio. Solo se puede subir cuando el premio ya está creado. */
  subirImagenPremio(id: number, archivo: File): Observable<Premio> {
    const datos = new FormData();
    datos.append('imagen', archivo);
    return this.http.post<Premio>(
      `${API_URL}/cace/premios/${id}/imagen`,
      datos,
    );
  }

  quitarImagenPremio(id: number): Observable<Premio> {
    return this.http.delete<Premio>(`${API_URL}/cace/premios/${id}/imagen`);
  }

  /** Todas las instituciones, con las pendientes primero. */
  listarInstituciones(): Observable<InstitucionCace[]> {
    return this.http.get<InstitucionCace[]>(`${API_URL}/cace/instituciones`);
  }

  aprobar(id: number): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/aprobar`, {});
  }

  rechazar(id: number, motivo: string): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/rechazar`, { motivo });
  }

  vetar(id: number, motivo: string): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/vetar`, { motivo });
  }

  reactivar(id: number): Observable<DecisionCace> {
    return this.http.post<DecisionCace>(`${API_URL}/cace/instituciones/${id}/reactivar`, {});
  }

  /**
   * Borrado definitivo de una institución rechazada. Falla con un mensaje claro
   * si todavía tiene historia (solicitudes, clases espejo, listas de alumnos…).
   */
  eliminarInstitucion(
    id: number,
  ): Observable<{ mensaje: string; id: number; nombre: string }> {
    return this.http.delete<{ mensaje: string; id: number; nombre: string }>(
      `${API_URL}/cace/instituciones/${id}`,
    );
  }
}
