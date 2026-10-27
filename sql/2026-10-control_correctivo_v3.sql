-- Control Correctivo · directrices propias (27-oct-2026).
-- Se ejecuta UNA vez en Supabase → SQL Editor, después de 2026-10-control_correctivo_v2.sql.
-- Se puede correr más de una vez. No toca datos existentes.
--
-- Por qué una tabla nueva: las directrices que se agregan desde el formulario
-- deben poder reutilizarse en otras acciones; por eso se guardan en un catálogo
-- (control_correctivo_directrices) y cada acción guarda cuáles atiende
-- (control_correctivo.directrices_propias_ids). Los objetivos del Despliegue
-- Estratégico siguen siendo opcionales (columna directrices_ids, ya existente).

create table if not exists public.control_correctivo_directrices (
  id                    bigint generated always as identity primary key,
  nombre                text not null,
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  created_by_persona_id integer,
  created_by_nombre     text
);

create unique index if not exists control_correctivo_directrices_nombre_uq
  on public.control_correctivo_directrices (lower(trim(nombre)));

alter table public.control_correctivo
  add column if not exists directrices_propias_ids integer[] not null default '{}';

-- Mismo esquema de acceso que control_correctivo (el portal usa la llave pública).
grant select, insert, update on public.control_correctivo_directrices to anon, authenticated;

alter table public.control_correctivo_directrices enable row level security;

drop policy if exists portal_acceso_total_temporal on public.control_correctivo_directrices;
create policy portal_acceso_total_temporal on public.control_correctivo_directrices
  for all to anon, authenticated using (true) with check (true);
