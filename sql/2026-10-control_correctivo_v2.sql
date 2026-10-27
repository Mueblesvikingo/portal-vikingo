-- Control Correctivo · ajustes pedidos por la PM (26-oct-2026).
-- Se ejecuta UNA vez en Supabase → SQL Editor, después de crear control_correctivo.
-- Solo AGREGA columnas a esa tabla (no borra ni cambia nada existente; las
-- acciones ya guardadas quedan igual, con estos campos vacíos). Se puede correr
-- más de una vez. Mientras no se ejecute, el módulo sigue funcionando como
-- antes y avisa que falta este paso.
--
--   nombre_accion             nombre corto de la acción (es lo que muestra el Gantt)
--   todos_procesos            la acción involucra a todos los procesos
--   procesos_involucrados_ids otros procesos involucrados en las brechas detectadas
--   directrices_ids           directrices estratégicas que atiende (despliegue_objetivos.id);
--                             una acción puede atender varias, sin límite

alter table public.control_correctivo
  add column if not exists nombre_accion text,
  add column if not exists todos_procesos boolean not null default false,
  add column if not exists procesos_involucrados_ids integer[] not null default '{}',
  add column if not exists directrices_ids integer[] not null default '{}';
