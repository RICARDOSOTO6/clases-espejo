import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Rol } from '../models/auth.models';

/**
 * Deja pasar solo a los roles indicados, y **sin redirigir**.
 *
 * El panel de trabajo vive en una sola URL (`/panel`) para los tres roles:
 * agente, docente y CACE. La URL no debe decir qué tipo de usuario eres, y para
 * eso hacen falta tres rutas con **el mismo path**: el router las prueba en
 * orden y se queda con la primera cuyo `canMatch` devuelve `true`
 * (`canActivate` no sirve aquí: al fallar corta la navegación en vez de dejar
 * probar la siguiente).
 *
 * Si no coincide ninguna —sin sesión, o un rol sin panel— se cae en la ruta
 * comodín, que manda al acceso.
 */
export const panelDeRol = (...roles: Exclude<Rol, null>[]): CanMatchFn => {
  return () => {
    const auth = inject(AuthService);
    const rol = auth.currentUser()?.rol ?? null;
    return auth.isAuthenticated && !!rol && roles.includes(rol);
  };
};
