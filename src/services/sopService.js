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

// Familia real (PCP-IF-01 Clasificación) — de qué familia de Tiempos
// estándar sale la carga real de este producto en Plan de operación.
// null = sin clasificar, no participa en ese cálculo (se avisa aparte).
export async function updateProductoFamilia(id, familia, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_productos")
      .update({
        familia: familia || null,
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
        semana_id: payload.semana_id || null,
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

// Semanas de la junta de alineación S&OP — mismo patrón que
// seguimiento_semanas de Seguimiento Estratégico (Nueva/Guardar/Consultar/
// Cerrar semana), adaptado a S&OP: los acuerdos capturados durante la junta
// de una semana quedan ligados a esa semana (sop_decisiones.semana_id) en
// vez de inferirse solo por fecha.
export async function getSopSemanas() {
  try {
    const { data, error } = await supabase
      .from("sop_semanas")
      .select("*")
      .order("fecha_inicio", { ascending: false });
    if (error) {
      console.error("Error al cargar semanas S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar semanas S&OP:", err);
    return [];
  }
}

export async function createSopSemana({ fecha_inicio, fecha_fin }) {
  try {
    const { data, error } = await supabase
      .from("sop_semanas")
      .insert({ fecha_inicio, fecha_fin, estado: "abierta" })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function cerrarSopSemana(id) {
  try {
    const { error } = await supabase.from("sop_semanas").update({ estado: "cerrada" }).eq("id", id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
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

// anio/mes siguen existiendo en la tabla (NOT NULL, uso histórico del ciclo
// mensual) pero ya no son la llave real — se derivan de semana_lunes solo
// para no romper esa columna. La llave real ahora es (semana_lunes, etapa),
// así el ciclo de firmas sigue a la semana que se esté viendo en Vista
// semanal, no a un mes fijo.
function anioMesDeSemana(semanaLunes) {
  const d = new Date(`${semanaLunes}T00:00:00`);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

export async function getFirmasCiclo(semanaLunes) {
  try {
    const { data, error } = await supabase
      .from("sop_firmas_ciclo")
      .select("*")
      .eq("semana_lunes", semanaLunes);

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

// Crea las 4 filas "Pendiente" de la semana si todavia no existen —
// ignoreDuplicates hace que sea seguro llamarla cada vez que se entra a
// Control S&OP con esa semana seleccionada, sin pisar firmas ya capturadas.
export async function ensureFirmasCiclo(semanaLunes) {
  try {
    const { anio, mes } = anioMesDeSemana(semanaLunes);
    const rows = ETAPAS_CICLO_KEYS.map((etapa) => ({ semana_lunes: semanaLunes, anio, mes, etapa, estado: "Pendiente" }));
    const { error } = await supabase
      .from("sop_firmas_ciclo")
      .upsert(rows, { onConflict: "semana_lunes,etapa", ignoreDuplicates: true });

    if (error) console.error("No se pudo inicializar el ciclo de firmas S&OP:", error);
  } catch (err) {
    console.error("Error inesperado al inicializar el ciclo de firmas S&OP:", err);
  }
}

export async function upsertFirma(semanaLunes, etapa, estado, comentario, actor) {
  try {
    const { anio, mes } = anioMesDeSemana(semanaLunes);
    const { data, error } = await supabase
      .from("sop_firmas_ciclo")
      .upsert(
        {
          semana_lunes: semanaLunes,
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
        { onConflict: "semana_lunes,etapa" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Reinicio manual del ciclo de firmas (solo equipo estrategico) — util cuando
// el ciclo quedo en un estado inconsistente (ej. varias etapas rechazadas a
// la vez mientras se probaba el flujo) y hay que empezar de nuevo sin
// esperar a la siguiente semana.
export async function resetCicloFirmas(semanaLunes, actor) {
  try {
    const { anio, mes } = anioMesDeSemana(semanaLunes);
    const rows = ETAPAS_CICLO_KEYS.map((etapa) => ({
      semana_lunes: semanaLunes,
      anio,
      mes,
      etapa,
      estado: "Pendiente",
      comentario: null,
      usuario_persona_id: null,
      usuario_nombre: null,
      fecha: null,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
      .from("sop_firmas_ciclo")
      .upsert(rows, { onConflict: "semana_lunes,etapa" })
      .select("*");

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

// Una sola prioridad por área y semana (unique en anio,mes,semana,area) —
// upsert en vez de insert para que capturar de nuevo sobre la misma casilla
// reemplace el texto en vez de duplicar filas.
export async function upsertPrioridadSemana(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_prioridades_semana")
      .upsert(
        {
          anio: payload.anio,
          mes: payload.mes,
          semana: payload.semana,
          area: payload.area,
          prioridad: payload.prioridad,
          meta_numerica: payload.meta_numerica || null,
          responsable: payload.responsable || null,
          created_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
          created_by_nombre: actor?.nombre || actor?.usuario || null,
        },
        { onConflict: "anio,mes,semana,area" }
      )
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

    return { ok: true, error: null, data: controlData };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Tiempos estándar reales (minutos por pieza) por familia de producto ×
// estación — de PCP-IF-01 Análisis Planeación Producción. Se cargó como
// catálogo real inicial, pero es editable desde el portal (los tiempos
// cambian si mejora el proceso o cambia el producto), y de ahí sale la
// carga real en minutos que exige el Plan de venta en cada estación.
export async function getTiemposEstandar() {
  try {
    const { data, error } = await supabase.from("sop_tiempos_estandar").select("*");
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error al cargar tiempos estándar S&OP:", err);
    return [];
  }
}

export async function updateTiempoEstandar(id, minutosPorPieza, actor) {
  try {
    const { error } = await supabase
      .from("sop_tiempos_estandar")
      .update({
        minutos_por_pieza: minutosPorPieza,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error al actualizar tiempo estándar S&OP:", err);
    return false;
  }
}

// Alta de una familia nueva en Tiempos estándar: crea una fila en 0
// minutos por cada estación real ya capturada (para que aparezca completa
// en la matriz y quede lista para editarse), en vez de inventar un tiempo.
export async function createFamiliaTiemposEstandar(familia, estaciones, actor) {
  try {
    const rows = estaciones.map((estacion) => ({
      familia,
      estacion,
      minutos_por_pieza: 0,
      updated_at: new Date().toISOString(),
      updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
      updated_by_nombre: actor?.nombre || actor?.usuario || null,
    }));
    const { data, error } = await supabase.from("sop_tiempos_estandar").insert(rows).select("*");
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Alta de una estación nueva en Tiempos estándar: simétrico a
// createFamiliaTiemposEstandar pero para una estación nueva — crea su fila
// en 0 minutos cruzada con cada familia ya existente, para que la matriz
// no quede con columnas huecas cuando se agrega una estación en Capacidad.
export async function createEstacionTiemposEstandar(estacion, familias, actor) {
  try {
    const rows = familias.map((familia) => ({
      familia,
      estacion,
      minutos_por_pieza: 0,
      updated_at: new Date().toISOString(),
      updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
      updated_by_nombre: actor?.nombre || actor?.usuario || null,
    }));
    const { data, error } = await supabase.from("sop_tiempos_estandar").insert(rows).select("*");
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Baja de una familia completa en Tiempos estándar — sin columna "activo"
// en esta tabla (es solo un catálogo de referencia, no un histórico), así
// que quitar una familia borra sus filas de verdad. Se confirma en la UI
// antes de llamar esto.
export async function deleteFamiliaTiemposEstandar(familia) {
  try {
    const { error } = await supabase.from("sop_tiempos_estandar").delete().eq("familia", familia);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Renombrar una estación real: el nombre se repite como texto libre en 3
// lugares (sop_capacidad_procesos.proceso, sop_infraestructura.proceso,
// sop_tiempos_estandar.estacion) sin llave foránea entre ellos, así que
// renombrar solo en uno rompería el cálculo de carga (deja de encontrar el
// tiempo estándar de esa estación). Esta función actualiza los 3 a la vez.
export async function renameEstacion(procesoId, oldName, newName, actor) {
  try {
    const { error: e1 } = await supabase
      .from("sop_capacidad_procesos")
      .update({
        proceso: newName,
        updated_at: new Date().toISOString(),
        updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
        updated_by_nombre: actor?.nombre || actor?.usuario || null,
      })
      .eq("id", procesoId);
    if (e1) throw e1;

    const { error: e2 } = await supabase
      .from("sop_infraestructura")
      .update({ proceso: newName, updated_at: new Date().toISOString() })
      .eq("proceso", oldName);
    if (e2) throw e2;

    const { error: e3 } = await supabase
      .from("sop_tiempos_estandar")
      .update({ estacion: newName, updated_at: new Date().toISOString() })
      .eq("estacion", oldName);
    if (e3) throw e3;

    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Vacantes de personal (Brechas reales de Operación) — antes una lista fija
// en el código, ahora capturable desde el portal igual que
// capacidad_procesos/infraestructura.
export async function getVacantesPersonal() {
  try {
    const { data, error } = await supabase
      .from("sop_vacantes_personal")
      .select("*")
      .eq("activo", true)
      .order("id", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error al cargar vacantes de personal S&OP:", err);
    return [];
  }
}

export async function createVacantePersonal(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_vacantes_personal")
      .insert({
        puesto: payload.puesto,
        faltan: payload.faltan || 1,
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

export async function updateVacantePersonal(id, payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_vacantes_personal")
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

export async function deactivateVacantePersonal(id, actor) {
  try {
    const { error } = await supabase
      .from("sop_vacantes_personal")
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

// Plan financiero — partidas manuales (sop_financiero_filas) y sus montos
// por mes (sop_financiero_montos), editables/reordenables/agregables por
// Finanzas + equipo estratégico. Las filas calculadas (venta, margen,
// utilidad) NO viven aqui — siguen derivandose de Plan de venta/Parametros.
export async function getFinancieroFilas() {
  try {
    const { data, error } = await supabase
      .from("sop_financiero_filas")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al cargar filas financieras S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar filas financieras S&OP:", err);
    return [];
  }
}

export async function createFinancieroFila(payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_financiero_filas")
      .insert({
        concepto: payload.concepto,
        categoria: payload.categoria,
        orden: payload.orden ?? 0,
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

export async function updateFinancieroFila(id, payload, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_financiero_filas")
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

export async function deactivateFinancieroFila(id, actor) {
  try {
    const { error } = await supabase
      .from("sop_financiero_filas")
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

export async function getFinancieroMontos() {
  try {
    const { data, error } = await supabase.from("sop_financiero_montos").select("*");

    if (error) {
      console.error("Error al cargar montos financieros S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar montos financieros S&OP:", err);
    return [];
  }
}

export async function upsertFinancieroMonto(filaId, anio, mes, monto) {
  try {
    const { data, error } = await supabase
      .from("sop_financiero_montos")
      .upsert(
        { fila_id: filaId, anio, mes, monto, updated_at: new Date().toISOString() },
        { onConflict: "fila_id,anio,mes" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

// Ajustes manuales sobre las filas calculadas de Plan financiero (Ventas
// netas, Margen bruto, Gastos fijos) — sobreescriben el valor derivado de
// Plan de venta/Parametros para ESE mes en ESTA pestana unicamente. Dashboard
// y Plan de operacion siguen leyendo Plan de venta directo, sin este ajuste
// — por eso la UI marca visualmente la celda ajustada, para que quede claro
// que puede diferir de lo que muestran esos otros modulos.
export async function getFinancieroAjustes() {
  try {
    const { data, error } = await supabase.from("sop_financiero_ajustes").select("*");

    if (error) {
      console.error("Error al cargar ajustes financieros S&OP:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar ajustes financieros S&OP:", err);
    return [];
  }
}

export async function upsertFinancieroAjuste(anio, mes, concepto, monto, actor) {
  try {
    const { data, error } = await supabase
      .from("sop_financiero_ajustes")
      .upsert(
        {
          anio,
          mes,
          concepto,
          monto,
          updated_at: new Date().toISOString(),
          updated_by_persona_id: actor?.persona_id != null ? Number(actor.persona_id) : null,
          updated_by_nombre: actor?.nombre || actor?.usuario || null,
        },
        { onConflict: "anio,mes,concepto" }
      )
      .select("*")
      .single();

    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    return { ok: false, error: err, data: null };
  }
}

export async function deleteFinancieroAjuste(anio, mes, concepto) {
  try {
    const { error } = await supabase
      .from("sop_financiero_ajustes")
      .delete()
      .eq("anio", anio)
      .eq("mes", mes)
      .eq("concepto", concepto);

    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}
