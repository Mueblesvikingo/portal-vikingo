import { supabase } from "./supabase";
import { getRecorridoPlanta } from "./calidadService";

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

// Traduce la "planta" de Gestión de Calidad (Materia Prima/Planta 1/2/3/
// Producto Terminado) al área de Desempeño Operativo cuyo supervisor debe
// responder por sus no conformidades — mismo criterio ya usado para elegir
// el ícono de cada planta en QualityModule.jsx (Planta 1 = carpintería,
// Planta 2 = costura, Planta 3 = tapicería). Materia Prima y Producto
// Terminado no tienen área/supervisor propio en este módulo, así que sus NC
// no alimentan ningún KPI de área (confirmado explícitamente por el usuario,
// 30-sep-2026) — quedan fuera de PLANTA_A_AREA_OPERATIVA a propósito.
export const PLANTA_A_AREA_OPERATIVA = {
  "Planta 1": "Carpintería y armado de madera",
  "Planta 2": "Corte y costura de tela",
  "Planta 3": "Tapicería",
};

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

// Bitácora de observaciones de un KPI (por ahora habilitada solo en
// "Eficiencia en el uso del personal" vía `kpi.bitacora_habilitada`, ver
// TableroTab): registros libres de fecha/horas/motivo, complementarios al
// Real/Meta que ya se captura en Resultados — sirven para dejar evidencia de
// POR QUÉ el número salió así (qué paró la línea y cuándo).
export async function getBitacora(kpiId, { desde, hasta } = {}) {
  try {
    let query = supabase
      .from("desempeno_operativo_bitacora")
      .select("*")
      .eq("kpi_id", kpiId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);
    const { data, error } = await query;
    if (error) return { ok: false, error, data: [] };
    return { ok: true, error: null, data: data || [] };
  } catch (err) {
    console.error("Error inesperado al leer bitácora de KPI:", err);
    return { ok: false, error: err, data: [] };
  }
}

