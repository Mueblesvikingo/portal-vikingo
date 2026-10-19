-- Carga inicial de Avance de planos (pedido del Coordinador SIG):
--   · TODOS los productos del seguimiento: check en Carpintería (2D) y Armado (3D).
--   · TODAS las salas: además check en Espuma (2D) y Corte tela (2D).
-- Se ejecuta UNA vez en Supabase → SQL Editor, después de crear sig_avance_planos
-- y de agregar no_aplica. Se puede correr más de una vez sin duplicar nada.
--
-- Mismos productos que muestra la pestaña: se omiten buros, tocadores y las
-- bases de tela. Una casilla que ya estaba marcada como N/A se respeta: esta
-- carga no la pisa. No borra ni desmarca nada.

-- La tabla se creó antes de agregar el área "espuma", y su regla de áreas
-- válidas no la incluía (error 23514 al cargar). Se reemplaza la regla para
-- aceptar espuma; no toca ningún dato.
alter table public.sig_avance_planos drop constraint if exists sig_avance_planos_area_check;
alter table public.sig_avance_planos add constraint sig_avance_planos_area_check
  check (area in ('corte', 'costura', 'carpinteria', 'armado', 'tapizado', 'espuma'));

insert into public.sig_avance_planos (producto_id, area, tipo, completado, no_aplica, updated_by_nombre)
select p.id, v.area, v.tipo, true, false, 'Carga inicial'
from public.calidad_productos p
cross join (values ('carpinteria', '2D'), ('armado', '3D')) as v(area, tipo)
where p.activo
  and p.nombre !~* '^(par de buros|tocador)'
  and not (p.nombre ~* '^base' and p.nombre ~* 'tela')
on conflict (producto_id, area, tipo) do update
  set completado = true,
      updated_at = now(),
      updated_by_nombre = 'Carga inicial'
  where not public.sig_avance_planos.no_aplica;

insert into public.sig_avance_planos (producto_id, area, tipo, completado, no_aplica, updated_by_nombre)
select p.id, v.area, v.tipo, true, false, 'Carga inicial'
from public.calidad_productos p
cross join (values ('espuma', '2D'), ('corte', '2D')) as v(area, tipo)
where p.activo
  and p.nombre ~* '^sala\M'
on conflict (producto_id, area, tipo) do update
  set completado = true,
      updated_at = now(),
      updated_by_nombre = 'Carga inicial'
  where not public.sig_avance_planos.no_aplica;
