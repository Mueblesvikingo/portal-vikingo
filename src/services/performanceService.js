import { supabase } from "./supabase";

export async function getKpis() {
  try {
    const { data, error } = await supabase
      .from("desempeno_kpis")
      .select("*")
      .eq("activo", true)
      .order("ambito", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar KPIs de desempeño:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar KPIs de desempeño:", err);
    return [];
  }
}

export async function getResultados({ anio } = {}) {
  try {
    let query = supabase.from("desempeno_resultados").select("*");
    if (anio) query = query.eq("anio", anio);

    const { data, error } = await query;
    if (error) {
      console.error("Error al cargar resultados de desempeño:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar resultados de desempeño:", err);
    return [];
  }
}

export async function createKpi(payload) {
  try {
    const { data, error } = await supabase
      .from("desempeno_kpis")
      .insert({
        ambito: payload.ambito || "estrategico",
        macroproceso: payload.macroproceso || null,
        perspectiva: payload.perspectiva || null,
        objetivo_estrategico: payload.objetivo_estrategico || "",
        nombre_indicador: payload.nombre_indicador || "Nuevo KPI",
        formula_texto: payload.formula_texto || "",
        fuente_datos: payload.fuente_datos || "",
        periodicidad: payload.periodicidad || "Mensual",
        unidad_medida: payload.unidad_medida || "numero",
        responsable_rol: payload.responsable_rol || "",
        tipo_grafico: payload.tipo_grafico || "barra",
        orden: payload.orden ?? 999,
        activo: true,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear KPI:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function updateKpi(id, updates) {
  try {
    const { data, error } = await supabase
      .from("desempeno_kpis")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar KPI:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function deactivateKpi(id) {
  return updateKpi(id, { activo: false });
}

export async function upsertResultado({ kpiId, anio, mes, tipo, valor }) {
  try {
    const { data, error } = await supabase
      .from("desempeno_resultados")
      .upsert(
        {
          kpi_id: kpiId,
          anio,
          mes,
          tipo,
          valor,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "kpi_id,anio,mes,tipo" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar resultado de desempeño:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getMacroprocesos() {
  try {
    const { data, error } = await supabase
      .from("procesos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error al cargar macroprocesos:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar macroprocesos:", err);
    return [];
  }
}

// Macroproceso(s) donde esta persona es "Líder de proceso" — usado para
// decidir el filtro por defecto al abrir el módulo para un usuario que no es
// equipo estratégico, y para saber si puede editar un tablero táctico.
export async function getPersonaMacroprocesosLiderProceso(personaId) {
  try {
    const { data, error } = await supabase
      .from("persona_roles")
      .select("proceso")
      .eq("persona_id", String(personaId))
      .eq("activo", true)
      .or("rol.eq.Líder de proceso,rol.eq.Lider de proceso");

    if (error) {
      console.error("Error al cargar macroprocesos de Líder de proceso:", error);
      return [];
    }
    return [...new Set((data || []).map((row) => row.proceso).filter(Boolean))];
  } catch (err) {
    console.error("Error inesperado al cargar macroprocesos de Líder de proceso:", err);
    return [];
  }
}
