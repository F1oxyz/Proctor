-- 004_harden_sesion_alumnos_rls.sql
-- Endurece la policy más abierta del flujo alumno sin romper el modelo actual anónimo.

drop policy if exists sa_anon_update on public.sesion_alumnos;
drop policy if exists sa_anon_update_controlado on public.sesion_alumnos;

create policy sa_anon_update_controlado
on public.sesion_alumnos
for update
to public
using (
  estado in ('unido', 'en_progreso')
)
with check (
  estado in ('unido', 'en_progreso', 'enviado')
);
