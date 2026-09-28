import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

// Beatriz Ruiz Carreón (persona_id 11) es la Gerente de Calidad — una sola
// persona, no un rol compartido por varias — mismo patrón que
// COORDINADOR_SIG_PERSONA_ID / PM_PERSONA_ID en auditoriasService.js/pmoService.js.
export const GERENTE_CALIDAD_PERSONA_ID = 11;
export const GERENTE_CALIDAD_NOMBRE = "Ruiz Carreón Beatriz";

export async function getPersonasActivas() {
  try {
    const { data, error } = await supabase.from("personas").select("id, nombre").eq("activo", true).order("nombre");
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer personas:", err);
    return { ok: false, error: err, data: [] };
  }
}

// Plan de muestreo interno Vikingo (Ac/Re por tamaño de lote, hasta 50 piezas
// por OP) — misma tabla del PDF compartido, para sugerir Muestra/Ac/Re
// automáticamente y que la inspectora no tenga que consultarlo a mano. Ac/Re
// aplica a no conformidades MENORES; 1 Mayor o Crítica siempre se contiene y
// se amplía a inspección al 100% (eso lo decide la inspectora, no es un
// número de esta tabla).
export const PLAN_MUESTREO = [
  { lote: "1", max: 1, muestra: 1, ac: 0, re: 1 },
  { lote: "2", max: 2, muestra: 2, ac: 0, re: 1 },
  { lote: "3 - 5", max: 5, muestra: 2, ac: 0, re: 1 },
  { lote: "6 - 10", max: 10, muestra: 3, ac: 0, re: 1 },
  { lote: "11 - 15", max: 15, muestra: 4, ac: 1, re: 2 },
  { lote: "16 - 20", max: 20, muestra: 5, ac: 1, re: 2 },
  { lote: "21 - 30", max: 30, muestra: 6, ac: 1, re: 2 },
  { lote: "31 - 40", max: 40, muestra: 8, ac: 2, re: 3 },
  { lote: "41 - 50", max: 50, muestra: 10, ac: 2, re: 3 },
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

// Planta 3: el mismo formato tiene DOS juegos de puntos de control distintos
// según el proceso elegido (Corte y pegado de hule espuma = A-H; Tapicería /
// Empaque = A-I, mismo juego repetido para ambos) — a diferencia de MP/
// Planta 1/2 donde el juego de puntos es único. Trae TODOS los puntos de la
// planta sin filtrar por proceso; el panel filtra en el cliente según el
// proceso que la inspectora vaya seleccionando en el formulario.
export async function getPuntosControlPorProceso(planta) {
  try {
    const { data, error } = await supabase
      .from("calidad_puntos_control")
      .select("*")
      .eq("planta", planta)
      .eq("activo", true)
      .order("proceso")
      .order("orden");
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer puntos de control por proceso:", err);
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

// Registro único autosuficiente — recepción/inspección + cierre/firmas en un
// solo paso, a diferencia del modelo antiguo de arriba (recorrido con varias
// inspecciones bajo un cierre único). Se usa en Materia Prima y Planta 1:
// puede haber varias entregas/OPs el mismo día, cada una su propio registro,
// identificado por fecha + persona + hora, sin folio consecutivo.
const FOLIO_PREFIJO = { "Materia Prima": "MP", "Planta 1": "P1", "Planta 2": "P2", "Planta 3": "P3" };

export async function crearInspeccionUnica({ planta, fecha, jornada, inspeccion, puntos, cierre }, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const prefijo = FOLIO_PREFIJO[planta] || planta.replace(/\s+/g, "").slice(0, 4).toUpperCase();
    const folio = `${prefijo}-${fecha.replace(/-/g, "")}-${(inspeccion.hora || "").replace(":", "")}`;
    const { data: recorrido, error: recorridoError } = await supabase
      .from("calidad_recorridos")
      .insert({
        planta,
        folio,
        fecha,
        jornada: jornada || "07:00–17:00",
        inspectora_persona_id: personaId,
        inspectora_nombre: nombre,
        dictamen: cierre.dictamen,
        observacion_general: cierre.observacion_general || null,
        firma_inspectora: nombre,
        // Supervisor de área y Gerente de Calidad ya NO se capturan como
        // texto libre al crear el registro: aquí solo se asigna QUIÉN debe
        // firmar (persona_id) — la firma real (nombre + fecha) se guarda
        // después, cuando esa persona entra y presiona "Firmar" (ver
        // firmarComoResponsableArea / firmarComoGerenteCalidad).
        responsable_area_persona_id: cierre.responsable_area_persona_id || null,
        gerente_calidad_persona_id: GERENTE_CALIDAD_PERSONA_ID,
        cerrado_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (recorridoError) return { ok: false, error: recorridoError, data: null };

    const { data: insp, error: inspError } = await supabase
      .from("calidad_inspecciones")
      .insert({
        recorrido_id: recorrido.id,
        hora: inspeccion.hora || null,
        proceso: inspeccion.proceso || null,
        op: inspeccion.op || null,
        producto_texto: inspeccion.producto_texto || null,
        terminacion: inspeccion.terminacion || null,
        linea_operador: inspeccion.linea_operador || null,
        proveedor: inspeccion.proveedor || null,
        oc_lote: inspeccion.oc_lote || null,
        lote_identificacion: inspeccion.lote_identificacion || null,
        cantidad: inspeccion.cantidad || null,
        muestra: inspeccion.muestra || null,
        resultado: inspeccion.resultado || null,
        clasificacion: inspeccion.clasificacion || null,
        observacion: inspeccion.observacion || null,
        accion_reinspeccion: inspeccion.accion_reinspeccion || null,
        // Propios de Inspección y Liberación de Producto Terminado (F-GC-05)
        // — nulos para el resto de los formatos.
        modelo: inspeccion.modelo || null,
        cliente_destino: inspeccion.cliente_destino || null,
        ac: inspeccion.ac || null,
        re: inspeccion.re || null,
        nc_menor: inspeccion.nc_menor || null,
        nc_mayor_critico: inspeccion.nc_mayor_critico || null,
        resultado_reinspeccion: inspeccion.resultado_reinspeccion || null,
        hora_liberacion: inspeccion.hora_liberacion || null,
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
      })
      .select("*")
      .single();
    if (inspError) {
      // El recorrido quedaría huérfano (sin inspección) si esto falla — se
      // revierte para no dejar un registro a medias.
      await supabase.from("calidad_recorridos").delete().eq("id", recorrido.id);
      return { ok: false, error: inspError, data: null };
    }

    if (puntos?.length) {
      const rows = puntos.filter((p) => p.valor).map((p) => ({ inspeccion_id: insp.id, punto_control_id: p.punto_control_id, valor: p.valor }));
      if (rows.length) {
        const { error: puntosError } = await supabase.from("calidad_inspeccion_puntos").insert(rows);
        if (puntosError) console.error("Error al guardar puntos de control:", puntosError);
      }
    }

    return { ok: true, error: null, data: { ...recorrido, calidad_inspecciones: [insp] } };
  } catch (err) {
    console.error("Error inesperado al crear inspección:", err);
    return { ok: false, error: err, data: null };
  }
}

// Firmas reales — el servidor vuelve a validar quién puede firmar cada rol
// (nunca confía en lo que mande el cliente), igual que
// firmarFichaComoAuditado en auditoriasService.js.
export async function firmarComoResponsableArea(recorridoId, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data: recorrido, error: findErr } = await supabase
      .from("calidad_recorridos")
      .select("responsable_area_persona_id")
      .eq("id", recorridoId)
      .maybeSingle();
    if (findErr) return { ok: false, error: findErr, data: null };
    if (!recorrido || Number(recorrido.responsable_area_persona_id) !== personaId) {
      return { ok: false, error: "Solo el supervisor de área asignado a este registro puede firmar aquí.", data: null };
    }
    const { data, error } = await supabase
      .from("calidad_recorridos")
      .update({ responsable_area_nombre: nombre, responsable_area_firmado_at: new Date().toISOString() })
      .eq("id", recorridoId)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al firmar como supervisor de área:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function firmarComoGerenteCalidad(recorridoId, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    if (personaId !== GERENTE_CALIDAD_PERSONA_ID) {
      return { ok: false, error: "Solo la Gerente de Calidad puede firmar aquí.", data: null };
    }
    const { data, error } = await supabase
      .from("calidad_recorridos")
      .update({ gerente_calidad_nombre: nombre, gerente_calidad_firmado_at: new Date().toISOString() })
      .eq("id", recorridoId)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al firmar como Gerente de Calidad:", err);
    return { ok: false, error: err, data: null };
  }
}

// Recordatorios de firma pendiente — mismo esquema y flujo que
// pmo_recordatorios/createRecordatorio (pmoService.js): se muestran en la
// misma campanita de notificaciones (NotificationBell.jsx).
export async function createCalidadRecordatorio({ recorridoId, destinatarioPersonaId, mensaje }, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("calidad_recordatorios")
      .insert({ recorrido_id: recorridoId, destinatario_persona_id: destinatarioPersonaId, mensaje, created_by_persona_id: personaId, created_by_nombre: nombre })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear recordatorio de calidad:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getPendingCalidadRecordatorios(personaId) {
  try {
    const { data, error } = await supabase
      .from("calidad_recordatorios")
      .select("*, calidad_recorridos(fecha, planta, folio)")
      .eq("destinatario_persona_id", personaId)
      .eq("visto", false)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer recordatorios de calidad:", err);
    return { ok: false, error: err, data: [] };
  }
}

export async function markCalidadRecordatorioVisto(id) {
  try {
    const { error } = await supabase.from("calidad_recordatorios").update({ visto: true, visto_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al marcar recordatorio de calidad como visto:", err);
    return { ok: false, error: err };
  }
}

// Lista de registros ya combinados (un recorrido = una inspección, con sus
// puntos de control y evidencias embebidas) para la vista de lista/detalle
// de una sola pieza.
export async function getInspeccionesUnica(planta, { desde, hasta } = {}) {
  try {
    let query = supabase
      .from("calidad_recorridos")
      .select("*, calidad_inspecciones(*, calidad_inspeccion_puntos(*), calidad_evidencias(*))")
      .eq("planta", planta)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);
    const { data, error } = await query;
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer inspecciones:", err);
    return { ok: false, error: err, data: [] };
  }
}

// Wrappers de Materia Prima — conservan la firma original para no tocar
// MateriaPrimaPanel.jsx; mismo comportamiento de siempre (folio "MP-...").
export async function crearInspeccionMP({ fecha, jornada, inspeccion, puntos, cierre }, actor) {
  return crearInspeccionUnica({ planta: "Materia Prima", fecha, jornada, inspeccion, puntos, cierre }, actor);
}
export async function getInspeccionesMP({ desde, hasta } = {}) {
  return getInspeccionesUnica("Materia Prima", { desde, hasta });
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
