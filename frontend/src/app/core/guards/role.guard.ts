import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Rol } from '../models/auth.models';

/**
 * Exige uno de los roles indicados para entrar en una ruta.
 *
 * Se usa en las páginas que **solo** tienen un rol (por ejemplo, las secciones
 * de la CACE), no en el panel general: ese lo resuelve `panelDeRol` sin
 * redirigir. Aquí sí se redirige, y siempre al panel: si un docente abre una
 * sección de la CACE, vuelve a su propio panel sin ver el login.
 */
export const roleGuard = (...roles: Exclude<Rol, null>[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.currentUser();

    if (auth.isAuthenticated && user?.debeAceptarAviso !== false) {
      return router.createUrlTree(['/aceptar-aviso']);
    }

    if (auth.isAuthenticated && user?.rol && roles.includes(user.rol)) {
      return true;
    }

    if (user?.rol) {
      return router.createUrlTree(['/panel']);
    }

    return router.createUrlTree(['/login']);
  };
};
