import { useMemo } from "react";
import { buildHorizonte, formatMoney, formatNumber, LINEAS } from "./sopHelpers";

export default function FinancieroTab({ productos, planVenta, control, parametros }) {
  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);
  const escenarioActivo = parametros?.escenario_venta || "Base";

  const productoMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const margenPorLinea = {
    Bases: Number(parametros?.margen_bruto_bases ?? 0),
    "Recámaras": Number(parametros?.margen_bruto_recamaras ?? 0),
    Salas: Number(parametros?.margen_bruto_salas ?? 0),
  };
  const gastosFijosMensuales = Number(parametros?.gastos_fijos_mensuales || 0);

  const filas = useMemo(() => {
    return horizonte.map((m) => {
      const ventaPorLinea = Object.fromEntries(LINEAS.map((l) => [l, 0]));
      for (const row of planVenta) {
        if (row.escenario !== escenarioActivo || row.anio !== m.anio || row.mes !== m.mes) continue;
        const producto = productoMap.get(row.producto_id);
        if (!producto) continue;
        ventaPorLinea[producto.linea] += Number(row.piezas || 0) * Number(producto.precio || 0);
      }
      const ventasNetas = LINEAS.reduce((s, l) => s + ventaPorLinea[l], 0);
      const margenBruto = LINEAS.reduce((s, l) => s + ventaPorLinea[l] * margenPorLinea[l], 0);
      const margenBrutoPct = ventasNetas > 0 ? margenBruto / ventasNetas : 0;
      const utilidadOperativa = margenBruto - gastosFijosMensuales;
      const margenOperativoPct = ventasNetas > 0 ? utilidadOperativa / ventasNetas : 0;
      return { ...m, ventasNetas, margenBruto, margenBrutoPct, gastosFijos: gastosFijosMensuales, utilidadOperativa, margenOperativoPct };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonte, planVenta, escenarioActivo, productoMap, margenPorLinea.Bases, margenPorLinea["Recámaras"], margenPorLinea.Salas, gastosFijosMensuales]);

  const totales = filas.reduce(
    (acc, f) => ({
      ventasNetas: acc.ventasNetas + f.ventasNetas,
      margenBruto: acc.margenBruto + f.margenBruto,
      gastosFijos: acc.gastosFijos + f.gastosFijos,
      utilidadOperativa: acc.utilidadOperativa + f.utilidadOperativa,
    }),
    { ventasNetas: 0, margenBruto: 0, gastosFijos: 0, utilidadOperativa: 0 }
  );
  const totalMargenBrutoPct = totales.ventasNetas > 0 ? totales.margenBruto / totales.ventasNetas : 0;
  const totalMargenOperativoPct = totales.ventasNetas > 0 ? totales.utilidadOperativa / totales.ventasNetas : 0;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold text-sky-700">
        Escenario de venta activo: <b>{escenarioActivo}</b> · Márgenes por línea y gastos fijos se editan en Parámetros. El margen bruto aquí se pondera por la mezcla real de venta de cada mes (Salas/Bases/Recámaras), no un porcentaje fijo.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Concepto</th>
              {horizonte.map((m) => (
                <th key={`${m.anio}-${m.mes}`} className="px-2 py-2 text-right">{m.label}</th>
              ))}
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Ventas netas totales</td>
              {filas.map((f, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatMoney(f.ventasNetas)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-800">{formatMoney(totales.ventasNetas)}</td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Margen bruto %</td>
              {filas.map((f, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">{(f.margenBrutoPct * 100).toFixed(1)}%</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-800">{(totalMargenBrutoPct * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Margen bruto ($)</td>
              {filas.map((f, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatMoney(f.margenBruto)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-800">{formatMoney(totales.margenBruto)}</td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Gastos fijos</td>
              {filas.map((f, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatMoney(f.gastosFijos)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-800">{formatMoney(totales.gastosFijos)}</td>
            </tr>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Utilidad operativa</td>
              {filas.map((f, i) => (
                <td key={i} className={`px-2 py-1.5 text-right font-black ${f.utilidadOperativa < 0 ? "text-red-600" : "text-slate-700"}`}>{formatMoney(f.utilidadOperativa)}</td>
              ))}
              <td className={`px-2 py-1.5 text-right font-black ${totales.utilidadOperativa < 0 ? "text-red-600" : "text-slate-800"}`}>{formatMoney(totales.utilidadOperativa)}</td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Margen operativo %</td>
              {filas.map((f, i) => (
                <td key={i} className="px-2 py-1.5 text-right font-black text-slate-700">{(f.margenOperativoPct * 100).toFixed(1)}%</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-800">{(totalMargenOperativoPct * 100).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ventas del horizonte</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatMoney(totales.ventasNetas)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Margen bruto del horizonte</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatMoney(totales.margenBruto)}</p>
        </div>
        <div className={`rounded-xl border p-3 ${totales.utilidadOperativa >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Utilidad operativa del horizonte</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatMoney(totales.utilidadOperativa)}</p>
        </div>
      </div>
    </div>
  );
}
