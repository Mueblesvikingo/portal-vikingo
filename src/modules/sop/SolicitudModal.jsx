import { useState } from "react";

const EMPTY = { titulo: "", descripcion: "", fecha: "", riesgo: "Moderado" };

export default function SolicitudModal({ onSubmit, onClose, initialDraft }) {
  const [draft, setDraft] = useState({ ...EMPTY, ...initialDraft });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!draft.titulo.trim()) {
      setError("Captura al menos el título de la solicitud.");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onSubmit(draft);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-xs font-black uppercase tracking-widest text-slate-700">Nueva solicitud a Dirección</p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">Se envía a la Bandeja del Centro de Decisiones para que Dirección la revise.</p>

        <div className="mt-3 space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Título / solicitud
            <input
              autoFocus
              value={draft.titulo}
              onChange={(e) => setDraft((c) => ({ ...c, titulo: e.target.value }))}
              placeholder="Ej. Autorizar horas extra para cumplir plan de agosto"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
            />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Descripción / recomendación
            <textarea
              value={draft.descripcion}
              onChange={(e) => setDraft((c) => ({ ...c, descripcion: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
            />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Fecha compromiso
              <input
                type="date"
                value={draft.fecha}
                onChange={(e) => setDraft((c) => ({ ...c, fecha: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              />
            </label>
            <label className="block flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Riesgo
              <select
                value={draft.riesgo}
                onChange={(e) => setDraft((c) => ({ ...c, riesgo: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              >
                <option>Alto</option>
                <option>Moderado</option>
                <option>Bajo</option>
              </select>
            </label>
          </div>
        </div>

        {error && <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-slate-500">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}
