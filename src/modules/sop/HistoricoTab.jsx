import { useMemo, useState } from "react";
import { buildHorizonte, formatMoney, formatNumber, LINEAS } from "./sopHelpers";

// Resume el mes activo (primer mes del horizonte) con lo mismo que ya
// calculan Plan de operación y Plan financiero, para poder archivarlo al
// cerrar el mes sin tener que volver a capturar nada.
function resumirMesActivo(productos, planVenta, control, parametros) {
  const horizonte = buildHorizonte(control?.mes_activo, 1);
  const mesActivo = horizonte[0];
  if (!mesActivo) return null;

  const escenario = parametros?.escenario_venta || "Base";
  const productoMap = new Map(productos.map((p) => [p.id, p]));
  const margenPorLinea = {
    Bases: Number(parametros?.margen_bruto_bases ?? 0),
    "Recámaras": Number(parametros?.margen_bruto_recamaras ?? 0),
    Salas: Number(parametros?.margen_bruto_salas ?? 0),
  };

  const piezasPorLinea = Object.fromEntries(LINEAS.map((l) => [l, 0]));
  const ventaPorLinea = Object.fromEntries(LINEAS.map((l) => [l, 0]));
  for (const row of planVenta) {
    if (row.escenario !== escenario || row.anio !== mesActivo.anio || row.mes !== mesActivo.mes) continue;
    const producto = productoMap.get(row.producto_id);
    if (!producto) continue;
    piezasPorLinea[producto.linea] += Number(row.piezas || 0);
    ventaPorLinea[producto.linea] += Number(row.piezas || 0) * Number(producto.precio || 0);
  }
  const ventaPlaneada = LINEAS.reduce((s, l) => s + ventaPorLinea[l], 0);
  const produccionPiezas = LINEAS.reduce((s, l) => s + piezasPorLinea[l], 0);
  const capacidadPiezas =
    parametros?.escenario_capacidad === "2 turnos" && parametros?.capacidad_tapiceria_2_turnos
      ? Number(parametros.capacidad_tapiceria_2_turnos)
      : Number(parametros?.capacidad_tapiceria_1_turno || 0);
  const utilizacion = capacidadPiezas > 0 ? produccionPiezas / capacidadPiezas : 0;
  const margenBruto = LINEAS.reduce((s, l) => s + ventaPorLinea[l] * margenPorLinea[l], 0);
  const margenBrutoPct = ventaPlaneada > 0 ? margenBruto / ventaPlaneada : 0;
  const utilidadOperativa = margenBruto - Number(parametros?.gastos_fijos_mensuales || 0);

  return {
    mes: `${mesActivo.anio}-${String(mesActivo.mes).padStart(2, "0")}-01`,
    label: mesActivo.label,
    escenario,
    ventaPlaneada,
    produccionPiezas,
    capacidadPiezas,
    utilizacion,
    margenBrutoPct,
    utilidadOperativa,
  };
}

export default function HistoricoTab({ historico, productos, planVenta, control, parametros, canEdit, onCloseMonth, currentUser }) {
  const [showClose, setShowClose] = useState(false);
  const [ventaReal, setVentaReal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resumen = useMemo(() => resumirMesActivo(productos, planVenta, control, parametros), [productos, planVenta, control, parametros]);

  async function handleConfirmClose() {
    const n = Number(ventaReal);
    if (!Number.isFinite(n) || n < 0) {
      setError("Captura la venta real del mes (número válido).");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onCloseMonth({ control, resumenMes: resumen, ventaReal: n, actor: currentUser });
    setSaving(false);
    if (ok) {
      setShowClose(false);
      setVentaReal("");
    }
  }

  return (
    <div className="space-y-3 p-3">
      {resumen && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Cierre del mes activo — {resumen.label}</p>
              <p className="mt-1 text-[10px] font-bold text-amber-700">
                Venta planeada: <b>{formatMoney(resumen.ventaPlaneada)}</b> · Producción: <b>{formatNumber(resumen.produccionPiezas)} pzas</b> ({(resumen.utilizacion * 100).toFixed(0)}% de capacidad)
              </p>
            </div>
            {canEdit && (
              <button type="button" onClick={() => setShowClose(true)} className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white">
                Cerrar mes activo
              </button>
            )}
          </div>

          {showClose && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-amber-200 pt-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                Venta real del mes
                <input type="number" min="0" value={ventaReal} onChange={(e) => setVentaReal(e.target.value)} className="mt-1 h-10 w-48 rounded-xl border border-amber-200 bg-white px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
              </label>
              <button type="button" disabled={saving} onClick={handleConfirmClose} className="rounded-lg bg-[#001225] px-4 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {saving ? "Cerrando..." : "Confirmar cierre"}
              </button>
              <button type="button" onClick={() => setShowClose(false)} className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-[10px] font-black text-amber-700">Cancelar</button>
              {error && <p className="w-full text-[10px] font-bold text-red-600">{error}</p>}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="px-3 py-2 text-white">Mes</th>
              <th className="px-2 py-2 text-right">Venta planeada</th>
              <th className="px-2 py-2 text-right">Venta real</th>
              <th className="px-2 py-2 text-right">Diferencia</th>
              <th className="px-2 py-2 text-right">Producción</th>
              <th className="px-2 py-2 text-right">Capacidad</th>
              <th className="px-2 py-2 text-right">Utilización</th>
              <th className="px-2 py-2 text-right">Margen bruto %</th>
              <th className="px-2 py-2 text-right">Utilidad operativa</th>
              <th className="px-2 py-2 text-right">% Efectividad</th>
              <th className="px-2 py-2">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {historico.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay meses cerrados.</td></tr>
            )}
            {historico.map((h) => {
              const efectividad = Number(h.venta_planeada) > 0 ? (Number(h.venta_real) / Number(h.venta_planeada)) * 100 : null;
              return (
                <tr key={h.id} className="border-b border-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-700">{h.mes?.slice(0, 7)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{formatMoney(h.venta_planeada)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{formatMoney(h.venta_real)}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${Number(h.diferencia) < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(h.diferencia)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{formatNumber(h.produccion_piezas)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{formatNumber(h.capacidad_piezas)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{(Number(h.utilizacion) * 100).toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{(Number(h.margen_bruto_pct) * 100).toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{formatMoney(h.utilidad_operativa)}</td>
                  <td className={`px-2 py-1.5 text-right font-black ${efectividad === null ? "text-slate-400" : efectividad >= 100 ? "text-emerald-600" : efectividad >= 80 ? "text-amber-600" : "text-red-600"}`}>
                    {efectividad === null ? "—" : `${efectividad.toFixed(1)}%`}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">{h.responsable || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
