import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { getInspeccionesUnica, getPuntosControl, getPuntosControlPorProceso } from "../../services/calidadService";
import { cardClass } from "./coreliTheme";
import { calcularPeriodo, todayISO, ddmmyyyy, SelectorPeriodoSPC } from "./shared";

// Pareto de no conformidades por punto de control — cuenta cuántas veces
// cada punto (letra) salió NC entre todas las inspecciones ya guardadas de
// la planta elegida, ordenado de mayor a menor, con % acumulado (el 80/20
// clásico: unos pocos puntos concentran la mayoría de las no conformidades).
// En Planta 3 la misma letra significa algo distinto según el proceso —
// por eso ahí se agrupa por punto_control_id (no por letra) y se etiqueta
// con el proceso entre paréntesis para no mezclar cosas distintas.
const PLANTAS = [
  { value: "Materia Prima", label: "Materia Prima" },
  { value: "Planta 1", label: "Planta 1" },
  { value: "Planta 2", label: "Planta 2" },
  { value: "Planta 3", label: "Planta 3" },
  { value: "Producto Terminado", label: "Producto Terminado" },
];

function calcularPareto(registros, puntosCatalogo) {
  const counts = new Map();
  for (const r of registros) {
    const insp = r.calidad_inspecciones?.[0];
    if (!insp) continue;
    for (const pp of insp.calidad_inspeccion_puntos || []) {
      if (pp.valor === "NC") {
        counts.set(pp.punto_control_id, (counts.get(pp.punto_control_id) || 0) + 1);
      }
    }
  }
  const filas = Array.from(counts.entries()).map(([id, count]) => {
    const punto = puntosCatalogo.find((p) => p.id === id);
    return {
      id,
      letra: punto?.letra || "?",
      descripcion: punto?.descripcion || "Punto sin descripción",
      proceso: punto?.proceso || null,
      count,
    };
  });
  filas.sort((a, b) => b.count - a.count);
  const total = filas.reduce((s, f) => s + f.count, 0);
  let acumulado = 0;
  return filas.map((f) => {
    acumulado += f.count;
    return { ...f, pctAcumulado: total ? Math.round((acumulado / total) * 1000) / 10 : 0 };
  });
}

function ParetoTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0]?.payload;
  if (!fila) return null;
  return (
    <div className="rounded-lg border border-[#edf0f4] bg-white px-2.5 py-2 text-xs shadow-lg">
      <p className="font-bold text-[#0f1f3d]">{fila.letra}. {fila.descripcion}</p>
      {fila.proceso && <p className="text-[10px] text-[#94a3b8]">{fila.proceso}</p>}
      <p className="mt-1 text-[#5b6472]">{fila.count} no conformidad(es) · {fila.pctAcumulado}% acumulado</p>
    </div>
  );
}

export default function ParetoView() {
  const [planta, setPlanta] = useState("Materia Prima");
  const [rango, setRango] = useState(() => {
    const r = calcularPeriodo("mes", todayISO());
    return { desde: r.desde, hasta: r.hasta };
  });
  const { desde, hasta } = rango;
  const label = `${ddmmyyyy(desde)} – ${ddmmyyyy(hasta)}`;
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState([]);
  const [totalInspecciones, setTotalInspecciones] = useState(0);
  const [totalNC, setTotalNC] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      const [puntosResult, registrosResult] = await Promise.all([
        planta === "Planta 3" ? getPuntosControlPorProceso(planta) : getPuntosControl(planta),
        getInspeccionesUnica(planta, { desde, hasta }),
      ]);
      if (cancelado) return;
      const puntos = puntosResult.ok ? puntosResult.data : [];
      const registros = registrosResult.ok ? registrosResult.data : [];
      setFilas(calcularPareto(registros, puntos));
      setTotalInspecciones(registros.length);
      let nc = 0;
      for (const r of registros) {
        const insp = r.calidad_inspecciones?.[0];
        nc += (insp?.calidad_inspeccion_puntos || []).filter((p) => p.valor === "NC").length;
      }
      setTotalNC(nc);
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, [planta, desde, hasta]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PLANTAS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPlanta(p.value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              planta === p.value ? "border-[#c9a227] bg-[#fdf7e6] text-[#96771a]" : "border-[#edf0f4] bg-white text-[#5b6472]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <SelectorPeriodoSPC desde={desde} hasta={hasta} onChange={setRango} />

      {/* Si ya había una gráfica cargada, se queda visible (atenuada, con
          "Actualizando…") mientras llega la nueva — así al cambiar de planta
          o período la gráfica anterior NUNCA se desmonta de golpe, que era
          la causa real del parpadeo (un min-h por sí solo no lo evitaba: el
          árbol de recharts se destruía y volvía a montar en cada cambio).
          El bloque "Cargando" a pantalla completa solo aparece en la
          primerísima carga, cuando todavía no hay nada que mostrar. */}
      <div className="min-h-[320px]">
      {filas.length > 0 ? (
        <div className={`relative space-y-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-2">
              <p className="rounded-full border border-[#edf0f4] bg-white px-3 py-1 text-[11px] font-semibold text-[#5b6472] shadow-sm">Actualizando…</p>
            </div>
          )}
          <p className="text-xs text-[#5b6472]">
            {label} — {totalNC} no conformidad(es) en {totalInspecciones} inspección(es) — {filas.length} punto(s) distinto(s) con NC.
          </p>

          <div className={`${cardClass} p-3`}>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f4" vertical={false} />
                <XAxis dataKey="letra" tick={{ fontSize: 10, fill: "#5b6472" }} />
                <YAxis yAxisId="izq" tick={{ fontSize: 10, fill: "#5b6472" }} allowDecimals={false} width={24} />
                <YAxis yAxisId="der" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#5b6472" }} width={30} unit="%" />
                <Tooltip content={<ParetoTooltip />} />
                <ReferenceLine yAxisId="der" y={80} stroke="#94a3b8" strokeDasharray="4 4" />
                <Bar yAxisId="izq" dataKey="count" name="No conformidades" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                <Line yAxisId="der" type="monotone" dataKey="pctAcumulado" name="% acumulado" stroke="#c9a227" strokeWidth={2} dot={{ r: 3, fill: "#c9a227" }} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="mt-1 text-center text-[10px] text-[#94a3b8]">Barras rojas = no conformidades · Línea dorada = % acumulado · Línea punteada = 80%</p>
          </div>

          <div className="space-y-1.5">
            {filas.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg border border-[#edf0f4] bg-white px-2.5 py-1.5 text-xs">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f7f7f4] text-[10px] font-bold text-[#5b6472]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#0f1f3d]">
                    {f.letra}. {f.descripcion}{f.proceso ? ` (${f.proceso})` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-red-600">{f.count}</span>
                <span className="shrink-0 text-[10px] text-[#94a3b8]">{f.pctAcumulado}% ac.</span>
              </div>
            ))}
          </div>
        </div>
      ) : loading ? (
        <div className="flex h-[320px] items-center justify-center">
          <p className="text-sm font-medium text-[#94a3b8]">Cargando…</p>
        </div>
      ) : (
        <p className="rounded-xl bg-[#f7f7f4] px-3 py-6 text-center text-sm text-[#5b6472]">Sin no conformidades registradas en {planta} ({label}).</p>
      )}
      </div>
    </div>
  );
}
