-- Punto de control "Exceso de grapa" en Planta 1 (letra J). Se ejecuta UNA vez
-- en Supabase → SQL Editor. Solo agrega 1 fila a calidad_puntos_control;
-- no modifica el esquema ni las inspecciones ya guardadas (las anteriores
-- simplemente no traen valor en el punto nuevo). Se puede correr más de una vez.

insert into public.calidad_puntos_control (planta, proceso, letra, descripcion, orden, activo)
select 'Planta 1', null, 'J', 'Exceso de grapa', 10, true
where not exists (
  select 1 from public.calidad_puntos_control
  where planta = 'Planta 1' and descripcion = 'Exceso de grapa'
);
