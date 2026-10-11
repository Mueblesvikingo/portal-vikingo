-- Historial de ediciones de las inspecciones de Gestión de Calidad.
-- Se ejecuta UNA vez en Supabase → SQL Editor. Mientras esta tabla no exista,
-- el portal sigue editando inspecciones con normalidad, solo que sin historial.
--
-- Cada fila = una edición guardada: quién la hizo, cuándo y qué cambió
-- (campos del registro y puntos de control, con el valor anterior y el nuevo).
-- No modifica ninguna tabla existente.

create table if not exists public.calidad_ediciones (
  id           bigserial primary key,
  recorrido_id bigint not null references public.calidad_recorridos(id) on delete cascade,
  persona_id   integer,
  nombre       text,
  cambios      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists calidad_ediciones_recorrido_idx
  on public.calidad_ediciones (recorrido_id, created_at desc);

-- Mismo esquema de acceso que calidad_recordatorios (el portal usa la llave pública).
grant select, insert on public.calidad_ediciones to anon, authenticated;
grant usage, select on sequence public.calidad_ediciones_id_seq to anon, authenticated;

alter table public.calidad_ediciones enable row level security;

drop policy if exists portal_acceso_total_temporal on public.calidad_ediciones;
create policy portal_acceso_total_temporal on public.calidad_ediciones
  for all to anon, authenticated using (true) with check (true);
