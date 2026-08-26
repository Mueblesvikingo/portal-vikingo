import jsPDF from "jspdf";
import { supabase } from "./supabase";
import { createAccion } from "./accionesService";
import { upsertEstado } from "./sigService";
import { VIKINGO_LOGO_PNG_BASE64 } from "../assets/vikingoLogoBase64";
import { isDirectorGeneral } from "./permissionsService";

// Mismo encabezado de documento controlado del SIG que minutasService.js
// (Código/Edición/Fecha/Aplicación + logo Vikingo) — códigos siguientes en
// la numeración SIG-F ya usada (SIG-F-01 Presupuesto Estrategia, SIG-F-02
// Minutas): SIG-F-03 para el Programa de auditoría, SIG-F-04 para la Ficha
// de auditoría (Plan + Informe, un solo PDF por sesión).
const NEGRO = [23, 23, 23];
const ROJO = [124, 20, 22];
const GRIS = [120, 120, 120];
const GRIS_LINEA = [205, 205, 205];
const DOC_EDICION = "01";
const DOC_FECHA_EDICION = "19/08/2026";
const LOGO_RATIO = 432 / 122;

function drawDocumentHeader(doc, { titulo, aplicacion, codigo }, paginaSpots) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const top = 30;
  const headerHeight = 60;
  const logoColWidth = 105;
  const metaColWidth = 150;
  const metaX = pageWidth - marginX - metaColWidth;
  const middleX = marginX + logoColWidth + 12;
  const middleWidth = metaX - middleX - 12;

  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(1);
  doc.rect(marginX, top, contentWidth, headerHeight);
  doc.line(marginX + logoColWidth, top, marginX + logoColWidth, top + headerHeight);
  doc.line(metaX, top, metaX, top + headerHeight);

  const logoW = 68;
  const logoH = logoW / LOGO_RATIO;
  doc.addImage(`data:image/png;base64,${VIKINGO_LOGO_PNG_BASE64}`, "PNG", marginX + (logoColWidth - logoW) / 2, top + (headerHeight - logoH) / 2, logoW, logoH);

  doc.setTextColor(...NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(titulo, middleX, top + 21, { maxWidth: middleWidth });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ROJO);
  doc.text("Sistema Integrado de Gestión", middleX, top + 34, { maxWidth: middleWidth });
  doc.setTextColor(...GRIS);
  doc.text(`Aplicación: ${aplicacion}`, middleX, top + 46, { maxWidth: middleWidth });

  const metaRows = [["Código:", codigo], ["Estado:", "Vigente"], ["Edición:", DOC_EDICION], ["Fecha:", DOC_FECHA_EDICION], ["Página:", "__PAGINA__"]];
  const rowH = headerHeight / metaRows.length;
  metaRows.forEach((row, i) => {
    const rowY = top + i * rowH;
    if (i > 0) {
      doc.setDrawColor(...GRIS_LINEA);
      doc.setLineWidth(0.5);
      doc.line(metaX, rowY, pageWidth - marginX, rowY);
    }
    const textY = rowY + rowH / 2 + 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...ROJO);
    doc.text(row[0], metaX + 8, textY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NEGRO);
    if (row[1] === "__PAGINA__") {
      const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      paginaSpots.push({ page: pageNum, x: metaX + 48, y: textY });
    } else {
      doc.text(String(row[1]), metaX + 48, textY);
    }
  });

  return top + headerHeight;
}

function finishPagination(doc, paginaSpots) {
  const totalPages = doc.internal.getNumberOfPages();
  paginaSpots.forEach((spot) => {
    doc.setPage(spot.page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...NEGRO);
    doc.text(`${spot.page} de ${totalPages}`, spot.x, spot.y);
  });
  doc.setPage(totalPages);
}

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

