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

export async function createProducto(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_productos")
      .insert({
        codigo: payload.codigo,
        nombre: payload.nombre,
        linea: payload.linea,
        precio: payload.precio || 0,
        orden: payload.orden || 0,
        activo: true,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// "Quitar" un producto no lo borra (evita perder su historial en
// sop_plan_venta/sop_historico) — solo lo desactiva, igual que el patron
// activo/inactivo del resto del catalogo organizacional.
export async function setProductoActivo(id, activo, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_productos")
      .update({
        activo,
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

export async function updateProductoPrecio(id, precio, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_productos")
      .update({
        precio,
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
    // El draft del formulario viene de {...parametros}, que incluye "id" —
    // Postgres rechaza el UPDATE si se intenta reescribir una columna
    // identity (aunque sea al mismo valor), por eso se excluye aqui.
    const { id: _omit, ...rest } = payload;
    const { data, error } = await supabase
      .from("sop_parametros")
      .update({
        ...rest,
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
// Paginado explicito: PostgREST corta cualquier select("*") sin rango a
// 1000 filas por default. sop_plan_venta ya paso ese umbral (74 productos x
// 2 escenarios x N meses acumulados) y esto estaba recortando filas
// silenciosamente — sin error, solo datos faltantes al azar segun el orden
// fisico de la tabla.
const PAGE_SIZE = 1000;

export async function getPlanVenta() {
  try {
    const rows = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("sop_plan_venta")
        .select("*")
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Error al cargar plan de venta S&OP:", error);
        return rows;
      }
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
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

export async function getVentaReal() {
  try {
    const { data, error } = await supabase
      .from("sop_venta_real")
      .select("*")
      .order("anio", { ascending: true })
      .order("mes", { ascending: true });

    if (error) {
      console.error("Error al cargar venta real S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar venta real S&OP:", err);
    return [];
  }
}

export async function upsertVentaReal(anio, mes, monto, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_venta_real")
      .upsert(
        {
          anio,
          mes,
          monto,
          updated_at: new Date().toISOString(),
          updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
          updated_by_nombre: actor?.nombre || actor?.usuario || null,
        },
        { onConflict: "anio,mes" }
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

const ETAPAS_CICLO_KEYS = ["comercial", "operativo", "financiero", "ejecutivo"];

export async function getFirmasCiclo(anio, mes) {
  try {
    const { data, error } = await supabase
      .from("sop_firmas_ciclo")
      .select("*")
      .eq("anio", anio)
      .eq("mes", mes);

    if (error) {
      console.error("Error al cargar firmas del ciclo S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar firmas del ciclo S&OP:", err);
    return [];
  }
}

// Crea las 4 filas "Pendiente" del ciclo (anio, mes) si todavia no existen —
// ignoreDuplicates hace que sea seguro llamarla varias veces (al cargar el
// modulo y al cerrar un mes) sin pisar firmas ya capturadas.
export async function ensureFirmasCiclo(anio, mes) {
  try {
    const rows = ETAPAS_CICLO_KEYS.map((etapa) => ({ anio, mes, etapa, estado: "Pendiente" }));
    const { error } = await supabase
      .from("sop_firmas_ciclo")
      .upsert(rows, { onConflict: "anio,mes,etapa", ignoreDuplicates: true });

    if (error) console.error("No se pudo inicializar el ciclo de firmas S&OP:", error);
  } catch (err) {
    console.error("Error inesperado al inicializar el ciclo de firmas S&OP:", err);
  }
}

export async function upsertFirma(anio, mes, etapa, estado, comentario, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_firmas_ciclo")
      .upsert(
        {
          anio,
          mes,
          etapa,
          estado,
          comentario: comentario || null,
          usuario_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
          usuario_nombre: actor?.nombre || actor?.usuario || null,
          fecha: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "anio,mes,etapa" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function getPrioridadesSemana() {
  try {
    const { data, error } = await supabase
      .from("sop_prioridades_semana")
      .select("*")
      .order("anio", { ascending: false })
      .order("mes", { ascending: false })
      .order("semana", { ascending: true });

    if (error) {
      console.error("Error al cargar prioridades semanales S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar prioridades semanales S&OP:", err);
    return [];
  }
}

export async function createPrioridadSemana(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_prioridades_semana")
      .insert({
        anio: payload.anio,
        mes: payload.mes,
        semana: payload.semana,
        area: payload.area,
        prioridad: payload.prioridad,
        meta_numerica: payload.meta_numerica || null,
        responsable: payload.responsable || null,
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

export async function updatePrioridadSemana(id, estado) {
  try {
    const { data, error } = await supabase
      .from("sop_prioridades_semana")
      .update({ estado })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Umbral de efectividad de forecast bajo el cual el cierre de mes genera
// automaticamente una decision pendiente de revision — sin esto, un mes
// que no cumple el plan no obliga a nadie a revisarlo. Mismo corte que el
// semaforo de Historico S&OP (rojo <80%).
const EFECTIVIDAD_MINIMA = 0.8;
const formatMoneyPlain = (v) => `$${Math.round(Number(v || 0)).toLocaleString("es-MX")}`;

// Cierra el mes activo: archiva su resumen en el histórico (append-only) y
// avanza el control al mes siguiente — equivalente a la macro CerrarMesSOP
// del Excel, sin el truco de ocultar columnas (aquí el horizonte es solo
// una consulta por rango de fechas).
export async function closeCurrentMonth({ control, resumenMes, ventaReal, actor }) {
  try {
    const diferencia = Number(ventaReal || 0) - Number(resumenMes.ventaPlaneada || 0);
    const efectividad = Number(resumenMes.ventaPlaneada) > 0 ? Number(ventaReal || 0) / Number(resumenMes.ventaPlaneada) : null;

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

    if (efectividad !== null && efectividad < EFECTIVIDAD_MINIMA) {
      const { error: decisionError } = await supabase.from("sop_decisiones").insert({
        mes_reunion: resumenMes.mes,
        decision: `Baja efectividad de forecast en ${resumenMes.label}: ${(efectividad * 100).toFixed(1)}% (real ${formatMoneyPlain(ventaReal)} vs plan ${formatMoneyPlain(resumenMes.ventaPlaneada)}) — revisar causa raíz.`,
        responsable: "Por asignar",
        created_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        created_by_nombre: actor?.nombre || actor?.usuario || null,
      });
      if (decisionError) console.error("No se pudo crear la decisión automática de baja efectividad:", decisionError);
    }

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

    await ensureFirmasCiclo(nextMonth.getFullYear(), nextMonth.getMonth() + 1);

    return { ok: true, error: null, data: controlData };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Gestión de capacidad — mano de obra (sop_capacidad_procesos) e
// infraestructura (sop_infraestructura). Ambas son catálogos capturables
// desde Plan de operación, mismo patrón activo/inactivo que sop_productos
// para no perder historial al "quitar" una fila.
export async function getCapacidadProcesos() {
  try {
    const { data, error } = await supabase
      .from("sop_capacidad_procesos")
      .select("*")
      .eq("activo", true)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error al cargar capacidad de procesos S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar capacidad de procesos S&OP:", err);
    return [];
  }
}

export async function createCapacidadProceso(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_capacidad_procesos")
      .insert({
        proceso: payload.proceso,
        operarios: payload.operarios || 0,
        horas_turno: payload.horas_turno || 8,
        turnos_activos: payload.turnos_activos || 1,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function updateCapacidadProceso(id, payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_capacidad_procesos")
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

export async function deactivateCapacidadProceso(id, actor) {
  try {
    const { error } = await supabase
      .from("sop_capacidad_procesos")
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .eq("id", id);

    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function getInfraestructura() {
  try {
    const { data, error } = await supabase
      .from("sop_infraestructura")
      .select("*")
      .eq("activo", true)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error al cargar infraestructura S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar infraestructura S&OP:", err);
    return [];
  }
}

export async function createInfraestructura(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_infraestructura")
      .insert({
        nombre_equipo: payload.nombre_equipo,
        proceso: payload.proceso || null,
        cantidad: payload.cantidad || 1,
        horas_disponibles_turno: payload.horas_disponibles_turno || 8,
        turnos_activos: payload.turnos_activos || 1,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function updateInfraestructura(id, payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_infraestructura")
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

export async function deactivateInfraestructura(id, actor) {
  try {
    const { error } = await supabase
      .from("sop_infraestructura")
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .eq("id", id);

    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}
