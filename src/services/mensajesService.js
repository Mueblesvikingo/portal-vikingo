import { supabase } from "./supabase";

// Mensajería interna entre personas del portal — conversación 1 a 1, con
// check de leído visible para el remitente. Mismo patrón try/catch +
// {ok,error,data} que el resto de los servicios del proyecto.

export async function getDirectorioPersonas(excludePersonaId) {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("persona_id, nombre, rol_organizacional")
      .eq("activo", true)
      .not("persona_id", "is", null)
      .order("nombre", { ascending: true });
    if (error) {
      console.error("Error al cargar directorio de personas:", error);
      return [];
    }
    return (data || []).filter((u) => Number(u.persona_id) !== Number(excludePersonaId));
  } catch (err) {
    console.error("Error inesperado al cargar directorio de personas:", err);
    return [];
  }
}

// Todos los mensajes donde la persona participa (como remitente o
// destinatario), para armar la lista de conversaciones agrupando en el
// cliente — el volumen de mensajes internos es bajo, no justifica una vista
// SQL aparte.
export async function getMensajesDePersona(personaId) {
  if (!personaId) return [];
  try {
    const { data, error } = await supabase
      .from("mensajes_internos")
      .select("*")
      .or(`remitente_persona_id.eq.${personaId},destinatario_persona_id.eq.${personaId}`)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error al cargar mensajes internos:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar mensajes internos:", err);
    return [];
  }
}

export async function enviarMensaje({ remitentePersonaId, remitenteNombre, destinatarioPersonaId, destinatarioNombre, mensaje }) {
  try {
    const texto = String(mensaje || "").trim();
    if (!texto) return { ok: false, error: "Mensaje vacío", data: null };
    const { data, error } = await supabase
      .from("mensajes_internos")
      .insert({
        remitente_persona_id: remitentePersonaId,
        remitente_nombre: remitenteNombre || null,
        destinatario_persona_id: destinatarioPersonaId,
        destinatario_nombre: destinatarioNombre || null,
        mensaje: texto,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al enviar mensaje interno:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function marcarMensajeLeido(mensajeId) {
  try {
    const { error } = await supabase
      .from("mensajes_internos")
      .update({ leido: true, leido_at: new Date().toISOString() })
      .eq("id", mensajeId);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al marcar leído el mensaje interno:", err);
    return { ok: false, error: err };
  }
}

export async function marcarConversacionLeida(personaId, otraPersonaId) {
  try {
    const { error } = await supabase
      .from("mensajes_internos")
      .update({ leido: true, leido_at: new Date().toISOString() })
      .eq("destinatario_persona_id", personaId)
      .eq("remitente_persona_id", otraPersonaId)
      .eq("leido", false);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al marcar leída la conversación:", err);
    return { ok: false, error: err };
  }
}
