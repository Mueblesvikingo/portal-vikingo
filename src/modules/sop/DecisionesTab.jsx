import { useState } from "react";

const EMPTY_DRAFT = { mes_reunion: "", decision: "", opcion_elegida: "", responsable: "", fecha: "" };

export default function DecisionesTab({ decisiones, canEdit, onCreate, onDelete, currentUser }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!draft.mes_reunion || !draft.decision.trim()) {
      setError("Captura al menos el mes de reunión y la decisión.");
      return;
    }
    setError("");
    setSaving(true);
    const result = await onCreate({ ...draft, mes_reunion: `${draft.mes_reunion}-01` }, currentUser);
    setSaving(false);
    if (result) setDraft(EMPTY_DRAFT);
  }

  return (
    <div className="space-y-3 p-3">
      {canEdit && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registrar decisión de la reunión S&amp;OP</p>
          <div className="mt-2 grid gap-2 md:grid-cols-5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-1">
              Mes de reunión
              <input type="month" value={draft.mes_reunion} onChange={(e) => setDraft((c) => ({ ...c, mes_reunion: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
              Decisión
              <input value={draft.decision} onChange={(e) => setDraft((c) => ({ ...c, decision: e.target.value }))} placeholder="Ej. Ampliar capacidad a 2 turnos" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Opción elegida
              <input value={draft.opcion_elegida} onChange={(e) => setDraft((c) => ({ ...c, opcion_elegida: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Responsable
              <input value={draft.responsable} onChange={(e) => setDraft((c) => ({ ...c, responsable: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Fecha compromiso
              <input type="date" value={draft.fecha} onChange={(e) => setDraft((c) => ({ ...c, fecha: e.target.value }))} className="mt-1 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
            <button type="button" disabled={saving} onClick={handleSave} className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {saving ? "Guardando..." : "+ Agregar decisión"}
            </button>
          </div>
          {error && <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Mes reunión</th>
              <th className="px-2 py-2">Decisión</th>
              <th className="px-2 py-2">Opción elegida</th>
              <th className="px-2 py-2">Responsable</th>
              <th className="px-2 py-2">Fecha</th>
              {canEdit && <th className="px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {decisiones.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay decisiones registradas.</td></tr>
            )}
            {decisiones.map((d) => (
              <tr key={d.id} className="border-b border-slate-50">
                <td className="px-3 py-1.5 font-bold text-slate-700">{d.mes_reunion?.slice(0, 7)}</td>
                <td className="px-2 py-1.5 text-slate-700">{d.decision}</td>
                <td className="px-2 py-1.5 text-slate-600">{d.opcion_elegida || "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{d.responsable || "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{d.fecha || "—"}</td>
                {canEdit && (
                  <td className="px-2 py-1.5 text-right">
                    <button type="button" onClick={() => onDelete(d.id)} className="text-[9px] font-black text-red-500 hover:underline">Eliminar</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
