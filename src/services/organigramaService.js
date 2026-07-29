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
          puesto_id: payload.puesto_id || null,
          nivel: payload.nivel,
          reporta_a_id: payload.reporta_a_id || null,
          tipo_linea: payload.tipo_linea || "solida",
          orden: payload.orden ?? 0,
          perfil_puesto: payload.perfil_puesto || null,
          objetivo_puesto: payload.objetivo_puesto || null,
          competencias_clave: payload.competencias_clave || null,
          competencias_tecnicas: payload.competencias_tecnicas || null,
          responsabilidades_clave: payload.responsabilidades_clave || null,
          pos_x: payload.pos_x ?? null,
          pos_y: payload.pos_y ?? null,
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
          puesto_id: payload.puesto_id,
          nivel: payload.nivel,
          reporta_a_id: payload.reporta_a_id,
          tipo_linea: payload.tipo_linea,
          perfil_puesto: payload.perfil_puesto,
          objetivo_puesto: payload.objetivo_puesto,
          competencias_clave: payload.competencias_clave,
          competencias_tecnicas: payload.competencias_tecnicas,
          responsabilidades_clave: payload.responsabilidades_clave,
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

// Deshacer/rehacer: restaura TODOS los campos de cada puesto que estaba en
// el snapshot (incluida posición y jefe) y desactiva cualquier puesto que
// exista ahora pero no estuviera en el snapshot (deshace una creación).
export async function restoreNodosSnapshot(snapshotNodos, currentNodos) {
  try {
    const snapshotIds = new Set(snapshotNodos.map((n) => n.id));
    const currentIds = new Set(currentNodos.map((n) => n.id));

    const restores = snapshotNodos.map((n) =>
      supabase
        .from("organigrama_nodos")
        .update({
          titulo_puesto: n.titulo_puesto,
          nombre_persona: n.nombre_persona,
          persona_id: n.persona_id,
          puesto_id: n.puesto_id,
          nivel: n.nivel,
          reporta_a_id: n.reporta_a_id,
          tipo_linea: n.tipo_linea,
          perfil_puesto: n.perfil_puesto,
          objetivo_puesto: n.objetivo_puesto,
          competencias_clave: n.competencias_clave,
          competencias_tecnicas: n.competencias_tecnicas,
          responsabilidades_clave: n.responsabilidades_clave,
          pos_x: n.pos_x,
          pos_y: n.pos_y,
          activo: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", n.id)
    );

    const removals = [...currentIds]
      .filter((id) => !snapshotIds.has(id))
      .map((id) =>
        supabase
          .from("organigrama_nodos")
          .update({ activo: false, updated_at: new Date().toISOString() })
          .eq("id", id)
      );

    const results = await Promise.all([...restores, ...removals]);
    const failed = results.find((result) => result.error);
    if (failed) return { ok: false, error: failed.error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Posición manual al arrastrar un puesto: se queda exactamente donde lo
// sueltes (no reasigna jefe ni reordena nada más).
export async function updateNodoPosition(id, posX, posY) {
  try {
    const { data, error } = await supabase
      .from("organigrama_nodos")
      .update({ pos_x: posX, pos_y: posY, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Conexiones adicionales entre dos puestos que NO son de jefe-subordinado
// (ej. apoyo, coordinación) — se dibujan aparte de la línea de mando, sin
// afectar el árbol jerárquico ni el acomodo automático.
export async function getConexiones() {
  try {
    const { data, error } = await supabase.from("organigrama_conexiones").select("*");
    if (error) {
      console.error("Error al cargar organigrama_conexiones:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar organigrama_conexiones:", err);
    return [];
  }
}

export async function createConexion(nodoAId, nodoBId, tipo = "apoyo") {
  try {
    const { data, error } = await supabase
      .from("organigrama_conexiones")
      .insert([{ nodo_a_id: nodoAId, nodo_b_id: nodoBId, tipo }])
      .select()
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function deleteConexion(id) {
  try {
    const { error } = await supabase.from("organigrama_conexiones").delete().eq("id", id);
    if (error) return { ok: false, error };
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
