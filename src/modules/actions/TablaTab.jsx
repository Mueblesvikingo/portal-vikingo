import { Fragment, useState } from "react";
import { NIVELES_ACCION, NIVEL_COLOR, NIVEL_BADGE, PRIORIDAD_BADGE, ESTADO_BADGE, ESTADO_COLOR, isVencida, formatDate, getFlujoEtapas, subTabParaEtapa } from "./actionsHelpers";
import { canEditAccion } from "../../services/permissionsService";

// Vista compacta de la línea de tiempo — mismo código de color e
// iluminado/tenue que la del detalle completo, sin la fecha por etapa (esa
// sí requiere cargar el historial, que aquí no vale la pena traer solo
// para una vista previa).
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

// Ventana emergente con la línea de tiempo de una acción — se abre con el
// botón "Ver" de la tabla, sin desplegar la fila ni salir de la pantalla.
function TimelineModal({ accion, etapas, onOpenEtapa, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400">{accion.codigo}</p>
            <p className="truncate text-sm font-black text-slate-900">{accion.titulo}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-500 hover:bg-slate-200">×</button>
        </div>
        <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Línea de tiempo — clic en un bloque para abrir esa parte del detalle</p>
        <div className="mt-2">
          <InlineTimeline accion={accion} etapas={etapas} onOpenEtapa={onOpenEtapa} />
        </div>
      </div>
    </div>
  );
}

// Campos del formulario de asignación — separados de su contenedor (fila de
// tabla en escritorio, tarjeta en celular) para no duplicar la lógica entre
// las dos vistas de TablaTab.
function AsignacionFormFields({ personas, defaultPersonaId, defaultTitulo, onConfirm, onCancel }) {
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
    <>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Persona
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-full min-w-[160px] rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none sm:w-48">
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
    </>
  );
}

// Misma forma que AsignacionForm en AccionDetailPanel.jsx, como fila de
// tabla para expandirse directo debajo de la fila de la acción (mismo
// patrón que SigAsignacionForm en Diagnóstico SIG) — solo para la tabla de
// escritorio; la lista en tarjetas de celular usa AsignacionFormFields
// directo dentro de un <div> (ver AccionCardMobile).
function AsignacionRowForm({ colSpan, ...props }) {
  return (
    <tr className="border-b border-slate-100 bg-sky-50/50">
      <td colSpan={colSpan} className="px-3 py-2.5">
        <AsignacionFormFields {...props} />
      </td>
    </tr>
  );
}

