import { Fragment, useState } from "react";

const EMPTY_DRAFT = { mes_reunion: "", decision: "", opcion_elegida: "", responsable: "", fecha: "" };
const PRIORIDADES = ["Crítica", "Alta", "Media", "Baja"];

// Formulario compacto para convertir una decisión en una asignación real de
// Balance de Carga, para cualquier persona del catálogo (no solo quien
// aparece como "responsable" en texto libre).
function ConvertirEnAsignacionForm({ decision, personasCatalogo, onConfirm, onCancel, currentUser }) {
  const [personaId, setPersonaId] = useState("");
  const [horas, setHoras] = useState(4);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Alta");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!personaId) {
      setError("Selecciona a quién se le asigna.");
      return;
    }
    setError("");
    setSaving(true);
    const persona = personasCatalogo.find((p) => String(p.id) === String(personaId));
    const ok = await onConfirm(decision, {
      personaId: Number(personaId),
      personaNombre: persona?.nombre || "",
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    }, currentUser);
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <tr className="border-b border-slate-100 bg-violet-50/50">
      <td colSpan={6} className="px-3 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Persona
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-52 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              <option value="">Selecciona...</option>
              {personasCatalogo.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Horas estimadas
            <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-24 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Fecha límite
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Prioridad
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#001225] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {saving ? "Enviando..." : "Confirmar asignación"}
          </button>
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
        </div>
        {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export default function DecisionesTab({ decisiones, canEdit, canRequestDirectorDecision, onCreate, onDelete, onRequestDirectorDecision, onConvertToAssignment, personasCatalogo = [], currentUser }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [convertingId, setConvertingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  async function handleSave() {
    if (!draft.mes_reunion || !draft.decision.trim()) {
      setError("Captura al menos el mes de reunión y el acuerdo.");
      return;
    }
    setError("");
    setSaving(true);
    const result = await onCreate({ ...draft, mes_reunion: `${draft.mes_reunion}-01` }, currentUser);
    setSaving(false);
    if (result) setDraft(EMPTY_DRAFT);
  }

  async function handleRequest(decision) {
    setSendingId(decision.id);
    await onRequestDirectorDecision(decision, currentUser);
    setSendingId(null);
  }

  return (
    <div className="space-y-3 p-3">
      {canEdit && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registrar acuerdo de la reunión S&amp;OP</p>
          <div className="mt-2 grid gap-2 md:grid-cols-5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-1">
              Mes de reunión
              <input type="month" value={draft.mes_reunion} onChange={(e) => setDraft((c) => ({ ...c, mes_reunion: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
              Acuerdo
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
              {saving ? "Guardando..." : "+ Agregar acuerdo"}
            </button>
          </div>
          {error && <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Mes reunión</th>
              <th className="px-2 py-2">Acuerdo</th>
              <th className="px-2 py-2">Opción elegida</th>
              <th className="px-2 py-2">Responsable</th>
              <th className="px-2 py-2">Fecha</th>
              {(canEdit || canRequestDirectorDecision) && <th className="px-2 py-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {decisiones.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay acuerdos registrados.</td></tr>
            )}
            {decisiones.map((d) => (
              <Fragment key={d.id}>
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-700">{d.mes_reunion?.slice(0, 7)}</td>
                  <td className="px-2 py-1.5 text-slate-700">{d.decision}</td>
                  <td className="px-2 py-1.5 text-slate-600">{d.opcion_elegida || "—"}</td>
                  <td className="px-2 py-1.5 text-slate-600">{d.responsable || "—"}</td>
                  <td className="px-2 py-1.5 text-slate-600">{d.fecha || "—"}</td>
                  {(canEdit || canRequestDirectorDecision) && (
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit && (
                          <button type="button" onClick={() => setConvertingId(convertingId === d.id ? null : d.id)} className="text-[9px] font-black text-violet-600 hover:underline">
                            → Asignación
                          </button>
                        )}
                        {canRequestDirectorDecision && (
                          <button type="button" disabled={sendingId === d.id} onClick={() => handleRequest(d)} className="text-[9px] font-black text-sky-600 hover:underline disabled:opacity-50">
                            {sendingId === d.id ? "Enviando..." : "→ Solicitar a Dirección"}
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" onClick={() => onDelete(d.id)} className="text-[9px] font-black text-red-500 hover:underline">Eliminar</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {convertingId === d.id && (
                  <ConvertirEnAsignacionForm
                    decision={d}
                    personasCatalogo={personasCatalogo}
                    onConfirm={onConvertToAssignment}
                    onCancel={() => setConvertingId(null)}
                    currentUser={currentUser}
                  />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
