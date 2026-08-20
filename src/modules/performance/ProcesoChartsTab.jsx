import { KpiChartCard } from "./PerspectivaChartsTab";
import { getKpiColor } from "./performanceHelpers";

// Equivalente a PerspectivaChartsTab pero para tableros de proceso (no
// Estratégico): ahí los KPIs no tienen "perspectiva", se agrupan en
// Tácticos/Operativos igual que ya hacen TableroTab y ResultadosTab.
export default function ProcesoChartsTab({ kpis, resultados, anio }) {
  const groups = [
    { label: "Tácticos", items: kpis.filter((k) => k.ambito === "tactico") },
    { label: "Operativos", items: kpis.filter((k) => k.ambito === "operativo") },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-[11px] font-bold text-slate-300">
        Aún no hay KPIs activos para graficar en este tablero.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{group.label}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {group.items.map((kpi, index) => (
              <KpiChartCard key={kpi.id} kpi={kpi} resultados={resultados} anio={anio} color={getKpiColor(kpi, index)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
