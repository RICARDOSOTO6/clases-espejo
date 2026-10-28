import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RecuperarComponent } from './recuperar/recuperar.component';
import { RestablecerComponent } from './restablecer/restablecer.component';
import { ConfirmarCorreoComponent } from './confirmar-correo/confirmar-correo.component';
import { AuthService } from '../../core/services/auth.service';
import { IdentidadCaceService } from '../../core/services/identidad-cace.service';

const IDENTIDAD = {
  logo: signal('logo.png'),
  lema: signal('lema'),
  descripcion: signal('descripcion'),
};

function configurar(
  componente: unknown,
  auth: Record<string, unknown>,
  token: string | null = null,
): void {
  TestBed.configureTestingModule({
    imports: [componente as never],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: IdentidadCaceService, useValue: IDENTIDAD },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(token === null ? {} : { token }),
          },
        },
      },
    ],
  });
}

describe('Flujos de recuperación y confirmación', () => {
  it('recuperar no envía el formulario si el correo es inválido', () => {
    let llamadas = 0;
    configurar(RecuperarComponent, {
      recuperarPassword: () => {
        llamadas += 1;
        return of({ mensaje: 'ok' });
      },
    });

    const fixture = TestBed.createComponent(RecuperarComponent);
    fixture.componentInstance.form.setValue({ correo: 'no-es-correo' });
    fixture.componentInstance.submit();

    expect(llamadas).toBe(0);
    expect(fixture.componentInstance.form.controls.correo.touched).toBe(true);
  });

  it('recuperar muestra el mensaje del servidor', () => {
    let correoEnviado = '';
    configurar(RecuperarComponent, {
      recuperarPassword: (correo: string) => {
        correoEnviado = correo;
        return of({ mensaje: 'Si existe, enviamos un enlace.' });
      },
    });

    const fixture = TestBed.createComponent(RecuperarComponent);
    fixture.componentInstance.form.setValue({ correo: 'docente@prueba.mx' });
    fixture.componentInstance.submit();

    expect(correoEnviado).toBe('docente@prueba.mx');
    expect(fixture.componentInstance.enviado()).toBe(true);
    expect(fixture.componentInstance.mensaje()).toContain('enviamos');
  });

  it('restablecer rechaza un enlace sin token', () => {
    configurar(RestablecerComponent, {});

    const fixture = TestBed.createComponent(RestablecerComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.estado()).toBe('invalido');
    expect(fixture.componentInstance.error()).toContain('Falta el código');
  });

  it('restablecer valida el token y envía la contraseña nueva', () => {
    let recibido: [string, string] | null = null;
    configurar(
      RestablecerComponent,
      {
        validarRecuperacion: () => of({ valido: true, correo: 'ana@prueba.mx' }),
        restablecerPassword: (token: string, password: string) => {
          recibido = [token, password];
          return of({ mensaje: 'Contraseña actualizada.' });
        },
      },
      'token-1',
    );

    const fixture = TestBed.createComponent(RestablecerComponent);
    fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.estado()).toBe('listo');
    expect(fixture.componentInstance.correo()).toBe('ana@prueba.mx');

    fixture.componentInstance.form.setValue({
      password: 'ClaveNueva1234',
      confirmar: 'ClaveNueva1234',
    });
    fixture.componentInstance.submit();

    expect(recibido).toEqual(['token-1', 'ClaveNueva1234']);
    expect(fixture.componentInstance.estado()).toBe('hecho');
  });

  it('confirmar correo rechaza un enlace sin token', () => {
    configurar(ConfirmarCorreoComponent, {});

    const fixture = TestBed.createComponent(ConfirmarCorreoComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.estado()).toBe('error');
    expect(fixture.componentInstance.error()).toContain('Falta el código');
  });

  it('confirmar correo muestra el resultado del servidor', () => {
    configurar(
      ConfirmarCorreoComponent,
      {
        confirmarCorreo: () =>
          of({
            mensaje: 'Correo confirmado.',
            tipo: 'CAMBIO',
            correo: 'nuevo@prueba.mx',
          }),
      },
      'token-2',
    );

    const fixture = TestBed.createComponent(ConfirmarCorreoComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.estado()).toBe('hecho');
    expect(fixture.componentInstance.correo()).toBe('nuevo@prueba.mx');
    expect(fixture.componentInstance.esCambio()).toBe(true);
  });
});
