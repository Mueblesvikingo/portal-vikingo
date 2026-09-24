import { useEffect, useState } from "react";
import { getBitacora, createBitacoraEntry } from "../../services/operationalPerformanceService";
import { formatDateTime } from "./performanceHelpers";

// Un color/ícono por motivo — no es estado (no hay "bueno/malo"), es
// categoría: ayuda a distinguir de un vistazo el tipo de paro en el
// historial, como resaltadores de colores en una libreta física.
const MOTIVOS = [
  { key: "Falta de material", icon: "📦", color: "#d97706", bg: "#fef3e2" },
  { key: "Falla de máquina", icon: "🔧", color: "#dc2626", bg: "#fdecec" },
  { key: "Falta de personal", icon: "👤", color: "#0284c7", bg: "#e6f4fc" },
  { key: "Mantenimiento programado", icon: "🛠️", color: "#7c3aed", bg: "#f3edfd" },
  { key: "Otro", icon: "📌", color: "#64748b", bg: "#f1f5f9" },
];
const motivoMeta = (key) => MOTIVOS.find((m) => m.key === key) || MOTIVOS[MOTIVOS.length - 1];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Bitácora de paros de un KPI: registro libre (fecha/horas/motivo/nota) que
// explica por qué el Real de la semana salió como salió — complementa, no
// reemplaza, la captura de Meta/Real de la pestaña Resultados. Presentada
// como libreta digital: pestañas Captura/Historial, motivos codificados por
// color e ícono, en vez de una tabla plana.
export default function KpiBitacoraModal({ kpi, currentUser, onClose }) {
  const [tab, setTab] = useState("captura");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState("mes");
  const [desde, setDesde] = useState(firstDayOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [form, setForm] = useState({ fecha: todayISO(), horas: "", motivo: MOTIVOS[0].key, observacion: "" });
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  async function loadEntries() {
    setLoading(true);
    const result = await getBitacora(kpi.id, { desde, hasta });
    if (result.ok) setEntries(result.data);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  function applyPreset(key) {
    setPreset(key);
    if (key === "semana") { setDesde(daysAgoISO(7)); setHasta(todayISO()); }
    if (key === "mes") { setDesde(firstDayOfMonthISO()); setHasta(todayISO()); }
    if (key === "todo") { setDesde("2020-01-01"); setHasta(todayISO()); }
  }

  async function handleSave() {
    if (!form.fecha) { setError("Selecciona una fecha."); return; }
    setSaving(true);
    setError("");
    const result = await createBitacoraEntry(kpi.id, form, currentUser);
    setSaving(false);
    if (!result.ok) { setError("No fue posible guardar el registro."); return; }
    setForm({ fecha: todayISO(), horas: "", motivo: MOTIVOS[0].key, observacion: "" });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
    loadEntries();
  }

  const totalHoras = entries.reduce((sum, e) => sum + (Number(e.horas) || 0), 0);
  const activeMeta = motivoMeta(form.motivo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado tipo portada de libreta */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(135deg, #fdf8ef 0%, #ffffff 100%)", borderBottom: "1px solid #f1e9d8" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: "#fef3e2" }}>📔</span>
            <div>
              <p className="text-[12px] font-black text-slate-800">Bitácora de paros</p>
              <p className="text-[10px] font-bold text-slate-400">{kpi.nombre_indicador} · {kpi.area}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-0.5 text-[12px] font-black text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        {/* Pestañas */}
        <div className="flex gap-1 border-b border-slate-100 bg-slate-50/60 px-3 pt-2">
          {[
            { key: "captura", label: "✍️ Captura" },
            { key: "historial", label: "🗂️ Historial" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-t-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                tab === t.key ? "bg-white text-slate-800 shadow-[0_-1px_0_0_#e2e8f0_inset]" : "text-slate-400 hover:text-slate-600"
              }`}
              style={tab === t.key ? { boxShadow: "inset 0 -2px 0 0 #f59e0b" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-4 py-3.5" style={{ background: "repeating-linear-gradient(180deg, #ffffff, #ffffff 27px, #f8fafc 28px)" }}>
          {tab === "captura" ? (
            <div className="rounded-xl border p-3.5" style={{ borderColor: `${activeMeta.color}30`, background: `${activeMeta.bg}` }}>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  📅 Fecha
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  ⏱️ Horas paradas
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.horas}
                    onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))}
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none"
                  />
                </label>
              </div>

              <p className="mb-1.5 mt-2.5 text-[9px] font-black uppercase tracking-widest text-slate-500">Motivo</p>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS.map((m) => {
                  const active = form.motivo === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, motivo: m.key }))}
                      className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black transition"
                      style={active
                        ? { borderColor: m.color, background: m.color, color: "#ffffff" }
                        : { borderColor: `${m.color}40`, background: "#ffffff", color: m.color }
                      }
                    >
                      <span>{m.icon}</span>{m.key}
                    </button>
                  );
                })}
              </div>

              <label className="mt-2.5 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                📝 Observación
                <textarea
                  value={form.observacion}
                  onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
                  placeholder="Detalle breve (opcional)"
                  rows={2}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none"
                />
              </label>

              {error && <p className="mt-2 text-[10px] font-bold text-red-500">{error}</p>}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-3 w-full rounded-lg px-3 py-2 text-[11px] font-black text-white transition disabled:opacity-50"
                style={{ background: justSaved ? "#16a34a" : "#001225" }}
              >
                {saving ? "Guardando…" : justSaved ? "✓ Registro guardado" : "Guardar registro"}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1">
                  {[{ key: "semana", label: "7 días" }, { key: "mes", label: "Este mes" }, { key: "todo", label: "Todo" }].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p.key)}
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition ${
                        preset === p.key ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPreset("custom"); }} className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 outline-none" />
                  <span className="text-[10px] font-bold text-slate-300">a</span>
                  <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPreset("custom"); }} className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 outline-none" />
                </div>
              </div>

              {!loading && entries.length > 0 && (
                <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-700">
                  ⏱️ {totalHoras} horas paradas registradas en este periodo · {entries.length} evento(s)
                </div>
              )}

              <div className="mt-2.5 space-y-2">
                {loading ? (
                  <p className="py-6 text-center text-[10px] font-bold text-slate-300">Cargando…</p>
                ) : entries.length === 0 ? (
                  <p className="py-6 text-center text-[10px] font-bold text-slate-300">Sin registros en este periodo.</p>
                ) : (
                  entries.map((entry) => {
                    const meta = motivoMeta(entry.motivo);
                    return (
                      <div key={entry.id} className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]" style={{ background: meta.bg }}>{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="text-[10px] font-black text-slate-700">{entry.fecha}</span>
                            {entry.horas !== null && (
                              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ background: meta.bg, color: meta.color }}>{entry.horas} h</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] font-black" style={{ color: meta.color }}>{entry.motivo}</p>
                          {entry.observacion && <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] text-slate-500">{entry.observacion}</p>}
                          <p className="mt-1 text-[9px] font-bold text-slate-300">{entry.persona_nombre || "—"} · {formatDateTime(entry.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