// Roles ISO 19011: auditor líder (responsable único de la auditoría) y
// equipo auditor (uno o más auditores adicionales, tabla aparte porque son
// varios por auditoría — mismo patrón que seguimiento_minuta_participantes).
// El resto del Plan (§6.3: auditado, alcance, modalidad, criterios) y del
// Informe (§6.5: hallazgos, conclusiones, declaración, seguimiento) también
// se captura en el portal — ver sig_auditoria_hallazgos y los campos abajo.
// La evidencia primaria del auditado sigue viviendo en su SharePoint.
export async function getAuditorias() {
  try {
    const [{ data: auditorias, error: aErr }, { data: equipo, error: eErr }] = await Promise.all([
      supabase.from("sig_auditorias").select("*, auditor_lider:personas!sig_auditorias_auditor_persona_id_fkey(id,nombre), auditado:personas!sig_auditorias_auditado_persona_id_fkey(id,nombre), programa:sig_programas_auditoria(id,nombre)").order("fecha_programada", { ascending: true }),
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
        programa_id: payload.programaId ? Number(payload.programaId) : null,
        auditado_persona_id: payload.auditadoPersonaId ? Number(payload.auditadoPersonaId) : null,
        alcance: payload.alcance || null,
        modalidad_lugar: payload.modalidadLugar || null,
        criterios: payload.criterios || [],
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
      })
      .select("*, auditor_lider:personas!sig_auditorias_auditor_persona_id_fkey(id,nombre), auditado:personas!sig_auditorias_auditado_persona_id_fkey(id,nombre)")
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

// Un hallazgo se convierte en una Acción Correctiva real del Centro de
// Gestión de Acciones, con análisis de causa y verificación de eficacia
// exigidos por default (nace de auditoría, no es un ajuste menor). Una
// auditoría puede tener varios hallazgos, así que esto se puede llamar
// varias veces para la misma auditoría — el vínculo vive en origen_tabla/
// origen_id de `acciones` (mismo patrón que Control de Cambios), no en una
// sola columna de sig_auditorias.
export async function createAccionDesdeHallazgo(auditoria, formValues, actor) {
  return createAccion(
    {
      tipo: "Acción Correctiva",
      nivel: "Operativa",
      origenModulo: "Programa de Auditorías SIG",
      origenTabla: "sig_auditorias",
      origenId: auditoria.id,
      titulo: formValues.titulo?.trim() || `Hallazgo de auditoría — ${auditoria.macroproceso}`,
      descripcion: formValues.descripcion || "",
      responsablePersonaId: formValues.responsablePersonaId ? Number(formValues.responsablePersonaId) : null,
      prioridad: formValues.prioridad || "Alta",
      requiereAnalisisCausa: true,
      requiereVerificacionEficacia: true,
    },
    actor
  );
}

// ---- Programa de auditoría (ISO 19011 §5) — editable, uno "Vigente" a la vez ----

export async function getProgramaVigente() {
  try {
    const { data, error } = await supabase
      .from("sig_programas_auditoria")
      .select("*, aprobado_por:personas!sig_programas_auditoria_aprobado_por_persona_id_fkey(id,nombre)")
      .eq("estado", "Vigente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Error al cargar el programa de auditoría vigente:", error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error("Error inesperado al cargar el programa de auditoría vigente:", err);
    return null;
  }
}

export async function getProgramas() {
  try {
    const { data, error } = await supabase
      .from("sig_programas_auditoria")
      .select("*, aprobado_por:personas!sig_programas_auditoria_aprobado_por_persona_id_fkey(id,nombre)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error al cargar los programas de auditoría:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar los programas de auditoría:", err);
    return [];
  }
}

export async function createPrograma(payload, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_programas_auditoria")
      .insert({
        nombre: payload.nombre,
        objetivos: payload.objetivos || null,
        alcance: payload.alcance || null,
        riesgos_oportunidades: payload.riesgosOportunidades || null,
        recursos_roles: payload.recursosRoles || null,
        criterios_generales: payload.criteriosGenerales || null,
        enfoque_metodologico: payload.enfoqueMetodologico || null,
        documentos_referencia: payload.documentosReferencia || null,
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
      })
      .select("*, aprobado_por:personas!sig_programas_auditoria_aprobado_por_persona_id_fkey(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear el programa de auditoría:", err);
    return { ok: false, error: err, data: null };
  }
}

// Mismo criterio que ya usa AUDITORIA_LIDER_PERSONA_IDS en
// SigDiagnosisModule.jsx: Cristian (id 15) es el Coordinador SIG.
const COORDINADOR_SIG_PERSONA_ID = 15;

// Editar un programa ya firmado/aprobado limpia ambas firmas — un cambio
// de contenido exige volver a firmar, no se queda "firmado" sobre texto
// distinto.
export async function updatePrograma(id, changes, actor) {
  try {
    const { data, error } = await supabase
      .from("sig_programas_auditoria")
      .update({
        ...changes,
        aprobado_por_persona_id: null, aprobado_por_nombre: null, aprobado_at: null,
        firmado_coordinador_persona_id: null, firmado_coordinador_nombre: null, firmado_coordinador_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, aprobado_por:personas!sig_programas_auditoria_aprobado_por_persona_id_fkey(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al actualizar el programa de auditoría:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function aprobarPrograma(id, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_programas_auditoria")
      .update({ aprobado_por_persona_id: personaId, aprobado_por_nombre: nombre, aprobado_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, aprobado_por:personas!sig_programas_auditoria_aprobado_por_persona_id_fkey(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al aprobar el programa de auditoría:", err);
    return { ok: false, error: err, data: null };
  }
}

// "Firma automática al reconocer el usuario" — mismo patrón que
// firmarMinuta() en minutasService.js: no se teclea nombre, se toma
// directo de currentUser, y solo puede firmar quien de verdad es el
// Coordinador SIG (no cualquier miembro del equipo estratégico).
export async function firmarProgramaComoCoordinador(id, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    if (personaId !== COORDINADOR_SIG_PERSONA_ID) {
      return { ok: false, error: "Solo el Coordinador SIG puede firmar aquí.", data: null };
    }
    const { data, error } = await supabase
      .from("sig_programas_auditoria")
      .update({ firmado_coordinador_persona_id: personaId, firmado_coordinador_nombre: nombre, firmado_coordinador_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, aprobado_por:personas!sig_programas_auditoria_aprobado_por_persona_id_fkey(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al firmar el programa como Coordinador SIG:", err);
    return { ok: false, error: err, data: null };
  }
}

// Editar cualquier contenido de la Ficha (plan, hallazgos, cierre) invalida
// las 3 firmas ya capturadas — mismo criterio que Programa: un cambio de
// contenido exige volver a firmar. Se exporta para que la UI lo incluya en
// sus propios `changes` al llamar updateAuditoria() sobre campos de plan/
// cierre; upsertHallazgo() lo aplica directo por tocar otra tabla.
export const FICHA_FIRMAS_CLEAR = {
  firmado_coordinador_persona_id: null, firmado_coordinador_nombre: null, firmado_coordinador_at: null,
  firmado_director_persona_id: null, firmado_director_nombre: null, firmado_director_at: null,
  firmado_auditado_persona_id: null, firmado_auditado_nombre: null, firmado_auditado_at: null,
};

// "Firma automática al reconocer el usuario" — mismo patrón que
// firmarMinuta()/firmarProgramaComoCoordinador(): no se teclea nombre, se
// toma directo de currentUser, y solo firma quien de verdad corresponde.
export async function firmarFichaComoCoordinador(auditoriaId, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    if (personaId !== COORDINADOR_SIG_PERSONA_ID) {
      return { ok: false, error: "Solo el Coordinador SIG puede firmar aquí.", data: null };
    }
    const { data, error } = await supabase
      .from("sig_auditorias")
      .update({ firmado_coordinador_persona_id: personaId, firmado_coordinador_nombre: nombre, firmado_coordinador_at: new Date().toISOString() })
      .eq("id", auditoriaId)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al firmar la ficha como Coordinador SIG:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function firmarFichaComoDirector(auditoriaId, actor) {
  try {
    if (!isDirectorGeneral(actor)) {
      return { ok: false, error: "Solo el Director General puede firmar aquí.", data: null };
    }
    const { personaId, nombre } = actorFields(actor);
    const { data, error } = await supabase
      .from("sig_auditorias")
      .update({ firmado_director_persona_id: personaId, firmado_director_nombre: nombre, firmado_director_at: new Date().toISOString() })
      .eq("id", auditoriaId)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al firmar la ficha como Director General:", err);
    return { ok: false, error: err, data: null };
  }
}

// El auditado varía por sesión (no hay un id fijo como Coordinador/
// Director), así que se verifica contra el auditado_persona_id guardado
// en esta auditoría específica.
export async function firmarFichaComoAuditado(auditoriaId, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data: auditoria, error: findErr } = await supabase
      .from("sig_auditorias")
      .select("auditado_persona_id")
      .eq("id", auditoriaId)
      .maybeSingle();
    if (findErr) return { ok: false, error: findErr, data: null };
    if (!auditoria || Number(auditoria.auditado_persona_id) !== personaId) {
      return { ok: false, error: "Solo el auditado de esta sesión puede firmar aquí.", data: null };
    }
    const { data, error } = await supabase
      .from("sig_auditorias")
      .update({ firmado_auditado_persona_id: personaId, firmado_auditado_nombre: nombre, firmado_auditado_at: new Date().toISOString() })
      .eq("id", auditoriaId)
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al firmar la ficha como auditado:", err);
    return { ok: false, error: err, data: null };
  }
}

// ---- Hallazgos de auditoría (ISO 19011 §6.5 g) — uno por criterio evaluado ----

export async function getHallazgos(auditoriaId) {
  if (!auditoriaId) return [];
  try {
    const { data, error } = await supabase
      .from("sig_auditoria_hallazgos")
      .select("*")
      .eq("auditoria_id", auditoriaId);
    if (error) {
      console.error("Error al cargar los hallazgos de la auditoría:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error inesperado al cargar los hallazgos de la auditoría:", err);
    return [];
  }
}

// Guarda el hallazgo del criterio Y, si hay nivel confirmado, lo escribe
// también en sig_diagnostico_estados vía upsertEstado (mismo servicio que
// usa la matriz de Diagnóstico HLS) — así el hallazgo de la auditoría pasa
// a ser el dato real del diagnóstico, no una copia paralela.
export async function upsertHallazgo(auditoriaId, criterio, { nivel, evidencia }, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { numeral, subtitulo, numero } = criterio;
    const { data, error } = await supabase
      .from("sig_auditoria_hallazgos")
      .upsert(
        {
          auditoria_id: auditoriaId,
          numeral,
          subtitulo,
          numero,
          nivel_confirmado: nivel ?? null,
          evidencia_observada: evidencia || null,
          updated_at: new Date().toISOString(),
          updated_by_persona_id: personaId,
          updated_by_nombre: nombre,
        },
        { onConflict: "auditoria_id,numeral,subtitulo,numero" }
      )
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };

    if (nivel !== null && nivel !== undefined && criterio.proceso) {
      const estadoResult = await upsertEstado(
        { subtitulo, numero, numeral, proceso: criterio.proceso, score: nivel, evidencia: evidencia || "" },
        { actor }
      );
      if (!estadoResult.ok) console.error("Hallazgo guardado, pero no se pudo actualizar Diagnóstico SIG:", estadoResult.error);
    }

    const { error: clearErr } = await supabase.from("sig_auditorias").update(FICHA_FIRMAS_CLEAR).eq("id", auditoriaId);
    if (clearErr) console.error("Hallazgo guardado, pero no se pudieron limpiar las firmas de la ficha:", clearErr);

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar el hallazgo de auditoría:", err);
    return { ok: false, error: err, data: null };
  }
}

// ---- Estilos visuales compartidos por los PDF de auditoría ----
// Mismos 4 colores (y sus tintes de fondo) que ya usa la rúbrica 0/3/5/10
// en el artefacto HTML aprobado por el usuario — se reutilizan aquí para
// que el PDF se vea consistente con lo que ya vio y aceptó.
const LV_STYLES = {
  0: { fg: [166, 54, 45], bg: [251, 234, 232], label: "No implementado" },
  3: { fg: [165, 113, 31], bg: [251, 241, 222], label: "En desarrollo" },
  5: { fg: [33, 113, 79], bg: [230, 243, 236], label: "Implementado" },
  10: { fg: [30, 39, 97], bg: [231, 233, 246], label: "Estandarizado" },
};
const CARD_BG = [248, 248, 250];

// Mide y dibuja un campo como tarjeta: cuadro rojo pequeño + título, y el
// cuerpo como párrafo o —si el texto trae saltos de línea— como lista con
// viñetas (una viñeta por línea del texto guardado). El alto de la tarjeta
// se calcula antes de dibujar para poder pintar el fondo de una sola vez.
function measureFieldCard(doc, width, texto) {
  const cardPad = 12;
  const bulletIndent = 13;
  const lineH = 13;
  const raw = texto && texto.trim() ? texto : "Sin definir.";
  const isBulleted = raw.includes("\n");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const items = isBulleted
    ? raw.split("\n").filter(Boolean).map((p) => doc.splitTextToSize(p, width - cardPad * 2 - bulletIndent))
    : [doc.splitTextToSize(raw, width - cardPad * 2)];
  const totalLines = items.reduce((sum, lines) => sum + lines.length, 0);
  const itemGap = isBulleted ? (items.length - 1) * 5 : 0;
  const titleBlock = 20;
  const height = cardPad * 2 + titleBlock + totalLines * lineH + itemGap;
  return { cardPad, bulletIndent, lineH, isBulleted, items, height };
}

function drawFieldCard(doc, x, y, width, titulo, layout) {
  const { cardPad, bulletIndent, lineH, isBulleted, items, height } = layout;
  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...GRIS_LINEA);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, width, height, 6, 6, "FD");

  doc.setFillColor(...ROJO);
  doc.roundedRect(x + cardPad, y + cardPad + 1, 6, 6, 1.5, 1.5, "F");
  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(titulo, x + cardPad + 12, y + cardPad + 7);

  let cursor = y + cardPad + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...NEGRO);
  items.forEach((lines) => {
    if (isBulleted) {
      doc.setFillColor(...GRIS);
      doc.circle(x + cardPad + 3, cursor - 3, 1.6, "F");
      doc.text(lines, x + cardPad + bulletIndent, cursor);
    } else {
      doc.text(lines, x + cardPad, cursor);
    }
    cursor += lines.length * lineH + (isBulleted ? 5 : 0);
  });

  return y + height;
}

// Franja de 4 celdas con la escala 0/3/5/10 — misma info que ya vive en
// scoreMeaning()/cellStyle() de SigDiagnosisModule.jsx, dibujada aquí de
// forma fija (no depende de texto capturado) para que siempre se vea igual.
function drawEscalaCalificacion(doc, x, y, width) {
  const gap = 8;
  const cellW = (width - gap * 3) / 4;
  const cellH = 40;
  [0, 3, 5, 10].forEach((nivel, i) => {
    const style = LV_STYLES[nivel];
    const cellX = x + i * (cellW + gap);
    doc.setFillColor(...style.bg);
    doc.roundedRect(cellX, y, cellW, cellH, 5, 5, "F");
    doc.setTextColor(...style.fg);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(nivel), cellX + 8, y + 17);
    doc.setFontSize(7.8);
    doc.text(style.label, cellX + 8, y + 30, { maxWidth: cellW - 14 });
  });
  return y + cellH;
}

// Tarjeta de un criterio en la Ficha de auditoría: etiqueta + texto del
// criterio, evidencia esperada, una píldora de color con el nivel
// confirmado (mismos colores que LV_STYLES) y, si existe, la evidencia
// observada durante la sesión.
function measureCriterioCard(doc, width, c) {
  const pad = 12;
  const tagColW = 58;
  const innerWidth = width - pad * 2 - tagColW;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const textoLines = doc.splitTextToSize(c.texto, innerWidth);
  doc.setFontSize(8.3);
  const evLines = doc.splitTextToSize(`Evidencia esperada: ${c.evidenciaEsperada || "—"}`, innerWidth);
  let obsLines = [];
  if (c.evidenciaObservada) {
    doc.setFontSize(9);
    obsLines = doc.splitTextToSize(`Evidencia observada: ${c.evidenciaObservada}`, innerWidth);
  }
  const height = pad * 2 + textoLines.length * 12.5 + evLines.length * 11 + 8 + 18 + (obsLines.length ? obsLines.length * 11 + 4 : 0);
  return { pad, tagColW, textoLines, evLines, obsLines, height };
}

function drawCriterioCard(doc, x, y, width, c, layout) {
  const { pad, tagColW, textoLines, evLines, obsLines, height } = layout;
  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...GRIS_LINEA);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, width, height, 6, 6, "FD");

  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(c.tag, x + pad, y + pad + 8);

  const textX = x + pad + tagColW;
  doc.setTextColor(...NEGRO);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(textoLines, textX, y + pad + 8);
  let cursor = y + pad + 8 + textoLines.length * 12.5 + 3;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.3);
  doc.setTextColor(...GRIS);
  doc.text(evLines, textX, cursor);
  cursor += evLines.length * 11 + 8;

  const style = c.nivelConfirmado == null ? { fg: GRIS, bg: [240, 240, 242] } : LV_STYLES[c.nivelConfirmado];
  const label = c.nivelConfirmado == null ? "SIN CAPTURAR" : `${c.nivelConfirmado} · ${LV_STYLES[c.nivelConfirmado].label.toUpperCase()}`;
  const badgeW = 104;
  doc.setFillColor(...style.bg);
  doc.roundedRect(textX, cursor - 10, badgeW, 15, 7.5, 7.5, "F");
  doc.setTextColor(...style.fg);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.text(label, textX + badgeW / 2, cursor, { align: "center" });
  cursor += 16;

  if (obsLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...NEGRO);
    doc.text(obsLines, textX, cursor);
  }

  return y + height;
}

// ---- PDF: Programa de auditoría (SIG-F-03) ----

function buildProgramaPdfDoc(programa) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 50;
  const paginaSpots = [];
  const headerOpts = { titulo: "PROGRAMA DE AUDITORÍA SIG", aplicacion: "Diagnóstico SIG", codigo: "SIG-F-03" };

  function ensureSpace(y, needed) {
    if (y + needed > bottomLimit) {
      doc.addPage();
      return drawDocumentHeader(doc, headerOpts, paginaSpots) + 24;
    }
    return y;
  }

  let y = drawDocumentHeader(doc, headerOpts, paginaSpots) + 24;

  doc.setFillColor(...ROJO);
  doc.rect(marginX, y, contentWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(programa.nombre || "Programa de auditoría", marginX + 14, y + 22, { maxWidth: contentWidth - 28 });
  y += 34 + 16;

  const secciones = [
    ["Objetivos del programa (ISO 19011 §5)", programa.objetivos],
    ["Alcance del programa", programa.alcance],
    ["Riesgos y oportunidades del programa", programa.riesgos_oportunidades],
    ["Recursos y roles", programa.recursos_roles],
    ["Criterios generales", programa.criterios_generales],
    ["Enfoque metodológico", programa.enfoque_metodologico],
    ["Documentos de referencia", programa.documentos_referencia],
  ];

  secciones.forEach(([titulo, texto]) => {
    const layout = measureFieldCard(doc, contentWidth, texto);
    y = ensureSpace(y, layout.height);
    y = drawFieldCard(doc, marginX, y, contentWidth, titulo, layout) + 12;
    if (titulo.startsWith("Criterios generales")) {
      y = ensureSpace(y, 52);
      doc.setTextColor(...GRIS);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("ESCALA DE CALIFICACIÓN", marginX, y);
      y = drawEscalaCalificacion(doc, marginX, y + 6, contentWidth) + 16;
    }
  });

  y = ensureSpace(y, 100);
  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Firmas", marginX, y);
  y += 14;

  const colW = (contentWidth - 20) / 2;
  drawFirmaBlock(doc, marginX, y, colW, "Coordinador SIG", programa.firmado_coordinador_nombre, programa.firmado_coordinador_at);
  drawFirmaBlock(doc, marginX + colW + 20, y, colW, "Director General", programa.aprobado_por_nombre, programa.aprobado_at);
  y += 92;

  finishPagination(doc, paginaSpots);
  return doc;
}

function drawFirmaBlock(doc, x, y, width, rol, nombre, fecha) {
  const firmado = Boolean(nombre);
  const badgeStyle = firmado ? { fg: [33, 113, 79], bg: [230, 243, 236], label: "FIRMADO" } : { fg: [165, 113, 31], bg: [251, 241, 222], label: "PENDIENTE" };
  doc.setFillColor(...badgeStyle.bg);
  doc.roundedRect(x, y, 66, 16, 8, 8, "F");
  doc.setTextColor(...badgeStyle.fg);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(badgeStyle.label, x + 33, y + 11, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text(rol.toUpperCase(), x, y + 30);

  if (firmado) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...ROJO);
    doc.text(nombre, x, y + 44, { maxWidth: width });
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(new Date(fecha).toLocaleDateString("es-MX"), x, y + 57);
  } else {
    doc.setDrawColor(...GRIS_LINEA);
    doc.setLineWidth(0.5);
    doc.line(x, y + 50, x + width, y + 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("Nombre, firma y fecha", x, y + 62);
  }
}

export function downloadProgramaPdf(programa) {
  const doc = buildProgramaPdfDoc(programa);
  const safeTitle = (programa.nombre || "programa").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  doc.save(`${safeTitle}.pdf`);
}

// ---- PDF: Ficha de auditoría — Plan + Informe (SIG-F-04) ----
// `criterios` viene ya resuelto por la UI: [{ tag, texto, evidenciaEsperada,
// nivelConfirmado, evidenciaObservada }] — este servicio no conoce el
// catálogo de criterios (sigSections vive en el módulo), solo lo dibuja.
function buildFichaAuditoriaPdfDoc(auditoria, criterios) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 50;
  const paginaSpots = [];
  const headerOpts = { titulo: "FICHA DE AUDITORÍA SIG", aplicacion: "Diagnóstico SIG", codigo: "SIG-F-04" };

  function ensureSpace(y, needed) {
    if (y + needed > bottomLimit) {
      doc.addPage();
      return drawDocumentHeader(doc, headerOpts, paginaSpots) + 24;
    }
    return y;
  }

  let y = drawDocumentHeader(doc, headerOpts, paginaSpots) + 24;

  doc.setFillColor(...ROJO);
  doc.rect(marginX, y, contentWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(auditoria.macroproceso || "Proceso auditado", marginX + 14, y + 22, { maxWidth: contentWidth - 28 });
  y += 34 + 18;

  doc.setTextColor(...NEGRO);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const datos = [
    `Auditor líder: ${auditoria.auditor_lider?.nombre || "Sin asignar"}`,
    `Auditado: ${auditoria.auditado?.nombre || "Sin asignar"}`,
    `Fecha: ${auditoria.fecha_programada || "Por definir"}`,
    `Modalidad y lugar: ${auditoria.modalidad_lugar || "Sin definir"}`,
  ];
  datos.forEach((linea) => { doc.text(linea, marginX, y); y += 13; });
  if (auditoria.alcance) {
    const lines = doc.splitTextToSize(`Alcance: ${auditoria.alcance}`, contentWidth);
    lines.forEach((line) => { y = ensureSpace(y, 13); doc.text(line, marginX, y); y += 13; });
  }
  y += 12;

  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  y = ensureSpace(y, 20);
  doc.text("Criterios y hallazgos (ISO 19011 §6.5 f-g)", marginX, y);
  y += 16;

  (criterios || []).forEach((c) => {
    const layout = measureCriterioCard(doc, contentWidth, c);
    y = ensureSpace(y, layout.height);
    y = drawCriterioCard(doc, marginX, y, contentWidth, c, layout) + 10;
  });
  y += 6;

  const cierre = [
    ["Conclusiones de la auditoría (h)", auditoria.conclusiones],
    ["Declaración del grado de cumplimiento (i)", auditoria.declaracion_cumplimiento],
    ["Opiniones divergentes no resueltas (j)", auditoria.opiniones_divergentes],
    ["Plan de seguimiento (k)", auditoria.plan_seguimiento],
  ];
  cierre.forEach(([titulo, texto]) => {
    const layout = measureFieldCard(doc, contentWidth, texto);
    y = ensureSpace(y, layout.height);
    y = drawFieldCard(doc, marginX, y, contentWidth, titulo, layout) + 10;
  });

  y = ensureSpace(y, 110);
  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Firmas", marginX, y);
  y += 14;

  const firmaGap = 16;
  const firmaColW = (contentWidth - firmaGap * 2) / 3;
  drawFirmaBlock(doc, marginX, y, firmaColW, "Coordinador SIG", auditoria.firmado_coordinador_nombre, auditoria.firmado_coordinador_at);
  drawFirmaBlock(doc, marginX + firmaColW + firmaGap, y, firmaColW, "Director General", auditoria.firmado_director_nombre, auditoria.firmado_director_at);
  drawFirmaBlock(doc, marginX + (firmaColW + firmaGap) * 2, y, firmaColW, "Auditado", auditoria.firmado_auditado_nombre, auditoria.firmado_auditado_at);

  finishPagination(doc, paginaSpots);
  return doc;
}

export function downloadFichaAuditoriaPdf(auditoria, criterios) {
  const doc = buildFichaAuditoriaPdfDoc(auditoria, criterios);
  const safeTitle = (auditoria.macroproceso || "auditoria").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  doc.save(`ficha-auditoria-${safeTitle}-${auditoria.fecha_programada || "sin-fecha"}.pdf`);
}
