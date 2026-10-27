import { useMemo, useState } from "react";
import { MAX_ARCHIVO_MB } from "../../services/controlCorrectivoService";
import { inputClass, labelClass, btnPrimaryClass, btnGhostClass, iniciales } from "./ccHelpers";
import AvanceSlider from "./AvanceSlider";

const fmtFechaHora = (valor) => {
  try {
    return new Date(valor).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const fmtFecha = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
};

function Dato({ etiqueta, valor, tono = "text-[#0f1f3d]" }) {
  return (
    <div className="rounded-xl border border-[#edf0f4] bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">{etiqueta}</p>
      <p className={`mt-0.5 text-base font-black leading-tight ${tono}`}>{valor}</p>
    </div>
  );
}

// Resumen de un reporte: barra, "lista" y archivo, en una línea.
function ResumenReporte({ r, color }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {r.avance != null && (
        <span className="flex items-center gap-1.5">
          <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[#edf0f4]">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${r.avance}%`, background: color }} />
          </span>
          <span className="text-[11px] font-black text-[#0f1f3d]">{r.avance}%</span>
        </span>
      )}
      {r.listo && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Lista</span>}
      {r.archivo_url && (
        <a href={r.archivo_url} target="_blank" rel="noreferrer" className="max-w-[220px] truncate rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100" title={r.archivo_nombre}>
          📎 {r.archivo_nombre || "Archivo"}
        </a>
      )}
    </div>
  );
}

// Avance que reportan los involucrados de una acción correctiva (aparte de la
// barra oficial de la PM). Quien está involucrado puede reportar: barra %,
// "mi parte está lista", comentario y/o archivo; todos los demás solo leen.
export default function AvanceEquipoModal({ item, titulo, color, involucrados, reportes, vistos = new Map(), nombrePersona, miPersonaId, puedeReportar, onReportar, onClose }) {
  const [form, setForm] = useState({ usarBarra: false, avance: 0, listo: false, comentario: "" });
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);

  // Una fila por involucrado (más quien haya reportado sin estar en la lista),
  // con su último reporte; los que no han reportado van al final.
  const filas = useMemo(() => {
    const porPersona = new Map();
    reportes.forEach((r) => {
      const id = Number(r.persona_id);
      if (!porPersona.has(id)) porPersona.set(id, []);
      porPersona.get(id).push(r);
    });
    const ids = [...new Set([...involucrados, ...porPersona.keys()])];
    return ids
      .map((id) => {
        const lista = (porPersona.get(id) || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return { id, nombre: nombrePersona(id) !== "—" ? nombrePersona(id) : lista[0]?.persona_nombre || `Persona ${id}`, lista, ultimo: lista[0] || null };
      })
      .sort((a, b) => (b.ultimo ? 1 : 0) - (a.ultimo ? 1 : 0) || String(b.ultimo?.created_at || "").localeCompare(String(a.ultimo?.created_at || "")) || a.nombre.localeCompare(b.nombre, "es"));
  }, [reportes, involucrados, nombrePersona]);

  const resumen = useMemo(() => {
    const reportaron = filas.filter((x) => x.ultimo).length;
    const listas = filas.filter((x) => x.ultimo?.listo).length;
    const conBarra = filas.filter((x) => x.ultimo && x.ultimo.avance != null);
    const promedio = conBarra.length ? Math.round(conBarra.reduce((a, x) => a + Number(x.ultimo.avance), 0) / conBarra.length) : null;
    const alertados = [...vistos.keys()];
    const vieron = alertados.filter((id) => vistos.get(id)).length;
    return { total: filas.length, reportaron, listas, promedio, alertados: alertados.length, vieron };
  }, [filas, vistos]);

  const sinContenido = !form.usarBarra && !form.listo && !form.comentario.trim() && !archivo;

  async function enviar() {
    setGuardando(true);
    setError("");
    try {
      await onReportar({ avance: form.usarBarra ? form.avance : null, listo: form.listo, comentario: form.comentario, archivo });
      setForm({ usarBarra: false, avance: 0, listo: false, comentario: "" });
      setArchivo(null);
    } catch (err) {
      console.error("Error al reportar avance:", err);
      setError(err?.message || "No se pudo guardar el avance. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_-12px_rgba(11,31,58,0.45)]">
        <div className="flex items-start justify-between bg-[#0f1f3d] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a227]">Avance del equipo</p>
            <p className="truncate text-lg font-black text-white">{titulo}</p>
            <p className="text-[11px] font-semibold text-white/60">Compromiso: {fmtFecha(item.fecha_compromiso)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#fbfbf9] p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dato etiqueta="Reportaron" valor={`${resumen.reportaron} de ${resumen.total}`} />
            <Dato etiqueta="Su parte lista" valor={`${resumen.listas} de ${resumen.total}`} tono={resumen.listas > 0 && resumen.listas === resumen.total ? "text-emerald-700" : "text-[#0f1f3d]"} />
            <Dato etiqueta="Avance reportado" valor={resumen.promedio != null ? `${resumen.promedio}%` : "—"} />
            <Dato etiqueta="Vieron la alerta" valor={resumen.alertados ? `${resumen.vieron} de ${resumen.alertados}` : "—"} tono={resumen.alertados > 0 && resumen.vieron === resumen.alertados ? "text-emerald-700" : "text-[#0f1f3d]"} />
          </div>

          {!puedeReportar && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-2.5 text-[11px] leading-snug text-sky-900">
              <p className="font-black uppercase tracking-wider">Cómo funciona</p>
              <p className="mt-1">Cada involucrado reporta su avance desde su propio usuario: entra a Control Correctivo y pulsa <span className="font-bold">+ Reportar mi avance</span> en su acción. Aquí ves lo que va reportando cada quien. {resumen.total > 0 && resumen.reportaron === 0 ? "Todavía nadie ha reportado." : ""}</p>
              <p className="mt-1">La barra oficial de la acción no cambia con estos reportes: se actualiza al editar la acción con el lápiz ✏️.</p>
            </div>
          )}

          {puedeReportar && (
            <section className="rounded-xl border border-[#efe2b4] bg-[#fbf6e3] p-3.5">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#7a5f0c]">Reportar mi avance</p>
              <p className="mb-2.5 mt-0.5 text-[11px] text-[#7a5f0c]/80">Llena lo que aplique: porcentaje, "mi parte está lista", un comentario o un archivo.</p>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#0f1f3d]">
                    <input type="checkbox" checked={form.usarBarra} onChange={(e) => setForm((f) => ({ ...f, usarBarra: e.target.checked }))} />
                    Reportar porcentaje de avance
                  </label>
                  {form.usarBarra && (
                    <div className="mt-1.5 rounded-xl border border-[#edf0f4] bg-white px-3 py-2.5">
                      <AvanceSlider value={form.avance} prioridad={item.prioridad} onCommit={(v) => setForm((f) => ({ ...f, avance: v }))} />
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[#0f1f3d]">
                  <input type="checkbox" checked={form.listo} onChange={(e) => setForm((f) => ({ ...f, listo: e.target.checked }))} />
                  ✓ Mi parte está lista
                </label>
                <label className={labelClass}>
                  Comentario <span className="normal-case tracking-normal">(opcional)</span>
                  <textarea value={form.comentario} maxLength={1000} onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))} rows={2} placeholder="¿Qué avanzaste?" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Archivo adjunto <span className="normal-case tracking-normal">(opcional, hasta {MAX_ARCHIVO_MB} MB)</span>
                  <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs text-[#5b6472] file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#0f1f3d]" />
                </label>
                <div className="flex items-center justify-end gap-2">
                  {error && <span className="text-xs font-medium text-red-600">{error}</span>}
                  <button type="button" onClick={enviar} disabled={guardando || sinContenido} title={sinContenido ? "Marca algo, escribe un comentario o adjunta un archivo" : undefined} className={btnPrimaryClass}>{guardando ? "Guardando…" : "Enviar avance"}</button>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-[#edf0f4] bg-white">
            <p className="border-b border-[#edf0f4] px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wider text-[#5b6472]">
              Involucrados · {filas.filter((f) => f.ultimo).length} de {filas.length} reportaron
            </p>
            {filas.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-xs text-[#94a3b8]">Esta acción aún no tiene involucrados registrados.</p>
            ) : (
              filas.map((f) => (
                <div key={f.id} className="border-b border-[#f1f3f6] px-3.5 py-2.5 last:border-0">
                  <div className="flex items-start gap-2.5">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${f.ultimo ? "bg-[#0f1f3d] text-white" : "border border-dashed border-[#cbd5e1] text-[#94a3b8]"}`}>{iniciales(f.nombre)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <p className="text-xs font-bold text-[#0f1f3d]">{f.nombre}{Number(f.id) === Number(miPersonaId) ? " (tú)" : ""}</p>
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#94a3b8]">
                          {f.ultimo ? fmtFechaHora(f.ultimo.created_at) : ""}
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${!f.ultimo ? "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]" : f.ultimo.listo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{!f.ultimo ? "Sin reporte" : f.ultimo.listo ? "Lista" : "En proceso"}</span>
                        </p>
                      </div>
                      {vistos.has(f.id) && (
                        <p className={`mt-1 text-[11px] font-bold ${vistos.get(f.id) ? "text-emerald-700" : "text-amber-700"}`}>
                          {vistos.get(f.id) ? `✓ Vio la alerta · ${fmtFechaHora(vistos.get(f.id))}` : "⏳ Alerta enviada · aún no la ha visto"}
                        </p>
                      )}
                      {f.ultimo && (
                        <div className="mt-1 space-y-1">
                          <ResumenReporte r={f.ultimo} color={color} />
                          {f.ultimo.comentario && <p className="text-[11px] leading-snug text-[#5b6472]">{f.ultimo.comentario}</p>}
                          {f.lista.length > 1 && (
                            <button type="button" onClick={() => setAbierto((cur) => (cur === f.id ? null : f.id))} className="text-[10px] font-bold text-sky-700 hover:underline">
                              {abierto === f.id ? "Ocultar historial" : `Ver ${f.lista.length - 1} reporte(s) anterior(es)`}
                            </button>
                          )}
                          {abierto === f.id && (
                            <div className="space-y-1.5 border-l-2 border-[#edf0f4] pl-2.5">
                              {f.lista.slice(1).map((r) => (
                                <div key={r.id}>
                                  <p className="text-[10px] font-semibold text-[#94a3b8]">{fmtFechaHora(r.created_at)}</p>
                                  <ResumenReporte r={r} color={color} />
                                  {r.comentario && <p className="text-[11px] leading-snug text-[#5b6472]">{r.comentario}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="flex justify-end border-t border-[#edf0f4] bg-white px-5 py-3">
          <button type="button" onClick={onClose} className={btnGhostClass}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
