import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ESTADOS_ACCION, ESTADO_COLOR, isVencida } from "./actionsHelpers";

// Dona chica + lista de valores al lado (en vez de la Legend de Recharts,
// que envuelve a su propio ancho y puede empujar la tarjeta más alta de lo
// esperado) — pensado para vivir en pareja de a dos, lado a lado, sin
// obligar a hacer scroll en celular (pedido explícito del usuario).
function MiniDonut({ title, data }) {
  const chartData = data.filter((d) => d.value > 0);
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="rounded-2xl border border-[#edf0f4] bg-white p-2.5 shadow-[0_1px_1px_rgba(11,31,58,0.04),0_4px_12px_-2px_rgba(11,31,58,0.07)]">
      <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      {chartData.length === 0 ? (
        <div className="flex h-[88px] items-center justify-center text-[9px] font-bold text-slate-300">Sin datos</div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-[88px] w-[88px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={24} outerRadius={42} stroke="none" paddingAngle={2}>
                  {chartData.map((d) => <Cell key={d.label} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 9, fontWeight: 700, padding: "2px 6px" }} formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {chartData.map((d) => (
              <div key={d.label} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="min-w-0 flex-1 truncate text-[9px] font-bold text-slate-600">{d.label}</span>
                <span className="shrink-0 text-[9px] font-black text-slate-800">{d.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 border-t border-slate-100 pt-1">
              <span className="min-w-0 flex-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">Total</span>
              <span className="shrink-0 text-[9px] font-black text-slate-500">{total}</span>
            </div>
          </div>
        </div>
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

  const porEtapa = ESTADOS_ACCION
    .filter((estado) => estado !== "Cerrada")
    .map((estado) => ({
      label: estado,
      value: acciones.filter((a) => a.estado === estado).length,
      color: ESTADO_COLOR[estado] || "#94a3b8",
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
