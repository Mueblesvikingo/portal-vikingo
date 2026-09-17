import { Fragment, useState } from "react";
import { NIVELES_ACCION, NIVEL_COLOR, NIVEL_BADGE, PRIORIDAD_BADGE, ESTADO_BADGE, ESTADO_COLOR, isVencida, formatDate, getFlujoEtapas, subTabParaEtapa } from "./actionsHelpers";
import { canEditAccion } from "../../services/permissionsService";

// Vista compacta de la línea de tiempo, para expandir sin salir de la
// tabla — mismo código de color e iluminado/tenue que la del detalle
// completo, sin la fecha por etapa (esa sí requiere cargar el historial,
// que aquí no vale la pena traer solo para una vista previa).
function InlineTimeline({ accion, etapas, onOpenEtapa }) {
  if (!etapas.length) {
    return <p className="text-[10px] font-bold text-slate-300">Sin flujo configurado para este tipo de acción.</p>;
  }
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-stretch" style={{ minWidth: `${etapas.length * 116}px` }}>
        {etapas.map((etapa, index) => {
          const isCurrent = accion.estado === etapa;
          const isPast = etapas.indexOf(accion.estado) > index;
          const alcanzada = isCurrent || isPast;
          const color = ESTADO_COLOR[etapa] || "#94a3b8";
          return (
            <div key={etapa} className="flex items-center">
              <button
                type="button"
                onClick={() => onOpenEtapa(subTabParaEtapa(etapa))}
                title={`Abrir "${etapa}"`}
                className="flex w-[102px] shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-2 py-2 text-center transition hover:opacity-80"
                style={{ borderColor: alcanzada ? color : `${color}30`, background: alcanzada ? `${color}16` : "#fff" }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: alcanzada ? color : `${color}45` }}>
                  {isPast ? "✓" : index + 1}
                </span>
                <span className="text-[9px] font-black leading-tight" style={{ color: alcanzada ? color : "#cbd5e1" }}>{etapa}</span>
                {isCurrent && <span className="rounded-full px-1.5 py-0.5 text-[6px] font-black uppercase tracking-widest text-white" style={{ background: color }}>Aquí vas</span>}
              </button>
              {index < etapas.length - 1 && (
                <span className="mx-0.5 shrink-0 text-[14px] font-black" style={{ color: isPast ? color : "#e2e8f0" }}>→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Formulario compacto para crear la asignación en Balance de Carga — misma
// forma que AsignacionForm en AccionDetailPanel.jsx, pero como fila de
// tabla para expandirse directo debajo de la fila de la acción (mismo
// patrón que SigAsignacionForm en Diagnóstico SIG).
function AsignacionRowForm({ colSpan, personas, defaultPersonaId, defaultTitulo, onConfirm, onCancel }) {
  const [personaId, setPersonaId] = useState(defaultPersonaId || "");
  const [titulo, setTitulo] = useState(defaultTitulo || "");
  const [horas, setHoras] = useState(2);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!personaId) { setError("Selecciona a quién se le asigna."); return; }
    if (!titulo.trim()) { setError("El título no puede quedar vacío."); return; }
    setError("");
    setSaving(true);
    const persona = personas.find((p) => String(p.id) === String(personaId));
    const ok = await onConfirm({
      personaId: Number(personaId),
      personaNombre: persona?.nombre || "",
      titulo: titulo.trim(),
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <tr className="border-b border-slate-100 bg-sky-50/50">
      <td colSpan={colSpan} className="px-3 py-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Persona
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-48 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              <option value="">Selecciona...</option>
              {personas.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
            </select>
          </label>
          <label className="min-w-[180px] flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Título
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Horas
            <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-20 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Fecha límite
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Prioridad
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              {["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#111827] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {saving ? "Enviando..." : "Confirmar"}
          </button>
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
        </div>
        {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export default function TablaTab({ acciones, personas, personasById, procesosById, currentUser, tiposFlujo, onSelectAccion, onCreateAssignment }) {
  const [convertingId, setConvertingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const groups = NIVELES_ACCION.map((nivel) => ({
    nivel,
    color: NIVEL_COLOR[nivel],
    items: acciones.filter((a) => a.nivel === nivel),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Acción</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Proceso</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2 text-right">Prioridad</th>
              <th className="px-3 py-2 text-right">Estado</th>
              <th className="px-3 py-2 text-right">Compromiso</th>
              <th className="px-3 py-2 text-center">Asignación</th>
              <th className="px-2 py-2 text-center">Ver</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.nivel}>
                <tr>
                  <td colSpan={9} className="px-3 py-1.5" style={{ background: `${group.color}14` }}>
                    <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest" style={{ color: group.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                      {group.nivel}
                    </span>
                  </td>
                </tr>
                {group.items.map((accion, rowIndex) => {
                  const responsable = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
                  const proceso = accion.proceso_id ? procesosById[accion.proceso_id] : null;
                  const vencida = isVencida(accion);
                  const canEdit = canEditAccion(currentUser, accion, proceso);
                  const isConverting = convertingId === accion.id;
                  const isExpanded = expandedId === accion.id;
                  const etapas = getFlujoEtapas(tiposFlujo, accion.tipo);
                  return (
                    <Fragment key={accion.id}>
                      <tr
                        className="border-b border-slate-50 transition hover:bg-sky-50/60"
                        style={{ background: rowIndex % 2 === 1 ? `${group.color}0d` : "#fff" }}
                      >
                        <td className="px-3 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${group.color}` }}>
                          <button type="button" onClick={() => onSelectAccion(accion.id)} className="text-left hover:text-sky-700">
                            <span className="block text-[9px] font-bold text-slate-400">{accion.codigo}</span>
                            <span className="font-black text-slate-800">{accion.titulo}</span>
                            {accion.con_riesgo && <span className="ml-2 rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[8px] font-black text-red-600">Con riesgo</span>}
                          </button>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">{accion.tipo}</td>
                        <td className="px-3 py-1.5 text-slate-500">{proceso?.nombre || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-500">{responsable || "Sin asignar"}</td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${PRIORIDAD_BADGE[accion.prioridad] || ""}`}>{accion.prioridad}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${ESTADO_BADGE[accion.estado] || ""}`}>{accion.estado}</span>
                        </td>
                        <td className={`px-3 py-1.5 text-right font-bold ${vencida ? "text-red-500" : "text-slate-500"}`}>{formatDate(accion.fecha_compromiso) || "—"}</td>
                        <td className="px-3 py-1.5 text-center">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setConvertingId((current) => (current === accion.id ? null : accion.id))}
                              title="Enviar a Asignaciones"
                              className={`flex h-6 w-6 items-center justify-center rounded-full transition ${isConverting ? "bg-sky-100 text-sky-600" : "text-slate-300 hover:bg-sky-50 hover:text-sky-600"}`}
                            >
                              →
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedId((current) => (current === accion.id ? null : accion.id))}
                            className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition ${isExpanded ? "border-sky-200 bg-sky-100 text-sky-700" : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                          >
                            {isExpanded ? "Ocultar ▲" : "Ver ▾"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td colSpan={9} className="px-4 py-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Línea de tiempo — clic en un bloque para abrir esa parte del detalle</p>
                            <InlineTimeline
                              accion={accion}
                              etapas={etapas}
                              onOpenEtapa={(subTab) => onSelectAccion(accion.id, subTab)}
                            />
                          </td>
                        </tr>
                      )}
                      {isConverting && (
                        <AsignacionRowForm
                          colSpan={9}
                          personas={personas}
                          defaultPersonaId={accion.responsable_persona_id || ""}
                          defaultTitulo={accion.titulo}
                          onCancel={() => setConvertingId(null)}
                          onConfirm={(payload) => onCreateAssignment(accion, payload)}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
            {acciones.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay acciones para estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
