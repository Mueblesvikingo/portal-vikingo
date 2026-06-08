import { supabase } from "./supabase";

const ORIGIN = "Diseño Organizacional";

function minutesFromHours(hours) {
  const value = Number(hours);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 60) : 60;
}

function cleanUndefined(payload) {
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  return payload;
}

function workloadPayload(activity) {
  const durationMinutes = Number(
    activity.duracion_minutos ||
      activity.durationMinutes ||
      minutesFromHours(activity.timeHours)
  );

  return {
    titulo: activity.actividad || activity.name || "Nueva actividad",
    descripcion:
      activity.descripcion ||
      activity.description ||
      activity.impact ||
      null,
    tipo: "Proceso",
    proceso:
      activity.proceso ||
      activity.processName ||
      "Diseño Organizacional",
    responsable:
      activity.responsable ||
      activity.responsible ||
      null,
    puesto:
      activity.puesto ||
      activity.position ||
      activity.responsible ||
      null,
    duracion_minutos: durationMinutes,
    carga_horas: Number((durationMinutes / 60).toFixed(2)),
    frecuencia:
      activity.frecuencia ||
      activity.frequencyType ||
      "Mensual",
    observaciones: `Día típico: ${
      activity.dia_tipico ||
      activity.typicalDay ||
      "Lunes"
    }`,
    estado: "Programada",
    origen_proceso: ORIGIN,
    orden_flujo: activity.orden_flujo ?? activity.order ?? null,
  };
}

export async function getOrganizationalDesignData() {
  const [
    processesResult,
    rolesResult,
    subprocessesResult,
    activitiesResult,
  ] = await Promise.all([
    supabase.from("procesos").select("*").order("id", { ascending: true }),
    supabase.from("proceso_roles").select("*").order("orden", { ascending: true }),
    supabase.from("subprocesos").select("*"),
    supabase.from("proceso_actividades").select("*"),
  ]);

  if (processesResult.error) {
    console.error("SUPABASE procesos ERROR:", processesResult.error);
  }

  if (rolesResult.error) {
    console.error("SUPABASE proceso_roles ERROR:", rolesResult.error);
  }

  if (subprocessesResult.error) {
    console.error("SUPABASE subprocesos ERROR:", subprocessesResult.error);
  }

  if (activitiesResult.error) {
    console.error("SUPABASE proceso_actividades ERROR:", activitiesResult.error);
  }

  return {
    processes: processesResult.error ? [] : processesResult.data || [],
    roles: rolesResult.error ? [] : rolesResult.data || [],
    subprocesses: subprocessesResult.error ? [] : subprocessesResult.data || [],
    activities: activitiesResult.error ? [] : activitiesResult.data || [],
  };
}

export async function getProcessDesignData(processName) {
  if (!processName) {
    return {
      roles: [],
      subprocesses: [],
      activities: [],
    };
  }

  const cleanName = String(processName).trim();

  const [
    rolesResult,
    roleCatalogResult,
    subprocessesResult,
    activitiesResult,
  ] = await Promise.all([
    supabase
      .from("proceso_roles")
      .select("*")
      .eq("proceso", cleanName)
      .order("orden", { ascending: true }),

    supabase
      .from("roles_catalogo")
      .select("*")
      .eq("macroproceso", cleanName)
      .eq("activo", true)
      .order("orden", { ascending: true }),

    supabase
      .from("subprocesos")
      .select("*")
      .eq("proceso", cleanName),

    supabase
      .from("proceso_actividades")
      .select("*")
      .eq("proceso", cleanName),
  ]);

  if (rolesResult.error) {
    console.error("SUPABASE proceso_roles ERROR:", rolesResult.error);
  }

  if (roleCatalogResult.error) {
    console.error("SUPABASE roles_catalogo ERROR:", roleCatalogResult.error);
  }

  if (subprocessesResult.error) {
    console.error("SUPABASE subprocesos ERROR:", subprocessesResult.error);
  }

  if (activitiesResult.error) {
    console.error("SUPABASE proceso_actividades ERROR:", activitiesResult.error);
  }

  /*
    Importante:
    No filtramos inactivos aquí.

    Regla actual:
    - activo = true  -> visible normal
    - activo = false -> visible en gris
    - eliminar con X -> delete real en Supabase, previa confirmación
  */

  const roles = rolesResult.error
    ? []
    : (rolesResult.data || []).sort(
        (a, b) =>
          Number(a.orden ?? a.id ?? 0) -
          Number(b.orden ?? b.id ?? 0)
      );

  const subprocesses = subprocessesResult.error
    ? []
    : (subprocessesResult.data || []).sort(
        (a, b) =>
          Number(a.orden_flujo ?? a.orden ?? a.id ?? 0) -
          Number(b.orden_flujo ?? b.orden ?? b.id ?? 0)
      );

  const activities = activitiesResult.error
    ? []
    : (activitiesResult.data || []).sort(
        (a, b) =>
          Number(a.orden_flujo ?? a.orden ?? a.id ?? 0) -
          Number(b.orden_flujo ?? b.orden ?? b.id ?? 0)
      );

  return {
    roles,
    roleCatalog: roleCatalogResult.error ? [] : roleCatalogResult.data || [],
    roleCatalogError: roleCatalogResult.error?.message || null,
    subprocesses,
    activities,
  };
}

