-- Escenarios guardados del Simulador financiero (pestaña "Simulador" de Diagnóstico SIG,
-- visible solo para el Coordinador SIG y el Director General).
-- Se ejecuta UNA vez en Supabase → SQL Editor. Se puede correr más de una vez.
-- Crea una tabla nueva; no modifica ninguna tabla existente ni borra datos.
-- Mientras no exista, el simulador funciona y guarda solo en el navegador de cada persona.
--
-- Una fila = un escenario: nombre, todos los supuestos y alternativas (datos) y un resumen
-- (mejor alternativa, VPN, TIR, recuperación) para listarlos sin abrirlos.
-- Mismo esquema de acceso que el resto del portal (llave pública): la restricción a
-- Coordinador SIG y Director General se aplica en pantalla, no en la base de datos.

create table if not exists public.sig_simulaciones (
  id                    bigint generated always as identity primary key,
  nombre                text not null,
  datos                 jsonb not null,
  resumen               jsonb,
  created_by_persona_id integer,
  created_by_nombre     text,
  updated_by_nombre     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists sig_simulaciones_actualizado_idx
  on public.sig_simulaciones (updated_at desc);

grant select, insert, update, delete on public.sig_simulaciones to anon, authenticated;
grant usage, select on sequence public.sig_simulaciones_id_seq to anon, authenticated;

alter table public.sig_simulaciones enable row level security;

drop policy if exists portal_acceso_total_temporal on public.sig_simulaciones;
create policy portal_acceso_total_temporal on public.sig_simulaciones
  for all to anon, authenticated using (true) with check (true);
