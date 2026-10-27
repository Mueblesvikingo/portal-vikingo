-- Seguridad del inicio de sesión del portal (27-oct-2026).
-- Se ejecuta UNA vez en Supabase → SQL Editor, DESPUÉS de desplegar la versión
-- del portal que usa la función portal_login. Se puede correr más de una vez.
--
-- Qué hace:
--   1. Cifra con bcrypt las contraseñas que hoy están en texto plano en
--      usuarios.password_hash. Cada persona sigue entrando con la MISMA
--      contraseña de siempre; solo cambia cómo se guarda.
--   2. Trigger: toda contraseña nueva o cambiada se cifra sola al guardarse
--      (Catálogo Organizacional sigue funcionando igual).
--   3. Función portal_login(usuario, contraseña): valida en la base y devuelve
--      los datos del usuario sin la contraseña. Solo usuarios activos.
--   4. Quita al navegador el permiso de LEER la columna password_hash.
-- No borra ni desactiva a nadie.
--
-- Para cambiar la contraseña de alguien después de esto:
--   update public.usuarios set password_hash = 'NuevaContraseña' where usuario = 'nombre_de_usuario';
-- (el trigger la cifra al guardarla).

create extension if not exists pgcrypto with schema extensions;

-- 2. Cifrado automático de contraseñas nuevas o cambiadas
create or replace function public.usuarios_cifrar_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.password_hash is not null and new.password_hash !~ '^\$2[aby]\$' then
    new.password_hash := crypt(new.password_hash, gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_cifrar_password on public.usuarios;
create trigger usuarios_cifrar_password
  before insert or update of password_hash on public.usuarios
  for each row execute function public.usuarios_cifrar_password();

-- 1. Cifrar las contraseñas existentes (solo las que aún están en texto plano)
update public.usuarios
   set password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf'))
 where password_hash is not null
   and password_hash !~ '^\$2[aby]\$';

-- 3. Validación del inicio de sesión en la base
create or replace function public.portal_login(p_usuario text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios%rowtype;
  v_persona text;
begin
  select * into u from public.usuarios where usuario = trim(p_usuario) and activo = true limit 1;
  if not found or u.password_hash is null or u.password_hash !~ '^\$2[aby]\$' then
    return null;
  end if;
  if u.password_hash <> crypt(p_password, u.password_hash) then
    return null;
  end if;
  select nombre into v_persona from public.personas where id = u.persona_id;
  update public.usuarios set ultimo_acceso = now() where id = u.id;
  return (to_jsonb(u) - 'password_hash') || jsonb_build_object('persona_nombre', v_persona);
end;
$$;

revoke all on function public.portal_login(text, text) from public;
grant execute on function public.portal_login(text, text) to anon, authenticated;

-- 4. El navegador ya no puede leer password_hash (sí puede leer el resto de columnas)
revoke select on public.usuarios from anon, authenticated;
grant select (id, usuario, nombre, puesto, rol_sistema, rol_organizacional, activo,
              ultimo_acceso, created_at, permisos_custom, persona_id, ultima_actividad)
  on public.usuarios to anon, authenticated;
