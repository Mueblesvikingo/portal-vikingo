import { supabase } from "./supabase";

// Ventana semanal de alineación S&OP — capa temporal mientras el ciclo
// mensual madura: da visibilidad real de la semana siguiente por pestaña,
// para la junta de alineación de cada martes. Una sola tabla para las 5
// pestañas (dashboard/plan-venta/operacion/financiero/decisiones): `datos`
// guarda los campos propios de cada una en jsonb, evitando 5 tablas casi
// idénticas para un registro que es, en el fondo, siempre lo mismo
// (pestaña + semana + qué se espera + quién responde).

export async function getVentana(pestana, semanaLunes) {
  try {
    const { data, error } = await supabase
      .from("sop_ventana_semanal")
      .select("*")
      .eq("pestana", pestana)
      .eq("semana_lunes", semanaLunes)
      .maybeSingle();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error al cargar ventana semanal S&OP:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function upsertVentana({ pestana, semanaLunes, datos }, { actor } = {}) {
  try {
    const { data, error } = await supabase
      .from("sop_ventana_semanal")
      .upsert(
        {
          pestana,
          semana_lunes: semanaLunes,
          datos,
          creado_por_persona_id: actor?.persona_id || null,
          creado_por_nombre: actor?.nombre || actor?.usuario || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "pestana,semana_lunes" }
      )
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error al guardar ventana semanal S&OP:", err);
    return { ok: false, error: err, data: null };
  }
}
