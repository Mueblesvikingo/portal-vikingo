import { useMemo, useState } from "react";
import { buildHorizonte, formatMoney, formatNumber, LINEAS } from "./sopHelpers";

const LINEA_STYLE = {
  Bases: { badge: "border-sky-200 bg-sky-50 text-sky-700", row: "bg-sky-50/50", total: "bg-sky-50 text-sky-700", dot: "bg-sky-400" },
  Recámaras: { badge: "border-violet-200 bg-violet-50 text-violet-700", row: "bg-violet-50/50", total: "bg-violet-50 text-violet-700", dot: "bg-violet-400" },
  Salas: { badge: "border-amber-200 bg-amber-50 text-amber-700", row: "bg-amber-50/50", total: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
};

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

function AgregarProductoForm({ onCreate, onClose, currentUser, siguienteOrden }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [linea, setLinea] = useState(LINEAS[0]);
  const [precio, setPrecio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!codigo.trim() || !nombre.trim()) {
      setError("Captura al menos código y nombre.");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onCreate(
      { codigo: codigo.trim(), nombre: nombre.trim(), linea, precio: Number(precio) || 0, orden: siguienteOrden },
      currentUser
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Código
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="mt-1 h-9 w-24 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 h-9 w-64 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Línea
          <select value={linea} onChange={(e) => setLinea(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            {LINEAS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Precio
          <input type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} className="mt-1 h-9 w-28 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <button type="button" disabled={saving} onClick={handleCreate} className="h-9 rounded-lg bg-[#001225] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Guardando..." : "Agregar"}
        </button>
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

// Escenario unico (Base) — se dejo de mostrar el toggle Base/Objetivo en
// esta pestana, pero la columna "escenario" sigue existiendo en
// sop_plan_venta (compartida con Dashboard/Operacion/Financiero), asi que
// se sigue filtrando/guardando con este valor fijo.
const ESCENARIO_UNICO = "Base";

export default function PlanVentaTab({ productos, planVenta, control, canEdit, onSave, onSavePrecio, onCreateProducto, onDeactivateProducto, currentUser }) {
  const escenario = ESCENARIO_UNICO;
  const [showAgregar, setShowAgregar] = useState(false);

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
        <div className="flex items-center gap-2">
          {canEdit && !showAgregar && (
            <button
              type="button"
              onClick={() => setShowAgregar(true)}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100"
            >
              + Agregar producto
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-sky-500">Total piezas</p>
            <p className="text-sm font-black text-sky-900">{formatNumber(granTotalPiezas)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Total ventas</p>
            <p className="text-sm font-black text-emerald-900">{formatMoney(granTotalMonto)}</p>
          </div>
        </div>
      </div>

      {canEdit && showAgregar && (
        <AgregarProductoForm
          onCreate={onCreateProducto}
          onClose={() => setShowAgregar(false)}
          currentUser={currentUser}
          siguienteOrden={Math.max(0, ...productos.map((p) => p.orden || 0)) + 1}
        />
      )}

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
              const style = LINEA_STYLE[group.linea] || LINEA_STYLE.Bases;
              return (
                <>
                  <tr key={`h-${group.linea}`}>
                    <td colSpan={horizonte.length + 2} className={`px-3 py-1.5 ${style.row}`}>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {group.linea}
                      </span>
                    </td>
                  </tr>
                  {group.items.map((p) => (
                    <tr key={p.id} className={`border-b border-slate-50 hover:bg-slate-50/70`}>
                      <td className="sticky left-0 z-10 bg-white px-3 py-1 font-bold text-slate-700">
                        <span className="text-[9px] text-slate-300">{p.codigo}</span> {p.nombre}
                        {canEdit && (
                          <button
                            type="button"
                            title="Quitar producto del catálogo"
                            onClick={() => {
                              if (window.confirm(`¿Quitar "${p.nombre}" del Plan de venta? No se borra su historial, solo deja de mostrarse.`)) {
                                onDeactivateProducto(p.id, currentUser);
                              }
                            }}
                            className="ml-1.5 text-[9px] font-black text-red-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        )}
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
                  <tr key={`t-${group.linea}`} className={`border-b border-slate-100 ${style.total}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1 text-[9px] font-black uppercase ${style.total}`}>Total {group.linea}</td>
                    <td />
                    {lineaTotales.map((t, i) => (
                      <td key={i} className="px-2 py-1 text-right text-[9px] font-black">{formatNumber(t)}</td>
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
