import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

const TRACKED_FIELDS = ["etapa", "avance_porcentaje", "semaforo", "proximo_hito", "fecha_hito", "decision_requerida"];

export async function getProyectos() {
  try {
    const { data, error } = await supabase
      .from("pmo_proyectos")
      .select("*, lider_proyecto:personas(id,nombre)")
      .eq("activo", true)
      .order("orden");
    if (error) {
      console.error("Error al cargar proyectos del tablero PMO:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar proyectos del tablero PMO:", err);
    return [];
  }
}

// Actualiza solo los campos que vengan en `changes` y registra en el
// historial únicamente los que realmente cambiaron respecto a `previous` —
// mismo criterio que upsertEstado en sigService.js.
export async function updateProyecto(proyectoId, changes, { actor, previous } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("pmo_proyectos")
      .update({ ...changes, updated_at: new Date().toISOString(), updated_by_persona_id: personaId, updated_by_nombre: nombre })
      .eq("id", proyectoId)
      .select("*, lider_proyecto:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };

    const historialEntries = TRACKED_FIELDS
      .filter((field) => field in changes && previous && String(previous[field] ?? "") !== String(changes[field] ?? ""))
      .map((field) => ({
        proyecto_id: proyectoId,
        campo: field,
        valor_anterior: previous[field] != null ? String(previous[field]) : null,
        valor_nuevo: changes[field] != null ? String(changes[field]) : null,
        persona_id: personaId,
        nombre,
      }));
    if (historialEntries.length > 0) {
      const { error: histError } = await supabase.from("pmo_proyectos_historial").insert(historialEntries);
      if (histError) console.error("Error al guardar historial del tablero PMO:", histError);
    }

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar proyecto del tablero PMO:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function createProyecto({ nombre, orden }, { actor } = {}) {
  try {
    const { personaId, nombre: actorNombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("pmo_proyectos")
      .insert({ nombre, orden, updated_by_persona_id: personaId, updated_by_nombre: actorNombre })
      .select("*, lider_proyecto:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear proyecto del tablero PMO:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getProyectosHistorial(proyectoId) {
  try {
    let query = supabase.from("pmo_proyectos_historial").select("*").order("created_at", { ascending: false });
    if (proyectoId) query = query.eq("proyecto_id", proyectoId);
    const { data, error } = await query.limit(200);
    if (error) {
      console.error("Error al cargar historial del tablero PMO:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial del tablero PMO:", err);
    return [];
  }
}

export async function createRecordatorio({ proyectoId, destinatarioPersonaId, mensaje }, { actor } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("pmo_recordatorios")
      .insert({
        proyecto_id: proyectoId,
        destinatario_persona_id: destinatarioPersonaId,
        mensaje,
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear recordatorio del tablero PMO:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getPendingRecordatorios(personaId) {
  if (!personaId) return [];
  try {
    const { data, error } = await supabase
      .from("pmo_recordatorios")
      .select("*, proyecto:pmo_proyectos(nombre)")
      .eq("destinatario_persona_id", personaId)
      .eq("visto", false)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error al cargar recordatorios del tablero PMO:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar recordatorios del tablero PMO:", err);
    return [];
  }
}

export async function markRecordatorioVisto(recordatorioId) {
  try {
    const { error } = await supabase
      .from("pmo_recordatorios")
      .update({ visto: true, visto_at: new Date().toISOString() })
      .eq("id", recordatorioId);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al marcar visto el recordatorio del tablero PMO:", err);
    return { ok: false, error: err };
  }
}
