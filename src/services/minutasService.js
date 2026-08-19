import jsPDF from "jspdf";
import { supabase } from "./supabase";
import { VIKINGO_LOGO_PNG_BASE64 } from "../assets/vikingoLogoBase64";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

// Identidad Vikingo (negro + rojo oscuro) y encabezado de documento controlado
// del SIG, siguiendo el formato de SIG-P-02/SIG-P-03. Código asignado revisando
// la carpeta "04) Documentación del SIG" / "03) Formatos": el único SIG-F
// existente es SIG-F-01 (Presupuesto Estrategia), por lo que a esta minuta
// (primer Formato del proceso "Planeación estratégica del SIG" para Seguimiento
// Estratégico) le corresponde el siguiente consecutivo.
const NEGRO = [23, 23, 23];
const ROJO = [124, 20, 22];
const GRIS = [120, 120, 120];
const GRIS_LINEA = [205, 205, 205];
const DOC_CODIGO = "SIG-F-02";
const DOC_EDICION = "01";
const DOC_FECHA_EDICION = "19/08/2026";
const DOC_APLICACION = "Seguimiento Estratégico";
const LOGO_RATIO = 432 / 122;

export async function getMinutas() {
  try {
    const [{ data: minutas, error: mErr }, { data: participantes, error: pErr }] = await Promise.all([
      supabase.from("seguimiento_minutas").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("seguimiento_minuta_participantes").select("*, persona:personas(id,nombre)").order("orden"),
    ]);
    if (mErr || pErr) {
      console.error("Error al cargar minutas:", mErr || pErr);
      return [];
    }
    const porMinuta = new Map();
    (participantes || []).forEach((p) => {
      if (!porMinuta.has(p.minuta_id)) porMinuta.set(p.minuta_id, []);
      porMinuta.get(p.minuta_id).push(p);
    });
    return (minutas || []).map((m) => ({ ...m, participantes: porMinuta.get(m.id) || [] }));
  } catch (err) {
    console.error("Error inesperado al cargar minutas:", err);
    return [];
  }
}

export async function getMinutaDetalle(minutaId) {
  try {
    const [{ data: minuta, error: mErr }, { data: participantes }, { data: puntos }] = await Promise.all([
      supabase.from("seguimiento_minutas").select("*").eq("id", minutaId).single(),
      supabase.from("seguimiento_minuta_participantes").select("*, persona:personas(id,nombre)").eq("minuta_id", minutaId).order("orden"),
      supabase.from("seguimiento_minuta_puntos").select("*, responsable:personas(id,nombre)").eq("minuta_id", minutaId).order("orden"),
    ]);
    if (mErr) { console.error("Error al cargar la minuta:", mErr); return null; }
    return { ...minuta, participantes: participantes || [], puntos: puntos || [] };
  } catch (err) {
    console.error("Error inesperado al cargar la minuta:", err);
    return null;
  }
}