// Tarjeta compacta para la lista en celular — mismo dato que la fila de la
// tabla de escritorio (código/título, tipo, proceso, responsable, prioridad,
// estado, compromiso) pero apilado en vez de en columnas, que es lo que no
// cabe en una pantalla angosta. Los botones "Ver" y "→ Asignación" quedan
// igual de accesibles que en la tabla.
function AccionCardMobile({ accion, color, proceso, responsable, vencida, canEdit, isConverting, onToggleConvertir, onVer, personas, onCreateAssignment, onCancelConvertir }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#edf0f4] bg-white shadow-sm" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <button type="button" onClick={onVer} className="block w-full px-3 py-2.5 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400">{accion.codigo}</p>
            <p className="truncate text-[12px] font-black text-slate-800">{accion.titulo}</p>
          </div>
          {accion.con_riesgo && <span className="shrink-0 rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[8px] font-black text-red-600">Riesgo</span>}
        </div>
        <p className="mt-1 truncate text-[9px] font-bold text-slate-400">{accion.tipo} · {proceso?.nombre || "Sin proceso"} · {responsable || "Sin asignar"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${PRIORIDAD_BADGE[accion.prioridad] || ""}`}>{accion.prioridad}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${ESTADO_BADGE[accion.estado] || ""}`}>{accion.estado}</span>
          {accion.fecha_compromiso && (
            <span className={`ml-auto text-[9px] font-black ${vencida ? "text-red-500" : "text-slate-400"}`}>{formatDate(accion.fecha_compromiso)}</span>
          )}
        </div>
      </button>
      {canEdit && (
        <div className="flex items-center gap-1.5 border-t border-[#edf0f4] px-3 py-1.5">
          <button
            type="button"
            onClick={onToggleConvertir}
            className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest transition ${isConverting ? "bg-sky-100 text-sky-700" : "text-sky-600 hover:bg-sky-50"}`}
          >
            → Asignación
          </button>
        </div>
      )}
      {isConverting && (
        <div className="border-t border-[#edf0f4] bg-sky-50/50 px-3 py-2.5">
          <AsignacionFormFields
            personas={personas}
            defaultPersonaId={accion.responsable_persona_id || ""}
            defaultTitulo={accion.titulo}
            onCancel={onCancelConvertir}
            onConfirm={(payload) => onCreateAssignment(accion, payload)}
          />
        </div>
      )}
    </div>
  );
}

export default function TablaTab({ acciones, personas, personasById, procesosById, currentUser, tiposFlujo, onSelectAccion, onCreateAssignment }) {
  const [convertingId, setConvertingId] = useState(null);
  const [verAccionId, setVerAccionId] = useState(null);
  const accionEnVer = verAccionId ? acciones.find((a) => a.id === verAccionId) : null;
  const groups = NIVELES_ACCION.map((nivel) => ({
    nivel,
    color: NIVEL_COLOR[nivel],
    items: acciones.filter((a) => a.nivel === nivel),
  })).filter((group) => group.items.length > 0);

  return (
    <div>
      {/* Escritorio: tabla ancha con todas las columnas a la vez. En una
          pantalla angosta esas 9 columnas no caben ni con scroll horizontal
          cómodo, así que celular usa una lista de tarjetas apiladas en su
          lugar (mismo dato, mismas acciones) — ver el bloque `lg:hidden`
          de abajo. */}
    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
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
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{accion.tipo}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{proceso?.nombre || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{responsable || "Sin asignar"}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${PRIORIDAD_BADGE[accion.prioridad] || ""}`}>{accion.prioridad}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
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
                            onClick={() => setVerAccionId(accion.id)}
                            className="whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-sky-700 transition hover:bg-sky-100"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
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

      {/* Celular/tablet: lista de tarjetas agrupadas por nivel, igual que la
          tabla pero apiladas — mismos datos, mismas acciones (Ver / →
          Asignación). */}
      <div className="space-y-3 lg:hidden">
        {groups.map((group) => (
          <div key={group.nivel} className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest" style={{ color: group.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
              {group.nivel}
            </span>
            <div className="space-y-1.5">
              {group.items.map((accion) => {
                const responsable = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
                const proceso = accion.proceso_id ? procesosById[accion.proceso_id] : null;
                const vencida = isVencida(accion);
                const canEdit = canEditAccion(currentUser, accion, proceso);
                const isConverting = convertingId === accion.id;
                return (
                  <AccionCardMobile
                    key={accion.id}
                    accion={accion}
                    color={group.color}
                    proceso={proceso}
                    responsable={responsable}
                    vencida={vencida}
                    canEdit={canEdit}
                    isConverting={isConverting}
                    onToggleConvertir={() => setConvertingId((current) => (current === accion.id ? null : accion.id))}
                    onCancelConvertir={() => setConvertingId(null)}
                    onVer={() => onSelectAccion(accion.id)}
                    personas={personas}
                    onCreateAssignment={onCreateAssignment}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {acciones.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#edf0f4] bg-white px-3 py-8 text-center text-[11px] font-bold text-slate-300">
            Aún no hay acciones para estos filtros.
          </div>
        )}
      </div>

      {accionEnVer && (
        <TimelineModal
          accion={accionEnVer}
          etapas={getFlujoEtapas(tiposFlujo, accionEnVer.tipo)}
          onOpenEtapa={(subTab) => { onSelectAccion(accionEnVer.id, subTab); setVerAccionId(null); }}
          onClose={() => setVerAccionId(null)}
        />
      )}
    </div>
  );
}