export async function getRoleCatalogByMacroprocess(macroprocessName) {
  if (!macroprocessName) return [];

  const { data, error } = await supabase
    .from("roles_catalogo")
    .select("*")
    .eq("macroproceso", String(macroprocessName).trim())
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    console.error("SUPABASE roles_catalogo ERROR:", error);
    return [];
  }

  return data || [];
}

export async function createProcess(payload) {
  const { data, error } = await supabase
    .from("procesos")
    .insert([
      {
        nombre: payload.nombre || payload.name,
        tipo: payload.tipo || payload.lane || "Operativo",
        responsable: payload.responsable || payload.owner || null,
        activo: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createRole(payload) {
  const { data, error } = await supabase
    .from("proceso_roles")
    .insert([
      {
        proceso: payload.proceso || payload.processName || null,
        rol: payload.rol || payload.lane || "Nuevo carril",
        responsable: payload.responsable || null,
        orden: payload.orden ?? 0,
        activo: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRole(id, updates) {
  if (!id) {
    throw new Error("updateRole requiere un id real de Supabase.");
  }

  const payload = cleanUndefined({
    rol: updates.rol || updates.lane || updates.name,
    responsable: updates.responsable || updates.responsible,
    orden: updates.orden ?? updates.order,
    activo:
      updates.activo ??
      (updates.active === undefined ? undefined : updates.active !== false),
  });

  const { data, error } = await supabase
    .from("proceso_roles")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateRole(id) {
  if (!id) {
    throw new Error("deactivateRole requiere un id real de Supabase.");
  }

  const { data, error } = await supabase
    .from("proceso_roles")
    .update({ activo: false })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createSubprocess(payload) {
  const { data, error } = await supabase
    .from("subprocesos")
    .insert([
      {
        proceso: payload.proceso,
        codigo: payload.codigo || payload.codigo_subproceso || null,
        nombre: payload.nombre || payload.name || "Nuevo subproceso",
        objetivo:
          payload.objetivo ||
          payload.descripcion ||
          payload.description ||
          null,
        responsable:
          payload.responsable ||
          payload.responsible ||
          payload.carril ||
          payload.lane ||
          "Subprocesos",
        carril:
          payload.carril ||
          payload.lane ||
          payload.responsable ||
          payload.responsible ||
          "Subprocesos",
        orden_flujo:
          payload.orden_flujo ??
          payload.orden ??
          payload.order ??
          0,
        activo:
          payload.activo ??
          (payload.active === undefined ? true : payload.active !== false),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSubprocess(id, updates) {
  if (!id) {
    throw new Error("updateSubprocess requiere un id real de Supabase.");
  }

  const payload = cleanUndefined({
    codigo:
      updates.codigo ||
      updates.codigo_subproceso ||
      updates.code,

    nombre:
      updates.nombre ||
      updates.name,

    objetivo:
      updates.objetivo ||
      updates.descripcion ||
      updates.description,

    responsable:
      updates.responsable ||
      updates.responsible ||
      updates.rol ||
      updates.lane,

    carril:
      updates.carril ||
      updates.lane ||
      updates.rol ||
      updates.responsable ||
      updates.responsible,

    orden_flujo:
      updates.orden_flujo ??
      updates.orden ??
      updates.order,

    criticidad:
      updates.criticidad ||
      updates.criticality,

    estado:
      updates.estado ||
      updates.status,

    impacto:
      updates.impacto ??
      updates.impact,

    beneficio:
      updates.beneficio ??
      updates.benefit,

    activo:
      updates.activo ??
      (updates.active === undefined ? undefined : updates.active !== false),
  });

  const { data, error } = await supabase
    .from("subprocesos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSubprocessOrder(id, order, carril) {
  if (!id) {
    throw new Error("updateSubprocessOrder requiere un id real de Supabase.");
  }

  const updates = {
    orden_flujo: order,
  };

  if (carril) {
    updates.carril = carril;
    updates.responsable = carril;
  }

  const { data, error } = await supabase
    .from("subprocesos")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateSubprocess(id) {
  if (!id) {
    throw new Error("deactivateSubprocess requiere un id real de Supabase.");
  }

  const { data, error } = await supabase
    .from("subprocesos")
    .update({ activo: false })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSubprocess(id) {
  if (!id) {
    throw new Error("deleteSubprocess requiere un id real de Supabase.");
  }

  const { error } = await supabase
    .from("subprocesos")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}

export async function createActivity(payload) {
  const durationMinutes =
    payload.duracion_minutos ||
    payload.durationMinutes ||
    minutesFromHours(payload.timeHours);

  const activityPayload = cleanUndefined({
    proceso_id: payload.proceso_id,

    actividad:
      payload.actividad ||
      payload.name ||
      "Nueva actividad",

    descripcion:
      payload.descripcion ||
      payload.description ||
      payload.impacto ||
      payload.impact ||
      null,

    proceso:
      payload.proceso ||
      payload.processName,

    responsable:
      payload.responsable ||
      payload.responsible,

    puesto:
      payload.puesto ||
      payload.position ||
      payload.responsible,

    duracion_minutos: durationMinutes,

    frecuencia:
      payload.frecuencia ||
      payload.frequencyType ||
      "Mensual",

    frecuencia_valor:
      payload.frecuencia_valor ??
      payload.frequencyValue ??
      1,

    dia_tipico:
      payload.dia_tipico ||
      payload.typicalDay ||
      "Lunes",

    orden_flujo:
      payload.orden_flujo ??
      payload.order ??
      0,

    rol:
      payload.rol ||
      payload.lane ||
      payload.responsable ||
      payload.responsible,

    subproceso_id:
      payload.subproceso_id ||
      null,

    codigo_subproceso:
      payload.codigo_subproceso ||
      null,

    fase:
      payload.fase,

    criticidad:
      payload.criticidad ||
      payload.criticality ||
      "medium",

    estado:
      payload.estado ||
      payload.status ||
      "active",

    automatizada:
      payload.automatizada ??
      payload.automated ??
      false,

    impacto:
      payload.impacto ??
      payload.impact ??
      null,

    beneficio:
      payload.beneficio ??
      payload.benefit ??
      null,

    automatizacion_ia:
      payload.automatizacion_ia ??
      payload.aiAutomation ??
      null,

    carga_horas:
      payload.carga_horas ??
      payload.monthlyHours ??
      Number((durationMinutes / 60).toFixed(2)),

    activa:
      payload.activa ??
      (payload.active === undefined ? true : payload.active !== false),
  });

  const { data, error } = await supabase
    .from("proceso_actividades")
    .insert([activityPayload])
    .select()
    .single();

  if (error) throw error;

  try {
    await syncActivityToWorkload({
      ...activityPayload,
      id: data.id,
    });
  } catch (syncError) {
    console.error("SUPABASE workload sync ERROR:", syncError);
  }

  return data;
}

export async function updateActivity(id, updates) {
  if (!id) {
    throw new Error("updateActivity requiere un id real de Supabase.");
  }

  const durationMinutes =
    updates.duracion_minutos ||
    updates.durationMinutes ||
    (updates.timeHours === undefined
      ? undefined
      : minutesFromHours(updates.timeHours));

  const activityPayload = cleanUndefined({
    actividad:
      updates.actividad ||
      updates.name,

    descripcion:
      updates.descripcion ||
      updates.description ||
      updates.impacto ||
      updates.impact,

    proceso:
      updates.proceso ||
      updates.processName,

    responsable:
      updates.responsable ||
      updates.responsible,

    puesto:
      updates.puesto ||
      updates.position ||
      updates.responsible,

    duracion_minutos: durationMinutes,

    frecuencia:
      updates.frecuencia ||
      updates.frequencyType,

    frecuencia_valor:
      updates.frecuencia_valor ??
      updates.frequencyValue,

    dia_tipico:
      updates.dia_tipico ||
      updates.typicalDay,

    orden_flujo:
      updates.orden_flujo ??
      updates.order,

    rol:
      updates.rol ||
      updates.lane ||
      updates.responsable ||
      updates.responsible,

    subproceso_id:
      updates.subproceso_id,

    codigo_subproceso:
      updates.codigo_subproceso,

    fase:
      updates.fase,

    criticidad:
      updates.criticidad ||
      updates.criticality,

    estado:
      updates.estado ||
      updates.status,

    automatizada:
      updates.automatizada ??
      updates.automated,

    impacto:
      updates.impacto ??
      updates.impact,

    beneficio:
      updates.beneficio ??
      updates.benefit,

    automatizacion_ia:
      updates.automatizacion_ia ??
      updates.aiAutomation,

    carga_horas:
      updates.carga_horas ??
      updates.monthlyHours ??
      (durationMinutes
        ? Number((durationMinutes / 60).toFixed(2))
        : undefined),

    activa:
      updates.activa ??
      (updates.active === undefined ? undefined : updates.active !== false),
  });

  const { data, error } = await supabase
    .from("proceso_actividades")
    .update(activityPayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  try {
    await syncActivityToWorkload({
      ...updates,
      ...activityPayload,
      id,
    });
  } catch (syncError) {
    console.error("SUPABASE workload sync ERROR:", syncError);
  }

  return data;
}

export async function updateActivityOrder(id, order, roleId, laneName) {
  if (!id) {
    throw new Error("updateActivityOrder requiere un id real de Supabase.");
  }

  const updates = {
    orden_flujo: order,
  };

  if (laneName) {
    updates.rol = laneName;
    updates.responsable = laneName;
    updates.puesto = laneName;
  }

  const { data, error } = await supabase
    .from("proceso_actividades")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateActivity(id) {
  if (!id) {
    throw new Error("deactivateActivity requiere un id real de Supabase.");
  }

  const { data, error } = await supabase
    .from("proceso_actividades")
    .update({ activa: false })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteActivity(id) {
  if (!id) {
    throw new Error("deleteActivity requiere un id real de Supabase.");
  }

  const { error } = await supabase
    .from("proceso_actividades")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { id };
}

export async function syncActivityToWorkload(activity) {
  const payload = workloadPayload(activity);

  const { data: existing, error: findError } = await supabase
    .from("workload_actividades")
    .select("id")
    .eq("origen_proceso", ORIGIN)
    .eq("titulo", payload.titulo)
    .eq("proceso", payload.proceso)
    .limit(1);

  if (findError) {
    console.error("SUPABASE workload lookup ERROR:", findError);
  }

  if (existing?.[0]?.id) {
    const { error } = await supabase
      .from("workload_actividades")
      .update(payload)
      .eq("id", existing[0].id);

    if (error) throw error;
    return existing[0];
  }

  const { data, error } = await supabase
    .from("workload_actividades")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}
export async function getSubprocessTraceability(subprocessId) {
  if (!subprocessId) return [];

  const { data, error } = await supabase
    .from("subproceso_trazabilidad")
    .select("*")
    .eq("subproceso_id", subprocessId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSubprocessTraceability(payload) {
  const { data, error } = await supabase
    .from("subproceso_trazabilidad")
    .insert([
      {
        subproceso_id: payload.subproceso_id,
        campo: payload.campo,
        valor_anterior: payload.valor_anterior ?? null,
        valor_nuevo: payload.valor_nuevo ?? null,
        usuario: payload.usuario || "Usuario actual",
        detalle: payload.detalle || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}
