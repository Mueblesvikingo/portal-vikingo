import { useState } from "react";
import { ESTADOS_ACCION, ESTADO_BADGE, TIPO_COLOR, NIVEL_BADGE, PRIORIDAD_BADGE, isVencida, formatDate } from "./actionsHelpers";

function AccionCard({ accion, personasById, onClick, onDragStart }) {
  const responsable = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
  const vencida = isVencida(accion);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:shadow-md active:cursor-grabbing"
      style={{ borderLeft: `3px solid ${TIPO_COLOR[accion.tipo] || "#94a3b8"}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">{accion.codigo}</span>
        {accion.con_riesgo && <span className="rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[7px] font-black text-red-600">Riesgo</span>}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[10px] font-black leading-tight text-slate-900">{accion.titulo}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black ${NIVEL_BADGE[accion.nivel] || "border-slate-200 bg-slate-50 text-slate-500"}`}>{accion.nivel}</span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black ${PRIORIDAD_BADGE[accion.prioridad] || ""}`}>{accion.prioridad}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[8px] font-bold text-slate-400">
        <span className="truncate">{responsable || "Sin asignar"}</span>
        <span className={vencida ? "font-black text-red-500" : ""}>{formatDate(accion.fecha_compromiso)}</span>
      </div>
    </div>
  );
}

export default function KanbanTab({ acciones, personasById, onUpdateAccion, onSelectAccion }) {
  const [draggedId, setDraggedId] = useState(null);

  const columns = ESTADOS_ACCION.map((estado) => ({
    estado,
    items: acciones.filter((a) => a.estado === estado),
  }));

  function handleDrop(estado) {
    if (draggedId == null) return;
    const accion = acciones.find((a) => a.id === draggedId);
    if (accion && accion.estado !== estado) onUpdateAccion(draggedId, { estado });
    setDraggedId(null);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2" style={{ minWidth: `${columns.length * 200}px` }}>
        {columns.map((col) => (
          <div
            key={col.estado}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(col.estado)}
            className="min-w-[200px] flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-2.5 py-2">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${ESTADO_BADGE[col.estado]}`}>{col.estado}</span>
              <span className="ml-1.5 text-[9px] font-black text-slate-400">{col.items.length}</span>
            </div>
            <div className="space-y-1.5 p-2">
              {col.items.map((accion) => (
                <AccionCard
                  key={accion.id}
                  accion={accion}
                  personasById={personasById}
                  onDragStart={() => setDraggedId(accion.id)}
                  onClick={() => onSelectAccion(accion.id)}
                />
              ))}
              {col.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-[9px] font-bold text-slate-300">Vacío</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
