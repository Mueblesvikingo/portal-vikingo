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
    const { error } = await supabase.from("desempeno_operativo_historial").insert(entries);
    if (error) console.error("Error al guardar historial de desempeño operativo:", error);
  } catch (err) {
    console.error("Error inesperado al guardar historial de desempeño operativo:", err);
  }
}

export const AREAS_OPERATIVAS = ["Corte y costura de tela", "Carpintería y armado de madera", "Tapicería"];

// TableroTab/ResultadosTab/ProcesoChartsTab (compartidos con Desempeño
// Organizacional) agrupan por `kpi.ambito === "operativo"` cuando el
// tablero no es Estratégico — aquí todos los KPIs son de ese tipo, así que
// se estampa en memoria al leer (no existe la columna en esta tabla, no
// hace falta: es el mismo valor fijo para las 3 áreas).
function withAmbito(row) {
  return { ...row, ambito: "operativo" };
}

export async function getKpis() {
  try {
    const { data, error } = await supabase
      .from("desempeno_operativo_kpis")
      .select("*")
      .order("area", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar KPIs de desempeño operativo:", error);
      return [];
    }
    return (data || []).map(withAmbito);
  } catch (err) {
    console.error("Error inesperado al cargar KPIs de desempeño operativo:", err);
    return [];
  }
}

export async function getResultados({ anio } = {}) {
  try {
    let query = supabase.from("desempeno_operativo_resultados").select("*");
    if (anio) query = query.eq("anio", anio);

    const { data, error } = await query;
    if (error) {
      console.error("Error al cargar resultados de desempeño operativo:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar resultados de desempeño operativo:", err);
    return [];
  }
}

export async function createKpi(payload, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("desempeno_operativo_kpis")
      .insert({
        area: payload.area,
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
        updated_by_persona_id: personaId,
        updated_by_nombre: nombre,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };

    await logHistorialEntries([{
      kpi_id: data.id,
      tipo_registro: "kpi",
      referencia: "creado",
      valor_anterior: null,
      valor_nuevo: data.nombre_indicador,
      persona_id: personaId,
      usuario_nombre: nombre,
    }]);

    return { ok: true, error: null, data: withAmbito(data) };
  } catch (err) {
    console.error("Error inesperado al crear KPI operativo:", err);
    return { ok: false, error: err, data: null };
  }
}

// `previous` (el KPI tal como estaba antes del cambio, ya disponible en el
// estado de React del llamador) permite registrar en el historial solo los
// campos que realmente cambiaron, con su valor anterior y nuevo.
export async function updateKpi(id, updates, { actor, previous } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("desempeno_operativo_kpis")
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
          kpi_id: id,
          tipo_registro: "kpi",
          referencia: field,
          valor_anterior: previous[field] != null ? String(previous[field]) : null,
          valor_nuevo: updates[field] != null ? String(updates[field]) : null,
          persona_id: personaId,
          usuario_nombre: nombre,
        }));
      await logHistorialEntries(entries);
    }

    return { ok: true, error: null, data: withAmbito(data) };
  } catch (err) {
    console.error("Error inesperado al actualizar KPI operativo:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function deactivateKpi(id, options) {
  return updateKpi(id, { activo: false }, options);
}

export async function activateKpi(id, options) {
  return updateKpi(id, { activo: true }, options);
}

// Borrado definitivo (no "desactivar"): se usa cuando el usuario pide quitar
// un KPI por completo, no solo ocultarlo. Los resultados e historial de ese
// KPI se van con él por el `on delete cascade` de las tablas relacionadas.
export async function deleteKpi(id) {
  try {
    const { error } = await supabase.from("desempeno_operativo_kpis").delete().eq("id", id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al eliminar KPI operativo:", err);
    return { ok: false, error: err };
  }
}

// `previousValor` es el valor actual de esa celda (kpi_id, anio, mes,
// semana, tipo) antes de este guardado, para poder registrar el cambio en
// el historial. `semana` (1-5) solo aplica a KPIs de captura semanal.
export async function upsertResultado({ kpiId, anio, mes, semana = null, tipo, valor }, { actor, previousValor } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("desempeno_operativo_resultados")
      .upsert(
        {
          kpi_id: kpiId,
          anio,
          mes,
          semana,
          tipo,
          valor,
          updated_at: new Date().toISOString(),
          updated_by_persona_id: personaId,
          updated_by_nombre: nombre,
        },
        { onConflict: "kpi_id,anio,mes,semana,tipo" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };

    if (String(previousValor ?? "") !== String(valor ?? "")) {
      await logHistorialEntries([{
        kpi_id: kpiId,
        tipo_registro: "resultado",
        referencia: semana ? `${anio}-${mes}-s${semana}-${tipo}` : `${anio}-${mes}-${tipo}`,
        valor_anterior: previousValor != null ? String(previousValor) : null,
        valor_nuevo: valor != null ? String(valor) : null,
        persona_id: personaId,
        usuario_nombre: nombre,
      }]);
    }

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar resultado de desempeño operativo:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function getHistorialByKpiIds(kpiIds) {
  if (!kpiIds?.length) return [];
  try {
    const { data, error } = await supabase
      .from("desempeno_operativo_historial")
      .select("*")
      .in("kpi_id", kpiIds)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Error al cargar historial de desempeño operativo:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial de desempeño operativo:", err);
    return [];
  }
}
