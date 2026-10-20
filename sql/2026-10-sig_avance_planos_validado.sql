-- Opción "validado" (paloma dorada) en las casillas de Avance de planos.
-- Se ejecuta UNA vez en Supabase → SQL Editor, después de crear sig_avance_planos.
-- Solo agrega una columna a esa tabla; no toca ninguna otra ni borra datos
-- (las casillas ya marcadas quedan igual). Se puede correr más de una vez.

alter table public.sig_avance_planos
  add column if not exists validado boolean not null default false;
