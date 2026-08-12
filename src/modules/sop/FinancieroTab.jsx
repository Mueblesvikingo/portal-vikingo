import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { buildHorizonte, formatMoney, LINEAS } from "./sopHelpers";
import SolicitudModal from "./SolicitudModal";

// Numero clicable -> input, mismo patron que EditableNum de OperacionTab.jsx.
function EditableMonto({ value, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));

  if (!canEdit) return <span className="text-slate-600">{formatMoney(value || 0)}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value ?? 0));
          setEditing(true);
        }}
        className="rounded px-1 text-slate-600 transition hover:bg-sky-50"
      >
        {formatMoney(value || 0)}
      </button>
    );
  }

  function commit() {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n) && n !== Number(value ?? 0)) onSave(n);
  }

  return (
    <input
      autoFocus
      type="number"
      step="1"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-7 w-24 rounded border border-sky-300 bg-white px-1 text-right text-[10px] font-bold text-slate-800 outline-none"
    />
  );
}

// Celda de una fila calculada (Ventas/Margen/Gastos fijos): editable como
// ajuste manual. Si esta ajustada se marca con un punto ambar clicable que
// la restablece al valor real de Plan de venta/Parametros.
function CeldaAjustable({ value, ajustada, canEdit, onSave, onReset }) {
  return (
    <span className="inline-flex items-center gap-1">
      <EditableMonto value={value} canEdit={canEdit} onSave={onSave} />
      {ajustada && (
        <button
          type="button"
          onClick={onReset}
          title="Ajustado manualmente — clic para restablecer el valor de Plan de venta/Parámetros"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 hover:bg-amber-600"
        />
      )}
    </span>
  );
}

