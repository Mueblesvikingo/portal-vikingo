-- Control Correctivo v4: selección múltiple de proceso, líder y supervisor, y
-- alertas (ventana emergente + sirena + campanita) a las personas de la acción.
-- Se ejecuta UNA vez en Supabase → SQL Editor, después de v1, v2 y v3.
--
-- 1) Listas nuevas en control_correctivo. Las columnas de un solo valor
--    (proceso_id, lider_persona_id, supervisor_persona_id) NO se tocan: el
--    portal las sigue llenando con el primero de cada lista, para que las
--    acciones ya registradas, el Gantt y los filtros funcionen igual.
--    Las acciones existentes se copian a las listas nuevas (no se pierde nada).
--
-- 2) Tabla nueva control_correctivo_notificaciones: una fila = un aviso a una
--    persona sobre una acción correctiva. Hace falta una tabla propia porque la
--    de Acciones de Mejora (accion_notificaciones) está ligada a la tabla
--    acciones y no puede apuntar a control_correctivo. Una persona recibe un
--    solo aviso por acción (al editar, solo se avisa a quien se agrega).
--    "Visto" solo llena visto_en; nunca se borran filas.

alter table public.control_correctivo
  add column if not exists procesos_ids     integer[] not null default '{}',
  add column if not exists lideres_ids      integer[] not null default '{}',
  add column if not exists supervisores_ids integer[] not null default '{}';

update public.control_correctivo
   set procesos_ids = array[proceso_id::integer]
 where cardinality(procesos_ids) = 0 and proceso_id is not null;

update public.control_correctivo
   set lideres_ids = array[lider_persona_id]
 where cardinality(lideres_ids) = 0 and lider_persona_id is not null;

update public.control_correctivo
   set supervisores_ids = array[supervisor_persona_id]
 where cardinality(supervisores_ids) = 0 and supervisor_persona_id is not null;

create table if not exists public.control_correctivo_notificaciones (
  id                      bigint generated always as identity primary key,
  correctivo_id           bigint not null references public.control_correctivo(id),
  destinatario_persona_id integer not null,
  motivo                  text,
  mensaje                 text,
  urgente                 boolean not null default true,
  visto_en                timestamptz,
  created_at              timestamptz not null default now(),
  created_by_persona_id   integer,
  created_by_nombre       text,
  unique (correctivo_id, destinatario_persona_id)
);

create index if not exists control_correctivo_notif_pendientes_idx
  on public.control_correctivo_notificaciones (destinatario_persona_id)
  where visto_en is null;

-- Mismo esquema de acceso que el resto del módulo (el portal usa la llave pública).
grant select, insert, update on public.control_correctivo_notificaciones to anon, authenticated;

alter table public.control_correctivo_notificaciones enable row level security;

drop policy if exists portal_acceso_total_temporal on public.control_correctivo_notificaciones;
create policy portal_acceso_total_temporal on public.control_correctivo_notificaciones
  for all to anon, authenticated using (true) with check (true);
