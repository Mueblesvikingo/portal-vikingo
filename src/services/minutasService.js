import jsPDF from "jspdf";
import { supabase } from "./supabase";

function actorFields(actor) {
  return {
    personaId: actor?.persona_id != null ? Number(actor.persona_id) : null,
    nombre: actor?.nombre || actor?.usuario || null,
  };
}

const TIPO_COLOR = {
  Acuerdo: [37, 99, 235],
  Seguimiento: [16, 185, 129],
  "Revisión": [217, 119, 6],
};

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
  const color = TIPO_COLOR[minuta.tipo] || TIPO_COLOR.Acuerdo;

  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text((minuta.tipo || "Acuerdo").toUpperCase(), 40, 30);
  doc.setFontSize(18);
  doc.text(minuta.titulo || "", 40, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Fecha: ${minuta.fecha || ""}${minuta.proceso_relacionado ? "   ·   Proceso: " + minuta.proceso_relacionado : ""}`, 40, 75);

  let y = 120;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Puntos tratados", 40, y);
  y += 20;
  doc.setFontSize(10);

  if (!minuta.puntos?.length) {
    doc.setFont("helvetica", "italic");
    doc.text("Sin puntos registrados.", 40, y);
    y += 20;
  }

  (minuta.puntos || []).forEach((p, index) => {
    if (y > 700) { doc.addPage(); y = 40; }
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(`${index + 1}. ${p.descripcion}`, pageWidth - 80);
    doc.text(titleLines, 40, y);
    y += titleLines.length * 14;
    if (p.acuerdo) {
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(`Acuerdo: ${p.acuerdo}`, pageWidth - 90);
      doc.text(lines, 50, y);
      y += lines.length * 14;
    }
    if (p.responsable?.nombre || p.fecha_compromiso) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(
        `${p.responsable?.nombre ? "Responsable: " + p.responsable.nombre : ""}${p.fecha_compromiso ? "   Fecha compromiso: " + p.fecha_compromiso : ""}`,
        50, y
      );
      doc.setFontSize(10);
      y += 16;
    }
    y += 10;
  });

  y += 10;
  if (y > 680) { doc.addPage(); y = 40; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Firmas", 40, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  (minuta.participantes || []).forEach((p) => {
    if (y > 700) { doc.addPage(); y = 40; }
    doc.text(p.persona?.nombre || "—", 40, y);
    doc.text(
      p.firmado ? `Firmado · ${new Date(p.firmado_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}` : "Sin firmar",
      320, y
    );
    y += 18;
  });

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
