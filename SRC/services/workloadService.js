import { supabase } from "./supabase";

export async function getWorkloadActivities() {
  try {
    const { data, error } = await supabase
      .from("proceso_actividades")
      .select("*")
      .order("orden_flujo", { ascending: true });

    if (error) {
      console.error("Error al cargar actividades:", error);
      return [];
    }

    console.log("=== DATOS RECIBIDOS DESDE SUPABASE ===");
    console.log(data);

    return data || [];
  } catch (err) {
    console.error("Error inesperado:", err);
    return [];
  }
}

export async function getWorkloadPeople() {
  try {
    const { data, error } = await supabase
      .from("personas")
      .select("id,nombre")
      .eq("activo", true)
      .eq("tipo", "persona")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error al cargar personas:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar personas:", err);
    return [];
  }
}

export async function getWorkloadPersonRoles() {
  try {
    const { data, error } = await supabase
      .from("persona_roles")
      .select("id,persona_id,proceso,rol,activo")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error al cargar roles por persona:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar roles por persona:", err);
    return [];
  }
}

export async function getWorkloadWeeklyPlans() {
  try {
    const { data, error } = await supabase
      .from("workload_plan_semanal_detalle")
      .select("*")
      .order("orden", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error al cargar plan semanal:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar plan semanal:", err);
    return [];
  }
}

export async function getWorkloadMonthlyPlans() {
  try {
    const { data, error } = await supabase
      .from("workload_plan_mensual")
      .select("*")
      .order("orden", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error al cargar plan mensual:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar plan mensual:", err);
    return [];
  }
}

export async function scheduleActivityInWeeklyPlan({ personaId, activityId, dayName, plannedHours }) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from("workload_plan_semanal_detalle")
      .select("id")
      .eq("persona_id", personaId)
      .eq("actividad_id", activityId)
      .eq("dia_semana", dayName)
      .eq("activo", true)
      .limit(1);

    if (existingError) {
      console.error("Error al validar plan semanal:", existingError);
      return null;
    }

    if (existing?.length > 0) return existing[0];

    const { data: currentGroup } = await supabase
      .from("workload_plan_semanal_detalle")
      .select("orden")
      .eq("persona_id", personaId)
      .eq("dia_semana", dayName)
      .eq("activo", true)
      .order("orden", { ascending: false, nullsFirst: false })
      .limit(1);
    const nextOrder = Number(currentGroup?.[0]?.orden || 0) + 1;

    const { data, error } = await supabase
      .from("workload_plan_semanal_detalle")
      .insert({
        persona_id: personaId,
        actividad_id: activityId,
        dia_semana: dayName,
        orden: nextOrder,
        horas_planificadas: plannedHours,
        activo: true,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error al programar actividad semanal:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error inesperado al programar actividad semanal:", err);
    return null;
  }
}

export async function scheduleActivityInMonthlyPlan({ personaId, activityId, weekNumber, plannedHours }) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from("workload_plan_mensual")
      .select("id")
      .eq("persona_id", personaId)
      .eq("actividad_id", activityId)
      .eq("semana_mes", weekNumber)
      .eq("activo", true)
      .limit(1);

    if (existingError) {
      console.error("Error al validar plan mensual:", existingError);
      return { ok: false, error: existingError, data: null };
    }

    if (existing?.length > 0) return { ok: true, data: existing, error: null, duplicated: true };

    const { data: currentGroup } = await supabase
      .from("workload_plan_mensual")
      .select("orden")
      .eq("persona_id", personaId)
      .eq("semana_mes", weekNumber)
      .eq("activo", true)
      .order("orden", { ascending: false, nullsFirst: false })
      .limit(1);
    const nextOrder = Number(currentGroup?.[0]?.orden || 0) + 1;

    const payloadMensual = {
      persona_id: personaId,
      actividad_id: activityId,
      semana_mes: weekNumber,
      posicion_mes: `Semana ${weekNumber}`,
      orden: nextOrder,
      horas_planificadas: plannedHours,
      activo: true,
    };

    console.log("PAYLOAD MENSUAL", payloadMensual);

    const { data, error } = await supabase
      .from("workload_plan_mensual")
      .insert(payloadMensual)
      .select();

    console.log("DATA MENSUAL", data);
    console.log("ERROR MENSUAL", error);

    if (error) {
      console.error("Error al programar actividad mensual:", error);
      return { ok: false, error, data: null };
    }

    return { ok: true, data, error: null };
  } catch (err) {
    console.error("Error inesperado al programar actividad mensual:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function updateWeeklyPlanOrder(updates) {
  try {
    const results = await Promise.all(
      updates
        .filter((item) => item?.id)
        .map((item) => supabase
          .from("workload_plan_semanal_detalle")
          .update({ orden: item.orden })
          .eq("id", item.id)
          .select("id,orden")
        )
    );
    const error = results.find((result) => result.error)?.error;
    if (error) return { ok: false, error };
    return { ok: true, data: results.flatMap((result) => result.data || []) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function updateMonthlyPlanOrder(updates) {
  try {
    const results = await Promise.all(
      updates
        .filter((item) => item?.id)
        .map((item) => supabase
          .from("workload_plan_mensual")
          .update({ orden: item.orden })
          .eq("id", item.id)
          .select("id,orden")
        )
    );
    const error = results.find((result) => result.error)?.error;
    if (error) return { ok: false, error };
    return { ok: true, data: results.flatMap((result) => result.data || []) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function moveWeeklyPlanActivity({ planId, personaId, activityId, dayName, orden }) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from("workload_plan_semanal_detalle")
      .select("id")
      .eq("persona_id", personaId)
      .eq("actividad_id", activityId)
      .eq("dia_semana", dayName)
      .eq("activo", true)
      .neq("id", planId)
      .limit(1);

    if (existingError) return { ok: false, error: existingError };
    if (existing?.length > 0) return { ok: false, duplicated: true };

    const { data, error } = await supabase
      .from("workload_plan_semanal_detalle")
      .update({ dia_semana: dayName, ...(Number.isFinite(Number(orden)) ? { orden: Number(orden) } : {}) })
      .eq("id", planId)
      .select("*");

    if (error) return { ok: false, error };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function removeWeeklyPlanActivity(planId) {
  try {
    const { data, error } = await supabase
      .from("workload_plan_semanal_detalle")
      .update({ activo: false })
      .eq("id", planId)
      .select("*");

    if (error) return { ok: false, error };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function moveMonthlyPlanActivity({ planId, personaId, activityId, weekNumber, orden }) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from("workload_plan_mensual")
      .select("id")
      .eq("persona_id", personaId)
      .eq("actividad_id", activityId)
      .eq("semana_mes", weekNumber)
      .eq("activo", true)
      .neq("id", planId)
      .limit(1);

    if (existingError) return { ok: false, error: existingError };
    if (existing?.length > 0) return { ok: false, duplicated: true };

    const { data, error } = await supabase
      .from("workload_plan_mensual")
      .update({ semana_mes: weekNumber, posicion_mes: `Semana ${weekNumber}`, ...(Number.isFinite(Number(orden)) ? { orden: Number(orden) } : {}) })
      .eq("id", planId)
      .select("*");

    if (error) return { ok: false, error };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function removeMonthlyPlanActivity(planId) {
  try {
    const { data, error } = await supabase
      .from("workload_plan_mensual")
      .update({ activo: false })
      .eq("id", planId)
      .select("*");

    if (error) return { ok: false, error };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}
