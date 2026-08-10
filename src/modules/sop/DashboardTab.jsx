import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { buildHorizonte, formatMoney, formatNumber, LINEAS } from "./sopHelpers";

function KpiCard({ label, value, sub, tone = "slate" }) {
  const toneClass = {
    slate: "border-slate-200 bg-white",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] font-bold text-slate-500">{sub}</p>}
    </div>
  );
}

export default function DashboardTab({ productos, planVenta, control, parametros }) {
  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);
  const escenarioActivo = parametros?.escenario_venta || "Base";

  const precioPorProducto = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  function sumEscenario(escenario) {
    let piezas = 0;
    let monto = 0;
    const porLinea = Object.fromEntries(LINEAS.map((l) => [l, { piezas: 0, monto: 0 }]));
    const porMes = horizonte.map((m) => ({ ...m, piezas: 0, monto: 0 }));
    for (const row of planVenta) {
      if (row.escenario !== escenario) continue;
      const producto = precioPorProducto.get(row.producto_id);
      if (!producto) continue;
      const monthIndex = horizonte.findIndex((m) => m.anio === row.anio && m.mes === row.mes);
      if (monthIndex === -1) continue;
      const rowMonto = Number(row.piezas || 0) * Number(producto.precio || 0);
      piezas += Number(row.piezas || 0);
      monto += rowMonto;
      porLinea[producto.linea].piezas += Number(row.piezas || 0);
      porLinea[producto.linea].monto += rowMonto;
      porMes[monthIndex].piezas += Number(row.piezas || 0);
      porMes[monthIndex].monto += rowMonto;
    }
    return { piezas, monto, porLinea, porMes };
  }

  const base = useMemo(() => sumEscenario("Base"), [planVenta, horizonte, precioPorProducto]);
  const objetivo = useMemo(() => sumEscenario("Objetivo"), [planVenta, horizonte, precioPorProducto]);
  const activo = escenarioActivo === "Objetivo" ? objetivo : base;

  const margenBrutoPct = useMemo(() => {
    if (!parametros || activo.monto === 0) return 0;
    const margenSalas = Number(parametros.margen_bruto_salas || 0) * activo.porLinea.Salas.monto;
    const margenBases = Number(parametros.margen_bruto_bases || 0) * activo.porLinea.Bases.monto;
    const margenRecamaras = Number(parametros.margen_bruto_recamaras || 0) * activo.porLinea["Recámaras"].monto;
    return (margenSalas + margenBases + margenRecamaras) / activo.monto;
  }, [parametros, activo]);

  const margenBrutoMonto = activo.monto * margenBrutoPct;
  const gastosFijosTotal = Number(parametros?.gastos_fijos_mensuales || 0) * horizonte.length;
  const utilidadOperativa = margenBrutoMonto - gastosFijosTotal;
  const utilidadOperativaPct = activo.monto > 0 ? utilidadOperativa / activo.monto : 0;

  const chartData = horizonte.map((m, i) => ({
    mes: m.label,
    Base: base.porMes[i]?.monto || 0,
    Objetivo: objetivo.porMes[i]?.monto || 0,
  }));

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold text-sky-700">
        Escenario activo (definido en Parámetros): <b>{escenarioActivo}</b> — horizonte {control?.mes_activo ? `${horizonte[0]?.label} a ${horizonte[horizonte.length - 1]?.label}` : "sin definir"}.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`Venta plan (${escenarioActivo})`} value={formatMoney(activo.monto)} sub={`${formatNumber(activo.piezas)} piezas`} tone="slate" />
        <KpiCard label="Gap Objetivo vs Base" value={formatMoney(objetivo.monto - base.monto)} sub={`${formatNumber(objetivo.piezas - base.piezas)} piezas`} tone="amber" />
        <KpiCard label="Margen bruto estimado" value={formatMoney(margenBrutoMonto)} sub={`${(margenBrutoPct * 100).toFixed(1)}% sobre venta`} tone="emerald" />
        <KpiCard
          label="Utilidad operativa estimada"
          value={formatMoney(utilidadOperativa)}
          sub={`${(utilidadOperativaPct * 100).toFixed(1)}% — gastos fijos ${formatMoney(gastosFijosTotal)}`}
          tone={utilidadOperativa >= 0 ? "emerald" : "red"}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Venta mensual — Base vs Objetivo</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#898781" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} width={40} />
            <Tooltip formatter={(v) => formatMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="Base" fill="#c3c2b7" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Objetivo" fill="#0B5ED7" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desglose por línea ({escenarioActivo})</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {LINEAS.map((linea) => (
            <div key={linea} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{linea}</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formatMoney(activo.porLinea[linea]?.monto)}</p>
              <p className="text-[10px] font-bold text-slate-500">{formatNumber(activo.porLinea[linea]?.piezas)} piezas</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
