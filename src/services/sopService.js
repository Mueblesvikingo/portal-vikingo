import { supabase } from "./supabase";

export async function getProductos() {
  try {
    const { data, error } = await supabase
      .from("sop_productos")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar productos S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar productos S&OP:", err);
    return [];
  }
}

export async function getControl() {
  try {
    const { data, error } = await supabase
      .from("sop_control")
      .select("*")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error al cargar control S&OP:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error inesperado al cargar control S&OP:", err);
    return null;
  }
}

export async function updateControl(id, payload) {
  try {
    const { data, error } = await supabase
      .from("sop_control")
      .update({ ...payload, fecha_actualizacion: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function getParametros() {
  try {
    const { data, error } = await supabase
      .from("sop_parametros")
      .select("*")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error al cargar parámetros S&OP:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error inesperado al cargar parámetros S&OP:", err);
    return null;
  }
}

export async function updateParametros(id, payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_parametros")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Trae TODO el plan de venta de una vez (ambos escenarios, todos los meses
// capturados) — el filtrado por horizonte/escenario se hace del lado del
// cliente para evitar N llamadas al cambiar de mes o escenario activo.
export async function getPlanVenta() {
  try {
    const { data, error } = await supabase.from("sop_plan_venta").select("*");

    if (error) {
      console.error("Error al cargar plan de venta S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar plan de venta S&OP:", err);
    return [];
  }
}

export async function upsertPlanVenta(productoId, escenario, anio, mes, piezas, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_plan_venta")
      .upsert(
        {
          producto_id: productoId,
          escenario,
          anio,
          mes,
          piezas,
          updated_at: new Date().toISOString(),
          updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
          updated_by_nombre: actor?.nombre || actor?.usuario || null,
        },
        { onConflict: "producto_id,escenario,anio,mes" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function getDecisiones() {
  try {
    const { data, error } = await supabase
      .from("sop_decisiones")
      .select("*")
      .order("mes_reunion", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("Error al cargar decisiones S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar decisiones S&OP:", err);
    return [];
  }
}

export async function createDecision(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_decisiones")
      .insert({
        mes_reunion: payload.mes_reunion,
        decision: payload.decision,
        opcion_elegida: payload.opcion_elegida || null,
        responsable: payload.responsable || null,
        fecha: payload.fecha || null,
        created_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        created_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function deleteDecision(id) {
  try {
    const { error } = await supabase.from("sop_decisiones").delete().eq("id", id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function getHistorico() {
  try {
    const { data, error } = await supabase
      .from("sop_historico")
      .select("*")
      .order("mes", { ascending: true });

    if (error) {
      console.error("Error al cargar histórico S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar histórico S&OP:", err);
    return [];
  }
}

// Cierra el mes activo: archiva su resumen en el histórico (append-only) y
// avanza el control al mes siguiente — equivalente a la macro CerrarMesSOP
// del Excel, sin el truco de ocultar columnas (aquí el horizonte es solo
// una consulta por rango de fechas).
export async function closeCurrentMonth({ control, resumenMes, ventaReal, actor }) {
  try {
    const diferencia = Number(ventaReal || 0) - Number(resumenMes.ventaPlaneada || 0);

    const { error: histError } = await supabase.from("sop_historico").insert({
      mes: resumenMes.mes,
      escenario: resumenMes.escenario,
      venta_planeada: resumenMes.ventaPlaneada,
      venta_real: ventaReal,
      diferencia,
      produccion_piezas: resumenMes.produccionPiezas,
      capacidad_piezas: resumenMes.capacidadPiezas,
      utilizacion: resumenMes.utilizacion,
      margen_bruto_pct: resumenMes.margenBrutoPct,
      utilidad_operativa: resumenMes.utilidadOperativa,
      responsable: actor?.nombre || actor?.usuario || null,
    });

    if (histError) return { ok: false, error: histError };

    const nextMonth = new Date(`${resumenMes.mes}T00:00:00`);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMesActivo = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: controlData, error: controlError } = await supabase
      .from("sop_control")
      .update({
        ultimo_mes_cerrado: resumenMes.mes,
        mes_activo: nextMesActivo,
        fecha_actualizacion: new Date().toISOString(),
        usuario_responsable_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        usuario_responsable_nombre: actor?.nombre || actor?.usuario || null,
      })
      .eq("id", control.id)
      .select("*")
      .single();

    if (controlError) return { ok: false, error: controlError };

    return { ok: true, error: null, data: controlData };
  } catch (err) {
    return { ok: false, error: err };
  }
}
