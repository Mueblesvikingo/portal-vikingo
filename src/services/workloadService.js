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

export async function updateWorkloadSourceActivity(activityId, payload) {
  const basePayload = Object.fromEntries(
    Object.entries({
      activa: payload.activa,
      estado: payload.estado,
      actividad: payload.actividad,
      duracion_minutos: payload.duracion_minutos,
      carga_horas: payload.carga_horas,
      frecuencia: payload.frecuencia,
      mes_planeado: payload.mes_planeado,
    }).filter(([, value]) => value !== undefined)
  );
  const payloadWithTimestamp = {
    ...basePayload,
    updated_at: new Date().toISOString(),
  };

  try {
    let result = await supabase
      .from("proceso_actividades")
      .update(payloadWithTimestamp)
      .eq("id", activityId)
      .select("*")
      .single();

    const shouldRetryWithoutUpdatedAt =
      result.error &&
      (String(result.error.message || "").toLowerCase().includes("updated_at") ||
        result.error.code === "PGRST204");

    if (shouldRetryWithoutUpdatedAt) {
      result = await supabase
        .from("proceso_actividades")
        .update(basePayload)
        .eq("id", activityId)
        .select("*")
        .single();
    }

    if (result.error) return { ok: false, error: result.error, data: null };
    return { ok: true, error: null, data: result.data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function createWorkloadSourceActivity(payload) {
  const activityPayload = {
    actividad: payload.actividad,
    descripcion: payload.descripcion || "",
    proceso: payload.proceso,
    responsable: payload.responsable || "",
    puesto: payload.puesto || payload.rol || "",
    rol: payload.rol || payload.puesto || "",
    duracion_minutos: payload.duracion_minutos,
    frecuencia: payload.frecuencia || "Manual",
    frecuencia_valor: payload.frecuencia_valor || 1,
    dia_tipico: payload.dia_tipico || "Lunes",
    orden_flujo: payload.orden_flujo,
    carga_horas: payload.carga_horas,
    estado: payload.estado || "Activa",
    activa: payload.activa ?? true,
  };

  try {
    const { data, error } = await supabase
      .from("proceso_actividades")
      .insert(activityPayload)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function getWorkloadPeople() {
  try {
    const { data, error } = await supabase
      .from("personas")
      .select(`
        id,
        nombre,
        puesto,
        activo,
        tipo,
        horas_lunes,
        horas_martes,
        horas_miercoles,
        horas_jueves,
        horas_viernes
      `)
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

// Duración personalizada por persona para actividades del rol transversal
// "Líder de proceso": la misma actividad aplica a todos los que tienen ese
// rol, pero cuánto les toma varía según el proceso que cada quien lidera.
// Guardar aquí evita tocar proceso_actividades (la fuente maestra que lee
// Diseño Organizacional) cada vez que alguien ajusta su propio tiempo.
export async function getLiderProcesoOverrides() {
  try {
    const { data, error } = await supabase
      .from("workload_lider_proceso_overrides")
      .select("*");

    if (error) {
      console.error("Error al cargar duraciones personalizadas de Líder de proceso:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar duraciones personalizadas de Líder de proceso:", err);
    return [];
  }
}

export async function upsertLiderProcesoOverride({ personaId, actividadId, duracionMinutos }) {
  try {
    const cargaHoras = Number((duracionMinutos / 60).toFixed(2));
    const { data, error } = await supabase
      .from("workload_lider_proceso_overrides")
      .upsert(
        {
          persona_id: personaId,
          actividad_id: actividadId,
          duracion_minutos: duracionMinutos,
          carga_horas: cargaHoras,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "persona_id,actividad_id" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar duración personalizada de Líder de proceso:", err);
    return { ok: false, error: err, data: null };
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

export async function getWorkloadAssignments() {
  try {
    const { data, error } = await supabase
      .from("workload_asignaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar asignaciones:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar asignaciones:", err);
    return [];
  }
}

export async function createWorkloadAssignment(payload) {
  try {
    const { data, error } = await supabase
      .from("workload_asignaciones")
      .insert({
        persona_id: payload.persona_id,
        responsable: payload.responsable,
        rol: payload.rol,
        tipo: payload.tipo,
        prioridad: payload.prioridad,
        gestion: payload.gestion,
        titulo: payload.titulo,
        revisara: payload.revisara,
        aprobara: payload.aprobara,
        seguimiento: payload.seguimiento,
        carga_horas: payload.carga_horas,
        duracion_minutos: payload.duracion_minutos,
        fecha_limite: payload.fecha_limite,
        estado: payload.estado || "Pendiente",
        asigna: payload.asigna,
        asigna_rol: payload.asigna_rol,
        activo: payload.activo ?? true,
        grupo_reunion: payload.grupo_reunion || null,
        nombre: payload.nombre || payload.titulo,
        descripcion: payload.descripcion || "",
        origen_estrategico: payload.origen_estrategico || null,
        horas_totales: payload.horas_totales ?? payload.carga_horas ?? 0,
        horas_programadas: payload.horas_programadas ?? 0,
        horas_ejecutadas: payload.horas_ejecutadas ?? 0,
        horas_pendientes: payload.horas_pendientes ?? payload.horas_totales ?? payload.carga_horas ?? 0,
        estado_proyecto: payload.estado_proyecto || "Pendiente",
        estado_programacion: payload.estado_programacion || "Sin programar",
        fecha_inicio: payload.fecha_inicio || null,
        url_externa: payload.url_externa || null,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function updateWorkloadAssignment(id, updates) {
  try {
    const { data, error } = await supabase
      .from("workload_asignaciones")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Backlog de asignaciones/proyectos: una asignación se crea con horas_totales
// y se va programando en Semana/Mes típico en varias llamadas parciales, sin
// que la asignación desaparezca del backlog. Cada llamada crea (o reutiliza)
// una única fila en proceso_actividades para esa asignación, y añade una fila
// de programación por semana/mes, marcada con asignacion_id para poder sumar
// horas_programadas por asignación en cualquier momento.
export async function recalculateAssignmentHours(assignmentId) {
  try {
    const { data: assignment, error: fetchError } = await supabase
      .from("workload_asignaciones")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (fetchError || !assignment) return { ok: false, error: fetchError, data: null };

    const [weeklyResult, monthlyResult] = await Promise.all([
      supabase
        .from("workload_plan_semanal_detalle")
        .select("horas_planificadas")
        .eq("asignacion_id", assignmentId)
        .eq("activo", true),
      supabase
        .from("workload_plan_mensual")
        .select("horas_planificadas")
        .eq("asignacion_id", assignmentId)
        .eq("activo", true),
    ]);

    if (weeklyResult.error) console.error("Error al sumar horas semanales de la asignación:", weeklyResult.error);
    if (monthlyResult.error) console.error("Error al sumar horas mensuales de la asignación:", monthlyResult.error);

    const horasProgramadas = [...(weeklyResult.data || []), ...(monthlyResult.data || [])]
      .reduce((sum, row) => sum + Number(row.horas_planificadas || 0), 0);

    const horasTotales = Number(assignment.horas_totales || assignment.carga_horas || 0);
    const horasEjecutadas = Number(assignment.horas_ejecutadas || 0);
    const horasPendientes = Math.max(0, horasTotales - horasProgramadas);

    let estadoProgramacion = "Sin programar";
    if (horasProgramadas > 0 && horasProgramadas < horasTotales) estadoProgramacion = "Programado parcialmente";
    if (horasTotales > 0 && horasProgramadas >= horasTotales) estadoProgramacion = "Totalmente programado";
    if (horasTotales > 0 && horasEjecutadas >= horasTotales) estadoProgramacion = "Completado";
    if (assignment.estado_proyecto === "En pausa") estadoProgramacion = "Programación suspendida";

    let estadoProyecto = assignment.estado_proyecto || "Pendiente";
    if (estadoProyecto === "Pendiente" && horasProgramadas > 0) estadoProyecto = "En ejecución";
    if (horasTotales > 0 && horasEjecutadas >= horasTotales) estadoProyecto = "Finalizado";

    const { data, error } = await supabase
      .from("workload_asignaciones")
      .update({
        horas_programadas: horasProgramadas,
        horas_pendientes: horasPendientes,
        estado_programacion: estadoProgramacion,
        estado_proyecto: estadoProyecto,
      })
      .eq("id", assignmentId)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al recalcular horas de la asignación:", err);
    return { ok: false, error: err, data: null };
  }
}

// Mapea el tipo de asignación al mismo marcador "X manual" que usan los
// bloques manuales de Semana/Mes típico, para que el bloque programado se
// vea con el color/etiqueta de origen correctos (Proyecto, Formación, etc.)
// en vez de caer en el "Proceso" por defecto.
function getAssignmentManualProcessLabel(tipo) {
  const normalized = String(tipo || "").toLowerCase();
  if (normalized.includes("formaci") || normalized.includes("capacit")) return "Formación manual";
  if (normalized.includes("reunion") || normalized.includes("reunión")) return "Reunión manual";
  return "Proyecto manual";
}

export async function programAssignmentHours({ assignmentId, personaId, type, hours, dayName, weekNumber, origen }) {
  try {
    const { data: assignment, error: fetchError } = await supabase
      .from("workload_asignaciones")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (fetchError || !assignment) return { ok: false, error: fetchError || new Error("Asignación no encontrada") };

    if (["En pausa", "Finalizado", "Cancelado"].includes(assignment.estado_proyecto)) {
      return { ok: false, error: new Error(`No se puede programar: el proyecto está ${assignment.estado_proyecto}.`) };
    }

    const horasTotales = Number(assignment.horas_totales || assignment.carga_horas || 0);
    const horasProgramadasActuales = Number(assignment.horas_programadas || 0);
    const horasPendientes = Math.max(0, horasTotales - horasProgramadasActuales);
    const horasAProgramar = Number(hours);

    if (!Number.isFinite(horasAProgramar) || horasAProgramar <= 0) {
      return { ok: false, error: new Error("Las horas a programar deben ser mayores a 0.") };
    }
    if (horasAProgramar > horasPendientes) {
      return { ok: false, error: new Error(`No puedes programar más de las horas pendientes (${horasPendientes} h).`) };
    }

    let activityId = assignment.proceso_actividad_id;

    if (!activityId) {
      const { data: activityData, error: activityError } = await supabase
        .from("proceso_actividades")
        .insert({
          actividad: assignment.nombre || assignment.titulo,
          descripcion: assignment.descripcion || "",
          proceso: getAssignmentManualProcessLabel(assignment.tipo),
          responsable: assignment.responsable || "",
          puesto: assignment.rol || "Líder de proceso",
          rol: assignment.rol || "Líder de proceso",
          duracion_minutos: Math.round(horasTotales * 60),
          frecuencia: "Manual",
          frecuencia_valor: 1,
          orden_flujo: Math.floor(Date.now() / 1000),
          carga_horas: horasTotales,
          estado: "Activa",
          activa: true,
        })
        .select("id")
        .single();

      if (activityError) return { ok: false, error: activityError };
      activityId = activityData.id;

      const { error: linkError } = await supabase
        .from("workload_asignaciones")
        .update({ proceso_actividad_id: activityId })
        .eq("id", assignmentId);
      if (linkError) console.error("Error al vincular la actividad maestra a la asignación:", linkError);
    }

    const table = type === "weekly" ? "workload_plan_semanal_detalle" : "workload_plan_mensual";
    const groupFilter = type === "weekly" ? { dia_semana: dayName || "Lunes" } : { semana_mes: Number(weekNumber || 1) };

    const { data: currentGroup, error: orderError } = await supabase
      .from(table)
      .select("orden")
      .eq("persona_id", personaId)
      .match(groupFilter)
      .eq("activo", true)
      .order("orden", { ascending: false, nullsFirst: false })
      .limit(1);
    if (orderError) console.error("Error al calcular el orden del bloque de asignación:", orderError);
    const nextOrder = Number(currentGroup?.[0]?.orden || 0) + 1;

    const insertPayload = {
      persona_id: personaId,
      actividad_id: activityId,
      asignacion_id: assignmentId,
      origen: origen || "Asignaciones",
      orden: nextOrder,
      horas_planificadas: horasAProgramar,
      activo: true,
      ...groupFilter,
    };

    const { error: insertError } = await supabase.from(table).insert(insertPayload);
    if (insertError) return { ok: false, error: insertError };

    return await recalculateAssignmentHours(assignmentId);
  } catch (err) {
    console.error("Error inesperado al programar horas de la asignación:", err);
    return { ok: false, error: err, data: null };
  }
}

async function setAssignmentProjectState(id, estadoProyecto) {
  try {
    const { error } = await supabase
      .from("workload_asignaciones")
      .update({ estado_proyecto: estadoProyecto })
      .eq("id", id);

    if (error) return { ok: false, error, data: null };
    return await recalculateAssignmentHours(id);
  } catch (err) {
    console.error(`Error inesperado al cambiar el estado de la asignación a "${estadoProyecto}":`, err);
    return { ok: false, error: err, data: null };
  }
}

export async function pauseAssignment(id) {
  return setAssignmentProjectState(id, "En pausa");
}

export async function reactivateAssignment(id) {
  return setAssignmentProjectState(id, "Pendiente");
}

export async function finalizeAssignment(id) {
  return setAssignmentProjectState(id, "Finalizado");
}

export async function cancelAssignment(id) {
  return setAssignmentProjectState(id, "Cancelado");
}

function cleanSavedPlanPayload(payload = {}) {
  return {
    tipo_plan: payload.tipo_plan,
    persona_id: String(payload.persona_id || ""),
    responsable: payload.responsable || null,
    fecha_inicio: payload.fecha_inicio || null,
    fecha_fin: payload.fecha_fin || null,
    mes: payload.mes ?? null,
    anio: payload.anio ?? null,
    nombre: payload.nombre || null,
    estado: payload.estado || "Borrador",
    bloques: Array.isArray(payload.bloques) ? payload.bloques : [],
    completados: Array.isArray(payload.completados) ? payload.completados : [],
    resumen: payload.resumen || null,
    creado_por: payload.creado_por || null,
    actualizado_por: payload.actualizado_por || null,
    activo: payload.activo ?? true,
  };
}

export async function getSavedWorkloadPlans({ personaId, tipoPlan }) {
  try {
    let query = supabase
      .from("workload_planes_guardados")
      .select("*")
      .eq("activo", true)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (personaId && personaId !== "all") query = query.eq("persona_id", String(personaId));
    if (tipoPlan) query = query.eq("tipo_plan", tipoPlan);

    const { data, error } = await query;
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    return { ok: false, error: err, data: [] };
  }
}

export async function getSavedWeeklyPlans({ personaId }) {
  return getSavedWorkloadPlans({ personaId, tipoPlan: "semanal" });
}

export async function getSavedMonthlyPlans({ personaId }) {
  return getSavedWorkloadPlans({ personaId, tipoPlan: "mensual" });
}

export async function saveWorkloadPlan(payload) {
  try {
    const { data, error } = await supabase
      .from("workload_planes_guardados")
      .insert(cleanSavedPlanPayload(payload))
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function updateSavedWorkloadPlan(id, payload) {
  try {
    const { data, error } = await supabase
      .from("workload_planes_guardados")
      .update({ ...cleanSavedPlanPayload(payload), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function findExistingSavedWeek({ personaId, fechaInicio, fechaFin }) {
  try {
    const { data, error } = await supabase
      .from("workload_planes_guardados")
      .select("*")
      .eq("activo", true)
      .eq("tipo_plan", "semanal")
      .eq("persona_id", String(personaId))
      .eq("fecha_inicio", fechaInicio)
      .eq("fecha_fin", fechaFin)
      .limit(1)
      .maybeSingle();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function findExistingSavedMonth({ personaId, mes, anio }) {
  try {
    const { data, error } = await supabase
      .from("workload_planes_guardados")
      .select("*")
      .eq("activo", true)
      .eq("tipo_plan", "mensual")
      .eq("persona_id", String(personaId))
      .eq("mes", Number(mes))
      .eq("anio", Number(anio))
      .limit(1)
      .maybeSingle();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
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

export async function updateWeeklyPlanHours(planId, hours) {
  try {
    const { data, error } = await supabase
      .from("workload_plan_semanal_detalle")
      .update({ horas_planificadas: hours })
      .eq("id", planId)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function updateMonthlyPlanHours(planId, hours) {
  try {
    const { data, error } = await supabase
      .from("workload_plan_mensual")
      .update({ horas_planificadas: hours })
      .eq("id", planId)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
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

