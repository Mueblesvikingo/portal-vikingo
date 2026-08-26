import jsPDF from "jspdf";
import { supabase } from "./supabase";
import { createAccion } from "./accionesService";
import { upsertEstado } from "./sigService";
import { VIKINGO_LOGO_PNG_BASE64 } from "../assets/vikingoLogoBase64";

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
      supabase.from("sig_auditorias").select("*, auditor_lider:personas!sig_auditorias_auditor_persona_id_fkey(id,nombre), auditado:personas!sig_auditorias_auditado_persona_id_fkey(id,nombre)").order("fecha_programada", { ascending: true }),
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
      .select("*, aprobado_por:personas(id,nombre)")
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
      .select("*, aprobado_por:personas(id,nombre)")
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
      .select("*, aprobado_por:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al crear el programa de auditoría:", err);
    return { ok: false, error: err, data: null };
  }
}

// Editar un programa ya aprobado limpia el VOBO — un cambio de contenido
// exige volver a aprobarlo, no se queda "aprobado" sobre texto distinto.
export async function updatePrograma(id, changes, actor) {
  try {
    const { data, error } = await supabase
      .from("sig_programas_auditoria")
      .update({ ...changes, aprobado_por_persona_id: null, aprobado_por_nombre: null, aprobado_at: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, aprobado_por:personas(id,nombre)")
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
      .select("*, aprobado_por:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al aprobar el programa de auditoría:", err);
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

    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al guardar el hallazgo de auditoría:", err);
    return { ok: false, error: err, data: null };
  }
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

  function ensureSpace(y, needed) {
    if (y + needed > bottomLimit) {
      doc.addPage();
      return drawDocumentHeader(doc, { titulo: "PROGRAMA DE AUDITORÍA SIG", aplicacion: "Diagnóstico SIG", codigo: "SIG-F-03" }, paginaSpots) + 24;
    }
    return y;
  }

  let y = drawDocumentHeader(doc, { titulo: "PROGRAMA DE AUDITORÍA SIG", aplicacion: "Diagnóstico SIG", codigo: "SIG-F-03" }, paginaSpots) + 24;

  doc.setFillColor(...ROJO);
  doc.rect(marginX, y, contentWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(programa.nombre || "Programa de auditoría", marginX + 14, y + 22, { maxWidth: contentWidth - 28 });
  y += 34 + 20;

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
    y = ensureSpace(y, 40);
    doc.setTextColor(...ROJO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(titulo, marginX, y);
    y += 15;
    doc.setTextColor(...NEGRO);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(texto || "Sin definir.", contentWidth);
    lines.forEach((line) => {
      y = ensureSpace(y, 14);
      doc.text(line, marginX, y);
      y += 14;
    });
    y += 10;
  });

  y = ensureSpace(y, 90);
  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Visto bueno", marginX, y);
  y += 24;
  doc.setDrawColor(...GRIS_LINEA);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, marginX + 260, y);
  y += 14;
  doc.setTextColor(...NEGRO);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (programa.aprobado_por_nombre) {
    doc.setTextColor(...ROJO);
    doc.text(`Aprobado por ${programa.aprobado_por_nombre} · ${new Date(programa.aprobado_at).toLocaleDateString("es-MX")}`, marginX, y);
  } else {
    doc.setTextColor(...GRIS);
    doc.text("Director General — nombre, firma y fecha", marginX, y);
  }

  finishPagination(doc, paginaSpots);
  return doc;
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
  y += 18;

  (criterios || []).forEach((c) => {
    y = ensureSpace(y, 60);
    doc.setTextColor(...ROJO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(c.tag, marginX, y);
    doc.setTextColor(...NEGRO);
    doc.setFont("helvetica", "normal");
    const textoLines = doc.splitTextToSize(c.texto, contentWidth - 70);
    doc.text(textoLines, marginX + 60, y);
    y += textoLines.length * 13;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    doc.text(`Evidencia esperada: ${c.evidenciaEsperada || "—"}`, marginX + 60, y);
    y += 13;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(c.nivelConfirmado === null || c.nivelConfirmado === undefined ? GRIS[0] : ROJO[0], c.nivelConfirmado == null ? GRIS[1] : ROJO[1], c.nivelConfirmado == null ? GRIS[2] : ROJO[2]);
    doc.text(`Nivel confirmado: ${c.nivelConfirmado ?? "Sin capturar"}`, marginX + 60, y);
    y += 13;
    if (c.evidenciaObservada) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...NEGRO);
      const evLines = doc.splitTextToSize(`Evidencia observada: ${c.evidenciaObservada}`, contentWidth - 70);
      evLines.forEach((line) => { y = ensureSpace(y, 12); doc.text(line, marginX + 60, y); y += 12; });
    }
    y += 12;
  });

  const cierre = [
    ["Conclusiones de la auditoría (h)", auditoria.conclusiones],
    ["Declaración del grado de cumplimiento (i)", auditoria.declaracion_cumplimiento],
    ["Opiniones divergentes no resueltas (j)", auditoria.opiniones_divergentes],
    ["Plan de seguimiento (k)", auditoria.plan_seguimiento],
  ];
  cierre.forEach(([titulo, texto]) => {
    y = ensureSpace(y, 36);
    doc.setTextColor(...ROJO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(titulo, marginX, y);
    y += 14;
    doc.setTextColor(...NEGRO);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(texto || "Sin registrar.", contentWidth);
    lines.forEach((line) => { y = ensureSpace(y, 13); doc.text(line, marginX, y); y += 13; });
    y += 8;
  });

  y = ensureSpace(y, 70);
  y += 10;
  [["Auditor líder — firma y fecha"], ["Auditado — firma y fecha"]].forEach(([label], i) => {
    const lineY = y + i * 34;
    doc.setDrawColor(...GRIS_LINEA);
    doc.setLineWidth(0.5);
    doc.line(marginX, lineY, marginX + 260, lineY);
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(label, marginX, lineY + 12);
  });

  finishPagination(doc, paginaSpots);
  return doc;
}

export function downloadFichaAuditoriaPdf(auditoria, criterios) {
  const doc = buildFichaAuditoriaPdfDoc(auditoria, criterios);
  const safeTitle = (auditoria.macroproceso || "auditoria").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  doc.save(`ficha-auditoria-${safeTitle}-${auditoria.fecha_programada || "sin-fecha"}.pdf`);
}
