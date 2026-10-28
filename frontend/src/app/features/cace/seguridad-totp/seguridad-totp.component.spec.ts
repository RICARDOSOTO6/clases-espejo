import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SeguridadTotpComponent } from './seguridad-totp.component';
import { AuthService } from '../../../core/services/auth.service';

describe('SeguridadTotpComponent', () => {
  function crear(habilitado = false) {
    const auth = {
      estadoTotp: () => of({ habilitado, confirmadoEn: null, codigosRestantes: 8 }),
      iniciarTotp: () =>
        of({
          secreto: 'SECRETO123',
          uri: 'otpauth://totp/Clases',
          qrDataUrl: 'data:image/png;base64,abc',
          mensaje: 'Escanea',
        }),
      confirmarTotp: () =>
        of({
          habilitado: true,
          codigosRecuperacion: ['AAAA-BBBB', 'CCCC-DDDD'],
          mensaje: 'Activado',
        }),
      desactivarTotp: () => of({ habilitado: false, mensaje: 'Desactivado' }),
    };

    TestBed.configureTestingModule({
      imports: [SeguridadTotpComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    });
    return TestBed.createComponent(SeguridadTotpComponent);
  }

  it('muestra el estado desactivado', () => {
    const fixture = crear(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.estado()?.habilitado).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Segundo factor desactivado');
  });

  it('muestra el QR y el secreto al iniciar la configuración', () => {
    const fixture = crear(false);
    fixture.detectChanges();
    fixture.componentInstance.iniciar();
    fixture.detectChanges();
    expect(fixture.componentInstance.inicio()?.secreto).toBe('SECRETO123');
    expect(fixture.nativeElement.querySelector('img')).toBeTruthy();
  });

  it('muestra los códigos de recuperación una sola vez', () => {
    const fixture = crear(false);
    fixture.detectChanges();
    fixture.componentInstance.iniciar();
    fixture.componentInstance.codigoForm.setValue({ codigo: '123456' });
    fixture.componentInstance.confirmar();
    fixture.detectChanges();
    expect(fixture.componentInstance.codigos()).toEqual(['AAAA-BBBB', 'CCCC-DDDD']);
    expect(fixture.nativeElement.textContent).toContain('AAAA-BBBB');
  });
});
