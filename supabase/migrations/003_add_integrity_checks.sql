-- 003_add_integrity_checks.sql
-- Agrega constraints de consistencia para evitar datos inválidos aunque falle el cliente.

alter table public.examenes
drop constraint if exists examenes_duracion_min_positiva_chk;

alter table public.examenes
add constraint examenes_duracion_min_positiva_chk
check (duracion_min > 0);

alter table public.examenes
drop constraint if exists examenes_minimo_aprobatorio_rango_chk;

alter table public.examenes
add constraint examenes_minimo_aprobatorio_rango_chk
check (minimo_aprobatorio >= 0 and minimo_aprobatorio <= 100);

alter table public.sesion_alumnos
drop constraint if exists sesion_alumnos_porcentaje_valido_chk;

alter table public.sesion_alumnos
add constraint sesion_alumnos_porcentaje_valido_chk
check (porcentaje is null or (porcentaje >= 0 and porcentaje <= 100));

alter table public.sesion_alumnos
drop constraint if exists sesion_alumnos_totales_validos_chk;

alter table public.sesion_alumnos
add constraint sesion_alumnos_totales_validos_chk
check (
  (total_correctas is null or total_correctas >= 0)
  and
  (total_incorrectas is null or total_incorrectas >= 0)
);
