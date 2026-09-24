import { useEffect, useState } from "react";
import { getBitacora, createBitacoraEntry } from "../../services/operationalPerformanceService";
import { formatDateTime } from "./performanceHelpers";

const MOTIVO_OPTIONS = ["Falta de material", "Falla de máquina", "Falta de personal", "Mantenimiento programado", "Otro"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

// Bitácora de paros de un KPI: registro libre (fecha/horas/motivo/nota) que
// explica por qué el Real de la semana salió como salió — complementa, no
// reemplaza, la captura de Meta/Real de la pestaña Resultados.
export default function KpiBitacoraModal({ kpi, currentUser, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [desde, setDesde] = useState(firstDayOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [form, setForm] = useState({ fecha: todayISO(), horas: "", motivo: MOTIVO_OPTIONS[0], observacion: "" });
  const [error, setError] = useState("");

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

  async function handleSave() {
    if (!form.fecha) { setError("Selecciona una fecha."); return; }
    setSaving(true);
    setError("");
    const result = await createBitacoraEntry(kpi.id, form, currentUser);
    setSaving(false);
    if (!result.ok) { setError("No fue posible guardar el registro."); return; }
    setForm({ fecha: todayISO(), horas: "", motivo: MOTIVO_OPTIONS[0], observacion: "" });
    loadEntries();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">📔 Bitácora de paros</p>
            <p className="text-[10px] font-bold text-slate-400">{kpi.nombre_indicador} · {kpi.area}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-0.5 text-[11px] font-black text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Nuevo registro</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Fecha
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"
                />
              </label>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Horas paradas
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.horas}
                  onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"
                />
              </label>
              <label className="col-span-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Motivo
                <select
                  value={form.motivo}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"
                >
                  {MOTIVO_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Observación
                <textarea
                  value={form.observacion}
                  onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
                  placeholder="Detalle breve (opcional)"
                  rows={2}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-800 outline-none"
                />
              </label>
            </div>
            {error && <p className="mt-2 text-[10px] font-bold text-red-500">{error}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-2 w-full rounded-lg bg-[#001225] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#0a2240] disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar registro"}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Historial</p>
            <div className="flex items-center gap-1.5">
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 outline-none" />
              <span className="text-[10px] font-bold text-slate-300">a</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 outline-none" />
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {loading ? (
              <p className="py-4 text-center text-[10px] font-bold text-slate-300">Cargando…</p>
            ) : entries.length === 0 ? (
              <p className="py-4 text-center text-[10px] font-bold text-slate-300">Sin registros en este periodo.</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-700">{entry.fecha}</span>
                    {entry.horas !== null && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-red-600">{entry.horas} h</span>}
                  </div>
                  {entry.motivo && <p className="mt-0.5 text-[10px] font-bold text-slate-500">{entry.motivo}</p>}
                  {entry.observacion && <p className="mt-0.5 text-[10px] text-slate-500">{entry.observacion}</p>}
                  <p className="mt-1 text-[9px] font-bold text-slate-300">{entry.persona_nombre || "—"} · {formatDateTime(entry.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
