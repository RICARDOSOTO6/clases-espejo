import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },
  {
    path: 'activate',
    loadComponent: () =>
      import('./features/auth/activate/activate.component').then(
        (m) => m.ActivateComponent,
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
      import('./features/verificacion/verificacion.component').then(
        (m) => m.VerificacionComponent,
      ),
  },
  {
    path: 'agente',
    loadComponent: () =>
      import('./features/agente/agente.component').then(
        (m) => m.AgenteComponent,
      ),
    canActivate: [authGuard, roleGuard('AGENTE')],
  },
  {
    path: 'docente',
    loadComponent: () =>
      import('./features/docente/docente.component').then(
        (m) => m.DocenteComponent,
      ),
    canActivate: [authGuard, roleGuard('DOCENTE')],
  },
  {
    // La presidencia de la CACE tiene su propia pantalla, sin el esqueleto de
    // agentes y docentes. Solo pide estar autenticado: su primer paso es
    // cambiar la contraseña provisional.
    path: 'cace',
    loadComponent: () =>
      import('./features/cace/cace.component').then((m) => m.CaceComponent),
    canActivate: [authGuard],
  },
  {
    path: 'cace/personalizacion',
    loadComponent: () =>
      import('./features/cace/cace.component').then((m) => m.CaceComponent),
    canActivate: [authGuard],
  },
  {
    path: 'cace/certificado',
    loadComponent: () =>
      import('./features/cace/cace.component').then((m) => m.CaceComponent),
    canActivate: [authGuard],
  },
  {
    path: 'proyectos/:id',
    loadComponent: () =>
      import('./features/proyecto/proyecto.component').then(
        (m) => m.ProyectoComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
