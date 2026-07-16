import { Fragment } from "react";
import { NIVELES_ACCION, NIVEL_COLOR, NIVEL_BADGE, PRIORIDAD_BADGE, ESTADO_BADGE, isVencida, formatDate } from "./actionsHelpers";

export default function TablaTab({ acciones, personasById, procesosById, onSelectAccion }) {
  const groups = NIVELES_ACCION.map((nivel) => ({
    nivel,
    color: NIVEL_COLOR[nivel],
    items: acciones.filter((a) => a.nivel === nivel),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Acción</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Proceso</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2 text-right">Prioridad</th>
              <th className="px-3 py-2 text-right">Estado</th>
              <th className="px-3 py-2 text-right">Compromiso</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.nivel}>
                <tr>
                  <td colSpan={7} className="px-3 py-1.5" style={{ background: `${group.color}14` }}>
                    <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest" style={{ color: group.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                      {group.nivel}
                    </span>
                  </td>
                </tr>
                {group.items.map((accion) => {
                  const responsable = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
                  const proceso = accion.proceso_id ? procesosById[accion.proceso_id]?.nombre : null;
                  const vencida = isVencida(accion);
                  return (
                    <tr key={accion.id} className="border-b border-slate-50 transition hover:bg-slate-50/70">
                      <td className="px-3 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${group.color}` }}>
                        <button type="button" onClick={() => onSelectAccion(accion.id)} className="text-left hover:text-sky-700">
                          <span className="block text-[9px] font-bold text-slate-400">{accion.codigo}</span>
                          <span className="font-black text-slate-800">{accion.titulo}</span>
                          {accion.con_riesgo && <span className="ml-2 rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-[8px] font-black text-red-600">Con riesgo</span>}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">{accion.tipo}</td>
                      <td className="px-3 py-1.5 text-slate-500">{proceso || "—"}</td>
                      <td className="px-3 py-1.5 text-slate-500">{responsable || "Sin asignar"}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${PRIORIDAD_BADGE[accion.prioridad] || ""}`}>{accion.prioridad}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${ESTADO_BADGE[accion.estado] || ""}`}>{accion.estado}</span>
                      </td>
                      <td className={`px-3 py-1.5 text-right font-bold ${vencida ? "text-red-500" : "text-slate-500"}`}>{formatDate(accion.fecha_compromiso) || "—"}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {acciones.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay acciones para estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
