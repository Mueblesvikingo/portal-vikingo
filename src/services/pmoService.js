import { supabase } from "./supabase";

// La PM (Jacqueline Serrano) es una sola persona, no un rol compartido por
// varias — igual patrón que COORDINADOR_SIG_PERSONA_ID en auditoriasService.js.
// Se usa para avisarle cuando una acción de mejora se convierte en proyecto
// o asignación, ya que es ella quien le da seguimiento desde aquí.
export const PM_PERSONA_ID = 12;

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

const TRACKED_FIELDS = ["etapa", "avance_porcentaje", "semaforo", "proximo_hito", "fecha_hito", "decision_requerida"];

// `cerrado` filtra entre el tablero activo (default) y el histórico de
// proyectos ya cerrados — misma idea que el toggle de historial en
// Balance de Carga → Asignaciones.
export async function getProyectos(cerrado = false) {
  try {
    const { data, error } = await supabase
      .from("pmo_proyectos")
      .select("*, lider_proyecto:personas(id,nombre)")
      .eq("activo", true)
      .eq("cerrado", cerrado)
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

export async function closeProyecto(proyectoId, { actor } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("pmo_proyectos")
      .update({ cerrado: true, cerrado_at: new Date().toISOString(), updated_by_persona_id: personaId, updated_by_nombre: nombre })
      .eq("id", proyectoId)
      .select("*, lider_proyecto:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al cerrar proyecto del tablero PMO:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function reopenProyecto(proyectoId, { actor } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("pmo_proyectos")
      .update({ cerrado: false, cerrado_at: null, updated_by_persona_id: personaId, updated_by_nombre: nombre })
      .eq("id", proyectoId)
      .select("*, lider_proyecto:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al reabrir proyecto del tablero PMO:", err);
    return { ok: false, error: err, data: null };
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

export async function createProyecto({ nombre, orden, asignacionId, liderProyectoPersonaId }, { actor } = {}) {
  try {
    const { personaId, nombre: actorNombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("pmo_proyectos")
      .insert({
        nombre,
        orden,
        asignacion_id: asignacionId || null,
        lider_proyecto_persona_id: liderProyectoPersonaId || null,
        updated_by_persona_id: personaId,
        updated_by_nombre: actorNombre,
      })
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

// Para quien envía el recordatorio (la PM/equipo estratégico): historial
// completo por proyecto, vistos y sin ver, para saber si el líder ya lo leyó
// y cuándo — getPendingRecordatorios solo trae lo no visto y del lado del
// destinatario, esto es la vista del remitente.
export async function getRecordatoriosByProyecto(proyectoId) {
  if (!proyectoId) return [];
  try {
    const { data, error } = await supabase
      .from("pmo_recordatorios")
      .select("*, destinatario:personas(nombre)")
      .eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error("Error al cargar historial de recordatorios del tablero PMO:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial de recordatorios del tablero PMO:", err);
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
