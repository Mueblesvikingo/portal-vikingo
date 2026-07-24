import { useEffect, useState } from "react";
import { NIVEL_COLORS, NIVEL_LABELS, NIVEL_OPTIONS, getAncestorChain, getDescendantIds, getChildren } from "./organigramaLayout";

export default function NodeDetailPanel({ nodo, nodos, canEdit, onSave, onDeactivate, onAssignParent, onClose, personasCatalogo = [], puestosCatalogo = [] }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingReportId, setAddingReportId] = useState("");

  useEffect(() => {
    if (nodo) {
      setDraft({
        titulo_puesto: nodo.titulo_puesto || "",
        nombre_persona: nodo.nombre_persona || "",
        nivel: nodo.nivel || "Operativo",
        perfil_puesto: nodo.perfil_puesto || "",
        reporta_a_id: nodo.reporta_a_id ?? "",
      });
    } else {
      setDraft(null);
    }
  }, [nodo]);

  if (!nodo || !draft) return null;

  const chain = getAncestorChain(nodos, nodo.id).reverse();
  const jefe = chain.length > 1 ? chain[chain.length - 2] : null;
  const colors = NIVEL_COLORS[nodo.nivel] || NIVEL_COLORS.Operativo;

  const descendantIds = getDescendantIds(nodos, nodo.id);
  const reporteOptions = nodos.filter((candidate) => candidate.id !== nodo.id && !descendantIds.has(candidate.id));
  const directReports = getChildren(nodos, nodo.id);
  const addableAsReport = nodos.filter(
    (candidate) => candidate.id !== nodo.id && candidate.reporta_a_id !== nodo.id && !getAncestorChain(nodos, nodo.id).some((ancestor) => ancestor.id === candidate.id)
  );

  async function handleAddReport() {
    if (!addingReportId) return;
    setSaving(true);
    await onAssignParent(Number(addingReportId), nodo.id);
    setSaving(false);
    setAddingReportId("");
  }

  async function handleRemoveReport(childId) {
    if (!window.confirm("¿Quitar esta conexión? El puesto quedará sin jefe (raíz) hasta que le asignes otro.")) return;
    setSaving(true);
    await onAssignParent(childId, null);
    setSaving(false);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(nodo.id, { ...draft, reporta_a_id: draft.reporta_a_id === "" ? null : Number(draft.reporta_a_id) });
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
          </div>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Reporta a
            {canEdit ? (
              <select
                value={draft.reporta_a_id}
                onChange={(event) => setDraft((current) => ({ ...current, reporta_a_id: event.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              >
                <option value="">Nadie (raíz del organigrama)</option>
                {reporteOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.titulo_puesto}{option.nombre_persona ? ` · ${option.nombre_persona}` : ""}</option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-[11px] font-bold normal-case tracking-normal text-slate-700">
                {jefe ? `${jefe.titulo_puesto}${jefe.nombre_persona ? ` (${jefe.nombre_persona})` : ""}` : "No reporta a nadie (raíz del organigrama)"}
              </p>
            )}
          </label>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Subordinados directos {directReports.length > 0 ? `(${directReports.length})` : ""}
            </p>
            {directReports.length === 0 ? (
              <p className="mt-1 text-[10px] font-bold text-slate-400">Nadie le reporta directamente todavía.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {directReports.map((report) => {
                  const reportColors = NIVEL_COLORS[report.nivel] || NIVEL_COLORS.Operativo;
                  return (
                    <span key={report.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-black ${reportColors.border} ${reportColors.text} ${reportColors.bg}`}>
                      {report.titulo_puesto}{report.nombre_persona ? ` · ${report.nombre_persona}` : ""}
                      {canEdit && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRemoveReport(report.id)}
                          title="Quitar esta conexión"
                          className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/10 text-[9px] leading-none hover:bg-black/20"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {canEdit && (
              <div className="mt-2 flex gap-1.5">
                <select
                  value={addingReportId}
                  onChange={(event) => setAddingReportId(event.target.value)}
                  className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-bold normal-case tracking-normal text-slate-700 outline-none"
                >
                  <option value="">Agregar puesto existente como subordinado...</option>
                  {addableAsReport.map((option) => (
                    <option key={option.id} value={option.id}>{option.titulo_puesto}{option.nombre_persona ? ` · ${option.nombre_persona}` : ""}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addingReportId || saving}
                  onClick={handleAddReport}
                  className="rounded-xl bg-[#001225] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Agregar
                </button>
              </div>
            )}
          </div>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Título del puesto
            <input
              list="organigrama-puestos-catalogo-detalle"
              disabled={!canEdit}
              value={draft.titulo_puesto}
              onChange={(event) => setDraft((current) => ({ ...current, titulo_puesto: event.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            />
            <datalist id="organigrama-puestos-catalogo-detalle">
              {puestosCatalogo.map((puesto) => (
                <option key={puesto.id} value={puesto.nombre} />
              ))}
            </datalist>
          </label>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nombre de quien lo ocupa
            <input
              list="organigrama-personas-catalogo-detalle"
              disabled={!canEdit}
              value={draft.nombre_persona}
              onChange={(event) => setDraft((current) => ({ ...current, nombre_persona: event.target.value }))}
              placeholder="Sin asignar"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
            />
            <datalist id="organigrama-personas-catalogo-detalle">
              {personasCatalogo.map((persona) => (
                <option key={persona.id} value={persona.nombre} />
              ))}
            </datalist>
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