export async function createBitacoraEntry(kpiId, payload, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("desempeno_operativo_bitacora")
      .insert({
        kpi_id: kpiId,
        fecha: payload.fecha,
        minutos: payload.minutos === "" || payload.minutos === undefined || payload.minutos === null ? null : Number(payload.minutos),
        motivo: payload.motivo || null,
        observacion: payload.observacion || null,
        persona_id: personaId,
        persona_nombre: nombre,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear registro de bitácora:", err);
    return { ok: false, error: err, data: null };
  }
}

function countMondaysUpTo(anio, mes, day) {
  let count = 0;
  for (let d = 1; d <= day; d++) {
    if (new Date(anio, mes - 1, d).getDay() === 1) count += 1;
  }
  return Math.max(1, count);
}

async function fetchExistingReal(kpiId, anio, mes, semana) {
  try {
    let query = supabase.from("desempeno_operativo_resultados").select("valor").eq("kpi_id", kpiId).eq("anio", anio).eq("mes", mes).eq("tipo", "real");
    query = semana === null ? query.is("semana", null) : query.eq("semana", semana);
    const { data } = await query.maybeSingle();
    return data ? Number(data.valor) : null;
  } catch {
    return null;
  }
}

// Recalcula el Real semanal de un KPI con bitácora habilitada a partir de
// TODOS sus registros de paro: agrupa por semana del mes (mismo criterio de
// "contar lunes" que ya usa getWeeksInMonth), convierte minutos → horas, y
// aplica (Horas programadas − Horas paradas) / Horas programadas × 100. Se
// recalculan todas las semanas con registros (no solo la del nuevo dato) para
// que editar/agregar una fecha pasada también corrija su semana, sin tener
// que rastrear cuál cambió.
export async function recomputeKpiRealFromBitacora(kpi, actor) {
  const horasProgramadas = Number(kpi?.horas_programadas_semana);
  if (!horasProgramadas || horasProgramadas <= 0) {
    return { ok: false, error: "Falta configurar Horas programadas/semana en la ficha del KPI." };
  }
  try {
    const { data: allEntries, error } = await supabase
      .from("desempeno_operativo_bitacora")
      .select("fecha, minutos")
      .eq("kpi_id", kpi.id);
    if (error) return { ok: false, error };

    const buckets = new Map();
    for (const entry of allEntries || []) {
      const [y, m, d] = entry.fecha.split("-").map(Number);
      const semana = countMondaysUpTo(y, m, d);
      const key = `${y}-${m}-${semana}`;
      buckets.set(key, (buckets.get(key) || 0) + (Number(entry.minutos) || 0));
    }

    for (const [key, minutosTotales] of buckets.entries()) {
      const [anio, mes, semana] = key.split("-").map(Number);
      const horasParadas = minutosTotales / 60;
      const pct = Math.max(0, Math.min(100, ((horasProgramadas - horasParadas) / horasProgramadas) * 100));
      const valor = Number((pct / 100).toFixed(4));
      const previousValor = await fetchExistingReal(kpi.id, anio, mes, semana);
      if (String(previousValor ?? "") !== String(valor)) {
        await upsertResultado({ kpiId: kpi.id, anio, mes, semana, tipo: "real", valor }, { actor, previousValor });
      }
    }
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al recalcular KPI desde bitácora:", err);
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

// Para KPIs "Mayor es mejor": capturar un 0 borra la celda en vez de guardar
// un cero real (ver EditableValue en ResultadosTab.jsx) — en "Menor es mejor"
// el 0 sí puede ser la meta/resultado real (cero incidencias, cero merma).
export async function deleteResultado({ kpiId, anio, mes, semana = null, tipo }, { actor, previousValor } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    let query = supabase.from("desempeno_operativo_resultados").delete().eq("kpi_id", kpiId).eq("anio", anio).eq("mes", mes).eq("tipo", tipo);
    query = semana === null ? query.is("semana", null) : query.eq("semana", semana);
    const { error } = await query;
    if (error) return { ok: false, error };

    if (previousValor != null) {
      await logHistorialEntries([{
        kpi_id: kpiId,
        tipo_registro: "resultado",
        referencia: semana ? `${anio}-${mes}-s${semana}-${tipo}` : `${anio}-${mes}-${tipo}`,
        valor_anterior: String(previousValor),
        valor_nuevo: null,
        persona_id: personaId,
        usuario_nombre: nombre,
      }]);
    }
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al borrar resultado de desempeño operativo:", err);
    return { ok: false, error: err };
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

// --- Puente Gestión de Calidad → KPI "% Cierre de no conformidades" -------
// Cada NC detectada en una inspección genera una acción en Acciones de
// Mejora (origen_tabla = "calidad_recorridos", ver shared.jsx de Calidad).
// Este bloque cuenta, por área y mes, cuántas de esas acciones ya llegaron a
// "Cerrada" contra el total detectado ese mes, y lo guarda como el Real del
// KPI del área — sin capturar nada a mano. Se llama desde accionesService.js
// justo al crear una de esas acciones (abre la NC) y al cambiar su estado
// (por si llega o sale de "Cerrada").

const NC_KPI_NOMBRE = "% Cierre de no conformidades";

async function getOrCreateNCKpi(area, actor) {
  try {
    const { data: existing, error } = await supabase
      .from("desempeno_operativo_kpis")
      .select("*")
      .eq("area", area)
      .eq("nombre_indicador", NC_KPI_NOMBRE)
      .maybeSingle();
    if (error) { console.error("Error al buscar el KPI de cierre de NC:", error); return null; }
    if (existing) return withAmbito(existing);

    const result = await createKpi(
      {
        area,
        nombre_indicador: NC_KPI_NOMBRE,
        objetivo_estrategico: "Resolver a tiempo las no conformidades detectadas en Gestión de Calidad.",
        formula_texto: "No conformidades cerradas el mes en que se detectaron / total de no conformidades detectadas ese mes × 100",
        fuente_datos: "Gestión de Calidad → Acciones de Mejora (automático)",
        periodicidad: "Mensual",
        unidad_medida: "porcentaje",
      },
      actor
    );
    if (!result?.ok) { console.error("Error al crear el KPI de cierre de NC:", result?.error); return null; }
    // `sentido` no se manda explícito: la columna ya trae 'Mayor es mejor'
    // como default en Supabase, igual que el resto de los KPIs creados a
    // mano desde "+ Agregar KPI" (createKpi tampoco lo manda).
    return result.data;
  } catch (err) {
    console.error("Error inesperado al obtener/crear el KPI de cierre de NC:", err);
    return null;
  }
}

// Recalcula con datos en vivo — nunca hace falta un "backfill" aparte: la
// primera vez que corre para un área/mes ya cuenta correctamente todo lo que
// existía antes de este cambio, porque no lleva un contador incremental.
async function recomputeCierreNC(area, anio, mes, actor) {
  try {
    const kpi = await getOrCreateNCKpi(area, actor);
    if (!kpi) return;

    const plantas = Object.entries(PLANTA_A_AREA_OPERATIVA)
      .filter(([, a]) => a === area)
      .map(([planta]) => planta);
    if (!plantas.length) return;

    const { data: recorridos, error: recorridosError } = await supabase
      .from("calidad_recorridos")
      .select("id")
      .in("planta", plantas);
    if (recorridosError) { console.error("Error al leer recorridos para el KPI de cierre de NC:", recorridosError); return; }
    const recorridoIds = (recorridos || []).map((r) => r.id);
    if (!recorridoIds.length) return;

    const desde = `${anio}-${String(mes).padStart(2, "0")}-01T00:00:00`;
    const hastaFecha = mes === 12 ? new Date(anio + 1, 0, 1) : new Date(anio, mes, 1);
    const hasta = hastaFecha.toISOString();

    const { data: accionesDelMes, error: accionesError } = await supabase
      .from("acciones")
      .select("estado")
      .eq("origen_tabla", "calidad_recorridos")
      .in("origen_id", recorridoIds)
      .gte("created_at", desde)
      .lt("created_at", hasta);
    if (accionesError) { console.error("Error al leer acciones para el KPI de cierre de NC:", accionesError); return; }

    const total = (accionesDelMes || []).length;
    if (!total) return;
    const cerradas = (accionesDelMes || []).filter((a) => a.estado === "Cerrada").length;
    const valor = Number((cerradas / total).toFixed(4));

    const previousValor = await fetchExistingReal(kpi.id, anio, mes, null);
    if (String(previousValor ?? "") === String(valor)) return;
    await upsertResultado({ kpiId: kpi.id, anio, mes, semana: null, tipo: "real", valor }, { actor, previousValor });
  } catch (err) {
    console.error("Error inesperado al recalcular el KPI de cierre de NC:", err);
  }
}

// Punto de entrada usado por accionesService.js: dado el id del recorrido de
// Calidad que originó la acción (origen_id) y la fecha en que esa acción se
// creó (define a qué mes pertenece la NC), resuelve la planta → área y
// dispara el recálculo. No hace nada si la planta no tiene área asignada
// (Materia Prima / Producto Terminado).
export async function recomputeCierreNCDesdeRecorrido(recorridoId, fechaCreacion, actor) {
  const planta = await getRecorridoPlanta(recorridoId);
  const area = PLANTA_A_AREA_OPERATIVA[planta];
  if (!area) return;
  const fecha = new Date(fechaCreacion || new Date());
  await recomputeCierreNC(area, fecha.getFullYear(), fecha.getMonth() + 1, actor);
}
