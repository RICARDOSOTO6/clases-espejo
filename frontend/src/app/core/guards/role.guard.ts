import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Rol } from '../models/auth.models';

export const roleGuard = (role: Exclude<Rol, null>): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.currentUser();

    if (auth.isAuthenticated && user?.rol === role) {
      return true;
    }

    if (user?.rol === 'AGENTE') {
      return router.createUrlTree(['/agente']);
    }
    if (user?.rol === 'DOCENTE') {
      return router.createUrlTree(['/docente']);
    }
    return router.createUrlTree(['/login']);
  };
};
