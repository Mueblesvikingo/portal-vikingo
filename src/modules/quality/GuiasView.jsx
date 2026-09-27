import { useState } from "react";
import { PLAN_MUESTREO } from "../../services/calidadService";
import { cardClass } from "./coreliTheme";

// Tarjetas de guía/capacitación — arrancamos con contenido real ya existente
// en el sistema (el Plan de Muestreo Ac/Re) en vez de inventar artículos;
// más adelante se agregan más tarjetas aquí mismo.
const GUIAS = [
  {
    key: "plan-muestreo",
    icono: "📊",
    titulo: "Plan de muestreo Ac/Re",
    resumen: "Cuántas piezas revisar según el tamaño del lote, y cuándo aceptar o rechazar.",
  },
];

function PlanMuestreoDetalle() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[#5b6472]">
        Aplica a no conformidades <span className="font-semibold text-[#0f1f3d]">menores</span>. Con 1 sola no conformidad <span className="font-semibold text-red-600">Mayor o Crítica</span>: contener y ampliar la inspección al 100% del lote.
      </p>
      <div className="rounded-xl border border-[#edf0f4]">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[24%]" />
            <col className="w-[21%]" />
            <col className="w-[21%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#f7f7f4] text-[9px] font-semibold uppercase tracking-wide text-[#5b6472] sm:text-[10px]">
              <th className="px-1.5 py-2 sm:px-3">Lote / OP</th>
              <th className="px-1 py-2 text-center sm:px-3">Muestra</th>
              <th className="px-1 py-2 text-center sm:px-3">Ac</th>
              <th className="px-1 py-2 text-center sm:px-3">Re</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {PLAN_MUESTREO.map((fila) => (
              <tr key={fila.lote}>
                <td className="px-1.5 py-1.5 font-medium text-[#0f1f3d] sm:px-3">{fila.lote}</td>
                <td className="px-1 py-1.5 text-center text-[#0f1f3d] sm:px-3">{fila.muestra}</td>
                <td className="px-1 py-1.5 text-center text-green-700 sm:px-3">{fila.ac}</td>
                <td className="px-1 py-1.5 text-center text-red-600 sm:px-3">{fila.re}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#94a3b8]">Ac = aceptar lote · Re = rechazar / escalar. Plan interno Vikingo para lotes de fabricación de hasta 50 muebles por OP.</p>
    </div>
  );
}

export default function GuiasView() {
  const [abierta, setAbierta] = useState(null);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#0f1f3d]">Guías</h2>
        <p className="text-sm text-[#5b6472]">Qué significa cada cosa, para consultar rápido desde el piso.</p>
      </div>

      <div className="space-y-2">
        {GUIAS.map((g) => {
          const abiertaAqui = abierta === g.key;
          return (
            <div key={g.key} className={`${cardClass} overflow-hidden`}>
              <button type="button" onClick={() => setAbierta(abiertaAqui ? null : g.key)} className="flex w-full items-center gap-3 p-4 text-left transition active:bg-[#f7f7f4]/60">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fdf7e6] text-base">{g.icono}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0f1f3d]">{g.titulo}</p>
                  <p className="text-xs text-[#5b6472]">{g.resumen}</p>
                </div>
                <span className={`shrink-0 text-[#94a3b8] transition-transform ${abiertaAqui ? "rotate-180" : ""}`}>⌄</span>
              </button>
              {abiertaAqui && <div className="border-t border-[#edf0f4] p-4">{g.key === "plan-muestreo" && <PlanMuestreoDetalle />}</div>}
            </div>
          );
        })}
      </div>

      <div className={`${cardClass} p-4 text-center text-sm text-[#94a3b8]`}>Más guías y contenido de capacitación próximamente.</div>
    </div>
  );
}
