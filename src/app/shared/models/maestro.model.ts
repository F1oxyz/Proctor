// =============================================================
// shared/models/maestro.model.ts
// Representa a un docente registrado en el sistema.
// La tabla `maestros` se auto-puebla via trigger de Supabase
// (handle_nuevo_maestro) al registrarse con OAuth o email/pass.
// Columna `id` === auth.users(id) de Supabase Auth.
// =============================================================

export interface Maestro {
  /** UUID que coincide con auth.users(id) de Supabase Auth */
  id: string;
  /** Nombre completo del docente (viene de raw_user_meta_data.full_name en OAuth) */
  nombre_completo: string;
  /** Correo institucional único */
  email: string;
  /** Fecha de creación del registro */
  creado_en: string; // TIMESTAMPTZ → string ISO 8601
}