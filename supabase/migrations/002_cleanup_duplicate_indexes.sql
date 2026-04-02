-- 002_cleanup_duplicate_indexes.sql
-- Limpia índices y constraints duplicadas detectadas durante el hardening.

alter table public.sesion_alumnos
drop constraint if exists uq_sesion_alumno;

alter table public.respuestas
drop constraint if exists uq_respuesta_por_pregunta;

drop index if exists public.idx_examenes_grupo;
drop index if exists public.idx_preguntas_examen;
drop index if exists public.idx_opciones_pregunta;
drop index if exists public.idx_respuestas_sa;
drop index if exists public.idx_sa_sesion;
