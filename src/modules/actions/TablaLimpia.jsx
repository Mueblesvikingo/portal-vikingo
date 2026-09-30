import { TIPOS_ACCION, ESTADO_BADGE, isVencida, formatDate } from "./actionsHelpers";

// Mismo estilo del historial de inspecciones de Calidad (ver
// src/modules/quality/MateriaPrimaPanel.jsx: cardClass + encabezado gris
// claro con la etiqueta y el conteo, tabla compacta de 2 líneas por celda,
// badge de estado, botón "Ver") — copiado aquí en vez de importado entre
// módulos, mismo criterio de autocontención ya usado en NuevaAccionModal.jsx.
const cardClass = "overflow-hidden rounded-2xl border border-[#edf0f4] bg-white shadow-[0_1px_1px_rgba(11,31,58,0.04),0_4px_12px_-2px_rgba(11,31,58,0.07)]";

function AccionFila({ accion, procesosById, personasById, onVer }) {
  const proceso = accion.proceso_id ? procesosById[accion.proceso_id]?.nombre : null;
  const responsable = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
  const vencida = isVencida(accion);
  return (
    <tr className="border-t border-[#edf0f4] first:border-0">
      <td className="px-2 py-2 align-top">
        <p className={`text-xs font-semibold ${vencida ? "text-red-500" : "text-[#0f1f3d]"}`}>{formatDate(accion.fecha_compromiso) || "Sin fecha"}</p>
        <p className="text-[10px] text-[#94a3b8]">{accion.codigo}</p>
      </td>
      <td className="px-2 py-2 align-top">
        <p className="truncate text-xs font-medium text-[#0f1f3d]">{accion.titulo}</p>
        <p className="truncate text-[10px] text-[#5b6472]">{proceso || "Sin proceso"} · {responsable || "Sin asignar"}</p>
      </td>
      <td className="px-2 py-2 align-top">
        <span className={`inline-block rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${ESTADO_BADGE[accion.estado] || "border-[#edf0f4] bg-[#f7f7f4] text-[#0f1f3d]"}`}>
          {accion.estado}
        </span>
      </td>
      <td className="px-2 py-2 text-right align-top">
        <button
          type="button"
          onClick={() => onVer(accion.id)}
          className="rounded-lg border border-[#edf0f4] bg-white px-2 py-1 text-[10px] font-semibold text-[#0f1f3d] shadow-[0_1px_2px_rgba(11,31,58,0.06)] transition active:scale-95"
        >
          👁 Ver
        </button>
      </td>
    </tr>
  );
}

// Seccionada por tipo (mismo orden que TIPOS_ACCION) — dentro de cada tipo,
// ordenada por fecha de compromiso (más próxima/reciente primero; sin fecha
// al final). Nada de scope, filtros ni pestañas: es la vista de solo
// consulta rápida, "una tabla limpia".
export default function TablaLimpia({ acciones, procesosById, personasById, onSelectAccion }) {
  const grupos = TIPOS_ACCION.map((tipo) => ({
    tipo,
    items: [...acciones]
      .filter((a) => a.tipo === tipo)
      .sort((a, b) => (b.fecha_compromiso || "").localeCompare(a.fecha_compromiso || "")),
  })).filter((g) => g.items.length > 0);

  if (grupos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#edf0f4] bg-white p-8 text-center text-[11px] font-bold text-slate-300">
        Sin acciones para mostrar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grupos.map((grupo) => (
        <div key={grupo.tipo} className={cardClass}>
          <div className="flex items-center justify-between gap-2 bg-[#f7f7f4] px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5b6472]">{grupo.tipo}</p>
            <span className="shrink-0 text-[11px] font-semibold text-[#94a3b8]">{grupo.items.length}</span>
          </div>
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[38%]" />
              <col className="w-[24%]" />
              <col className="w-[18%]" />
            </colgroup>
            <tbody>
              {grupo.items.map((a) => (
                <AccionFila key={a.id} accion={a} procesosById={procesosById} personasById={personasById} onVer={onSelectAccion} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
