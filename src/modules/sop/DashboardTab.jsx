import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { buildHorizonte, formatMoney, formatNumber, LINEAS, MES_NOMBRE } from "./sopHelpers";

// Captura de venta real (solo el importe total del mes, sin desglose por
// SKU) — clic para editar, igual que las celdas de Plan de venta.
function EditableMonto({ value, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  if (!canEdit) {
    return <span className="block text-right text-[11px] font-black text-slate-700">{value ? formatMoney(value) : "—"}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value ?? ""));
          setEditing(true);
        }}
        className="block w-full rounded px-1 text-right text-[11px] font-black text-slate-700 transition hover:bg-sky-50"
      >
        {value ? formatMoney(value) : "Capturar"}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = Number(draft);
        if (Number.isFinite(n) && n !== Number(value ?? 0)) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-8 w-full rounded border border-sky-300 bg-white px-2 text-right text-[11px] font-black text-slate-800 outline-none"
    />
  );
}

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

export default function DashboardTab({ productos, planVenta, control, parametros, ventaReal = [], historico = [], canEdit = false, onSaveVentaReal }) {
  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);
  const escenarioActivo = parametros?.escenario_venta || "Base";

  const ventaRealPorMes = useMemo(() => {
    const map = new Map();
    for (const row of ventaReal) map.set(`${row.anio}_${row.mes}`, Number(row.monto || 0));
    return map;
  }, [ventaReal]);

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

  // Meses ya cerrados (fuera del horizonte rodante vigente) — se toman de
  // Histórico S&OP para que la gráfica muestre la tendencia completa, no
  // solo los 6 meses que caben en el horizonte activo.
  const historicoChartData = useMemo(() => {
    const horizonteKeys = new Set(horizonte.map((m) => `${m.anio}-${m.mes}`));
    return historico
      .filter((h) => h.mes && !horizonteKeys.has(`${Number(h.mes.slice(0, 4))}-${Number(h.mes.slice(5, 7))}`))
      .map((h) => {
        const anio = Number(h.mes.slice(0, 4));
        const mes = Number(h.mes.slice(5, 7));
        return {
          mes: `${MES_NOMBRE[mes]}-${String(anio).slice(2)}`,
          Plan: Number(h.venta_planeada || 0),
          Real: Number(h.venta_real || 0),
        };
      });
  }, [historico, horizonte]);

  const chartData = [
    ...historicoChartData,
    ...horizonte.map((m, i) => ({
      mes: m.label,
      Plan: activo.porMes[i]?.monto || 0,
      Real: ventaRealPorMes.get(`${m.anio}_${m.mes}`) || 0,
    })),
  ];

  const ventaRealTotal = horizonte.reduce((sum, m) => sum + (ventaRealPorMes.get(`${m.anio}_${m.mes}`) || 0), 0);
  const mesesConReal = horizonte.filter((m) => ventaRealPorMes.has(`${m.anio}_${m.mes}`)).length;
  const planParaMesesConReal = horizonte.reduce(
    (sum, m, i) => (ventaRealPorMes.has(`${m.anio}_${m.mes}`) ? sum + (activo.porMes[i]?.monto || 0) : sum),
    0
  );
  const gapPlanVsReal = ventaRealTotal - planParaMesesConReal;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold text-sky-700">
        Escenario activo (definido en Parámetros): <b>{escenarioActivo}</b> — horizonte {control?.mes_activo ? `${horizonte[0]?.label} a ${horizonte[horizonte.length - 1]?.label}` : "sin definir"}.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`Venta plan (${escenarioActivo})`} value={formatMoney(activo.monto)} sub={`${formatNumber(activo.piezas)} piezas`} tone="slate" />
        <KpiCard
          label="Venta real capturada"
          value={formatMoney(ventaRealTotal)}
          sub={mesesConReal > 0 ? `Gap vs plan: ${formatMoney(gapPlanVsReal)} (${mesesConReal}/${horizonte.length} meses)` : "Sin captura todavía"}
          tone={mesesConReal === 0 ? "slate" : gapPlanVsReal >= 0 ? "emerald" : "red"}
        />
        <KpiCard label="Margen bruto estimado" value={formatMoney(margenBrutoMonto)} sub={`${(margenBrutoPct * 100).toFixed(1)}% sobre venta`} tone="emerald" />
        <KpiCard
          label="Utilidad operativa estimada"
          value={formatMoney(utilidadOperativa)}
          sub={`${(utilidadOperativaPct * 100).toFixed(1)}% — gastos fijos ${formatMoney(gastosFijosTotal)}`}
          tone={utilidadOperativa >= 0 ? "emerald" : "red"}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Venta mensual — Plan ({escenarioActivo}) vs Real</p>
          <p className="text-[9px] font-bold text-slate-400">Gap Objetivo vs Base (referencia): {formatMoney(objetivo.monto - base.monto)}</p>
        </div>
        {historicoChartData.length > 0 && (
          <p className="mt-0.5 text-[9px] font-bold normal-case text-slate-400">
            Incluye {historicoChartData.length} mes(es) cerrado(s) de Histórico S&amp;OP antes del horizonte vigente.
          </p>
        )}
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#898781" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} width={40} />
            <Tooltip formatter={(v) => formatMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="Plan" fill="#c3c2b7" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Real" fill="#0B5ED7" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Captura de venta real (importe total del mes)</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {horizonte.map((m) => (
              <div key={`${m.anio}-${m.mes}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{m.label}</p>
                <EditableMonto
                  value={ventaRealPorMes.get(`${m.anio}_${m.mes}`)}
                  canEdit={canEdit}
                  onSave={(n) => onSaveVentaReal(m.anio, m.mes, n)}
                />
              </div>
            ))}
          </div>
        </div>
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
