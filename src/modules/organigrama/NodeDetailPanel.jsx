import { useEffect, useState } from "react";
import { NIVEL_COLORS, NIVEL_LABELS, NIVEL_OPTIONS, getAncestorChain, getDescendantIds, getChildren, getDisplayName, getDisplayTitle } from "./organigramaLayout";

const SUB_MODAL_META = {
  objetivo_puesto: { icon: "🎯", label: "Objetivo del puesto" },
  competencias_clave: { icon: "🧠", label: "Competencias blandas" },
  competencias_tecnicas: { icon: "🛠️", label: "Competencias técnicas" },
  responsabilidades_clave: { icon: "✅", label: "Responsabilidades clave" },
};

// Para un equipo transversal (ej. "Oficina estratégica") los mismos 3 campos
// de texto se reutilizan con otro sentido: ya no describen UN puesto, sino
// al equipo completo — evita tener que agregar columnas nuevas en Supabase.
const GROUP_SUB_MODAL_META = {
  objetivo_puesto: { icon: "🎯", label: "Objetivo del equipo" },
  competencias_clave: { icon: "🧭", label: "Alcance" },
  responsabilidades_clave: { icon: "🏆", label: "Resultados esperados" },
};

// Editor de viñetas reutilizable: opera sobre un valor de texto plano
// (líneas separadas por "\n") sin conocer si pertenece al panel principal
// o al mini-panel de un integrante — cada quien decide qué pasa al guardar.
function BulletFieldEditor({ meta, value, canEdit, onChange, onClose }) {
  const items = (value || "").split("\n");
  const displayItems = items.length > 0 ? items : [""];

  function updateItem(index, next) {
    const updated = [...displayItems];
    updated[index] = next;
    onChange(updated.join("\n"));
  }
  function removeItem(index) {
    onChange(displayItems.filter((_, i) => i !== index).join("\n"));
  }
  function addItem() {
    onChange([...displayItems, ""].join("\n"));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <p className="text-xs font-black uppercase tracking-widest">{meta.icon} {meta.label}</p>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
          {displayItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm">{meta.icon}</span>
              <input
                autoFocus={index === 0 && displayItems.length === 1}
                disabled={!canEdit}
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                placeholder="Escribe un punto..."
                className="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] font-bold normal-case tracking-normal text-slate-700 outline-none disabled:text-slate-400"
              />
              {canEdit && displayItems.length > 1 && (
                <button type="button" onClick={() => removeItem(index)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-500">×</button>
              )}
            </div>
          ))}
          {canEdit && (
            <button type="button" onClick={addItem} className="mt-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[10px] font-black text-slate-500 hover:bg-slate-50">+ Agregar punto</button>
          )}
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4 pt-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Listo</button>
        </div>
      </div>
    </div>
  );
}

