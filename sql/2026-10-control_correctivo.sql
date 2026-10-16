-- Módulo "Control Correctivo" (seguimiento de acciones correctivas por proceso).
-- Se ejecuta UNA vez en Supabase → SQL Editor. Mientras esta tabla no exista,
-- el módulo se abre pero avisa que falta crearla.
--
-- Una fila = una acción correctiva: proceso, tipo de brecha, causa raíz,
-- acción, líder responsable, supervisor ejecutor, prioridad, fechas, avance
-- (0 a 100, capturado a mano) y resultado de eficiencia operativa.
-- No modifica ninguna tabla existente. "Eliminar" en el portal solo la marca
-- como inactiva (activo = false); nunca borra filas.

create table if not exists public.control_correctivo (
  id                    bigint generated always as identity primary key,
  proceso_id            bigint not null references public.procesos(id),
  tipo_brecha           text not null check (tipo_brecha in ('Operativa', 'Competencias', 'Financiera')),
  causa_raiz            text,
  accion_correctiva     text not null,
  lider_persona_id      integer,
  supervisor_persona_id integer,
  prioridad             text not null default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
  fecha_inicio          date not null default current_date,
  fecha_compromiso      date not null,
  avance                integer not null default 0 check (avance between 0 and 100),
  eficiencia_operativa  text,
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  created_by_persona_id integer,
  created_by_nombre     text,
  updated_at            timestamptz,
  updated_by_persona_id integer,
  updated_by_nombre     text,
  check (fecha_compromiso >= fecha_inicio)
);

create index if not exists control_correctivo_proceso_idx
  on public.control_correctivo (proceso_id, fecha_compromiso);

-- Mismo esquema de acceso que calidad_ediciones (el portal usa la llave pública).
grant select, insert, update on public.control_correctivo to anon, authenticated;
grant usage, select on sequence public.control_correctivo_id_seq to anon, authenticated;

alter table public.control_correctivo enable row level security;

drop policy if exists portal_acceso_total_temporal on public.control_correctivo;
create policy portal_acceso_total_temporal on public.control_correctivo
  for all to anon, authenticated using (true) with check (true);
