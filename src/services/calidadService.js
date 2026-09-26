import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

// Plan de muestreo interno Vikingo (Ac/Re por tamaño de lote, hasta 50 piezas
// por OP) — misma tabla del PDF compartido, para sugerir Muestra/Ac/Re
// automáticamente y que la inspectora no tenga que consultarlo a mano. Ac/Re
// aplica a no conformidades MENORES; 1 Mayor o Crítica siempre se contiene y
// se amplía a inspección al 100% (eso lo decide la inspectora, no es un
// número de esta tabla).
const PLAN_MUESTREO = [
  { max: 1, muestra: 1, ac: 0, re: 1 },
  { max: 2, muestra: 2, ac: 0, re: 1 },
  { max: 5, muestra: 2, ac: 0, re: 1 },
  { max: 10, muestra: 3, ac: 0, re: 1 },
  { max: 15, muestra: 4, ac: 1, re: 2 },
  { max: 20, muestra: 5, ac: 1, re: 2 },
  { max: 30, muestra: 6, ac: 1, re: 2 },
  { max: 40, muestra: 8, ac: 2, re: 3 },
  { max: 50, muestra: 10, ac: 2, re: 3 },
];

export function sugerirMuestreo(cantidadLote) {
  const cant = Number(cantidadLote);
  if (!cant || cant <= 0) return null;
  const fila = PLAN_MUESTREO.find((f) => cant <= f.max);
  if (!fila) return null; // fuera del plan (>50): la inspectora decide la muestra a criterio
  return { muestra: fila.muestra, ac: fila.ac, re: fila.re };
}

export async function getPuntosControl(planta, proceso = null) {
  try {
    let query = supabase.from("calidad_puntos_control").select("*").eq("planta", planta).eq("activo", true).order("orden");
    query = proceso ? query.eq("proceso", proceso) : query.is("proceso", null);
    const { data, error } = await query;
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer puntos de control:", err);
    return { ok: false, error: err, data: [] };
  }
}

export async function getRecorridos(planta, { desde, hasta } = {}) {
  try {
    let query = supabase.from("calidad_recorridos").select("*").eq("planta", planta).order("fecha", { ascending: false }).order("created_at", { ascending: false });
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);
    const { data, error } = await query;
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer recorridos de calidad:", err);
    return { ok: false, error: err, data: [] };
  }
}

export async function createRecorrido(planta, payload, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const folio = payload.folio || `${planta === "Materia Prima" ? "MP" : planta.replace(/\s+/g, "")}-${(payload.fecha || new Date().toISOString().slice(0, 10)).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
    const { data, error } = await supabase
      .from("calidad_recorridos")
      .insert({
        planta,
        folio,
        fecha: payload.fecha,
        jornada: payload.jornada || "07:00–17:00",
        inspectora_persona_id: personaId,
        inspectora_nombre: nombre,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear recorrido de calidad:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function cerrarRecorrido(id, payload, actor) {
  try {
    const { nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("calidad_recorridos")
      .update({
        dictamen: payload.dictamen,
        observacion_general: payload.observacion_general || null,
        firma_inspectora: payload.firma_inspectora || nombre,
        responsable_area_nombre: payload.responsable_area_nombre || null,
        cerrado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al cerrar recorrido de calidad:", err);
    return { ok: false, error: err, data: null };
  }
}

// Borrado definitivo de un recorrido completo: las inspecciones y sus puntos
// de control se van solos por el `on delete cascade` de las tablas, pero las
// FOTOS de evidencia viven en Supabase Storage (no en una tabla) — el
// cascade nunca las tocaría y quedarían huérfanas, así que se borran aquí
// explícitamente antes de borrar el recorrido.
export async function deleteRecorrido(id) {
  try {
    const { data: inspecciones } = await supabase.from("calidad_inspecciones").select("id").eq("recorrido_id", id);
    const inspeccionIds = (inspecciones || []).map((i) => i.id);
    if (inspeccionIds.length) {
      const { data: evidencias } = await supabase.from("calidad_evidencias").select("path").in("inspeccion_id", inspeccionIds);
      const paths = (evidencias || []).map((e) => e.path).filter(Boolean);
      if (paths.length) await supabase.storage.from("calidad-evidencias").remove(paths);
    }
    const { error } = await supabase.from("calidad_recorridos").delete().eq("id", id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al eliminar recorrido de calidad:", err);
    return { ok: false, error: err };
  }
}

export async function getInspecciones(recorridoId) {
  try {
    const { data, error } = await supabase
      .from("calidad_inspecciones")
      .select("*, calidad_inspeccion_puntos(*), calidad_evidencias(*)")
      .eq("recorrido_id", recorridoId)
      .order("created_at");
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer inspecciones:", err);
    return { ok: false, error: err, data: [] };
  }
}

// `puntos` = [{ punto_control_id, valor }]. Se inserta la inspección y luego
// sus puntos en un segundo paso — más simple que una función RPC para el
// volumen de datos que maneja este módulo.
export async function createInspeccion(recorridoId, payload, puntos, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("calidad_inspecciones")
      .insert({
        recorrido_id: recorridoId,
        hora: payload.hora || null,
        proceso: payload.proceso || null,
        op: payload.op || null,
        producto_texto: payload.producto_texto || null,
        terminacion: payload.terminacion || null,
        linea_operador: payload.linea_operador || null,
        proveedor: payload.proveedor || null,
        oc_lote: payload.oc_lote || null,
        lote_identificacion: payload.lote_identificacion || null,
        cantidad: payload.cantidad || null,
        muestra: payload.muestra || null,
        resultado: payload.resultado || null,
        clasificacion: payload.clasificacion || null,
        observacion: payload.observacion || null,
        accion_reinspeccion: payload.accion_reinspeccion || null,
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };

    if (puntos?.length) {
      const rows = puntos.filter((p) => p.valor).map((p) => ({ inspeccion_id: data.id, punto_control_id: p.punto_control_id, valor: p.valor }));
      if (rows.length) {
        const { error: puntosError } = await supabase.from("calidad_inspeccion_puntos").insert(rows);
        if (puntosError) console.error("Error al guardar puntos de control:", puntosError);
      }
    }
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear inspección:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function deleteInspeccion(id) {
  try {
    const { error } = await supabase.from("calidad_inspecciones").delete().eq("id", id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al eliminar inspección:", err);
    return { ok: false, error: err };
  }
}

export async function subirEvidencia(inspeccionId, blob, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const path = `${inspeccionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: uploadErr } = await supabase.storage.from("calidad-evidencias").upload(path, blob, { contentType: "image/jpeg" });
    if (uploadErr) return { ok: false, error: uploadErr, data: null };
    const { data: pub } = supabase.storage.from("calidad-evidencias").getPublicUrl(path);
    const { data, error } = await supabase
      .from("calidad_evidencias")
      .insert({ inspeccion_id: inspeccionId, url: pub.publicUrl, path, persona_id: personaId, persona_nombre: nombre })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al subir evidencia:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function eliminarEvidencia(evidencia) {
  try {
    await supabase.storage.from("calidad-evidencias").remove([evidencia.path]);
    const { error } = await supabase.from("calidad_evidencias").delete().eq("id", evidencia.id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al eliminar evidencia:", err);
    return { ok: false, error: err };
  }
}