// El objetivo (del puesto o del equipo) es una sola idea redactada, no una
// lista de puntos — a diferencia de competencias/responsabilidades, que sí
// se prestan a viñetas.
function TextFieldEditor({ meta, value, canEdit, onChange, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <p className="text-xs font-black uppercase tracking-widest">{meta.icon} {meta.label}</p>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="p-4">
          <textarea
            autoFocus
            disabled={!canEdit}
            value={value || ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Escribe la descripción..."
            rows={6}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold normal-case leading-relaxed tracking-normal text-slate-700 outline-none disabled:text-slate-400"
          />
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4 pt-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Listo</button>
        </div>
      </div>
    </div>
  );
}

// Selector del catálogo oficial de competencias (16 fijas, definidas en
// competencias_diccionario) — reemplaza el texto libre para un puesto
// individual: cada competencia es un checkbox (aplica/no aplica a este
// puesto) y un link que abre su definición + seguimiento en pestaña nueva,
// sin amontonar esa información dentro de este mismo panel.
function CompetenciaPickerModal({ meta, tipo, diccionario, selectedIds, personaId, canEdit, onToggle, onClose }) {
  const items = diccionario.filter((item) => item.tipo === tipo);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <p className="text-xs font-black uppercase tracking-widest">{meta.icon} {meta.label}</p>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="max-h-[70vh] space-y-1.5 overflow-y-auto p-4">
          {items.length === 0 && <p className="text-[11px] font-bold text-slate-300">Todavía no hay competencias de este tipo en el catálogo.</p>}
          {items.map((item) => {
            const checked = selectedIds.includes(item.id);
            const href = `/competencias/${item.id}${personaId ? `?persona=${personaId}` : ""}`;
            return (
              <div key={item.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${checked ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50"}`}>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={checked}
                  onChange={(event) => onToggle(item.id, event.target.checked)}
                  className="h-4 w-4 shrink-0 disabled:opacity-50"
                />
                <a href={href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[12px] font-bold normal-case tracking-normal text-slate-700 hover:text-sky-600 hover:underline" title="Ver definición y dar seguimiento (pestaña nueva)">
                  {item.nombre}
                </a>
                <span className="shrink-0 text-[10px] text-slate-300">↗</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4 pt-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Listo</button>
        </div>
      </div>
    </div>
  );
}

function FieldEditorModal({ fieldKey, meta, value, canEdit, onChange, onClose, isGroup }) {
  // El objetivo siempre es descripción libre; en un equipo transversal el
  // "alcance" (mismo campo que "competencias clave" en un puesto individual)
  // también se redacta como descripción, no como viñetas.
  const isFreeText = fieldKey === "objetivo_puesto" || (isGroup && fieldKey === "competencias_clave");
  if (isFreeText) {
    return <TextFieldEditor meta={meta} value={value} canEdit={canEdit} onChange={onChange} onClose={onClose} />;
  }
  return <BulletFieldEditor meta={meta} value={value} canEdit={canEdit} onChange={onChange} onClose={onClose} />;
}

// Ventana breve de un integrante de un equipo transversal: solo objetivo,
// competencias y responsabilidades de esa persona — sin línea de mando ni
// "a quién reporta", porque estos roles son transversales, no jerárquicos.
function PersonaMiniModal({ persona, personasCatalogo, puestosCatalogo, canEdit, onSave, onClose, competenciasDiccionario = [], nodoCompetencias = [], onToggleCompetencia }) {
  const [draft, setDraft] = useState({
    titulo_puesto: getDisplayTitle(persona, puestosCatalogo) || "",
    nombre_persona: getDisplayName(persona, personasCatalogo) || "",
    nivel: persona.nivel,
    perfil_puesto: persona.perfil_puesto || "",
    objetivo_puesto: persona.objetivo_puesto || "",
    competencias_clave: persona.competencias_clave || "",
    competencias_tecnicas: persona.competencias_tecnicas || "",
    responsabilidades_clave: persona.responsabilidades_clave || "",
    reporta_a_id: persona.reporta_a_id ?? "",
  });
  const [activeField, setActiveField] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedCompetenciaIds = nodoCompetencias.filter((nc) => nc.nodo_id === persona.id).map((nc) => nc.competencia_id);
  const isCompetenciaField = (key) => key === "competencias_clave" || key === "competencias_tecnicas";
  const competenciaTipo = (key) => (key === "competencias_tecnicas" ? "tecnica" : "blanda");
  function hasFieldContent(key) {
    if (isCompetenciaField(key)) {
      const tipo = competenciaTipo(key);
      return selectedCompetenciaIds.some((id) => competenciasDiccionario.find((c) => c.id === id)?.tipo === tipo);
    }
    return draft[key]?.trim();
  }

  async function handleSave() {
    setSaving(true);
    await onSave(persona.id, { ...draft, reporta_a_id: draft.reporta_a_id === "" ? null : Number(draft.reporta_a_id) });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">{draft.titulo_puesto}</p>
            <p className="text-[10px] font-bold text-slate-300">{draft.nombre_persona || "Sin asignar"}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(SUB_MODAL_META).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveField(key)}
                className="relative flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-center hover:bg-slate-100"
              >
                {hasFieldContent(key) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                <span className="text-base">{item.icon}</span>
                <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-slate-600">{item.label}</span>
              </button>
            ))}
          </div>
          {canEdit && (
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
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
          )}
        </div>
      </div>

      {activeField && isCompetenciaField(activeField) && (
        <CompetenciaPickerModal
          meta={SUB_MODAL_META[activeField]}
          tipo={competenciaTipo(activeField)}
          diccionario={competenciasDiccionario}
          selectedIds={selectedCompetenciaIds}
          personaId={persona.persona_id}
          canEdit={canEdit}
          onToggle={(competenciaId, checked) => onToggleCompetencia(persona.id, competenciaId, checked)}
          onClose={() => setActiveField(null)}
        />
      )}
      {activeField && !isCompetenciaField(activeField) && (
        <FieldEditorModal
          fieldKey={activeField}
          meta={SUB_MODAL_META[activeField]}
          value={draft[activeField]}
          canEdit={canEdit}
          onChange={(next) => setDraft((current) => ({ ...current, [activeField]: next }))}
          onClose={() => setActiveField(null)}
        />
      )}
    </div>
  );
}

export default function NodeDetailPanel({ nodo, nodos, canEdit, onSave, onDeactivate, onAssignParent, onClose, personasCatalogo = [], puestosCatalogo = [], competenciasDiccionario = [], nodoCompetencias = [], onToggleCompetencia }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingReportId, setAddingReportId] = useState("");
  const [activeSubModal, setActiveSubModal] = useState(null); // null | "objetivo_puesto" | "competencias_clave" | "responsabilidades_clave"
  const [activePersonaId, setActivePersonaId] = useState(null);

  useEffect(() => {
    if (nodo) {
      setDraft({
        titulo_puesto: getDisplayTitle(nodo, puestosCatalogo) || "",
        nombre_persona: getDisplayName(nodo, personasCatalogo) || "",
        nivel: nodo.nivel || "Operativo",
        perfil_puesto: nodo.perfil_puesto || "",
        objetivo_puesto: nodo.objetivo_puesto || "",
        competencias_clave: nodo.competencias_clave || "",
        competencias_tecnicas: nodo.competencias_tecnicas || "",
        responsabilidades_clave: nodo.responsabilidades_clave || "",
        reporta_a_id: nodo.reporta_a_id ?? "",
      });
      setActivePersonaId(null);
    } else {
      setDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Un puesto sin persona asignada que sí tiene subordinados es un equipo
  // transversal (ej. "Oficina estratégica"): sus integrantes se manejan
  // dentro de este mismo panel, no como cajas sueltas en el organigrama.
  const isGroup = !nodo.persona_id && !nodo.nombre_persona && directReports.length > 0;
  const activePersona = isGroup ? directReports.find((report) => report.id === activePersonaId) : null;

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
    onClose();
  }

  async function handleDeactivate() {
    if (!window.confirm(`¿Quitar "${getDisplayTitle(nodo, puestosCatalogo)}" del organigrama? Sus subordinados quedarán sin jefe directo (raíz) hasta que los reasignes.`)) return;
    setSaving(true);
    await onDeactivate(nodo.id);
    setSaving(false);
    onClose();
  }

  const subModalMetaSource = isGroup ? GROUP_SUB_MODAL_META : SUB_MODAL_META;

  const selectedCompetenciaIds = nodoCompetencias.filter((nc) => nc.nodo_id === nodo.id).map((nc) => nc.competencia_id);
  const isCompetenciaField = (key) => !isGroup && (key === "competencias_clave" || key === "competencias_tecnicas");
  const competenciaTipo = (key) => (key === "competencias_tecnicas" ? "tecnica" : "blanda");
  function hasFieldContent(key) {
    if (isCompetenciaField(key)) {
      const tipo = competenciaTipo(key);
      return selectedCompetenciaIds.some((id) => competenciasDiccionario.find((c) => c.id === id)?.tipo === tipo);
    }
    return draft[key]?.trim();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">{isGroup ? "Equipo transversal" : "Perfil de puesto"}</p>
            <p className="text-[10px] font-bold text-slate-300">{getDisplayTitle(nodo, puestosCatalogo)}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          {!isGroup && jefe && (
            <div className="sticky top-0 z-10 -mx-4 -mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 bg-white/95 px-4 py-2 backdrop-blur">
              <p className="text-[10px] font-bold text-slate-600">
                <span className="font-black uppercase tracking-widest text-red-500">A quién reporta:</span>{" "}
                {getDisplayTitle(jefe, puestosCatalogo)}{getDisplayName(jefe, personasCatalogo) ? ` (${getDisplayName(jefe, personasCatalogo)})` : ""}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isGroup ? "Objetivo, alcance y resultados esperados" : "Perfil de puesto"}
            </p>
            <div className={`mt-1 grid gap-1.5 ${isGroup ? "grid-cols-3" : "grid-cols-2"}`}>
              {Object.entries(subModalMetaSource).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSubModal(key)}
                  className="relative flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-center hover:bg-slate-100"
                >
                  {hasFieldContent(key) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  <span className="text-base">{item.icon}</span>
                  <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-slate-600">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {isGroup ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Integrantes ({directReports.length})
              </p>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {directReports.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setActivePersonaId(persona.id)}
                    className="flex flex-col items-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="text-[11px] font-black uppercase tracking-wide text-slate-700">{getDisplayTitle(persona, puestosCatalogo)}</span>
                    <span className="text-[10px] font-bold text-slate-400">{getDisplayName(persona, personasCatalogo) || "Sin asignar"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Línea de mando</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {chain.map((ancestor, index) => (
                    <span key={ancestor.id} className="flex items-center gap-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${(NIVEL_COLORS[ancestor.nivel] || NIVEL_COLORS.Operativo).border} ${(NIVEL_COLORS[ancestor.nivel] || NIVEL_COLORS.Operativo).text} ${(NIVEL_COLORS[ancestor.nivel] || NIVEL_COLORS.Operativo).bg}`}>
                        {getDisplayTitle(ancestor, puestosCatalogo)}{getDisplayName(ancestor, personasCatalogo) ? ` · ${getDisplayName(ancestor, personasCatalogo)}` : ""}
                      </span>
                      {index < chain.length - 1 && <span className="text-slate-300">▸</span>}
                    </span>
                  ))}
                </div>
              </div>

              {jefe && (
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
                        <option key={option.id} value={option.id}>{getDisplayTitle(option, puestosCatalogo)}{getDisplayName(option, personasCatalogo) ? ` · ${getDisplayName(option, personasCatalogo)}` : ""}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-[11px] font-bold normal-case tracking-normal text-slate-700">
                      {`${getDisplayTitle(jefe, puestosCatalogo)}${getDisplayName(jefe, personasCatalogo) ? ` (${getDisplayName(jefe, personasCatalogo)})` : ""}`}
                    </p>
                  )}
                </label>
              )}

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
                          {getDisplayTitle(report, puestosCatalogo)}{getDisplayName(report, personasCatalogo) ? ` · ${getDisplayName(report, personasCatalogo)}` : ""}
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
                        <option key={option.id} value={option.id}>{getDisplayTitle(option, puestosCatalogo)}{getDisplayName(option, personasCatalogo) ? ` · ${getDisplayName(option, personasCatalogo)}` : ""}</option>
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
            </>
          )}

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

          {!isGroup && (
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
          )}

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

          {activeSubModal && isCompetenciaField(activeSubModal) && (
            <CompetenciaPickerModal
              meta={subModalMetaSource[activeSubModal]}
              tipo={competenciaTipo(activeSubModal)}
              diccionario={competenciasDiccionario}
              selectedIds={selectedCompetenciaIds}
              personaId={nodo.persona_id}
              canEdit={canEdit}
              onToggle={(competenciaId, checked) => onToggleCompetencia(nodo.id, competenciaId, checked)}
              onClose={() => setActiveSubModal(null)}
            />
          )}
          {activeSubModal && !isCompetenciaField(activeSubModal) && (
            <FieldEditorModal
              fieldKey={activeSubModal}
              meta={subModalMetaSource[activeSubModal]}
              value={draft[activeSubModal]}
              canEdit={canEdit}
              isGroup={isGroup}
              onChange={(next) => setDraft((current) => ({ ...current, [activeSubModal]: next }))}
              onClose={() => setActiveSubModal(null)}
            />
          )}

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

      {activePersona && (
        <PersonaMiniModal
          persona={activePersona}
          personasCatalogo={personasCatalogo}
          puestosCatalogo={puestosCatalogo}
          canEdit={canEdit}
          onSave={onSave}
          onClose={() => setActivePersonaId(null)}
          competenciasDiccionario={competenciasDiccionario}
          nodoCompetencias={nodoCompetencias}
          onToggleCompetencia={onToggleCompetencia}
        />
      )}
    </div>
  );
}
