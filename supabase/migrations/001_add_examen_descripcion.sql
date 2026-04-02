-- 001_add_examen_descripcion.sql
-- Alinea el schema de Supabase con el frontend: el examen ahora soporta descripción opcional.

alter table public.examenes
add column if not exists descripcion text;

comment on column public.examenes.descripcion
is 'Descripción opcional del examen visible en creación, edición y detalle.';
