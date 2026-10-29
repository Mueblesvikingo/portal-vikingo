-- Historial de validaciones de Avance de planos (check dorado).
-- Se ejecuta UNA vez en Supabase → SQL Editor, después de crear sig_avance_planos.
-- Crea una tabla nueva; no modifica ninguna tabla existente ni borra datos.
-- Se puede correr más de una vez.
--
-- Una fila = una validación dada o retirada: qué plano (producto + área + tipo),
-- quién y cuándo. Es un registro de auditoría: el portal solo lo lee y le agrega
-- filas, por eso no se da permiso de update ni delete.

create table if not exists public.sig_avance_planos_historial (
  id             bigint generated always as identity primary key,
  producto_id    bigint not null,
  area           text not null,
  tipo           text not null check (tipo in ('2D', '3D')),
  accion         text not null check (accion in ('validado', 'retirado')),
  persona_id     integer,
  persona_nombre text,
  created_at     timestamptz not null default now()
);

create index if not exists sig_avance_planos_historial_plano_idx
  on public.sig_avance_planos_historial (producto_id, area, tipo, created_at desc);
create index if not exists sig_avance_planos_historial_fecha_idx
  on public.sig_avance_planos_historial (created_at desc);

-- Mismo esquema de acceso que sig_avance_planos (el portal usa la llave pública),
-- pero solo lectura y alta.
grant select, insert on public.sig_avance_planos_historial to anon, authenticated;
grant usage, select on sequence public.sig_avance_planos_historial_id_seq to anon, authenticated;

alter table public.sig_avance_planos_historial enable row level security;

drop policy if exists historial_lectura on public.sig_avance_planos_historial;
create policy historial_lectura on public.sig_avance_planos_historial
  for select to anon, authenticated using (true);

drop policy if exists historial_alta on public.sig_avance_planos_historial;
create policy historial_alta on public.sig_avance_planos_historial
  for insert to anon, authenticated with check (true);
