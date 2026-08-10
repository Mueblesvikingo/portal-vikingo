import { useMemo, useState } from "react";
import { buildHorizonte, formatMoney, formatNumber, LINEAS } from "./sopHelpers";

function EditableCell({ value, canEdit, onSave, format = formatNumber, step = "1", width = "w-16" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));

  if (!canEdit) {
    return <span className="block px-1 text-right text-[10px] font-bold text-slate-600">{format(value)}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value ?? 0));
          setEditing(true);
        }}
        className="block w-full rounded px-1 text-right text-[10px] font-bold text-slate-600 transition hover:bg-sky-50"
      >
        {format(value)}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      min="0"
      step={step}
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
      className={`h-6 ${width} rounded border border-sky-300 bg-white px-1 text-right text-[10px] font-bold text-slate-800 outline-none`}
    />
  );
}

export default function PlanVentaTab({ productos, planVenta, control, canEdit, onSave, onSavePrecio, currentUser }) {
  const [escenario, setEscenario] = useState("Base");

  const horizonte = useMemo(() => buildHorizonte(control?.mes_activo, control?.horizonte_meses || 6), [control]);

  const planMap = useMemo(() => {
    const map = new Map();
    for (const row of planVenta) {
      if (row.escenario !== escenario) continue;
      map.set(`${row.producto_id}_${row.anio}_${row.mes}`, row);
    }
    return map;
  }, [planVenta, escenario]);

  function getPiezas(productoId, anio, mes) {
    return Number(planMap.get(`${productoId}_${anio}_${mes}`)?.piezas || 0);
  }

  const grouped = useMemo(() => {
    return LINEAS.map((linea) => ({
      linea,
      items: productos.filter((p) => p.linea === linea),
    })).filter((g) => g.items.length > 0);
  }, [productos]);

  const totalesPorMes = useMemo(() => {
    return horizonte.map((m) => {
      const piezas = productos.reduce((sum, p) => sum + getPiezas(p.id, m.anio, m.mes), 0);
      const monto = productos.reduce((sum, p) => sum + getPiezas(p.id, m.anio, m.mes) * Number(p.precio || 0), 0);
      return { ...m, piezas, monto };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, planMap, horizonte]);

  const granTotalPiezas = totalesPorMes.reduce((s, m) => s + m.piezas, 0);
  const granTotalMonto = totalesPorMes.reduce((s, m) => s + m.monto, 0);

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setEscenario("Base")}
            className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${escenario === "Base" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
          >
            Escenario Base
          </button>
          <button
            type="button"
            onClick={() => setEscenario("Objetivo")}
            className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${escenario === "Objetivo" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
          >
            Escenario Objetivo
          </button>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total piezas</p>
            <p className="text-sm font-black text-slate-900">{formatNumber(granTotalPiezas)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total ventas</p>
            <p className="text-sm font-black text-slate-900">{formatMoney(granTotalMonto)}</p>
          </div>
        </div>
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-[10px]">
          <thead>
            <tr className="text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="sticky left-0 top-0 z-30 bg-[#001225] px-3 py-2 text-white">Producto</th>
              <th className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">Precio</th>
              {horizonte.map((m) => (
                <th key={`${m.anio}-${m.mes}`} className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => {
              const lineaTotales = horizonte.map((m) => group.items.reduce((sum, p) => sum + getPiezas(p.id, m.anio, m.mes), 0));
              return (
                <>
                  <tr key={`h-${group.linea}`}>
                    <td colSpan={horizonte.length + 2} className="bg-slate-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">{group.linea}</td>
                  </tr>
                  {group.items.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1 font-bold text-slate-700">
                        <span className="text-[9px] text-slate-300">{p.codigo}</span> {p.nombre}
                      </td>
                      <td className="px-1 py-1">
                        <EditableCell
                          value={p.precio}
                          canEdit={canEdit}
                          onSave={(n) => onSavePrecio(p.id, n, currentUser)}
                          format={formatMoney}
                          step="1"
                          width="w-20"
                        />
                      </td>
                      {horizonte.map((m) => (
                        <td key={`${m.anio}-${m.mes}`} className="px-1 py-1">
                          <EditableCell
                            value={getPiezas(p.id, m.anio, m.mes)}
                            canEdit={canEdit}
                            onSave={(n) => onSave(p.id, escenario, m.anio, m.mes, n, currentUser)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr key={`t-${group.linea}`} className="border-b border-slate-100 bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-slate-50/60 px-3 py-1 text-[9px] font-black uppercase text-slate-500">Total {group.linea}</td>
                    <td />
                    {lineaTotales.map((t, i) => (
                      <td key={i} className="px-2 py-1 text-right text-[9px] font-black text-slate-600">{formatNumber(t)}</td>
                    ))}
                  </tr>
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#001225] text-white">
              <td className="sticky left-0 z-10 bg-[#001225] px-3 py-2 text-[9px] font-black uppercase tracking-widest">Total general (piezas)</td>
              <td />
              {totalesPorMes.map((m, i) => (
                <td key={i} className="px-2 py-2 text-right text-[10px] font-black">{formatNumber(m.piezas)}</td>
              ))}
            </tr>
            <tr className="bg-[#001225]/95 text-white">
              <td className="sticky left-0 z-10 bg-[#001225] px-3 py-2 text-[9px] font-black uppercase tracking-widest">Total general ($)</td>
              <td />
              {totalesPorMes.map((m, i) => (
                <td key={i} className="px-2 py-2 text-right text-[9px] font-bold text-white/80">{formatMoney(m.monto)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
