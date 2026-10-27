import { supabase } from "./supabase";

export async function loginWithUserAndPassword(usuario, password) {
  const cleanUser = String(usuario || "").trim();
  const cleanPassword = String(password || "").trim();

  if (!cleanUser || !cleanPassword) {
    throw new Error("Ingresa usuario y contraseña.");
  }

  // La contraseña se valida en la base con la función `portal_login`
  // (sql/2026-10-seguridad_login.sql): compara contra el hash bcrypt y nunca
  // devuelve la contraseña al navegador.
  const { data: rpcData, error: rpcError } = await supabase.rpc("portal_login", {
    p_usuario: cleanUser,
    p_password: cleanPassword,
  });

  let data = rpcData;
  if (rpcError) {
    // Mientras ese SQL no se ejecute la función no existe: se compara contra la
    // contraseña guardada (hoy en texto plano) para no dejar el acceso sin validar.
    if (!esFuncionFaltante(rpcError)) {
      console.error("Error al validar el inicio de sesión:", rpcError);
      throw new Error("No se pudo validar el inicio de sesión. Inténtalo de nuevo.");
    }
    const { data: legacy, error } = await supabase
      .from("usuarios")
      .select(`${USUARIO_COLUMNAS_SESION},password_hash,persona:personas(nombre)`)
      .eq("usuario", cleanUser)
      .eq("activo", true)
      .maybeSingle();
    const coincide = !error && legacy && legacy.password_hash && !/^\$2[aby]\$/.test(legacy.password_hash) && legacy.password_hash === cleanPassword;
    data = coincide ? { ...legacy, persona_nombre: legacy.persona?.nombre || null } : null;
  }

  if (!data) {
    throw new Error("Usuario o contraseña incorrectos.");
  }

  return {
    id: data.id,
    usuario: data.usuario,
    nombre: data.nombre,
    puesto: data.puesto,
    rol_sistema: data.rol_sistema,
    rol_organizacional: data.rol_organizacional,
    activo: data.activo,
    permisos_custom: data.permisos_custom || null,
    persona_id: data.persona_id || null,
    persona_nombre: data.persona_nombre || null,
  };
}

// Columnas de `usuarios` que el portal puede leer: nunca `password_hash`.
const USUARIO_COLUMNAS_SESION = "id,usuario,nombre,puesto,rol_sistema,rol_organizacional,activo,permisos_custom,persona_id";

function esFuncionFaltante(error) {
  const texto = `${error?.message || ""}`.toLowerCase();
  return error?.code === "PGRST202" || error?.code === "42883" || texto.includes("could not find the function");
}

// La sesión vive en el navegador: si el usuario fue desactivado (o borrado)
// después de entrar, se cierra. Ante un error de red se deja abierta.
export async function sesionSigueActiva(usuarioId) {
  if (!usuarioId) return true;
  try {
    const { data, error } = await supabase.from("usuarios").select("id,activo").eq("id", usuarioId).maybeSingle();
    if (error) return true;
    return Boolean(data && data.activo);
  } catch {
    return true;
  }
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

// "En línea" en Mensajes (MessagesPanel.jsx) se calcula sobre esto: no hay
// backend de tiempo real en el proyecto (mismo criterio que el resto de las
// notificaciones, que funcionan a base de polling), así que la presencia es
// un heartbeat — mientras la sesión siga abierta, App.jsx llama esto cada
// ~45s, y se considera "en línea" a quien tenga esta marca reciente.
export async function marcarActividad(usuarioId) {
  if (!usuarioId) return;
  try {
    const { error } = await supabase.from("usuarios").update({ ultima_actividad: new Date().toISOString() }).eq("id", usuarioId);
    if (error) console.error("Error al marcar actividad del usuario:", error);
  } catch (err) {
    console.error("Error inesperado al marcar actividad del usuario:", err);
  }
}