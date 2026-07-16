import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

async function logHistorialEntries(entries) {
  if (!entries?.length) return;
  try {
    const { error } = await supabase.from("accion_historial").insert(entries);
    if (error) console.error("Error al guardar historial de acción:", error);
  } catch (err) {
    console.error("Error inesperado al guardar historial de acción:", err);
  }
}

async function generateCodigo() {
  const year = new Date().getFullYear();
  const prefix = `ACC-${year}-`;
  const { data, error } = await supabase.from("acciones").select("codigo").ilike("codigo", `${prefix}%`);
  if (error) console.error("Error al generar código de acción:", error);
  const maxNum = (data || []).reduce((max, row) => {
    const match = row.codigo?.match(/-(\d+)$/);
    const num = match ? Number(match[1]) : 0;
    return Math.max(max, num);
  }, 0);
  return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
}

export async function getTiposFlujo() {
  try {
    const { data, error } = await supabase.from("accion_tipo_flujo").select("*");
    if (error) {
      console.error("Error al cargar tipos de flujo de acciones:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar tipos de flujo de acciones:", err);
    return [];
  }
}

export async function getAcciones() {
  try {
    const { data, error } = await supabase
      .from("acciones")
      .select("*")
      .eq("activo", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar acciones:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar acciones:", err);
    return [];
  }
}

export async function createAccion(payload, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const codigo = await generateCodigo();
    const { data, error } = await supabase
      .from("acciones")
      .insert({
        codigo,
        tipo: payload.tipo,
        nivel: payload.nivel || "Operativa",
        origen_modulo: payload.origenModulo || "Manual",
        origen_tabla: payload.origenTabla || null,
        origen_id: payload.origenId || null,
        titulo: payload.titulo || "Nueva acción",
        descripcion: payload.descripcion || "",
        proceso_id: payload.procesoId || null,
        subproceso_id: payload.subprocesoId || null,
        objetivo_id: payload.objetivoId || null,
        responsable_persona_id: payload.responsablePersonaId || null,
        prioridad: payload.prioridad || "Media",
        estado: payload.estado || "Registrada",
        fecha_compromiso: payload.fechaCompromiso || null,
        requiere_analisis_causa: payload.requiereAnalisisCausa ?? false,
        requiere_verificacion_eficacia: payload.requiereVerificacionEficacia ?? false,
        requiere_aprobacion: payload.requiereAprobacion ?? false,
        enlace_ejecucion_texto: payload.enlaceEjecucionTexto || null,
        enlace_ejecucion_url: payload.enlaceEjecucionUrl || null,
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
        updated_by_persona_id: personaId,
        updated_by_nombre: nombre,
        activo: true,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };

    await logHistorialEntries([{
      accion_id: data.id,
      campo: "creado",
      valor_anterior: null,
      valor_nuevo: `${data.tipo} · ${data.titulo}`,
      persona_id: personaId,
      usuario_nombre: nombre,
    }]);

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear acción:", err);
    return { ok: false, error: err, data: null };
  }
}

// `previous` (la acción tal como estaba antes, ya disponible en el estado
// de React del llamador) permite registrar en accion_historial solo los
// campos que realmente cambiaron — mismo patrón que performanceService.js.
export async function updateAccion(id, updates, { actor, previous } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("acciones")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: personaId,
        updated_by_nombre: nombre,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };

    if (previous) {
      const entries = Object.keys(updates)
        .filter((field) => String(previous[field] ?? "") !== String(updates[field] ?? ""))
        .map((field) => ({
          accion_id: id,
          campo: field,
          valor_anterior: previous[field] != null ? String(previous[field]) : null,
          valor_nuevo: updates[field] != null ? String(updates[field]) : null,
          persona_id: personaId,
          usuario_nombre: nombre,
        }));
      await logHistorialEntries(entries);
    }

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar acción:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function deactivateAccion(id, options) {
  return updateAccion(id, { activo: false }, options);
}

export async function getAnalisisCausa(accionId) {
  try {
    const { data, error } = await supabase
      .from("accion_analisis_causa")
      .select("*")
      .eq("accion_id", accionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error al cargar análisis de causa:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar análisis de causa:", err);
    return [];
  }
}

export async function upsertAnalisisCausa({ accionId, herramienta, contenido, conclusionCausaRaiz }, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("accion_analisis_causa")
      .upsert(
        {
          accion_id: accionId,
          herramienta,
          contenido: contenido || {},
          conclusion_causa_raiz: conclusionCausaRaiz || null,
          created_by_persona_id: personaId,
          created_by_nombre: nombre,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "accion_id,herramienta" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar análisis de causa:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getHistorial(accionId) {
  try {
    const { data, error } = await supabase
      .from("accion_historial")
      .select("*")
      .eq("accion_id", accionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar historial de acción:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial de acción:", err);
    return [];
  }
}

export async function getComentarios(accionId) {
  try {
    const { data, error } = await supabase
      .from("accion_comentarios")
      .select("*")
      .eq("accion_id", accionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error al cargar comentarios de acción:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar comentarios de acción:", err);
    return [];
  }
}

export async function addComentario({ accionId, comentario }, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("accion_comentarios")
      .insert({ accion_id: accionId, comentario, persona_id: personaId, usuario_nombre: nombre })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar comentario de acción:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getAdjuntos(accionId) {
  try {
    const { data, error } = await supabase
      .from("accion_adjuntos")
      .select("*")
      .eq("accion_id", accionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error al cargar adjuntos de acción:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar adjuntos de acción:", err);
    return [];
  }
}

export async function addAdjunto({ accionId, nombreArchivo, url, tipo }, actor) {
  try {
    const { personaId } = actorFields(actor);
    const { data, error } = await supabase
      .from("accion_adjuntos")
      .insert({ accion_id: accionId, nombre_archivo: nombreArchivo, url, tipo: tipo || "evidencia", persona_id: personaId })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar adjunto de acción:", err);
    return { ok: false, error: err, data: null };
  }
}
