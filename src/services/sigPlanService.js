import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

// Devuelve macroprocesos con sus pendientes y responsables anidados, en
// orden de prioridad — misma forma que consume la UI del Plan de
// Implementación (11 macroprocesos, cada uno con 2-7 pendientes).
export async function getPlanMacroprocesos() {
  try {
    const [{ data: macroprocesos, error: mpError }, { data: pendientes, error: pError }, { data: responsables, error: rError }] = await Promise.all([
      supabase.from("sig_plan_macroprocesos").select("*").eq("activo", true).order("orden"),
      supabase.from("sig_plan_pendientes").select("*").order("orden"),
      supabase.from("sig_plan_responsables").select("*").order("orden"),
    ]);
    if (mpError || pError || rError) {
      console.error("Error al cargar plan de implementación SIG:", mpError || pError || rError);
      return [];
    }
    const responsablesPorPendiente = new Map();
    (responsables || []).forEach((r) => {
      if (!responsablesPorPendiente.has(r.pendiente_id)) responsablesPorPendiente.set(r.pendiente_id, []);
      responsablesPorPendiente.get(r.pendiente_id).push(r);
    });
    const pendientesPorMacro = new Map();
    (pendientes || []).forEach((p) => {
      if (!pendientesPorMacro.has(p.macroproceso_id)) pendientesPorMacro.set(p.macroproceso_id, []);
      pendientesPorMacro.get(p.macroproceso_id).push({ ...p, responsables: responsablesPorPendiente.get(p.id) || [] });
    });
    return (macroprocesos || []).map((mp) => ({ ...mp, pendientes: pendientesPorMacro.get(mp.id) || [] }));
  } catch (err) {
    console.error("Error inesperado al cargar plan de implementación SIG:", err);
    return [];
  }
}

export async function updatePendienteEstado(pendienteId, estado, { actor, previousEstado } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_plan_pendientes")
      .update({ estado, updated_at: new Date().toISOString(), updated_by_persona_id: personaId, updated_by_nombre: nombre })
      .eq("id", pendienteId)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };

    if (previousEstado !== undefined && String(previousEstado ?? "") !== String(estado ?? "")) {
      const { error: histError } = await supabase.from("sig_plan_historial").insert({
        pendiente_id: pendienteId,
        valor_anterior: previousEstado || null,
        valor_nuevo: estado || null,
        persona_id: personaId,
        nombre,
      });
      if (histError) console.error("Error al guardar historial del plan SIG:", histError);
    }

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar estado del plan SIG:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getPlanHistorial() {
  try {
    const { data, error } = await supabase.from("sig_plan_historial").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) {
      console.error("Error al cargar historial del plan SIG:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial del plan SIG:", err);
    return [];
  }
}
