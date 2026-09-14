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
