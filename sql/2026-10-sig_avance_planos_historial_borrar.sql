-- Permite revertir una validación de Avance de planos: al revertirla, el portal
-- borra su fila del historial (sig_avance_planos_historial).
-- Se ejecuta UNA vez en Supabase → SQL Editor, después de 2026-10-sig_avance_planos_historial.sql.
-- Solo agrega el permiso de borrar filas a esa tabla; no toca ninguna otra ni borra datos.
-- Se puede correr más de una vez.

grant delete on public.sig_avance_planos_historial to anon, authenticated;

drop policy if exists historial_borrado on public.sig_avance_planos_historial;
create policy historial_borrado on public.sig_avance_planos_historial
  for delete to anon, authenticated using (true);
