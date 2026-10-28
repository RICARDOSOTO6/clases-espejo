import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';
import { InstitucionesService } from '../../../core/services/instituciones.service';

describe('RegisterComponent', () => {
  it('envía el alta de una institución nueva con los datos del formulario', () => {
    let enviado: Record<string, unknown> | null = null;
    const auth = {
      register: (dto: Record<string, unknown>) => {
        enviado = dto;
        return of({
          mensaje: 'Solicitud registrada',
          usuario: { id: 1 },
        });
      },
    };
    const instituciones = { directorio: () => of([]) };

    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: InstitucionesService, useValue: instituciones },
      ],
    });

    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RegisterComponent);
    const componente = fixture.componentInstance;

    componente.crearInstitucionNueva();
    componente.form.setValue({
      nombres: 'Ana',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'López',
      tipoDocumento: 'DNI',
      dni: '12345678',
      correo: 'ana@prueba.mx',
      password: 'ClaveSegura123',
      aceptaAviso: true,
      nombreInstitucion: 'Instituto de Prueba',
      paisCodigo: 'MX',
      estado: 'Campeche',
      ciudad: 'Campeche',
      telefono: '9811234567',
      correoInstitucional: 'contacto@prueba.mx',
      cargo: 'Coordinador de Internacionalización',
    });

    componente.submit();

    expect(enviado).toMatchObject({
      nombres: 'Ana',
      correo: 'ana@prueba.mx',
      nombreInstitucion: 'Instituto de Prueba',
      pais: 'México',
      codigoPais: 'MX',
      aceptaAviso: true,
    });
    expect(navegar).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({ queryParams: expect.objectContaining({ registrado: '1' }) }),
    );
  });
});
