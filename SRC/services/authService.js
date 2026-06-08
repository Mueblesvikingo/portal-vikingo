import { supabase } from "./supabase";

export async function loginWithUserAndPassword(usuario, password) {
  const cleanUser = String(usuario || "").trim();
  const cleanPassword = String(password || "").trim();

  if (!cleanUser || !cleanPassword) {
    throw new Error("Ingresa usuario y contraseña.");
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("usuario", cleanUser)
    .eq("activo", true)
    .single();

  if (error || !data) {
    throw new Error("Usuario no encontrado o inactivo.");
  }

  // Validación temporal:
  // Como la contraseña está en bcrypt, por ahora NO validamos aquí.
  // En el siguiente paso agregamos validación segura.
  return {
    id: data.id,
    usuario: data.usuario,
    nombre: data.nombre,
    puesto: data.puesto,
    rol_sistema: data.rol_sistema,
    rol_organizacional: data.rol_organizacional,
    activo: data.activo,
  };
}

export function saveSession(user) {
  localStorage.setItem("vikingo_current_user", JSON.stringify(user));
}

export function getSession() {
  try {
    const stored = localStorage.getItem("vikingo_current_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("vikingo_current_user");
}