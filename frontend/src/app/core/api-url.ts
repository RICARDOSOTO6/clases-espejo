/**
 * Base de las llamadas al API.
 *
 * En producción el backend sirve el frontend y la ruta relativa funciona tal
 * cual. En desarrollo el frontend vive en `:4200` y el backend en `:3000`, así
 * que las peticiones se dirigen al host del backend.
 *
 * Esta lógica estaba copiada en los doce servicios (y otra vez en
 * `url-archivo.util.ts`); vive aquí para que cambiar el puerto del API sea un
 * solo cambio. El `typeof window` evita que el renderizado en servidor se rompa
 * al evaluar este módulo.
 */
export const API_URL =
  typeof window !== 'undefined' && window.location.port === '4200'
    ? `http://${window.location.hostname}:3000`
    : '';