export default function FinancieroTab({
  productos,
  planVenta,
  control,
  parametros,
  financieroFilas = [],
  financieroMontos = [],
  financieroAjustes = [],
  canEdit = false,
  currentUser,
  onCreateFila,
  onUpdateFila,
  onDeactivateFila,
  onUpsertMonto,
  onUpsertAjuste,
  onDeleteAjuste,
  onSolicitarFinanciero,
}) {
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [nuevaFila, setNuevaFila] = useState({ concepto: "", categoria: "Gasto" });
  const [saving, setSaving] = useState(false);

  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);
  const escenarioActivo = parametros?.escenario_venta || "Base";

  const productoMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const margenPorLinea = {
    Bases: Number(parametros?.margen_bruto_bases ?? 0),
    "Recámaras": Number(parametros?.margen_bruto_recamaras ?? 0),
    Salas: Number(parametros?.margen_bruto_salas ?? 0),
  };
  const gastosFijosMensuales = Number(parametros?.gastos_fijos_mensuales || 0);

  const filasBase = useMemo(() => {
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
      return { ...m, ventasNetas, margenBruto, gastosFijos: gastosFijosMensuales };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonte, planVenta, escenarioActivo, productoMap, margenPorLinea.Bases, margenPorLinea["Recámaras"], margenPorLinea.Salas, gastosFijosMensuales]);

  // Ajustes manuales (Ventas/Margen/Gastos fijos) sobreescriben el valor
  // calculado de Plan de venta/Parametros SOLO en esta pestana — Dashboard y
  // Plan de operacion siguen mostrando el valor real de Plan de venta, por
  // eso cada celda ajustada se marca visualmente y se puede restablecer.
  function ajusteDe(anio, mes, concepto) {
    return financieroAjustes.find((a) => a.anio === anio && a.mes === mes && a.concepto === concepto);
  }

  const filas = useMemo(() => {
    return filasBase.map((f) => {
      const ajVenta = ajusteDe(f.anio, f.mes, "ventas_netas");
      const ajMargen = ajusteDe(f.anio, f.mes, "margen_bruto");
      const ajGastos = ajusteDe(f.anio, f.mes, "gastos_fijos");
      const ventasNetas = ajVenta ? Number(ajVenta.monto) : f.ventasNetas;
      const margenBruto = ajMargen ? Number(ajMargen.monto) : f.margenBruto;
      const gastosFijos = ajGastos ? Number(ajGastos.monto) : f.gastosFijos;
      const margenBrutoPct = ventasNetas > 0 ? margenBruto / ventasNetas : 0;
      const utilidadOperativa = margenBruto - gastosFijos;
      const margenOperativoPct = ventasNetas > 0 ? utilidadOperativa / ventasNetas : 0;
      return {
        ...f,
        ventasNetas,
        margenBruto,
        margenBrutoPct,
        gastosFijos,
        utilidadOperativa,
        margenOperativoPct,
        ajustada: { ventasNetas: !!ajVenta, margenBruto: !!ajMargen, gastosFijos: !!ajGastos },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasBase, financieroAjustes]);

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

  // Partidas manuales: monto por fila y mes, capturado por Finanzas/equipo
  // estratégico — se suman (Ingreso) o restan (Gasto) a la utilidad
  // operativa para llegar al flujo de efectivo del periodo.
  const montoDe = (filaId, m) => {
    const row = financieroMontos.find((mo) => mo.fila_id === filaId && mo.anio === m.anio && mo.mes === m.mes);
    return row ? Number(row.monto || 0) : 0;
  };

  const flujoPorMes = useMemo(() => {
    let acumulado = 0;
    return filas.map((f) => {
      let ajuste = 0;
      for (const fila of financieroFilas) {
        const monto = montoDe(fila.id, f);
        ajuste += fila.categoria === "Ingreso" ? monto : -monto;
      }
      const delPeriodo = f.utilidadOperativa + ajuste;
      acumulado += delPeriodo;
      return { ...f, ajuste, delPeriodo, acumulado };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, financieroFilas, financieroMontos]);

  const chartData = flujoPorMes.map((f) => ({ mes: f.label, acumulado: f.acumulado }));
  const algunMesNegativo = flujoPorMes.some((f) => f.acumulado < 0);

  async function handleAgregarFila() {
    if (!nuevaFila.concepto.trim()) return;
    setSaving(true);
    const orden = financieroFilas.length > 0 ? Math.max(...financieroFilas.map((f) => f.orden)) + 1 : 0;
    const ok = await onCreateFila({ ...nuevaFila, orden }, currentUser);
    setSaving(false);
    if (ok) setNuevaFila({ concepto: "", categoria: "Gasto" });
  }

  async function handleMover(index, direccion) {
    const otro = index + direccion;
    if (otro < 0 || otro >= financieroFilas.length) return;
    const a = financieroFilas[index];
    const b = financieroFilas[otro];
    await onUpdateFila(a.id, { orden: b.orden }, currentUser);
    await onUpdateFila(b.id, { orden: a.orden }, currentUser);
  }

  const solicitudInicial = {
    titulo: algunMesNegativo ? "Flujo de efectivo proyectado negativo" : "",
    descripcion: algunMesNegativo
      ? flujoPorMes
          .filter((f) => f.acumulado < 0)
          .map((f) => `${f.label}: flujo acumulado ${formatMoney(f.acumulado)}.`)
          .join("\n")
      : "",
    riesgo: algunMesNegativo ? "Alto" : "Moderado",
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold text-sky-700">
        <span>
          Escenario de venta activo: <b>{escenarioActivo}</b> · Ventas netas, Margen bruto ($) y Gastos fijos vienen de Plan de venta/Parámetros, pero se pueden ajustar manualmente aquí (punto ámbar = ajustado). <b>Ojo</b>: Dashboard y Plan de operación siguen mostrando el valor real de Plan de venta, no el ajuste — úsalo solo cuando Finanzas tenga información que aún no está en Plan de venta.
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowSolicitud(true)}
            className="rounded-lg bg-[#001225] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-[#001a38]"
          >
            Solicitar a Dirección
          </button>
        )}
      </div>

      {showSolicitud && (
        <SolicitudModal initialDraft={solicitudInicial} onSubmit={(draft) => onSolicitarFinanciero(draft, currentUser)} onClose={() => setShowSolicitud(false)} />
      )}

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
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">
                  <CeldaAjustable
                    value={f.ventasNetas}
                    ajustada={f.ajustada.ventasNetas}
                    canEdit={canEdit}
                    onSave={(n) => onUpsertAjuste(f.anio, f.mes, "ventas_netas", n, currentUser)}
                    onReset={() => onDeleteAjuste(f.anio, f.mes, "ventas_netas")}
                  />
                </td>
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
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">
                  <CeldaAjustable
                    value={f.margenBruto}
                    ajustada={f.ajustada.margenBruto}
                    canEdit={canEdit}
                    onSave={(n) => onUpsertAjuste(f.anio, f.mes, "margen_bruto", n, currentUser)}
                    onReset={() => onDeleteAjuste(f.anio, f.mes, "margen_bruto")}
                  />
                </td>
              ))}
              <td className="px-2 py-1.5 text-right font-black text-slate-800">{formatMoney(totales.margenBruto)}</td>
            </tr>
            <tr className="border-b border-slate-50">
              <td className="px-3 py-1.5 font-bold text-slate-700">Gastos fijos</td>
              {filas.map((f, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-slate-600">
                  <CeldaAjustable
                    value={f.gastosFijos}
                    ajustada={f.ajustada.gastosFijos}
                    canEdit={canEdit}
                    onSave={(n) => onUpsertAjuste(f.anio, f.mes, "gastos_fijos", n, currentUser)}
                    onReset={() => onDeleteAjuste(f.anio, f.mes, "gastos_fijos")}
                  />
                </td>
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

      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-amber-50/60 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Otras partidas (editable)</p>
        </div>
        <div className="p-4">
          <p className="text-[9px] font-bold normal-case tracking-normal text-slate-400">
            Partidas que no vienen de Plan de venta ni de Parámetros (depreciación, intereses, impuestos, otros ingresos/gastos no operativos). Se suman (Ingreso) o restan (Gasto) a la Utilidad operativa para llegar al Flujo de efectivo.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-2 py-1.5">Concepto</th>
                  <th className="px-2 py-1.5">Tipo</th>
                  {horizonte.map((m) => (
                    <th key={`${m.anio}-${m.mes}`} className="px-2 py-1.5 text-right">{m.label}</th>
                  ))}
                  {canEdit && <th className="px-2 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {financieroFilas.length === 0 && (
                  <tr><td colSpan={horizonte.length + (canEdit ? 3 : 2)} className="px-2 py-4 text-center text-[10px] font-bold text-slate-300">Aún no hay partidas capturadas.</td></tr>
                )}
                {financieroFilas.map((fila, index) => (
                  <tr key={fila.id} className="border-t border-slate-50">
                    <td className="px-2 py-1 font-bold text-slate-700">{fila.concepto}</td>
                    <td className="px-2 py-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${fila.categoria === "Ingreso" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                        {fila.categoria}
                      </span>
                    </td>
                    {horizonte.map((m, i) => (
                      <td key={i} className="px-2 py-1 text-right">
                        <EditableMonto value={montoDe(fila.id, m)} canEdit={canEdit} onSave={(n) => onUpsertMonto(fila.id, m.anio, m.mes, n)} />
                      </td>
                    ))}
                    {canEdit && (
                      <td className="px-2 py-1">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" disabled={index === 0} onClick={() => handleMover(index, -1)} className="text-[10px] font-black text-slate-400 hover:text-slate-700 disabled:opacity-30">↑</button>
                          <button type="button" disabled={index === financieroFilas.length - 1} onClick={() => handleMover(index, 1)} className="text-[10px] font-black text-slate-400 hover:text-slate-700 disabled:opacity-30">↓</button>
                          <button type="button" onClick={() => onDeactivateFila(fila.id, currentUser)} className="text-[9px] font-black text-red-500 hover:underline">Quitar</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {financieroFilas.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <td colSpan={2} className="px-2 py-1.5 font-black uppercase text-[9px] text-slate-500">Flujo de efectivo del periodo</td>
                    {flujoPorMes.map((f, i) => (
                      <td key={i} className={`px-2 py-1.5 text-right font-black ${f.delPeriodo < 0 ? "text-red-600" : "text-slate-700"}`}>{formatMoney(f.delPeriodo)}</td>
                    ))}
                    {canEdit && <td />}
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-2 py-1.5 font-black uppercase text-[9px] text-slate-500">Flujo de efectivo acumulado</td>
                    {flujoPorMes.map((f, i) => (
                      <td key={i} className={`px-2 py-1.5 text-right font-black ${f.acumulado < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatMoney(f.acumulado)}</td>
                    ))}
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {canEdit && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Concepto
                <input value={nuevaFila.concepto} onChange={(e) => setNuevaFila((c) => ({ ...c, concepto: e.target.value }))} placeholder="Ej. Depreciación" className="mt-1 h-8 w-48 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none" />
              </label>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Tipo
                <select value={nuevaFila.categoria} onChange={(e) => setNuevaFila((c) => ({ ...c, categoria: e.target.value }))} className="mt-1 h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none">
                  <option value="Gasto">Gasto</option>
                  <option value="Ingreso">Ingreso</option>
                </select>
              </label>
              <button type="button" disabled={saving} onClick={handleAgregarFila} className="h-8 rounded-lg bg-[#001225] px-3 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {saving ? "Guardando..." : "+ Agregar partida"}
              </button>
            </div>
          )}
        </div>
      </div>

      {financieroFilas.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Flujo de efectivo acumulado — comportamiento por mes</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#898781" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} width={40} />
              <Tooltip formatter={(v) => formatMoney(v)} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="acumulado" stroke="#0B5ED7" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
