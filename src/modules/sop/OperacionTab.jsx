import { useMemo } from "react";
import { buildHorizonte, formatNumber, LINEAS } from "./sopHelpers";

function getEstado(utilizacion) {
  if (utilizacion > 1) return { label: "Saturado", tone: "border-red-200 bg-red-50 text-red-700", bar: "bg-red-500" };
  if (utilizacion >= 0.8) return { label: "Atención", tone: "border-amber-200 bg-amber-50 text-amber-700", bar: "bg-amber-400" };
  return { label: "OK", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" };
}

export default function OperacionTab({ productos, planVenta, control, parametros }) {
  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);
  const escenarioActivo = parametros?.escenario_venta || "Base";

  const productoLinea = useMemo(() => new Map(productos.map((p) => [p.id, p.linea])), [productos]);

  const factores = {
    Bases: Number(parametros?.factor_consumo_bases ?? 1),
    "Recámaras": Number(parametros?.factor_consumo_recamaras ?? 0),
    Salas: Number(parametros?.factor_consumo_salas ?? 1),
  };

  const capacidadDisponible =
    parametros?.escenario_capacidad === "2 turnos" && parametros?.capacidad_tapiceria_2_turnos
      ? Number(parametros.capacidad_tapiceria_2_turnos)
      : Number(parametros?.capacidad_tapiceria_1_turno || 0);

  const demandaPorMes = useMemo(() => {
    return horizonte.map((m) => {
      const porLinea = Object.fromEntries(LINEAS.map((l) => [l, 0]));
      for (const row of planVenta) {
        if (row.escenario !== escenarioActivo || row.anio !== m.anio || row.mes !== m.mes) continue;
        const linea = productoLinea.get(row.producto_id);
        if (!linea) continue;
        porLinea[linea] += Number(row.piezas || 0);
      }
      const totalPiezas = LINEAS.reduce((s, l) => s + porLinea[l], 0);
      const carga = LINEAS.reduce((s, l) => s + porLinea[l] * factores[l], 0);
      const utilizacion = capacidadDisponible > 0 ? carga / capacidadDisponible : 0;
      const gap = capacidadDisponible - carga;
      return { ...m, porLinea, totalPiezas, carga, utilizacion, gap };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonte, planVenta, escenarioActivo, productoLinea, factores.Bases, factores["Recámaras"], factores.Salas, capacidadDisponible]);

  const promedioUtilizacion = demandaPorMes.length
    ? demandaPorMes.reduce((s, m) => s + m.utilizacion, 0) / demandaPorMes.length
    : 0;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold text-sky-700">
        Escenario de venta activo: <b>{escenarioActivo}</b> · Capacidad disponible: <b>{formatNumber(capacidadDisponible)} pzas/mes</b> ({parametros?.escenario_capacidad}) · Factores de consumo y capacidad se editan en Parámetros.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Concepto</th>
              {horizonte.map((m) => (
                <th key={`${m.anio}-${m.mes}`} className="px-2 py-2 text-right">{m.label}</th>
              ))}
              <th className="px-2 py-2 text-right">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {LINEAS.map((linea) => (
              <tr key={linea} className="border-b border-slate-50">
                <td className="px-3 py-1.5 font-bold text-slate-700">{linea} <span className="text-[9px] text-slate-400">(factor {factores[linea]})</span></td>
                {demandaPorMes.map((m, i) => (
                  <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatNumber(m.porLinea[linea])}</td>
                ))}
                <td className="px-2 py-1.5 text-right font-bold text-slate-700">
                  {formatNumber(demandaPorMes.reduce((s, m) => s + m.porLinea[linea], 0) / (demandaPorMes.length || 1))}
                </td>
              </tr>
            ))}
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Total piezas demandadas</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className="px-2 py-1.5 text-right font-black text-slate-700">{formatNumber(m.totalPiezas)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-700">
                {formatNumber(demandaPorMes.reduce((s, m) => s + m.totalPiezas, 0) / (demandaPorMes.length || 1))}
              </td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Carga de tapicería (pzas equiv.)</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatNumber(m.carga)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-bold text-slate-700">
                {formatNumber(demandaPorMes.reduce((s, m) => s + m.carga, 0) / (demandaPorMes.length || 1))}
              </td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Capacidad disponible</td>
              {demandaPorMes.map((_, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">{formatNumber(capacidadDisponible)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-bold text-slate-700">{formatNumber(capacidadDisponible)}</td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Gap (piezas)</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className={`px-2 py-1.5 text-right font-bold ${m.gap < 0 ? "text-red-600" : "text-slate-600"}`}>{formatNumber(m.gap)}</td>
              ))}
              <td className="px-2 py-1.5 text-right font-bold text-slate-700">
                {formatNumber(demandaPorMes.reduce((s, m) => s + m.gap, 0) / (demandaPorMes.length || 1))}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">% Utilización</td>
              {demandaPorMes.map((m, i) => (
                <td key={i} className="px-2 py-1.5 text-right font-black text-slate-700">{(m.utilizacion * 100).toFixed(1)}%</td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-700">{(promedioUtilizacion * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500">Estado</td>
              {demandaPorMes.map((m, i) => {
                const estado = getEstado(m.utilizacion);
                return (
                  <td key={i} className="px-2 py-1.5 text-right">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${estado.tone}`}>{estado.label}</span>
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {demandaPorMes.map((m, i) => {
          const estado = getEstado(m.utilizacion);
          return (
            <div key={i} className={`rounded-xl border p-3 ${estado.tone}`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest">{m.label}</p>
                <span className="text-[9px] font-black uppercase">{estado.label}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/60">
                <div className={`h-full rounded-full ${estado.bar}`} style={{ width: `${Math.min(m.utilizacion * 100, 140)}%` }} />
              </div>
              <p className="mt-1 text-[9px] font-bold">{formatNumber(m.carga)} / {formatNumber(capacidadDisponible)} pzas ({(m.utilizacion * 100).toFixed(0)}%)</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
