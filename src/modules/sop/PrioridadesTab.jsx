import { useState } from "react";

const AREAS = ["Comercial", "Operaciones", "Finanzas"];
const EMPTY_DRAFT = { semana: 1, area: "Comercial", prioridad: "", meta_numerica: "", responsable: "" };

const ESTADO_STYLE = {
  "En curso": "border-sky-200 bg-sky-50 text-sky-700",
  Cumplida: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "No cumplida": "border-red-200 bg-red-50 text-red-700",
};

// Captura ligera de prioridades semana a semana (ritmo semanal recomendado
// en el taller S&OP: fijar 3-4 prioridades por área cada semana, sin flujo
// de aprobación — el consultor fue explícito en que en esta etapa inicial
// puede ser tan simple como esto).
export default function PrioridadesTab({ prioridades, control, canEdit, onCreate, onUpdateEstado, currentUser }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const anio = control?.mes_activo ? Number(control.mes_activo.slice(0, 4)) : null;
  const mes = control?.mes_activo ? Number(control.mes_activo.slice(5, 7)) : null;

  async function handleSave() {
    if (!draft.prioridad.trim()) {
      setError("Captura la prioridad.");
      return;
    }
    if (!anio || !mes) {
      setError("No hay mes activo definido en Control S&OP.");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onCreate({ ...draft, anio, mes }, currentUser);
    setSaving(false);
    if (ok) setDraft(EMPTY_DRAFT);
  }

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-[10px] font-bold text-violet-700">
        Ritmo semanal: 3-4 prioridades concretas por área, definidas al inicio de cada semana del mes activo. No requiere aprobación, solo seguimiento.
      </div>

      {canEdit && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nueva prioridad de la semana</p>
          <div className="mt-2 grid gap-2 md:grid-cols-6">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Semana
              <select value={draft.semana} onChange={(e) => setDraft((c) => ({ ...c, semana: Number(e.target.value) }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Semana {n}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Área
              <select value={draft.area} onChange={(e) => setDraft((c) => ({ ...c, area: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
              Prioridad
              <input value={draft.prioridad} onChange={(e) => setDraft((c) => ({ ...c, prioridad: e.target.value }))} placeholder="Ej. Cerrar 40 pzas de Sala Roma" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Meta numérica
              <input value={draft.meta_numerica} onChange={(e) => setDraft((c) => ({ ...c, meta_numerica: e.target.value }))} placeholder="Opcional" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Responsable
              <input value={draft.responsable} onChange={(e) => setDraft((c) => ({ ...c, responsable: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" disabled={saving} onClick={handleSave} className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {saving ? "Guardando..." : "+ Agregar prioridad"}
            </button>
          </div>
          {error && <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Mes / Semana</th>
              <th className="px-2 py-2">Área</th>
              <th className="px-2 py-2">Prioridad</th>
              <th className="px-2 py-2">Meta</th>
              <th className="px-2 py-2">Responsable</th>
              <th className="px-2 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {prioridades.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay prioridades semanales registradas.</td></tr>
            )}
            {prioridades.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-3 py-1.5 font-bold text-slate-700">{p.anio}-{String(p.mes).padStart(2, "0")} / S{p.semana}</td>
                <td className="px-2 py-1.5 text-slate-600">{p.area}</td>
                <td className="px-2 py-1.5 text-slate-700">{p.prioridad}</td>
                <td className="px-2 py-1.5 text-slate-600">{p.meta_numerica || "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{p.responsable || "—"}</td>
                <td className="px-2 py-1.5">
                  {canEdit ? (
                    <select
                      value={p.estado}
                      onChange={(e) => onUpdateEstado(p.id, e.target.value)}
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase outline-none ${ESTADO_STYLE[p.estado] || ESTADO_STYLE["En curso"]}`}
                    >
                      <option value="En curso">En curso</option>
                      <option value="Cumplida">Cumplida</option>
                      <option value="No cumplida">No cumplida</option>
                    </select>
                  ) : (
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${ESTADO_STYLE[p.estado] || ESTADO_STYLE["En curso"]}`}>{p.estado}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
