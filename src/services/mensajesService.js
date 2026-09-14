import { supabase } from "./supabase";

// Mensajería interna entre personas del portal — conversación 1 a 1, con
// check de leído visible para el remitente. Mismo patrón try/catch +
// {ok,error,data} que el resto de los servicios del proyecto.

export async function getDirectorioPersonas(excludePersonaId) {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("persona_id, nombre, rol_organizacional, ultima_actividad")
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

export async function enviarMensaje({ remitentePersonaId, remitenteNombre, destinatarioPersonaId, destinatarioNombre, mensaje, adjuntoUrl, adjuntoNombre, adjuntoTipo }) {
  try {
    const texto = String(mensaje || "").trim();
    if (!texto && !adjuntoUrl) return { ok: false, error: "Mensaje vacío", data: null };
    const { data, error } = await supabase
      .from("mensajes_internos")
      .insert({
        remitente_persona_id: remitentePersonaId,
        remitente_nombre: remitenteNombre || null,
        destinatario_persona_id: destinatarioPersonaId,
        destinatario_nombre: destinatarioNombre || null,
        mensaje: texto,
        adjunto_url: adjuntoUrl || null,
        adjunto_nombre: adjuntoNombre || null,
        adjunto_tipo: adjuntoTipo || null,
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

// Imágenes, capturas de pantalla y archivos adjuntos al chat interno — mismo
// criterio de bucket público ya usado por las minutas (buildPdfDoc) en
// minutasService.js. Límite de 8MB en el cliente: la llave anon del proyecto
// es permisiva (mismo patrón que el resto de las tablas), así que se acota
// el tamaño de subida en vez de dejarlo abierto.
const MAX_ADJUNTO_BYTES = 8 * 1024 * 1024;

export async function subirAdjuntoMensaje(file, personaId) {
  try {
    if (!file) return { ok: false, error: "Sin archivo", url: null };
    if (file.size > MAX_ADJUNTO_BYTES) {
      return { ok: false, error: "El archivo supera el límite de 8MB.", url: null };
    }
    const nombreLimpio = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${personaId}-${Date.now()}-${nombreLimpio}`;
    const { error: uploadErr } = await supabase.storage
      .from("mensajes-adjuntos")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (uploadErr) {
      console.error("Error al subir adjunto de mensaje:", uploadErr);
      return { ok: false, error: uploadErr, url: null };
    }
    const { data } = supabase.storage.from("mensajes-adjuntos").getPublicUrl(path);
    return { ok: true, error: null, url: data?.publicUrl || null };
  } catch (err) {
    console.error("Error inesperado al subir adjunto de mensaje:", err);
    return { ok: false, error: err, url: null };
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
