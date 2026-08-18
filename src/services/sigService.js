import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

export async function getEstados() {
  try {
    const { data, error } = await supabase.from("sig_diagnostico_estados").select("*");
    if (error) {
      console.error("Error al cargar estados del diagnóstico SIG:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar estados del diagnóstico SIG:", err);
    return [];
  }
}

// Score y evidencia son independientes por (subtitulo, numero, proceso):
// un criterio transversal ("Todos") lo ven varios procesos, pero cada uno
// captura su propio avance/evidencia, no comparten el mismo registro.
// Registra en el historial solo los campos que realmente cambiaron —
// misma lógica que updateKpi en performanceService.js.
export async function upsertEstado({ subtitulo, numero, numeral, proceso, score, evidencia }, { actor, previous } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_diagnostico_estados")
      .upsert(
        {
          subtitulo,
          numero,
          numeral,
          proceso,
          score,
          evidencia,
          updated_at: new Date().toISOString(),
          updated_by_persona_id: personaId,
          updated_by_nombre: nombre,
        },
        { onConflict: "subtitulo,numero,proceso" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };

    const historialEntries = [];
    if (previous?.score !== undefined && String(previous.score ?? "") !== String(score ?? "")) {
      historialEntries.push({
        subtitulo, numero, numeral, proceso, campo: "score",
        valor_anterior: previous.score != null ? String(previous.score) : null,
        valor_nuevo: score != null ? String(score) : null,
        persona_id: personaId, nombre,
      });
    }
    if (previous?.evidencia !== undefined && String(previous.evidencia ?? "") !== String(evidencia ?? "")) {
      historialEntries.push({
        subtitulo, numero, numeral, proceso, campo: "evidencia",
        valor_anterior: previous.evidencia || null,
        valor_nuevo: evidencia || null,
        persona_id: personaId, nombre,
      });
    }
    if (historialEntries.length > 0) {
      const { error: histError } = await supabase.from("sig_diagnostico_historial").insert(historialEntries);
      if (histError) console.error("Error al guardar historial de diagnóstico SIG:", histError);
    }

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar estado del diagnóstico SIG:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getHistorial({ subtitulo, numeral } = {}) {
  try {
    let query = supabase.from("sig_diagnostico_historial").select("*").order("created_at", { ascending: false });
    if (subtitulo) query = query.eq("subtitulo", subtitulo);
    if (numeral) query = query.eq("numeral", numeral);
    const { data, error } = await query.limit(200);
    if (error) {
      console.error("Error al cargar historial del diagnóstico SIG:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial del diagnóstico SIG:", err);
    return [];
  }
}

export async function getChecks(proceso) {
  try {
    let query = supabase.from("sig_diagnostico_checks").select("*").order("checked_at", { ascending: false });
    if (proceso) query = query.eq("proceso", proceso);
    const { data, error } = await query.limit(100);
    if (error) {
      console.error("Error al cargar checks del diagnóstico SIG:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar checks del diagnóstico SIG:", err);
    return [];
  }
}

export async function getAllChecks() {
  try {
    const { data, error } = await supabase.from("sig_diagnostico_checks").select("*").order("checked_at", { ascending: false }).limit(500);
    if (error) {
      console.error("Error al cargar checks del diagnóstico SIG:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar checks del diagnóstico SIG:", err);
    return [];
  }
}

export async function createCheck(proceso, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_diagnostico_checks")
      .insert({ proceso, checked_by_persona_id: personaId, checked_by_nombre: nombre })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al registrar check del diagnóstico SIG:", err);
    return { ok: false, error: err, data: null };
  }
}
