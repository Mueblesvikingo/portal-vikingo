import { supabase } from "./supabase";

export async function getCompetenciasDiccionario() {
  try {
    const { data, error } = await supabase
      .from("competencias_diccionario")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar diccionario de competencias:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar diccionario de competencias:", err);
    return [];
  }
}

export async function getCompetenciaById(id) {
  try {
    const { data, error } = await supabase
      .from("competencias_diccionario")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error al cargar la competencia:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error inesperado al cargar la competencia:", err);
    return null;
  }
}

// Todas las relaciones puesto-competencia de una sola vez (evita N+1 al
// pintar el organigrama completo) — agrupar por nodo_id queda del lado del llamador.
export async function getAllNodoCompetencias() {
  try {
    const { data, error } = await supabase
      .from("organigrama_nodo_competencias")
      .select("nodo_id, competencia_id");

    if (error) {
      console.error("Error al cargar competencias por puesto:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar competencias por puesto:", err);
    return [];
  }
}

// Reemplaza por completo el set de competencias asignadas a un puesto
// (borra lo que ya no está seleccionado, inserta lo nuevo).
export async function setNodoCompetencias(nodoId, competenciaIds) {
  try {
    const { error: deleteError } = await supabase
      .from("organigrama_nodo_competencias")
      .delete()
      .eq("nodo_id", nodoId);

    if (deleteError) return { ok: false, error: deleteError };

    if (competenciaIds.length > 0) {
      const { error: insertError } = await supabase
        .from("organigrama_nodo_competencias")
        .insert(competenciaIds.map((competencia_id) => ({ nodo_id: nodoId, competencia_id })));

      if (insertError) return { ok: false, error: insertError };
    }

    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Alta/baja puntual de una sola competencia en un puesto — usado por el
// checkbox del selector, sin tener que reenviar todo el set cada vez.
export async function addNodoCompetencia(nodoId, competenciaId) {
  try {
    const { error } = await supabase
      .from("organigrama_nodo_competencias")
      .insert({ nodo_id: nodoId, competencia_id: competenciaId });

    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function removeNodoCompetencia(nodoId, competenciaId) {
  try {
    const { error } = await supabase
      .from("organigrama_nodo_competencias")
      .delete()
      .eq("nodo_id", nodoId)
      .eq("competencia_id", competenciaId);

    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Avance de TODAS las personas en todas las competencias (para el organigrama
// completo) — agrupar por persona_id queda del lado del llamador.
export async function getAllSeguimiento() {
  try {
    const { data, error } = await supabase
      .from("persona_competencia_seguimiento")
      .select("*");

    if (error) {
      console.error("Error al cargar seguimiento de competencias:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar seguimiento de competencias:", err);
    return [];
  }
}

export async function getSeguimientoByPersona(personaId, competenciaId) {
  try {
    const { data, error } = await supabase
      .from("persona_competencia_seguimiento")
      .select("*")
      .eq("persona_id", personaId)
      .eq("competencia_id", competenciaId)
      .maybeSingle();

    if (error) {
      console.error("Error al cargar seguimiento de la persona:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error inesperado al cargar seguimiento de la persona:", err);
    return null;
  }
}

export async function upsertSeguimientoNivel(personaId, competenciaId, nivel, actor) {
  try {
    const { data, error } = await supabase
      .from("persona_competencia_seguimiento")
      .upsert(
        {
          persona_id: personaId,
          competencia_id: competenciaId,
          nivel_actual: nivel,
          updated_at: new Date().toISOString(),
          updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
          updated_by_nombre: actor?.nombre || actor?.usuario || null,
        },
        { onConflict: "persona_id,competencia_id" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}
