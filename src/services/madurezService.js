import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

const TRACKED_FIELDS = [
  "nombre", "lider_persona_id", "nivel",
  "bpmn", "caracterizacion", "documentacion", "validacion",
  "implementacion", "digitalizacion", "evaluacion", "optimizacion",
];

export async function getProcesos() {
  try {
    const { data, error } = await supabase
      .from("madurez_procesos")
      .select("*, lider:personas(id,nombre)")
      .eq("activo", true)
      .order("orden");
    if (error) {
      console.error("Error al cargar procesos de madurez organizacional:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar procesos de madurez organizacional:", err);
    return [];
  }
}

// Actualiza solo los campos que vengan en `changes` y registra en el
// historial únicamente los que realmente cambiaron — mismo criterio que
// updateProyecto en pmoService.js.
export async function updateProceso(procesoId, changes, { actor, previous } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("madurez_procesos")
      .update({ ...changes, updated_at: new Date().toISOString(), updated_by_persona_id: personaId, updated_by_nombre: nombre })
      .eq("id", procesoId)
      .select("*, lider:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };

    const historialEntries = TRACKED_FIELDS
      .filter((field) => field in changes && previous && String(previous[field] ?? "") !== String(changes[field] ?? ""))
      .map((field) => ({
        proceso_id: procesoId,
        campo: field,
        valor_anterior: previous[field] != null ? String(previous[field]) : null,
        valor_nuevo: changes[field] != null ? String(changes[field]) : null,
        persona_id: personaId,
        nombre,
      }));
    if (historialEntries.length > 0) {
      const { error: histError } = await supabase.from("madurez_procesos_historial").insert(historialEntries);
      if (histError) console.error("Error al guardar historial de madurez organizacional:", histError);
    }

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar proceso de madurez organizacional:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getHistorial(procesoId) {
  try {
    let query = supabase.from("madurez_procesos_historial").select("*").order("created_at", { ascending: false });
    if (procesoId) query = query.eq("proceso_id", procesoId);
    const { data, error } = await query.limit(200);
    if (error) {
      console.error("Error al cargar historial de madurez organizacional:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial de madurez organizacional:", err);
    return [];
  }
}
