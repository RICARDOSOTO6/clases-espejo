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
    // La CACE tiene su propia pantalla. Sin esto, un presidente que llegara a
    // una ruta de otro rol acabaría en el login, que lo devolvería a `/cace` y
    // otra vez aquí.
    if (user?.rol === 'PRESIDENTE_CACE' || user?.rol === 'SECRETARIA_CACE') {
      return router.createUrlTree(['/cace']);
    }
    return router.createUrlTree(['/login']);
  };
};
