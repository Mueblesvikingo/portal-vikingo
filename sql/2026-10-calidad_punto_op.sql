-- Punto de control "OP / código / terminación" en Planta 3 y texto ampliado en
-- Producto Terminado. Se ejecuta UNA vez en Supabase → SQL Editor.
-- Solo agrega 3 filas y actualiza 1 descripción en calidad_puntos_control;
-- no modifica el esquema ni las inspecciones ya guardadas (las anteriores
-- simplemente no traen valor en el punto nuevo).

insert into public.calidad_puntos_control (id, planta, proceso, letra, descripcion, orden, activo)
select m.mx + v.n, 'Planta 3', v.proceso, v.letra, 'OP / código / terminación', v.orden, true
from (select coalesce(max(id), 0) as mx from public.calidad_puntos_control) m,
     (values
       (1, 'Corte y pegado de hule espuma', 'I', 9),
       (2, 'Tapicería',                      'J', 10),
       (3, 'Empaque',                        'J', 10)
     ) as v(n, proceso, letra, orden)
where not exists (
  select 1 from public.calidad_puntos_control p
  where p.planta = 'Planta 3' and p.proceso = v.proceso and p.descripcion = 'OP / código / terminación'
);

update public.calidad_puntos_control
   set descripcion = 'Etiqueta: producto, OP, terminación y cliente'
 where planta = 'Producto Terminado' and letra = 'A'
   and descripcion = 'Etiqueta / identificación y trazabilidad';
