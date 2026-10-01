import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ESTADOS_ACCION, ESTADO_COLOR, isVencida } from "./actionsHelpers";

// Dona arriba + lista de valores abajo (no al costado — apretados lado a
// lado dentro de una tarjeta de medio ancho salía muy poco legible, pedido
// explícito del usuario). Así el texto usa el ancho completo de la tarjeta.
function MiniDonut({ title, data }) {
  const chartData = data.filter((d) => d.value > 0);
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="rounded-2xl border border-[#edf0f4] bg-white p-3 shadow-[0_1px_1px_rgba(11,31,58,0.04),0_4px_12px_-2px_rgba(11,31,58,0.07)]">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      {chartData.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-[10px] font-bold text-slate-300">Sin datos</div>
      ) : (
        <>
          <div className="mx-auto h-[110px] w-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={32} outerRadius={52} stroke="none" paddingAngle={2}>
                  {chartData.map((d) => <Cell key={d.label} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11, fontWeight: 700, padding: "3px 8px" }} formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {chartData.map((d) => (
              <div key={d.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-600">
                  {d.label}
                  {d.suffix && <span className="ml-1 font-semibold text-slate-400">{d.suffix}</span>}
                </span>
                <span className="shrink-0 text-[12px] font-black text-slate-800">{d.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 border-t border-slate-100 pt-1.5">
              <span className="min-w-0 flex-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">Total</span>
              <span className="shrink-0 text-[11px] font-black text-slate-500">{total}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Dos donas lado a lado en Inicio: "en qué etapa está" y "qué urge" — pensado
// para que cada quien vea de un vistazo cómo van SUS acciones abiertas, sin
// competir con la lista de tarjetas de abajo. `acciones` ya llega filtrada a
// "las mías" (ver baseAcciones en ActionsModule.jsx) y solo abiertas.
export default function InicioCharts({ acciones }) {
  if (!acciones.length) return null;

  // "(n/total)" = en qué paso del flujo general va esa etapa (Registrada,
  // En análisis, Plan de acción... hasta Verificación de eficacia) — ayuda a
  // leer de un vistazo qué tan avanzada va, no solo cuántas hay.
  const etapasAbiertas = ESTADOS_ACCION.filter((estado) => estado !== "Cerrada");
  const porEtapa = etapasAbiertas.map((estado, index) => ({
    label: estado,
    value: acciones.filter((a) => a.estado === estado).length,
    color: ESTADO_COLOR[estado] || "#94a3b8",
    suffix: `(${index + 1}/${etapasAbiertas.length})`,
  }));

  const vencidas = acciones.filter(isVencida).length;
  const urgencia = [
    { label: "A tiempo", value: acciones.length - vencidas, color: "#16a34a" },
    { label: "Vencidas", value: vencidas, color: "#dc2626" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      <MiniDonut title="Por etapa" data={porEtapa} />
      <MiniDonut title="Vencidas" data={urgencia} />
    </div>
  );
}
