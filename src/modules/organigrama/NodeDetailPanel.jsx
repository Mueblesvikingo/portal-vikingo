import { useEffect, useState } from "react";
import { NIVEL_COLORS, NIVEL_LABELS, NIVEL_OPTIONS, getAncestorChain } from "./organigramaLayout";

export default function NodeDetailPanel({ nodo, nodos, canEdit, onSave, onDeactivate, onClose }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (nodo) {
      setDraft({
        titulo_puesto: nodo.titulo_puesto || "",
        nombre_persona: nodo.nombre_persona || "",
        nivel: nodo.nivel || "Operativo",
        perfil_puesto: nodo.perfil_puesto || "",
      });
    } else {
      setDraft(null);
    }
  }, [nodo]);

  if (!nodo || !draft) return null;

  const chain = getAncestorChain(nodos, nodo.id).reverse();
  const jefe = chain.length > 1 ? chain[chain.length - 2] : null;
  const colors = NIVEL_COLORS[nodo.nivel] || NIVEL_COLORS.Operativo;

  async function handleSave() {
    setSaving(true);
    await onSave(nodo.id, draft);
    setSaving(false);
  }

  async function handleDeactivate() {
    if (!window.confirm(`¿Quitar "${nodo.titulo_puesto}" del organigrama? Sus subordinados quedarán sin jefe directo (raíz) hasta que los reasignes.`)) return;
    setSaving(true);
    await onDeactivate(nodo.id);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Perfil de puesto</p>
            <p className="text-[10px] font-bold text-slate-300">{nodo.titulo_puesto}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Línea de mando</p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {chain.map((ancestor, index) => (
                <span key={ancestor.id} className="flex items-center gap-1">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${(NIVEL_COLORS[ancestor.nivel] || NIVEL_COLORS.Operativo).border} ${(NIVEL_COLORS[ancestor.nivel] || NIVEL_COLORS.Operativo).text} ${(NIVEL_COLORS[ancestor.nivel] || NIVEL_COLORS.Operativo).bg}`}>
                    {ancestor.titulo_puesto}{ancestor.nombre_persona ? ` · ${ancestor.nombre_persona}` : ""}
                  </span>
                  {index < chain.length - 1 && <span className="text-slate-300">▸</span>}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-bold text-slate-500">
              {jefe ? <>Reporta a <span className="font-black text-slate-700">{jefe.titulo_puesto}{jefe.nombre_persona ? ` (${jefe.nombre_persona})` : ""}</span></> : "No reporta a nadie (raíz del organigrama)"}
            </p>
          </div>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Título del puesto
            <input
              disabled={!canEdit}
              value={draft.titulo_puesto}
              onChange={(event) => setDraft((current) => ({ ...current, titulo_puesto: event.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            />
          </label>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nombre de quien lo ocupa
            <input
              disabled={!canEdit}
              value={draft.nombre_persona}
              onChange={(event) => setDraft((current) => ({ ...current, nombre_persona: event.target.value }))}
              placeholder="Sin asignar"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            />
          </label>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nivel
            <select
              disabled={!canEdit}
              value={draft.nivel}
              onChange={(event) => setDraft((current) => ({ ...current, nivel: event.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            >
              {NIVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>{NIVEL_LABELS[option]}</option>
              ))}
            </select>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${colors.border} ${colors.text} ${colors.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} /> {NIVEL_LABELS[nodo.nivel] || nodo.nivel}
            </span>
          </label>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Perfil de puesto
            <textarea
              disabled={!canEdit}
              value={draft.perfil_puesto}
              onChange={(event) => setDraft((current) => ({ ...current, perfil_puesto: event.target.value }))}
              rows={4}
              placeholder="Responsabilidades, requisitos, alcance del puesto..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            />
          </label>

          {canEdit && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleDeactivate}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Quitar del organigrama
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
