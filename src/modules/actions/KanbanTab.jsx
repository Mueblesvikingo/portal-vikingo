import { useState } from "react";
import { ESTADOS_ACCION, ESTADO_BADGE, TIPO_COLOR, NIVEL_BADGE, PRIORIDAD_BADGE, isVencida, formatDate } from "./actionsHelpers";
import { canEditAccion } from "../../services/permissionsService";

function AccionCard({ accion, personasById, canDrag, onClick, onDragStart }) {
  const responsable = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
  const vencida = isVencida(accion);
  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onClick={onClick}
      title={canDrag ? undefined : "Solo consulta — no tienes permiso para mover esta acción"}
      className={`rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:shadow-md ${canDrag ? "cursor-pointer active:cursor-grabbing" : "cursor-pointer"}`}
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

// Tarjeta para el Tablero en celular — mismo contenido que AccionCard, pero
// en vez de arrastrar (no hay drag&drop cómodo con el dedo) trae un select
// "Mover a…" que dispara el mismo onUpdateAccion que ya usa el drop de
// escritorio. Sin permiso de edición, se ve el badge de "Solo consulta" en
// su lugar (mismo criterio que el tooltip del drag en escritorio).
function AccionCardMobileKanban({ accion, personasById, canEdit, onClick, onMoveEstado }) {
  const responsable = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
  const vencida = isVencida(accion);
  return (
    <div className="overflow-hidden rounded-xl border border-[#edf0f4] bg-white shadow-sm" style={{ borderLeft: `3px solid ${TIPO_COLOR[accion.tipo] || "#94a3b8"}` }}>
      <button type="button" onClick={onClick} className="block w-full px-2.5 py-2 text-left">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">{accion.codigo}</span>
          {accion.con_riesgo && <span className="rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[7px] font-black text-red-600">Riesgo</span>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] font-black leading-tight text-slate-900">{accion.titulo}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black ${NIVEL_BADGE[accion.nivel] || "border-slate-200 bg-slate-50 text-slate-500"}`}>{accion.nivel}</span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black ${PRIORIDAD_BADGE[accion.prioridad] || ""}`}>{accion.prioridad}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px] font-bold text-slate-400">
          <span className="truncate">{responsable || "Sin asignar"}</span>
          <span className={vencida ? "font-black text-red-500" : ""}>{formatDate(accion.fecha_compromiso)}</span>
        </div>
      </button>
      <div className="border-t border-[#edf0f4] px-2.5 py-1.5">
        {canEdit ? (
          <select
            value=""
            onChange={(e) => { if (e.target.value) onMoveEstado(e.target.value); }}
            className="w-full rounded-lg border border-[#edf0f4] bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 outline-none"
          >
            <option value="">Mover a…</option>
            {ESTADOS_ACCION.filter((e) => e !== accion.estado).map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        ) : (
          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300">Solo consulta</span>
        )}
      </div>
    </div>
  );
}

export default function KanbanTab({ acciones, personasById, procesosById, currentUser, onUpdateAccion, onSelectAccion }) {
  const [draggedId, setDraggedId] = useState(null);
  // Solo para la vista de celular (ver bloque lg:hidden abajo) — en
  // escritorio se ven las 8 columnas a la vez, pero en una pantalla angosta
  // hay que elegir una para ver su lista.
  const [estadoActivo, setEstadoActivo] = useState(ESTADOS_ACCION[0]);

  const columns = ESTADOS_ACCION.map((estado) => ({
    estado,
    items: acciones.filter((a) => a.estado === estado),
  }));
  const columnaActiva = columns.find((c) => c.estado === estadoActivo) || columns[0];

  function moverEstado(accion, estado) {
    const proceso = accion.proceso_id ? procesosById[accion.proceso_id] : null;
    if (accion.estado !== estado && canEditAccion(currentUser, accion, proceso)) {
      onUpdateAccion(accion.id, { estado });
    }
  }

  function handleDrop(estado) {
    if (draggedId == null) return;
    const accion = acciones.find((a) => a.id === draggedId);
    if (accion) moverEstado(accion, estado);
    setDraggedId(null);
  }

  return (
    <div>
      {/* Escritorio: las 8 columnas a la vez con drag&drop. En celular no
          hay forma cómoda de arrastrar con el dedo, así que se reemplaza por
          "elige un estado (pills) → lista vertical de esa columna, con un
          select 'Mover a…' por tarjeta" — ver el bloque `lg:hidden` de
          abajo. Mismo dato, mismo onUpdateAccion. */}
      <div className="hidden overflow-x-auto lg:block">
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
                    canDrag={canEditAccion(currentUser, accion, accion.proceso_id ? procesosById[accion.proceso_id] : null)}
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

      <div className="space-y-2 lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {columns.map((col) => (
            <button
              key={col.estado}
              type="button"
              onClick={() => setEstadoActivo(col.estado)}
              className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest transition ${
                estadoActivo === col.estado ? "border-[#001225] bg-[#001225] text-white" : "border-[#edf0f4] bg-white text-slate-500"
              }`}
            >
              {col.estado}
              <span className={estadoActivo === col.estado ? "text-white/60" : "text-slate-300"}>{col.items.length}</span>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {columnaActiva.items.map((accion) => (
            <AccionCardMobileKanban
              key={accion.id}
              accion={accion}
              personasById={personasById}
              canEdit={canEditAccion(currentUser, accion, accion.proceso_id ? procesosById[accion.proceso_id] : null)}
              onClick={() => onSelectAccion(accion.id)}
              onMoveEstado={(estado) => moverEstado(accion, estado)}
            />
          ))}
          {columnaActiva.items.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#edf0f4] p-4 text-center text-[10px] font-bold text-slate-300">Sin acciones en "{columnaActiva.estado}".</div>
          )}
        </div>
      </div>
    </div>
  );
}
