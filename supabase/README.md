# Supabase migrations

Estas migraciones documentan y versionan los cambios de schema y hardening
que ya se aplicaron manualmente en el proyecto.

## Archivos

- `001_add_examen_descripcion.sql` — alinea `examenes.descripcion` con el frontend
- `002_cleanup_duplicate_indexes.sql` — elimina duplicados detectados durante la auditoría
- `003_add_integrity_checks.sql` — agrega constraints de consistencia
- `004_harden_sesion_alumnos_rls.sql` — endurece la policy de update del flujo alumno

## Nota

Algunas migraciones usan `drop ... if exists` para ser re-ejecutables en entornos
de desarrollo, pero están pensadas principalmente como historial versionado de los
cambios ejecutados en Supabase.
