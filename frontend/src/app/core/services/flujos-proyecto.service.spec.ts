import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SolicitudesService } from './solicitudes.service';
import { ProyectosService } from './proyectos.service';
import { CertificadosService } from './certificados.service';
import { VerificacionService } from './verificacion.service';

describe('Flujos de solicitud, clase y certificado', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crea una solicitud de clase espejo', () => {
    const servicio = TestBed.inject(SolicitudesService);
    servicio.crear({ titulo: 'Clase de prueba' } as never).subscribe();

    const peticion = http.expectOne('/solicitudes');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ titulo: 'Clase de prueba' });
    peticion.flush({ id: 4, titulo: 'Clase de prueba' });
  });

  it('revisa una solicitud entrante', () => {
    const servicio = TestBed.inject(SolicitudesService);
    servicio.revisar(9, { decision: 'APROBADA' } as never).subscribe();

    const peticion = http.expectOne('/solicitudes/9/revisar');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ decision: 'APROBADA' });
    peticion.flush({ id: 9, estado: 'APROBADA' });
  });

  it('consulta las solicitudes entrantes', () => {
    const servicio = TestBed.inject(SolicitudesService);
    servicio.listarEntrantes().subscribe((lista) => {
      expect(lista).toEqual([]);
    });

    const peticion = http.expectOne('/solicitudes/entrantes');
    expect(peticion.request.method).toBe('GET');
    peticion.flush([]);
  });

  it('guarda la planificación conjunta', () => {
    const servicio = TestBed.inject(ProyectosService);
    servicio.guardarPlanificacion(12, { objetivos: 'Aprender' } as never).subscribe();

    const peticion = http.expectOne('/proyectos/12/planificacion');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ objetivos: 'Aprender' });
    peticion.flush({ objetivos: 'Aprender' });
  });

  it('sube una evidencia como FormData', () => {
    const servicio = TestBed.inject(ProyectosService);
    const archivo = new File(['%PDF-1.4'], 'evidencia.pdf', {
      type: 'application/pdf',
    });
    servicio.crearEvidencia(12, archivo, 'Reporte', 3, 'https://youtu.be/abc').subscribe();

    const peticion = http.expectOne('/proyectos/12/evidencias');
    expect(peticion.request.method).toBe('POST');
    const cuerpo = peticion.request.body as FormData;
    expect(cuerpo).toBeInstanceOf(FormData);
    expect(cuerpo.get('tipo')).toBe('Reporte');
    expect(cuerpo.get('sesionId')).toBe('3');
    expect(cuerpo.get('enlaceUrl')).toBe('https://youtu.be/abc');
    expect((cuerpo.get('archivo') as File).name).toBe('evidencia.pdf');
    peticion.flush({ id: 1, tipo: 'Reporte' });
  });

  it('cierra la clase espejo', () => {
    const servicio = TestBed.inject(ProyectosService);
    servicio.cerrarProyecto(12).subscribe();

    const peticion = http.expectOne('/proyectos/12/cerrar');
    expect(peticion.request.method).toBe('POST');
    peticion.flush({ id: 12, estado: 'FINALIZADO' });
  });

  it('consulta el estado y emite un certificado', () => {
    const servicio = TestBed.inject(CertificadosService);
    servicio.estado(12).subscribe();
    http.expectOne('/proyectos/12/certificados').flush({ puedeEmitir: true });

    servicio.emitir(12, { alumnoId: 8 }).subscribe();
    const peticion = http.expectOne('/proyectos/12/certificados/emitir');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ alumnoId: 8 });
    peticion.flush({ emitidos: 1 });
  });

  it('consulta la verificación pública de un certificado', () => {
    const servicio = TestBed.inject(VerificacionService);
    servicio.consultar('CACE-2026-0013', 'ABC123').subscribe((res) => {
      expect(res.estado).toBe('VALIDO');
    });

    const peticion = http.expectOne(
      (req) => req.url === '/verificar/CACE-2026-0013' && req.params.get('c') === 'ABC123',
    );
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ estado: 'VALIDO' });
  });
});
