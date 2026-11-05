import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Rol } from '../models/auth.models';

/**
 * Deja pasar solo a los roles indicados, y **sin redirigir**.
 *
 * El panel de trabajo vive en `/panel` para los roles de siempre, y además
 * tiene URLs explícitas `/panel/agente` y `/panel/docente` para una cuenta que
 * sea agente y docente a la vez. El router prueba las rutas en orden y se queda
 * con la primera cuyo `canMatch` devuelve `true` (`canActivate` no sirve aquí:
 * al fallar corta la navegación en vez de dejar probar la siguiente).
 *
 * Si no coincide ninguna —sin sesión, o un rol sin panel— se cae en la ruta
 * comodín, que manda al acceso.
 */
export const panelDeRol = (...roles: Exclude<Rol, null>[]): CanMatchFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const usuario = auth.currentUser();
    const rolesUsuario =
      usuario?.roles && usuario.roles.length > 0
        ? usuario.roles
        : usuario?.rol
          ? [usuario.rol]
          : [];

    if (
      !auth.isAuthenticated ||
      !rolesUsuario.some((rol) => roles.includes(rol as Exclude<Rol, null>))
    ) {
      return false;
    }

    if (usuario?.debeAceptarAviso !== false) {
      return router.createUrlTree(['/aceptar-aviso']);
    }

    return true;
  };
};
