import { supabase } from "./supabase";

export async function getObjetivos() {
  try {
    const { data, error } = await supabase
      .from("despliegue_objetivos")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar objetivos estratégicos:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar objetivos estratégicos:", err);
    return [];
  }
}

export async function getKpisTacticos() {
  try {
    const { data, error } = await supabase
      .from("despliegue_kpis_tacticos")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar KPIs tácticos:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar KPIs tácticos:", err);
    return [];
  }
}

export async function createObjetivo(payload) {
  try {
    const { data, error } = await supabase
      .from("despliegue_objetivos")
      .insert({
        codigo: payload.codigo,
        titulo: payload.titulo || "Nuevo objetivo",
        perspectiva: payload.perspectiva || "Financiera",
        responsable: payload.responsable || "",
        riesgo: payload.riesgo || "",
        proposito: payload.proposito || "",
        estado_estrategico: payload.estado_estrategico || "Sin atención",
        orden: payload.orden ?? 999,
        activo: true,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear objetivo estratégico:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function updateObjetivo(id, updates) {
  try {
    const { data, error } = await supabase
      .from("despliegue_objetivos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar objetivo estratégico:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function deactivateObjetivo(id) {
  return updateObjetivo(id, { activo: false });
}

export async function createKpiTactico(payload) {
  try {
    const { data, error } = await supabase
      .from("despliegue_kpis_tacticos")
      .insert({
        objetivo_id: payload.objetivoId,
        proceso: payload.proceso || "Todos los procesos",
        kpi: payload.kpi || "Nuevo KPI táctico",
        meta: payload.meta || "",
        impacto: payload.impacto || "",
        responsable: payload.responsable || "",
        estrategico: payload.estrategico ?? payload.proceso === "Todos los procesos",
        orden: payload.orden ?? 999,
        activo: true,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear KPI táctico:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function updateKpiTactico(id, updates) {
  try {
    const { data, error } = await supabase
      .from("despliegue_kpis_tacticos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar KPI táctico:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function deactivateKpiTactico(id) {
  return updateKpiTactico(id, { activo: false });
}
