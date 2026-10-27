import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/login']);
  }

  // Una cuenta anterior a la versión vigente no entra al resto de la app
  // hasta que deje constancia de que leyó y aceptó el aviso.
  if (auth.currentUser()?.debeAceptarAviso !== false) {
    return router.createUrlTree(['/aceptar-aviso']);
  }

  return true;
};
