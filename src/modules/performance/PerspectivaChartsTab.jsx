import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  MESES,
  buildMonthlySeries,
  computeCumplimiento,
  getCumplimientoStatus,
  formatAxisValue,
  formatKpiValue,
  getKpiColor,
  getWeeksInMonth,
  getResultadoValue,
} from "./performanceHelpers";

// Mismo rango que se captura en Resultados (Ago-Dic) — no tiene sentido
// ofrecer meses sin captura habilitada en el selector de la vista semanal.
const WEEKLY_MESES = MESES.map((label, index) => ({ label, index })).slice(7);

// Serie semanal de un mes puntual: una barra/punto por semana capturada (4 o
// 5 según el mes), con la Meta mensual repetida en cada semana como
// referencia (no existe meta por semana, solo mensual).
function buildWeeklySeries(resultados, kpi, anio, mes) {
  const totalSemanas = getWeeksInMonth(anio, mes);
  const meta = getResultadoValue(resultados, kpi.id, anio, mes, "meta");
  return Array.from({ length: totalSemanas }, (_, i) => i + 1).map((semana) => ({
    mes: `S${semana}`,
    meta,
    real: getResultadoValue(resultados, kpi.id, anio, mes, "real", semana),
  }));
}

function ChartTooltip({ active, payload, label, unidad }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 shadow-lg">
      <p className="mb-1 text-slate-400">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatKpiValue(entry.value, unidad)}
        </p>
      ))}
    </div>
  );
}

export function KpiChartCard({ kpi, resultados, anio, color }) {
  const isSemanal = kpi.periodicidad === "Semanal" && kpi.tipo_grafico !== "circular";
  const [weeklyView, setWeeklyView] = useState(false);
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [selectedMes, setSelectedMes] = useState(currentMonth >= 8 ? currentMonth : 8);

  const serie = weeklyView ? buildWeeklySeries(resultados, kpi, anio, selectedMes) : buildMonthlySeries(resultados, kpi, anio);
  const { real, meta, cumplimiento } = computeCumplimiento(resultados, kpi, anio);
  const status = getCumplimientoStatus(cumplimiento);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black text-slate-900">{kpi.nombre_indicador}</p>
          <p className="text-[9px] font-bold text-slate-400">{kpi.objetivo_estrategico}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isSemanal && (
            <button
              type="button"
              onClick={() => setWeeklyView((v) => !v)}
              title={weeklyView ? "Volver a vista mensual" : "Ver por semana"}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide transition ${
                weeklyView ? "border-violet-300 bg-violet-50 text-violet-600" : "border-slate-200 text-slate-400 hover:border-violet-200 hover:text-violet-500"
              }`}
            >
              {weeklyView ? "↩ Mensual" : "▤ Semanal"}
            </button>
          )}
          <span className="rounded-full border px-2 py-0.5 text-[9px] font-black" style={{ borderColor: status.color, color: status.color }}>
            {cumplimiento === null ? "Sin datos" : `${cumplimiento}%`}
          </span>
        </div>
      </div>
      {weeklyView && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mes</span>
          <select
            value={selectedMes}
            onChange={(event) => setSelectedMes(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 outline-none"
          >
            {WEEKLY_MESES.map(({ label, index }) => (
              <option key={index} value={index + 1}>{label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="mb-2 flex gap-4 text-[10px] font-bold text-slate-500">
        <span>Real: <span className="text-slate-800">{formatKpiValue(real, kpi.unidad_medida)}</span></span>
        <span>Meta: <span className="text-slate-800">{formatKpiValue(meta, kpi.unidad_medida)}</span></span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        {kpi.tipo_grafico === "barra" ? (
          <BarChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#898781" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxisValue(v, kpi.unidad_medida)} width={40} />
            <Tooltip content={<ChartTooltip unidad={kpi.unidad_medida} />} cursor={{ fill: "#f0efec" }} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="meta" name="Meta" fill="#c3c2b7" radius={[3, 3, 0, 0]} />
            <Bar dataKey="real" name="Real" fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : kpi.tipo_grafico === "circular" ? (
          <PieChart>
            <Pie
              data={[{ name: "Real", value: real || 0 }, { name: "Restante", value: Math.max(0, (meta || 0) - (real || 0)) }]}
              dataKey="value"
              innerRadius={45}
              outerRadius={70}
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="#e1e0d9" />
            </Pie>
            <Tooltip content={<ChartTooltip unidad={kpi.unidad_medida} />} />
          </PieChart>
        ) : (
          <LineChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#898781" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxisValue(v, kpi.unidad_medida)} width={40} />
            <Tooltip content={<ChartTooltip unidad={kpi.unidad_medida} />} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Line type="monotone" dataKey="meta" name="Meta" stroke="#c3c2b7" strokeWidth={2} dot={false} strokeDasharray="4 3" />
            <Line type="monotone" dataKey="real" name="Real" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default function PerspectivaChartsTab({ kpis, resultados, anio, perspectiva }) {
  const items = kpis.filter((k) => k.perspectiva === perspectiva);
  if (items.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-[11px] font-bold text-slate-300">Aún no hay KPIs en esta perspectiva.</div>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((kpi, index) => (
        <KpiChartCard key={kpi.id} kpi={kpi} resultados={resultados} anio={anio} color={getKpiColor(kpi, index)} />
      ))}
    </div>
  );
}
