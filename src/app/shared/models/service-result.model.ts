// =============================================================
// shared/models/service-result.model.ts
// Tipo de resultado estándar para operaciones de servicios.
// Elimina la necesidad de definir este shape en cada servicio.
// =============================================================

/**
 * Resultado estándar de operaciones de servicios que pueden fallar.
 *
 * @example
 * async crearGrupo(): Promise<ServiceResult<Grupo>> {
 *   // ...
 *   return { data: grupo, error: null };
 *   return { data: null, error: 'Mensaje de error.' };
 * }
 */
export interface ServiceResult<T = void> {
  data: T | null;
  error: string | null;
}
