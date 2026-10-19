-- Avance de planos 2D y 3D por producto y área (pestaña de Diagnóstico SIG,
-- visible solo para el Coordinador SIG y el Director General).
-- Se ejecuta UNA vez en Supabase → SQL Editor. Mientras esta tabla no exista,
-- la pestaña se abre pero avisa que falta crearla.
--
-- Una fila = una casilla marcada o desmarcada: producto + área + tipo de plano.
-- El producto sale del catálogo calidad_productos (Configuración > Productos).
-- No modifica ninguna tabla existente. Implementación temporal.

create table if not exists public.sig_avance_planos (
  id                    bigint generated always as identity primary key,
  producto_id           bigint not null,
  area                  text not null check (area in ('corte', 'costura', 'carpinteria', 'armado', 'tapizado', 'espuma')),
  tipo                  text not null check (tipo in ('2D', '3D')),
  completado            boolean not null default false,
  updated_at            timestamptz not null default now(),
  updated_by_persona_id integer,
  updated_by_nombre     text,
  unique (producto_id, area, tipo)
);

create index if not exists sig_avance_planos_producto_idx
  on public.sig_avance_planos (producto_id);

-- Mismo esquema de acceso que calidad_ediciones y control_correctivo
-- (el portal usa la llave pública).
grant select, insert, update on public.sig_avance_planos to anon, authenticated;
grant usage, select on sequence public.sig_avance_planos_id_seq to anon, authenticated;

alter table public.sig_avance_planos enable row level security;

drop policy if exists portal_acceso_total_temporal on public.sig_avance_planos;
create policy portal_acceso_total_temporal on public.sig_avance_planos
  for all to anon, authenticated using (true) with check (true);
