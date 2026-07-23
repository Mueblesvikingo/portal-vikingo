import { supabase } from "./supabase";

function cleanPayload(payload) {
  const cleaned = { ...payload };

  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });

  return cleaned;
}

export async function getOrganigramaNodos() {
  try {
    const { data, error } = await supabase
      .from("organigrama_nodos")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar organigrama_nodos:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar organigrama_nodos:", err);
    return [];
  }
}

export async function createNodo(payload) {
  try {
    const { data, error } = await supabase
      .from("organigrama_nodos")
      .insert([
        cleanPayload({
          titulo_puesto: payload.titulo_puesto,
          nombre_persona: payload.nombre_persona || null,
          persona_id: payload.persona_id || null,
          nivel: payload.nivel,
          reporta_a_id: payload.reporta_a_id || null,
          tipo_linea: payload.tipo_linea || "solida",
          orden: payload.orden ?? 0,
          perfil_puesto: payload.perfil_puesto || null,
          activo: payload.activo ?? true,
        }),
      ])
      .select()
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function updateNodo(id, payload) {
  try {
    const { data, error } = await supabase
      .from("organigrama_nodos")
      .update(
        cleanPayload({
          titulo_puesto: payload.titulo_puesto,
          nombre_persona: payload.nombre_persona,
          persona_id: payload.persona_id,
          nivel: payload.nivel,
          tipo_linea: payload.tipo_linea,
          perfil_puesto: payload.perfil_puesto,
          activo: payload.activo,
          updated_at: new Date().toISOString(),
        })
      )
      .eq("id", id)
      .select()
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Arrastrar un nodo sobre otro (cambia de jefe) o entre hermanos (reordena).
// nuevoJefeId puede ser null para convertirlo en raíz.
export async function reparentNodo(id, nuevoJefeId, nuevoOrden) {
  try {
    const { data, error } = await supabase
      .from("organigrama_nodos")
      .update({
        reporta_a_id: nuevoJefeId,
        orden: nuevoOrden,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function reorderSiblings(updates) {
  try {
    const results = await Promise.all(
      updates.map(({ id, orden }) =>
        supabase.from("organigrama_nodos").update({ orden, updated_at: new Date().toISOString() }).eq("id", id)
      )
    );
    const failed = results.find((result) => result.error);
    if (failed) return { ok: false, error: failed.error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function deactivateNodo(id) {
  try {
    const { error } = await supabase
      .from("organigrama_nodos")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}
