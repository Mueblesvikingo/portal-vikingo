import { supabase } from "./supabase";
import { createAccion } from "./accionesService";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

// Roles ISO 19011: auditor líder (responsable único de la auditoría) y
// equipo auditor (uno o más auditores adicionales, tabla aparte porque son
// varios por auditoría — mismo patrón que seguimiento_minuta_participantes).
// A propósito NO se agregan los demás campos de un programa/plan de
// auditoría (objetivos, alcance, criterios, metodología, recursos...) —
// ese detalle sigue viviendo en el plan de auditoría real en SharePoint;
// aquí solo se rastrea el mínimo para dar seguimiento y conectar al portal.
export async function getAuditorias() {
  try {
    const [{ data: auditorias, error: aErr }, { data: equipo, error: eErr }] = await Promise.all([
      supabase.from("sig_auditorias").select("*, auditor_lider:personas(id,nombre)").order("fecha_programada", { ascending: true }),
      supabase.from("sig_auditoria_equipo").select("*, persona:personas(id,nombre)").order("orden"),
    ]);
    if (aErr || eErr) {
      console.error("Error al cargar el programa de auditorías:", aErr || eErr);
      return [];
    }
    const porAuditoria = new Map();
    (equipo || []).forEach((e) => {
      if (!porAuditoria.has(e.auditoria_id)) porAuditoria.set(e.auditoria_id, []);
      porAuditoria.get(e.auditoria_id).push(e);
    });
    return (auditorias || []).map((a) => ({ ...a, equipo: porAuditoria.get(a.id) || [] }));
  } catch (err) {
    console.error("Error inesperado al cargar el programa de auditorías:", err);
    return [];
  }
}

export async function createAuditoria(payload, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_auditorias")
      .insert({
        macroproceso: payload.macroproceso,
        fecha_programada: payload.fechaProgramada || null,
        auditor_lider_persona_id: payload.auditorLiderPersonaId ? Number(payload.auditorLiderPersonaId) : null,
        reporte_url: payload.reporteUrl || null,
        notas: payload.notas || null,
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
      })
      .select("*, auditor_lider:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };

    const equipoIds = [...new Set((payload.equipoPersonaIds || []).map(Number))].filter(
      (id) => String(id) !== String(payload.auditorLiderPersonaId)
    );
    if (equipoIds.length) {
      const rows = equipoIds.map((personaId, index) => ({ auditoria_id: data.id, persona_id: personaId, orden: index }));
      const { error: eqErr } = await supabase.from("sig_auditoria_equipo").insert(rows);
      if (eqErr) console.error("Error al guardar el equipo auditor:", eqErr);
    }
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al programar la auditoría:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function updateAuditoria(id, changes) {
  try {
    const { data, error } = await supabase
      .from("sig_auditorias")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar la auditoría:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function deleteAuditoria(id) {
  try {
    const { error } = await supabase.from("sig_auditorias").delete().eq("id", id);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al eliminar la auditoría:", err);
    return { ok: false, error: err };
  }
}

// Mismo mecanismo que createAccionCorrectivaPorCambio en cambiosService.js:
// el hallazgo de auditoría se convierte en una Acción Correctiva real del
// Centro de Gestión de Acciones, con análisis de causa y verificación de
// eficacia exigidos por default (es una acción nacida de auditoría, no un
// ajuste menor).
export async function createAccionCorrectivaPorAuditoria(auditoria, actor) {
  const result = await createAccion(
    {
      tipo: "Acción Correctiva",
      nivel: "Operativa",
      origenModulo: "Programa de Auditorías SIG",
      origenTabla: "sig_auditorias",
      origenId: auditoria.id,
      titulo: `Hallazgo de auditoría — ${auditoria.macroproceso}`,
      descripcion: auditoria.notas || "",
      prioridad: "Alta",
      requiereAnalisisCausa: true,
      requiereVerificacionEficacia: true,
    },
    actor
  );
  if (!result?.ok) return result;
  const updateResult = await updateAuditoria(auditoria.id, { accion_correctiva_id: result.data.id });
  if (!updateResult.ok) return updateResult;
  return result;
}
