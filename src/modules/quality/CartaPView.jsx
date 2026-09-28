import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { getInspeccionesUnica } from "../../services/calidadService";
import { cardClass } from "./coreliTheme";
import { calcularPeriodo, todayISO, SelectorPeriodoSPC } from "./shared";

// Carta de control p — complemento del Pareto: mientras el Pareto dice DONDE
// se concentran las no conformidades, esta dice CUANDO el proceso se sale de
// control. Cada día es un subgrupo: n = puntos evaluados ese día (sin contar
// "NA"), NC = cuántos de esos puntos salieron mal, p = NC/n. p̄ es el
// promedio de todos los días visibles, y UCL/LCL son sus límites a ±3
// sigma — como n cambia día a día (más o menos inspecciones), los límites
// también se recalculan por día en vez de ser una sola línea recta.
const PLANTAS = [
  { value: "Materia Prima", label: "Materia Prima" },
  { value: "Planta 1", label: "Planta 1" },
  { value: "Planta 2", label: "Planta 2" },
  { value: "Planta 3", label: "Planta 3" },
  { value: "Producto Terminado", label: "Producto Terminado" },
];

function fechaCorta(fecha) {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

function calcularCartaP(registros) {
  const porDia = new Map();
  for (const r of registros) {
    const insp = r.calidad_inspecciones?.[0];
    if (!insp) continue;
    const puntos = (insp.calidad_inspeccion_puntos || []).filter((p) => p.valor !== "NA");
    if (!puntos.length) continue;
    if (!porDia.has(r.fecha)) porDia.set(r.fecha, { n: 0, nc: 0 });
    const d = porDia.get(r.fecha);
    d.n += puntos.length;
    d.nc += puntos.filter((p) => p.valor === "NC").length;
  }
  const dias = Array.from(porDia.entries())
    .map(([fecha, { n, nc }]) => ({ fecha, n, nc, p: n ? nc / n : 0 }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const totalN = dias.reduce((s, d) => s + d.n, 0);
  const totalNC = dias.reduce((s, d) => s + d.nc, 0);
  const pBarra = totalN ? totalNC / totalN : 0;

  const puntos = dias.map((d) => {
    const sigma = d.n ? Math.sqrt((pBarra * (1 - pBarra)) / d.n) : 0;
    const ucl = Math.min(1, pBarra + 3 * sigma);
    const lcl = Math.max(0, pBarra - 3 * sigma);
    return {
      ...d,
      label: fechaCorta(d.fecha),
      pPct: Math.round(d.p * 1000) / 10,
      uclPct: Math.round(ucl * 1000) / 10,
      lclPct: Math.round(lcl * 1000) / 10,
      fueraControl: d.p > ucl || d.p < lcl,
    };
  });

  return { puntos, pBarra, totalN, totalNC, totalDias: dias.length };
}

function CartaPTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0]?.payload;
  if (!fila) return null;
  return (
    <div className="rounded-lg border border-[#edf0f4] bg-white px-2.5 py-2 text-xs shadow-lg">
      <p className="font-bold text-[#0f1f3d]">{fila.label}</p>
      <p className="mt-1 text-[#5b6472]">
        {fila.nc} NC de {fila.n} puntos · <span className="font-semibold">{fila.pPct}%</span>
      </p>
      <p className="text-[10px] text-[#94a3b8]">Límites del día: {fila.lclPct}% – {fila.uclPct}%</p>
      {fila.fueraControl && <p className="mt-1 font-semibold text-red-600">Fuera de control</p>}
    </div>
  );
}

export default function CartaPView() {
  const [planta, setPlanta] = useState("Materia Prima");
  const [periodo, setPeriodo] = useState("mes");
  const [fechaRef, setFechaRef] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [datos, setDatos] = useState({ puntos: [], pBarra: 0, totalN: 0, totalNC: 0, totalDias: 0 });

  const { desde, hasta, label } = calcularPeriodo(periodo, fechaRef);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      const result = await getInspeccionesUnica(planta, { desde, hasta });
      if (cancelado) return;
      const registros = result.ok ? result.data : [];
      setDatos(calcularCartaP(registros));
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, [planta, desde, hasta]);

  const fueraDeControl = datos.puntos.filter((p) => p.fueraControl);
  const pBarraPct = Math.round(datos.pBarra * 1000) / 10;

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

      <SelectorPeriodoSPC periodo={periodo} setPeriodo={setPeriodo} fechaRef={fechaRef} setFechaRef={setFechaRef} />

      {/* min-h fijo para que al cambiar de planta/período no "parpadee" la
          pantalla — sin esto, el mensaje de Cargando (una línea) colapsaba
          el layout y luego saltaba de golpe al alto real de la gráfica. */}
      <div className="min-h-[320px]">
      {loading ? (
        <div className="flex h-[320px] items-center justify-center">
          <p className="text-sm font-medium text-[#94a3b8]">Cargando…</p>
        </div>
      ) : datos.puntos.length === 0 ? (
        <p className="rounded-xl bg-[#f7f7f4] px-3 py-6 text-center text-sm text-[#5b6472]">Sin inspecciones registradas en {planta} ({label}).</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#5b6472]">
            {label} — {datos.totalDias} día(s) con inspección · {datos.totalN} puntos evaluados · <span className="font-semibold">p̄ = {pBarraPct}%</span> de NC en promedio.
          </p>

          <div className={`${cardClass} p-3`}>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={datos.puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5b6472" }} />
                <YAxis tick={{ fontSize: 10, fill: "#5b6472" }} width={30} unit="%" allowDecimals={false} />
                <Tooltip content={<CartaPTooltip />} />
                <ReferenceLine y={pBarraPct} stroke="#c9a227" strokeDasharray="4 4" label={{ value: "p̄", position: "right", fontSize: 10, fill: "#96771a" }} />
                <Line type="monotone" dataKey="uclPct" name="UCL" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="lclPct" name="LCL" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                <Line
                  type="monotone"
                  dataKey="pPct"
                  name="% NC del día"
                  stroke="#6b1e2f"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload, index } = props;
                    return (
                      <circle key={`dot-${index}`} cx={cx} cy={cy} r={payload.fueraControl ? 4.5 : 3} fill={payload.fueraControl ? "#b91c1c" : "#6b1e2f"} stroke="#fff" strokeWidth={1} />
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="mt-1 text-center text-[10px] text-[#94a3b8]">Línea vino = % NC por día · Líneas grises = límites de control (UCL/LCL) · Dorada = promedio (p̄) · Punto rojo = fuera de control</p>
          </div>

          {fueraDeControl.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Días fuera de control</p>
              {fueraDeControl.map((f) => (
                <div key={f.fecha} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-100 text-[10px] font-bold text-red-700">!</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#0f1f3d]">{f.label} — {f.pPct}% de NC</p>
                    <p className="text-[10px] text-[#94a3b8]">Límite esperado ese día: {f.lclPct}% – {f.uclPct}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-[#f7f7f4] px-3 py-2.5 text-center text-xs text-[#5b6472]">Proceso bajo control: ningún día se sale de sus límites.</p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
