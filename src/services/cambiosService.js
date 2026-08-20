import { supabase } from "./supabase";
import { createStrategicDecision } from "./decisionService";
import { createAccion } from "./accionesService";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

const TRACKED_FIELDS = [
  "titulo", "descripcion", "proceso_impactado", "beneficios_esperados", "riesgos", "estado",
  "impacto_objetivos_sig", "impacto_legal", "impacto_riesgos_oportunidades", "recursos_necesarios", "informe_analisis",
  "responsable_implementacion_persona_id", "plazo_implementacion", "recursos_asignados", "rechazo_justificacion",
  "plan_ejecucion", "documentacion_actualizada", "comunicado", "documentacion_obsoleta_retirada", "registrado_en_matriz",
  "indicadores_verificacion", "eficaz", "decision_seguimiento",
];

export async function getCambios() {
  try {
    const { data, error } = await supabase
      .from("sig_cambios")
      .select("*, solicitante:personas!sig_cambios_solicitante_persona_id_fkey(id,nombre), responsable_implementacion:personas!sig_cambios_responsable_implementacion_persona_id_fkey(id,nombre)")
      .eq("activo", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error al cargar control de cambios:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar control de cambios:", err);
    return [];
  }
}

// Cualquier colaborador o líder de proceso puede levantar la solicitud —
// sin gate de permisos, igual que el procedimiento SIG-P-03 lo describe.
export async function createCambio({ titulo, descripcion, procesoImpactado, beneficiosEsperados, riesgos }, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_cambios")
      .insert({
        titulo,
        descripcion: descripcion || null,
        proceso_impactado: procesoImpactado || null,
        beneficios_esperados: beneficiosEsperados || null,
        riesgos: riesgos || null,
        solicitante_persona_id: personaId,
        solicitante_nombre: nombre,
        estado: "Solicitado",
        updated_by_persona_id: personaId,
        updated_by_nombre: nombre,
      })
      .select("*, solicitante:personas!sig_cambios_solicitante_persona_id_fkey(id,nombre), responsable_implementacion:personas!sig_cambios_responsable_implementacion_persona_id_fkey(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear solicitud de cambio:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function updateCambio(cambioId, changes, { actor, previous } = {}) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_cambios")
      .update({ ...changes, updated_at: new Date().toISOString(), updated_by_persona_id: personaId, updated_by_nombre: nombre })
      .eq("id", cambioId)
      .select("*, solicitante:personas!sig_cambios_solicitante_persona_id_fkey(id,nombre), responsable_implementacion:personas!sig_cambios_responsable_implementacion_persona_id_fkey(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };

    const historialEntries = TRACKED_FIELDS
      .filter((field) => field in changes && previous && String(previous[field] ?? "") !== String(changes[field] ?? ""))
      .map((field) => ({
        cambio_id: cambioId,
        campo: field,
        valor_anterior: previous[field] != null ? String(previous[field]) : null,
        valor_nuevo: changes[field] != null ? String(changes[field]) : null,
        persona_id: personaId,
        nombre,
      }));
    if (historialEntries.length > 0) {
      const { error: histError } = await supabase.from("sig_cambios_historial").insert(historialEntries);
      if (histError) console.error("Error al guardar historial de control de cambios:", histError);
    }

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar control de cambios:", err);
    return { ok: false, error: err, data: null };
  }
}

// Al terminar la Evaluación, se envía a la Bandeja de Centro de Decisiones
// para que Dirección lo vea junto al resto de sus decisiones — mismo
// enganche ya usado desde S&OP y Seguimiento Estratégico. La resolución
// (aprobado/rechazado con recursos, plazo o justificación) se sigue
// capturando aquí mismo, porque esos campos no existen en el modelo
// genérico de decisiones.
export async function sendToDecisionCenter(cambio, actor) {
  try {
    const inserted = await createStrategicDecision({
      title: `Control de cambios SIG: ${cambio.titulo}`,
      owner: cambio.solicitante_nombre || actor?.nombre || "",
      risk: "Moderado",
      status: "Solicitud",
      executionType: null,
      dueDate: null,
      consequence: cambio.descripcion || "",
      recommendation: [
        cambio.informe_analisis,
        cambio.impacto_objetivos_sig ? `Impacto en objetivos del SIG: ${cambio.impacto_objetivos_sig}` : null,
        cambio.recursos_necesarios ? `Recursos necesarios: ${cambio.recursos_necesarios}` : null,
      ].filter(Boolean).join("\n\n"),
      wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
      process: "Control de cambios SIG",
    });
    const decisionId = inserted?.[0]?.id;
    const result = await updateCambio(cambio.id, { estado: "En aprobación", decision_id: decisionId || null }, { actor, previous: cambio });
    return result;
  } catch (err) {
    console.error("Error inesperado al enviar el cambio a Centro de Decisiones:", err);
    return { ok: false, error: err, data: null };
  }
}

// Genera la acción correctiva en Acciones de Mejora cuando
// el cambio resulta no eficaz (procedimiento de No Conformidad de SIG-P-03).
export async function createAccionCorrectivaPorCambio(cambio, actor) {
  const result = await createAccion(
    {
      tipo: "Acción Correctiva",
      nivel: "Operativa",
      origenModulo: "Control de Cambios SIG",
      origenTabla: "sig_cambios",
      origenId: cambio.id,
      titulo: `No conformidad — ${cambio.titulo}`,
      descripcion: cambio.indicadores_verificacion || "",
      prioridad: "Alta",
    },
    actor
  );
  if (!result?.ok) return result;
  const updateResult = await updateCambio(cambio.id, { accion_correctiva_id: result.data.id }, { actor, previous: cambio });
  if (!updateResult.ok) return updateResult;
  return result;
}

export async function getHistorial(cambioId) {
  try {
    let query = supabase.from("sig_cambios_historial").select("*").order("created_at", { ascending: false });
    if (cambioId) query = query.eq("cambio_id", cambioId);
    const { data, error } = await query.limit(200);
    if (error) {
      console.error("Error al cargar historial de control de cambios:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar historial de control de cambios:", err);
    return [];
  }
}
