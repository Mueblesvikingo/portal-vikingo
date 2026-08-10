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
