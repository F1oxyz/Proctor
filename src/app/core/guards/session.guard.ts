import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';

/**
 * Expresión regular para validar un UUID v4.
 * Usada para detectar valores corruptos en sessionStorage antes de confiar en ellos.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Devuelve true si el string parece un UUID v4 válido.
 * Si sessionStorage tiene basura (e.g., "undefined", JSON roto, token expirado)
 * el guard lo descarta y redirige a la sala de espera.
 */
function esUuidValido(valor: string | null): valor is string {
  return !!valor && UUID_REGEX.test(valor);
}

export const sessionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);

  // Verificar que el alumno haya pasado por la sala de espera.
  // Usamos sessionStorage como fallback ligero — ExamenActivoService persiste
  // el alumnoId con la clave `proctor_alumno_<codigo>` al unirse a la sala.
  const codigo = route.parent?.params['codigo'];

  // Blindar: si no hay código válido, no navegar a /examen/undefined
  if (!codigo || codigo === 'undefined') {
    router.navigate(['/']);
    return false;
  }

  const alumnoIdRaw = sessionStorage.getItem(`proctor_alumno_${codigo}`);

  // Validar que el valor almacenado sea un UUID real, no datos corruptos.
  // Datos corruptos posibles: "null", "undefined", strings vacíos, JSON.
  if (esUuidValido(alumnoIdRaw)) {
    return true;
  }

  // Limpiar la clave corrupta para evitar que quede basura en storage
  if (alumnoIdRaw !== null) {
    console.warn('[sessionGuard] Valor inválido en sessionStorage, limpiando:', alumnoIdRaw);
    sessionStorage.removeItem(`proctor_alumno_${codigo}`);
  }

  // Regresar a la sala de espera con el mismo código
  router.navigate(['/examen', codigo]);
  return false;
};