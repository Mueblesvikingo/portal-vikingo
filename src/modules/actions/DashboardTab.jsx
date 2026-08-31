import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TIPO_COLOR, NIVEL_COLOR, ESTADO_COLOR, isVencida } from "./actionsHelpers";

// Fila delgada horizontal (etiqueta + número en línea) en vez de una tarjeta
// alta — 4 de estas ya comunican lo mismo sin ocupar tanto alto.
function StatChip({ label, value, color }) {
  return (
    <div className="flex flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: `${color}35`, background: `${color}0a` }}>
      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{label}</p>
      <p className="text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function DistributionDonut({ title, data }) {
  const chartData = data.filter((d) => d.value > 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      {chartData.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-[10px] font-bold text-slate-300">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={38} outerRadius={62} stroke="none" paddingAngle={2}>
              {chartData.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 10, fontWeight: 700 }}
              formatter={(value, name) => [value, name]}
            />
            <Legend wrapperStyle={{ fontSize: 9, fontWeight: 700 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// scope="mias": vista de un líder viendo solo sus propias acciones — casi
// siempre caen todas en su mismo proceso, así que "Por proceso" no aporta
// nada (sería una sola rebanada). Esa gráfica solo tiene sentido con la
// vista completa de la organización ("todas").
export default function DashboardTab({ acciones, procesosById, scope }) {
  const abiertas = acciones.filter((a) => a.estado !== "Cerrada").length;
  const cerradas = acciones.filter((a) => a.estado === "Cerrada").length;
  const conRiesgo = acciones.filter((a) => a.con_riesgo).length;
  const vencidas = acciones.filter((a) => isVencida(a)).length;

  const byTipo = Object.entries(
    acciones.reduce((acc, a) => ({ ...acc, [a.tipo]: (acc[a.tipo] || 0) + 1 }), {})
  ).map(([label, value]) => ({ label, value, color: TIPO_COLOR[label] || "#94a3b8" }));

  const byNivel = Object.entries(
    acciones.reduce((acc, a) => ({ ...acc, [a.nivel]: (acc[a.nivel] || 0) + 1 }), {})
  ).map(([label, value]) => ({ label, value, color: NIVEL_COLOR[label] || "#94a3b8" }));

  const byEstado = Object.entries(
    acciones.reduce((acc, a) => ({ ...acc, [a.estado]: (acc[a.estado] || 0) + 1 }), {})
  ).map(([label, value]) => ({ label, value, color: ESTADO_COLOR[label] || "#94a3b8" }));

  const byProceso = Object.entries(
    acciones.reduce((acc, a) => {
      const label = a.proceso_id ? (procesosById[a.proceso_id]?.nombre || "Proceso sin nombre") : "Sin proceso";
      return { ...acc, [label]: (acc[label] || 0) + 1 };
    }, {})
  ).map(([label, value], index) => ({ label, value, color: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"][index % 8] }));

  const mostrarPorProceso = scope !== "mias";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatChip label="Abiertas" value={abiertas} color="#2a78d6" />
        <StatChip label="Cerradas" value={cerradas} color="#0ca30c" />
        <StatChip label="Con riesgo" value={conRiesgo} color="#d03b3b" />
        <StatChip label="Vencidas" value={vencidas} color="#eda100" />
      </div>
      <div className={`grid gap-3 md:grid-cols-2 ${mostrarPorProceso ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <DistributionDonut title="Por tipo" data={byTipo} />
        <DistributionDonut title="Por nivel" data={byNivel} />
        <DistributionDonut title="Por estado" data={byEstado} />
        {mostrarPorProceso && <DistributionDonut title="Por proceso" data={byProceso} />}
      </div>
      {acciones.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-[11px] font-bold text-slate-300">
          Aún no hay acciones registradas con estos filtros.
        </div>
      )}
    </div>
  );
}
