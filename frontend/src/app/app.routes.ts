import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { panelDeRol } from './core/guards/panel.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Rutas de la aplicación.
 *
 * **Las URLs del panel no dicen qué rol eres.** Agente, docente y CACE entran
 * todos por `/panel`, y el router elige la pantalla con `panelDeRol` (tres rutas
 * con el mismo path: gana la primera cuyo rol coincide). Las secciones que solo
 * tiene la CACE cuelgan de `/panel/...`; el resto de roles, si las abre, vuelve
 * a su panel sin ver el login.
 *
 * Las rutas viejas (`/agente`, `/docente`, `/cace`…) se quedan como redirección
 * para que un marcador guardado siga funcionando, pero la aplicación ya no
 * enlaza a ellas.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'aceptar-aviso',
    loadComponent: () =>
      import('./features/auth/aceptar-aviso/aceptar-aviso.component').then(
        (m) => m.AceptarAvisoComponent,
      ),
  },
  {
    // Página pública: la lee quien todavía no tiene cuenta y la enlazan el
    // registro, la activación y el acceso.
    path: 'privacidad',
    loadComponent: () =>
      import('./features/privacidad/privacidad.component').then((m) => m.PrivacidadComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    // Nombre nuevo de la misma pantalla: el auto-registro se presenta como
    // solicitud de alta, no como una vía principal de acceso.
    path: 'solicitud',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'activate',
    loadComponent: () =>
      import('./features/auth/activate/activate.component').then((m) => m.ActivateComponent),
  },
  {
    path: 'activar-secretaria',
    loadComponent: () =>
      import('./features/auth/activar-secretaria/activar-secretaria.component').then(
        (m) => m.ActivarSecretariaComponent,
      ),
  },
  {
    path: 'activar-agente',
    loadComponent: () =>
      import('./features/auth/activar-agente/activar-agente.component').then(
        (m) => m.ActivarAgenteComponent,
      ),
  },
  {
    // Recuperación de contraseña (Fase 1): pedir el enlace y usarlo. Son
    // pantallas públicas: quien las usa no tiene sesión.
    path: 'recuperar',
    loadComponent: () =>
      import('./features/auth/recuperar/recuperar.component').then((m) => m.RecuperarComponent),
  },
  {
    path: 'restablecer',
    loadComponent: () =>
      import('./features/auth/restablecer/restablecer.component').then(
        (m) => m.RestablecerComponent,
      ),
  },
  {
    // Enlace de confirmación de correo (registro y cambio de dirección).
    path: 'confirmar-correo',
    loadComponent: () =>
      import('./features/auth/confirmar-correo/confirmar-correo.component').then(
        (m) => m.ConfirmarCorreoComponent,
      ),
  },
  {
    // Verificación pública de un certificado: es lo que abre el QR impreso.
    // Va **sin guardia y fuera del esqueleto con menú** a propósito: la abre
    // cualquiera que tenga el certificado en la mano (un alumno, un empleador),
    // sin cuenta y sin sesión. La protección no es la sesión, sino el código
    // que va dentro del QR.
    path: 'verificar/:folio',
    loadComponent: () =>
      import('./features/verificacion/verificacion.component').then((m) => m.VerificacionComponent),
  },

  // --- Secciones de la CACE (páginas propias dentro del mismo panel) ---
  {
    path: 'panel/personalizacion',
    loadComponent: () => import('./features/cace/cace.component').then((m) => m.CaceComponent),
    canActivate: [authGuard, roleGuard('PRESIDENTE_CACE', 'SECRETARIA_CACE')],
  },
  {
    path: 'panel/certificado',
    loadComponent: () => import('./features/cace/cace.component').then((m) => m.CaceComponent),
    canActivate: [authGuard, roleGuard('PRESIDENTE_CACE', 'SECRETARIA_CACE')],
  },

  // --- Panel único: la URL no revela el rol ---
  {
    path: 'panel',
    pathMatch: 'full',
    canMatch: [panelDeRol('AGENTE')],
    loadComponent: () =>
      import('./features/agente/agente.component').then((m) => m.AgenteComponent),
  },
  {
    path: 'panel',
    pathMatch: 'full',
    canMatch: [panelDeRol('SECRETARIA_INSTITUCION')],
    loadComponent: () =>
      import('./features/secretaria-institucion/secretaria-institucion.component').then(
        (m) => m.SecretariaInstitucionComponent,
      ),
  },
  {
    path: 'panel',
    pathMatch: 'full',
    canMatch: [panelDeRol('DOCENTE')],
    loadComponent: () =>
      import('./features/docente/docente.component').then((m) => m.DocenteComponent),
  },
  {
    path: 'panel',
    pathMatch: 'full',
    canMatch: [panelDeRol('PRESIDENTE_CACE', 'SECRETARIA_CACE')],
    loadComponent: () => import('./features/cace/cace.component').then((m) => m.CaceComponent),
  },

  // --- Compatibilidad con enlaces guardados de antes ---
  { path: 'agente', redirectTo: 'panel', pathMatch: 'full' },
  { path: 'secretaria', redirectTo: 'panel', pathMatch: 'full' },
  { path: 'docente', redirectTo: 'panel', pathMatch: 'full' },
  { path: 'cace', redirectTo: 'panel', pathMatch: 'full' },
  {
    path: 'cace/personalizacion',
    redirectTo: 'panel/personalizacion',
    pathMatch: 'full',
  },
  {
    path: 'cace/certificado',
    redirectTo: 'panel/certificado',
    pathMatch: 'full',
  },

  {
    path: 'proyectos/:id',
    loadComponent: () =>
      import('./features/proyecto/proyecto.component').then((m) => m.ProyectoComponent),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
