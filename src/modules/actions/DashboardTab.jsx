import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TIPO_COLOR, NIVEL_COLOR, ESTADO_COLOR, isVencida, formatDate } from "./actionsHelpers";

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

// Mismo orden que la guía de 4 pasos del módulo (ActionsModule.jsx) — así el
// embudo se lee con el mismo mapa mental que ya se explicó ahí arriba.
const ETAPAS_PIPELINE = [
  { label: "Reportado", icono: "📝", color: "#94a3b8", estados: ["Borrador", "Registrada"] },
  { label: "Analizando", icono: "🔍", color: "#2a78d6", estados: ["En análisis"] },
  { label: "Aprobado", icono: "✅", color: "#0ca30c", estados: ["Aprobada"] },
  { label: "Ejecutando", icono: "🚀", color: "#eda100", estados: ["En ejecución", "En validación", "Verificación de eficacia", "Cerrada"] },
];

function Pipeline({ acciones }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ETAPAS_PIPELINE.map((etapa) => {
        const count = acciones.filter((a) => etapa.estados.includes(a.estado)).length;
        return (
          <div key={etapa.label} className="flex flex-1 min-w-[130px] items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: `${etapa.color}35`, background: `${etapa.color}0a` }}>
            <span className="text-[16px] leading-none">{etapa.icono}</span>
            <div>
              <p className="text-lg font-black leading-none text-slate-900">{count}</p>
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: etapa.color }}>{etapa.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Por cada acción abierta, junta las razones concretas por las que le toca
// al líder hacer algo — no es un conteo, es una lista clickeable directo a
// la acción. Se basa solo en campos que ya trae `acciones` (sin consultas
// extra): vencida, marcada con riesgo, sin empezar el análisis, o ya le
// tocó su fecha de verificación de eficacia (HLS 10.2 d) y sigue sin
// evaluar.
function construirAtencion(acciones) {
  const hoy = new Date().toISOString().slice(0, 10);
  const RAZONES = [
    { test: (a) => isVencida(a), tag: "Vencida", color: "#d03b3b" },
    { test: (a) => a.con_riesgo, tag: "Con riesgo", color: "#eb6834" },
    { test: (a) => ["Borrador", "Registrada"].includes(a.estado), tag: "Sin analizar", color: "#2a78d6" },
    { test: (a) => a.requiere_verificacion_eficacia && !a.eficacia_resultado && a.fecha_verificacion_eficacia && a.fecha_verificacion_eficacia <= hoy, tag: "Verificar eficacia", color: "#0891b2" },
  ];
  return acciones
    .filter((a) => a.estado !== "Cerrada")
    .map((a) => ({ accion: a, razones: RAZONES.filter((r) => r.test(a)) }))
    .filter((item) => item.razones.length > 0)
    .sort((a, b) => b.razones.length - a.razones.length);
}

function AtencionList({ items, onSelectAccion }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-center text-[11px] font-bold text-emerald-700">
        ✓ Nada pendiente de tu parte por ahora.
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
      {items.map(({ accion, razones }) => (
        <button
          key={accion.id}
          type="button"
          onClick={() => onSelectAccion?.(accion.id)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
        >
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-slate-800">{accion.codigo} · {accion.titulo}</p>
            <p className="text-[9px] font-bold text-slate-400">{accion.estado}{accion.fecha_compromiso ? ` · Compromiso ${formatDate(accion.fecha_compromiso)}` : ""}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {razones.map((r) => (
              <span key={r.tag} className="rounded-full px-2 py-0.5 text-[9px] font-black text-white" style={{ background: r.color }}>{r.tag}</span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

// scope="mias": un líder viendo 3-5 acciones propias no necesita gráficas de
// distribución (son puro dato sin decisión detrás) — necesita saber qué le
// toca hacer. Se reemplazan los donuts por el embudo de las 4 etapas del
// flujo y una lista clickeable de "qué necesita tu atención". scope="todas"
// sí es un análisis de portafolio para equipo estratégico, ahí los donuts
// (distribución por tipo/nivel/estado/proceso) siguen aportando.
export default function DashboardTab({ acciones, procesosById, scope, onSelectAccion }) {
  const abiertas = acciones.filter((a) => a.estado !== "Cerrada").length;
  const cerradas = acciones.filter((a) => a.estado === "Cerrada").length;
  const conRiesgo = acciones.filter((a) => a.con_riesgo).length;
  const vencidas = acciones.filter((a) => isVencida(a)).length;

  const esMias = scope === "mias";

  if (esMias) {
    const atencion = construirAtencion(acciones);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatChip label="Abiertas" value={abiertas} color="#2a78d6" />
          <StatChip label="Cerradas" value={cerradas} color="#0ca30c" />
          <StatChip label="Con riesgo" value={conRiesgo} color="#d03b3b" />
          <StatChip label="Vencidas" value={vencidas} color="#eda100" />
        </div>
        <Pipeline acciones={acciones} />
        <div>
          <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Necesita tu atención</p>
          <AtencionList items={atencion} onSelectAccion={onSelectAccion} />
        </div>
        {acciones.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-[11px] font-bold text-slate-300">
            Aún no tienes acciones registradas.
          </div>
        )}
      </div>
    );
  }

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatChip label="Abiertas" value={abiertas} color="#2a78d6" />
        <StatChip label="Cerradas" value={cerradas} color="#0ca30c" />
        <StatChip label="Con riesgo" value={conRiesgo} color="#d03b3b" />
        <StatChip label="Vencidas" value={vencidas} color="#eda100" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DistributionDonut title="Por tipo" data={byTipo} />
        <DistributionDonut title="Por nivel" data={byNivel} />
        <DistributionDonut title="Por estado" data={byEstado} />
        <DistributionDonut title="Por proceso" data={byProceso} />
      </div>
      {acciones.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-[11px] font-bold text-slate-300">
          Aún no hay acciones registradas con estos filtros.
        </div>
      )}
    </div>
  );
}
