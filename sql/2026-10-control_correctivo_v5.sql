-- Control Correctivo v5: los involucrados reportan su avance (barra %, "mi
-- parte está lista" y/o archivo adjunto, con comentario) y la PM recibe un
-- aviso en la campanita. Se ejecuta UNA vez en Supabase → SQL Editor,
-- después de v1 a v4.
--
-- 1) Tabla nueva control_correctivo_avances: una fila = un reporte de una
--    persona sobre una acción. Es aparte de control_correctivo.avance, que
--    sigue siendo la barra oficial de la PM. Los reportes nunca se borran.
--
-- 2) Espacio de archivos (Storage) control-correctivo-avances, público para
--    lectura igual que calidad-evidencias, para los adjuntos de los reportes.
--
-- 3) control_correctivo_notificaciones: v4 permitía un solo aviso por persona
--    y acción; la PM necesita uno por cada reporte. La regla de "un aviso de
--    acción nueva por persona" ahora la cuida el portal (y queda como índice
--    único solo para motivo = 'nueva_accion'). No se borra ningún aviso.

create table if not exists public.control_correctivo_avances (
  id              bigint generated always as identity primary key,
  correctivo_id   bigint not null references public.control_correctivo(id),
  persona_id      integer not null,
  persona_nombre  text,
  avance          integer check (avance between 0 and 100),
  listo           boolean not null default false,
  comentario      text,
  archivo_url     text,
  archivo_nombre  text,
  archivo_path    text,
  created_at      timestamptz not null default now()
);

create index if not exists control_correctivo_avances_correctivo_idx
  on public.control_correctivo_avances (correctivo_id, created_at);

grant select, insert on public.control_correctivo_avances to anon, authenticated;

alter table public.control_correctivo_avances enable row level security;

drop policy if exists portal_acceso_total_temporal on public.control_correctivo_avances;
create policy portal_acceso_total_temporal on public.control_correctivo_avances
  for all to anon, authenticated using (true) with check (true);

-- Archivos adjuntos de los reportes (máx. 15 MB cada uno).
insert into storage.buckets (id, name, public, file_size_limit)
values ('control-correctivo-avances', 'control-correctivo-avances', true, 15728640)
on conflict (id) do nothing;

drop policy if exists control_correctivo_avances_leer on storage.objects;
create policy control_correctivo_avances_leer on storage.objects
  for select to anon, authenticated using (bucket_id = 'control-correctivo-avances');

drop policy if exists control_correctivo_avances_subir on storage.objects;
create policy control_correctivo_avances_subir on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'control-correctivo-avances');

-- Avisos: varios por persona y acción (uno por reporte para la PM).
-- (el nombre automático de la restricción única de v4 se recorta a 63
-- caracteres, por eso se busca por tipo: es la única restricción "unique").
do $$
declare restriccion text;
begin
  select conname into restriccion
    from pg_constraint
   where conrelid = 'public.control_correctivo_notificaciones'::regclass and contype = 'u'
   limit 1;
  if restriccion is not null then
    execute format('alter table public.control_correctivo_notificaciones drop constraint %I', restriccion);
  end if;
end $$;

create unique index if not exists control_correctivo_notif_nueva_accion_uq
  on public.control_correctivo_notificaciones (correctivo_id, destinatario_persona_id)
  where motivo = 'nueva_accion';