export async function createMinuta({ tipo, titulo, fecha, procesoRelacionado, participantesPersonaIds, puntos }, actor) {
  try {
    const { personaId, nombre } = actorFields(actor);
    const { data: minuta, error } = await supabase
      .from("seguimiento_minutas")
      .insert({
        tipo: tipo || "Acuerdo",
        titulo,
        fecha: fecha || new Date().toISOString().slice(0, 10),
        proceso_relacionado: procesoRelacionado || null,
        created_by_persona_id: personaId,
        created_by_nombre: nombre,
      })
      .select("*")
      .single();
    if (error) return { ok: false, error, data: null };

    const participantesRows = (participantesPersonaIds || []).map((pid, index) => ({
      minuta_id: minuta.id, persona_id: Number(pid), orden: index,
    }));
    if (participantesRows.length) {
      const { error: pErr } = await supabase.from("seguimiento_minuta_participantes").insert(participantesRows);
      if (pErr) console.error("Error al guardar participantes de la minuta:", pErr);
    }

    const puntosRows = (puntos || [])
      .filter((p) => p.descripcion?.trim())
      .map((p, index) => ({
        minuta_id: minuta.id,
        orden: index,
        descripcion: p.descripcion.trim(),
        acuerdo: p.acuerdo || null,
        responsable_persona_id: p.responsablePersonaId ? Number(p.responsablePersonaId) : null,
        fecha_compromiso: p.fechaCompromiso || null,
      }));
    if (puntosRows.length) {
      const { error: ptErr } = await supabase.from("seguimiento_minuta_puntos").insert(puntosRows);
      if (ptErr) console.error("Error al guardar puntos de la minuta:", ptErr);
    }

    return { ok: true, error: null, data: minuta };
  } catch (err) {
    console.error("Error inesperado al crear la minuta:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function addPunto(minutaId, punto) {
  try {
    const { data, error } = await supabase
      .from("seguimiento_minuta_puntos")
      .insert({
        minuta_id: minutaId,
        orden: punto.orden ?? 0,
        descripcion: punto.descripcion,
        acuerdo: punto.acuerdo || null,
        responsable_persona_id: punto.responsablePersonaId ? Number(punto.responsablePersonaId) : null,
        fecha_compromiso: punto.fechaCompromiso || null,
      })
      .select("*, responsable:personas(id,nombre)")
      .single();
    if (error) return { ok: false, error, data: null };
    return { ok: true, error: null, data };
  } catch (err) {
    console.error("Error inesperado al agregar punto a la minuta:", err);
    return { ok: false, error: err, data: null };
  }
}

export async function removePunto(puntoId) {
  try {
    const { error } = await supabase.from("seguimiento_minuta_puntos").delete().eq("id", puntoId);
    if (error) return { ok: false, error };
    return { ok: true, error: null };
  } catch (err) {
    console.error("Error inesperado al quitar punto de la minuta:", err);
    return { ok: false, error: err };
  }
}

function buildPdfDoc(minuta) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 50;
  const paginaSpots = [];

  // Encabezado de documento controlado del SIG: logo + nombre del documento +
  // ficha (Código/Estado/Edición/Aplicación/Fecha/Página), replicando la
  // estructura del encabezado usado en SIG-P-02/SIG-P-03.
  function drawHeader() {
    const top = 30;
    const headerHeight = 80;
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

    const logoW = 82;
    const logoH = logoW / LOGO_RATIO;
    doc.addImage(
      `data:image/png;base64,${VIKINGO_LOGO_PNG_BASE64}`,
      "PNG",
      marginX + (logoColWidth - logoW) / 2,
      top + (headerHeight - logoH) / 2,
      logoW,
      logoH
    );

    doc.setTextColor(...NEGRO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("MINUTA DE REUNIÓN", middleX, top + 30, { maxWidth: middleWidth });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...ROJO);
    doc.text("Sistema Integrado de Gestión", middleX, top + 46, { maxWidth: middleWidth });
    doc.setTextColor(...GRIS);
    doc.text(`Aplicación: ${DOC_APLICACION}`, middleX, top + 60, { maxWidth: middleWidth });

    const metaRows = [
      ["Código:", DOC_CODIGO],
      ["Estado:", "Vigente"],
      ["Edición:", DOC_EDICION],
      ["Fecha:", DOC_FECHA_EDICION],
      ["Página:", "__PAGINA__"],
    ];
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

  function newPageWithHeader() {
    doc.addPage();
    return drawHeader() + 24;
  }

  function ensureSpace(y, needed) {
    if (y + needed > bottomLimit) return newPageWithHeader();
    return y;
  }

  let y = drawHeader() + 24;

  // Franja con los datos propios de la reunión (tipo, título, fecha, proceso).
  // El título admite hasta 2 líneas: la franja crece según lo que ocupe.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const tituloLines = doc.splitTextToSize(minuta.titulo || "", contentWidth - 28).slice(0, 2);
  const bandHeight = 30 + tituloLines.length * 17 + (minuta.proceso_relacionado ? 8 : 0);
  doc.setFillColor(...ROJO);
  doc.rect(marginX, y, contentWidth, bandHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text((minuta.tipo || "Acuerdo").toUpperCase(), marginX + 14, y + 18);
  doc.setFontSize(15);
  doc.text(tituloLines, marginX + 14, y + 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const infoLinea = `Fecha de la reunión: ${minuta.fecha || ""}${minuta.proceso_relacionado ? "   ·   Proceso: " + minuta.proceso_relacionado : ""}`;
  doc.text(infoLinea, marginX + 14, y + bandHeight - 10, { maxWidth: contentWidth - 28 });
  y += bandHeight + 22;

  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Puntos tratados", marginX, y);
  y += 18;
  doc.setFontSize(10);

  if (!minuta.puntos?.length) {
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "italic");
    doc.text("Sin puntos registrados.", marginX, y);
    y += 20;
  }

  (minuta.puntos || []).forEach((p, index) => {
    y = ensureSpace(y, 30);
    doc.setTextColor(...NEGRO);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(`${index + 1}. ${p.descripcion}`, contentWidth - 10);
    doc.text(titleLines, marginX, y);
    y += titleLines.length * 14;
    if (p.acuerdo) {
      y = ensureSpace(y, 16);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(`Acuerdo: ${p.acuerdo}`, contentWidth - 20);
      doc.text(lines, marginX + 10, y);
      y += lines.length * 14;
    }
    if (p.responsable?.nombre || p.fecha_compromiso) {
      y = ensureSpace(y, 16);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      doc.text(
        `${p.responsable?.nombre ? "Responsable: " + p.responsable.nombre : ""}${p.fecha_compromiso ? "   Fecha compromiso: " + p.fecha_compromiso : ""}`,
        marginX + 10, y
      );
      doc.setFontSize(10);
      doc.setTextColor(...NEGRO);
      y += 16;
    }
    y += 10;
  });

  y = ensureSpace(y + 6, 40);
  doc.setTextColor(...ROJO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Firmas", marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  (minuta.participantes || []).forEach((p) => {
    y = ensureSpace(y, 18);
    doc.setDrawColor(...GRIS_LINEA);
    doc.setLineWidth(0.5);
    doc.line(marginX, y + 4, pageWidth - marginX, y + 4);
    doc.setTextColor(...NEGRO);
    doc.text(p.persona?.nombre || "—", marginX, y);
    if (p.firmado) {
      doc.setTextColor(...ROJO);
      doc.text(
        `Firmado · ${new Date(p.firmado_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}`,
        marginX + 320, y
      );
    } else {
      doc.setTextColor(...GRIS);
      doc.text("Sin firmar", marginX + 320, y);
    }
    y += 18;
  });

  const totalPages = doc.internal.getNumberOfPages();
  paginaSpots.forEach((spot) => {
    doc.setPage(spot.page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...NEGRO);
    doc.text(`${spot.page} de ${totalPages}`, spot.x, spot.y);
  });
  doc.setPage(totalPages);

  return doc;
}

// Descarga directa en el navegador de un PDF "en el momento" — no se sube
// a Storage ni se guarda en el registro. Sirve para consultar/compartir un
// borrador mientras la minuta sigue abierta (con las firmas que ya haya al
// momento de descargar); la versión oficial del histórico es la que se
// genera y sube automáticamente al cerrarse (ver firmarMinuta).
export function downloadMinutaPdfPreview(minuta) {
  const doc = buildPdfDoc(minuta);
  const safeTitle = (minuta.titulo || "minuta").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  doc.save(`minuta-${safeTitle}-${minuta.fecha || ""}.pdf`);
}

// Se sube al bucket público "minutas" (mismo criterio de acceso permisivo
// ya usado en el resto del proyecto) y se guarda la URL pública en el
// registro — así queda descargable desde el histórico sin firmar URLs.
export async function generateAndUploadPdf(minuta) {
  try {
    const doc = buildPdfDoc(minuta);
    const blob = doc.output("blob");
    const path = `minuta-${minuta.id}-${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage.from("minutas").upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (uploadErr) {
      console.error("Error al subir el PDF de la minuta:", uploadErr);
      return { ok: false, error: uploadErr, url: null };
    }
    const { data } = supabase.storage.from("minutas").getPublicUrl(path);
    return { ok: true, error: null, url: data?.publicUrl || null };
  } catch (err) {
    console.error("Error inesperado al generar el PDF de la minuta:", err);
    return { ok: false, error: err, url: null };
  }
}

// "Firma automática al reconocer el usuario": no se teclea nombre, se toma
// directo de currentUser — solo puede firmar quien de verdad es la persona
// listada como participante. Si con esta firma quedan todos firmados, la
// minuta se cierra sola y se genera/sube el PDF en el mismo paso.
export async function firmarMinuta(minutaId, actor) {
  try {
    const personaId = actor?.persona_id != null ? Number(actor.persona_id) : null;
    if (!personaId) return { ok: false, error: "No se pudo identificar a la persona de la sesión.", data: null };

    const { data: participante, error: findErr } = await supabase
      .from("seguimiento_minuta_participantes")
      .select("*")
      .eq("minuta_id", minutaId)
      .eq("persona_id", personaId)
      .maybeSingle();
    if (findErr) return { ok: false, error: findErr, data: null };
    if (!participante) return { ok: false, error: "No estás en la lista de participantes de esta minuta.", data: null };

    const { error: updErr } = await supabase
      .from("seguimiento_minuta_participantes")
      .update({ firmado: true, firmado_at: new Date().toISOString() })
      .eq("id", participante.id);
    if (updErr) return { ok: false, error: updErr, data: null };

    const { data: todos, error: allErr } = await supabase
      .from("seguimiento_minuta_participantes")
      .select("firmado")
      .eq("minuta_id", minutaId);
    if (allErr) console.error("Error al verificar firmas de la minuta:", allErr);
    const todosFirmaron = Boolean(todos?.length) && todos.every((p) => p.firmado);

    let minutaCerrada = null;
    if (todosFirmaron) {
      const detalle = await getMinutaDetalle(minutaId);
      const pdfResult = detalle ? await generateAndUploadPdf(detalle) : { ok: false, url: null };
      const { data: cerrada, error: cerrarErr } = await supabase
        .from("seguimiento_minutas")
        .update({ cerrada: true, cerrada_at: new Date().toISOString(), pdf_url: pdfResult.url || null, updated_at: new Date().toISOString() })
        .eq("id", minutaId)
        .select("*")
        .single();
      if (cerrarErr) console.error("Error al cerrar la minuta:", cerrarErr);
      minutaCerrada = cerrada || null;
    }

    return { ok: true, error: null, data: { cerrada: todosFirmaron, minuta: minutaCerrada } };
  } catch (err) {
    console.error("Error inesperado al firmar la minuta:", err);
    return { ok: false, error: err, data: null };
  }
}
