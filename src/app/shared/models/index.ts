// =============================================================
// shared/models/index.ts
// Barrel de exportación de todos los modelos del proyecto.
// Estos tipos mapean 1:1 con las tablas de Supabase (ver BD PDF).
// NO modificar la estructura sin antes actualizar el schema en Supabase.
// =============================================================

export * from './maestro.model';
export * from './grupo.model';
export * from './alumno.model';
export * from './examen.model';
export * from './pregunta.model';
export * from './sesion.model';
export * from './respuesta.model';