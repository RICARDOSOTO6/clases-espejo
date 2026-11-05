/**
 * Accesibilidad automática de las pantallas principales.
 *
 * Monta cada pantalla con sus servicios simulados, deja que Angular pinte el
 * DOM y pasa **axe-core** sobre él. La prueba falla si aparece una violación de
 * impacto «grave» o «crítico» (`serious`/`critical`): son las que dejan la
 * pantalla inutilizable para quien usa lector de pantalla o teclado.
 *
 * Qué no comprueba: el contraste de color necesita medidas reales de maquetación
 * y el entorno de pruebas (`jsdom`) no las calcula; esa regla se desactiva aquí
 * a propósito. Los temas de la CACE tienen su contraste medido aparte.
 *
 * Las pantallas cubiertas son el acceso, el alta de institución, la verificación
 * pública del certificado (lo que abre el QR) y el armazón con el menú. Las del
 * panel de la CACE y del proyecto no están todavía: montarlas exige simular
 * media aplicación y eso se hará cuando haya pruebas de comportamiento de esas
 * pantallas.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Type, signal } from '@angular/core';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import * as axe from 'axe-core';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { VerificacionComponent } from './features/verificacion/verificacion.component';
import { LayoutComponent } from './shared/components/layout/layout.component';
import { AuthService } from './core/services/auth.service';
import { InstitucionesService } from './core/services/instituciones.service';
import { IdentidadCaceService } from './core/services/identidad-cace.service';
import { VerificacionService } from './core/services/verificacion.service';
import type { VerificacionCertificado } from './core/models/certificado.models';

const VERIFICACION: VerificacionCertificado = {
  estado: 'VALIDO',
  mensaje: 'El certificado es válido.',
  modoDemo: true,
  certificado: {
    folio: 'CACE-2026-0001-7K4M9Q2X',
    alumno: 'Ana Pérez López',
    titulo: 'Clase espejo de prueba',
    instituciones: [
      {
        nombre: 'Institución A',
        pais: 'México',
        codigoPais: 'MX',
        logoUrl: null,
      },
      {
        nombre: 'Institución B',
        pais: 'Colombia',
        codigoPais: 'CO',
        logoUrl: null,
      },
    ],
    institucionOrigen: 'Institución A',
    institucionDestino: 'Institución B',
    fechaInicio: '2026-10-20',
    fechaFin: '2026-11-03',
    emitidoEn: '2026-11-04T12:00:00.000Z',
    estado: 'EMITIDO',
    anuladoMotivo: '',
  },
};

/** Servicios simulados que la pantalla solo necesita para pintarse. */
function identidadSimulada() {
  return {
    logo: signal('logo.png'),
    lema: signal('Lema de la CACE'),
    descripcion: signal('Descripción de la comunidad'),
    cargar: () => of({}),
  };
}

function authSimulado() {
  return {
    login: () => of({}),
    verificarTotp: () => of({}),
    currentUser: () => null,
    isAuthenticated: false,
    reenviarConfirmacion: () => of({ mensaje: 'ok' }),
    register: () => of({ mensaje: 'ok', usuario: { id: 1 } }),
    getPerfil: () => of(null),
  };
}

/**
 * Pasa axe sobre el DOM ya pintado y devuelve solo las violaciones graves, en
 * texto, para que el mensaje del fallo diga qué regla y qué elemento.
 */
async function violacionesGraves(raiz: HTMLElement): Promise<string[]> {
  const resultado = await axe.run(raiz, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return resultado.violations
    .filter(
      (violacion) =>
        violacion.impact === 'critical' || violacion.impact === 'serious',
    )
    .map(
      (violacion) =>
        `${violacion.id} (${violacion.impact}): ${violacion.nodes
          .map((nodo) => nodo.target.join(' '))
          .join(', ')}`,
    );
}

async function revisar(componente: Type<unknown>): Promise<void> {
  const fixture: ComponentFixture<unknown> = TestBed.createComponent(componente);
  fixture.detectChanges();
  const graves = await violacionesGraves(fixture.nativeElement as HTMLElement);
  expect(graves).toEqual([]);
}

describe('Accesibilidad de las pantallas principales', () => {
  it('el acceso no tiene violaciones graves', async () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSimulado() },
        { provide: IdentidadCaceService, useValue: identidadSimulada() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
              paramMap: convertToParamMap({}),
            },
          },
        },
      ],
    });

    await revisar(LoginComponent);
  });

  it('el alta de institución no tiene violaciones graves', async () => {
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSimulado() },
        {
          provide: InstitucionesService,
          useValue: { directorio: () => of([]) },
        },
      ],
    });

    await revisar(RegisterComponent);
  });

  it('la verificación pública de un certificado no tiene violaciones graves', async () => {
    TestBed.configureTestingModule({
      imports: [VerificacionComponent],
      providers: [
        provideRouter([]),
        { provide: IdentidadCaceService, useValue: identidadSimulada() },
        {
          provide: VerificacionService,
          useValue: { consultar: () => of(VERIFICACION) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ folio: VERIFICACION.certificado?.folio ?? '' }),
              queryParamMap: convertToParamMap({ c: 'ABCDEFGH' }),
            },
          },
        },
      ],
    });

    await revisar(VerificacionComponent);
  });

  it('el armazón con el menú no tiene violaciones graves', async () => {
    TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSimulado() },
        { provide: IdentidadCaceService, useValue: identidadSimulada() },
      ],
    });

    await revisar(LayoutComponent);
  });

  it('el detector encuentra una violación conocida (control)', async () => {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = '<img src="logo.png"><button></button>';
    document.body.appendChild(contenedor);
    try {
      const graves = await violacionesGraves(contenedor);
      expect(graves.map((texto) => texto.split(' ')[0])).toContain(
        'image-alt',
      );
    } finally {
      contenedor.remove();
    }
  });
});
