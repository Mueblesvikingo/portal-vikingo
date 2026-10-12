-- Punto de control "OP / código / terminación" en Planta 3 y texto ampliado en
-- Producto Terminado. Se ejecuta UNA vez en Supabase → SQL Editor.
-- Solo agrega 3 filas y actualiza 1 descripción en calidad_puntos_control;
-- no modifica el esquema ni las inspecciones ya guardadas (las anteriores
-- simplemente no traen valor en el punto nuevo).

insert into public.calidad_puntos_control (planta, proceso, letra, descripcion, orden, activo)
select 'Planta 3', v.proceso, v.letra, 'OP / código / terminación', v.orden, true
from (values
       ('Corte y pegado de hule espuma', 'I', 9),
       ('Tapicería',                      'J', 10),
       ('Empaque',                        'J', 10)
     ) as v(proceso, letra, orden)
where not exists (
  select 1 from public.calidad_puntos_control p
  where p.planta = 'Planta 3' and p.proceso = v.proceso and p.descripcion = 'OP / código / terminación'
);

update public.calidad_puntos_control
   set descripcion = 'Etiqueta: producto, OP, terminación y cliente'
 where planta = 'Producto Terminado' and letra = 'A'
   and descripcion = 'Etiqueta / identificación y trazabilidad';
