import { Fragment, useEffect, useMemo, useState } from "react";
import { buildHorizonte, formatFechaCorta, formatMoney, formatNumber, LINEAS, parseCsvSimple } from "./sopHelpers";
import { getVentana, upsertVentana } from "../../services/sopVentanaSemanalService";
import SolicitarRecursoModal from "./SolicitarRecursoModal";

const LINEA_STYLE = {
  Bases: { badge: "border-sky-200 bg-sky-50 text-sky-700", row: "bg-sky-50/50", total: "bg-sky-50 text-sky-700", dot: "bg-sky-400" },
  Recámaras: { badge: "border-violet-200 bg-violet-50 text-violet-700", row: "bg-violet-50/50", total: "bg-violet-50 text-violet-700", dot: "bg-violet-400" },
  Salas: { badge: "border-amber-200 bg-amber-50 text-amber-700", row: "bg-amber-50/50", total: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
};

// Familias reales de Planeación de Producción (PCP-IF-01 Tiempos
// estándar/Clasificación) — de aquí sale la carga real que ve Plan de
// operación. "Sin clasificar" (familia null) es válido: ese producto
// simplemente no participa todavía en ese cálculo.
const FAMILIAS_PRODUCTO = ["Base Vinil", "Base Tela", "Cabecera Vinil", "Cabecera Tela", "Converticama", "Sala/Sofa", "Reposet", "Sillon"];

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

  // commit() se llama directo desde blur Y desde Enter (antes Enter solo
  // hacia blur() esperando que eso disparara onBlur; en pruebas reales no
  // siempre alcanzaba a completar antes de que el usuario cambiara de
  // pantalla, perdiendo el dato sin aviso).
  function commit() {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n) && n !== Number(value ?? 0)) onSave(n);
  }

  return (
    <input
      autoFocus
      type="number"
      min="0"
      step={step}
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
      className={`h-6 ${width} rounded border border-sky-300 bg-white px-1 text-right text-[10px] font-bold text-slate-800 outline-none`}
    />
  );
}

function AgregarProductoForm({ onCreate, onClose, currentUser, siguienteOrden, defaultLinea }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [linea, setLinea] = useState(defaultLinea || LINEAS[0]);
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

// Vista semanal de Plan de venta — a diferencia del formulario genérico de
// 3 campos que se usaba antes (igual en las 5 pestañas de S&OP), esta
// respeta el concepto real de la pestaña: la misma tabla de productos
// agrupada por línea, con la misma celda editable, pero con una sola
// columna (la semana elegida) en vez del horizonte de 6 meses — el dato se
// guarda en la misma tabla genérica `sop_ventana_semanal` (pestaña
// "plan-venta"), solo que su `datos` es un mapa {productoId: piezas} en vez
// de los 3 campos planos que usan las demás pestañas. Exportar/importar CSV
// y alta/baja de producto replican el mismo patrón ya usado en la vista
// mensual, para no inventar un segundo mecanismo.
function PlanVentaSemanalTable({ productos, grouped, currentUser, canEdit, onCreateProducto, onDeactivateProducto, onSolicitarRecurso, semanaLunes }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [piezasPorProducto, setPiezasPorProducto] = useState({});
  const [agregarEnLinea, setAgregarEnLinea] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [showSolicitarRecurso, setShowSolicitarRecurso] = useState(false);

  const lunes = new Date(`${semanaLunes}T00:00:00`);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setImportMsg("");
    getVentana("plan-venta", semanaLunes).then((result) => {
      if (cancelled) return;
      setPiezasPorProducto(result?.data?.datos?.piezasPorProducto || {});
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [semanaLunes]);

  async function guardarMapa(next) {
    const result = await upsertVentana({ pestana: "plan-venta", semanaLunes, datos: { piezasPorProducto: next } }, { actor: currentUser });
    if (result?.ok) setPiezasPorProducto(next);
    return result?.ok;
  }

  async function handleGuardarProducto(productoId, piezas) {
    setSaving(productoId);
    await guardarMapa({ ...piezasPorProducto, [productoId]: piezas });
    setSaving(null);
  }

  const granTotalPiezas = productos.reduce((sum, p) => sum + Number(piezasPorProducto[p.id] || 0), 0);
  const granTotalMonto = productos.reduce((sum, p) => sum + Number(piezasPorProducto[p.id] || 0) * Number(p.precio || 0), 0);

  function handleExportarSemana() {
    const header = ["Codigo", "Producto", "Linea", "Precio", "Piezas"];
    const escapeCsv = (value) => {
      const s = String(value ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = productos.map((p) => [p.codigo, p.nombre, p.linea, p.precio, piezasPorProducto[p.id] || 0]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Plan_de_venta_semana_${semanaLunes}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Importa por Código (columna "Codigo") + piezas (columna "Piezas") — el
  // resto de columnas del CSV exportado (Producto/Linea/Precio) se ignoran
  // al leer, son solo referencia visual para quien edita el archivo.
  async function handleImportarArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvSimple(text);
    if (rows.length < 2) { setImportMsg("El archivo no tiene filas para importar."); return; }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idxCodigo = header.indexOf("codigo");
    const idxPiezas = header.indexOf("piezas");
    if (idxCodigo === -1 || idxPiezas === -1) {
      setImportMsg('El archivo debe tener columnas "Codigo" y "Piezas".');
      return;
    }
    const porCodigo = new Map(productos.map((p) => [String(p.codigo).trim().toLowerCase(), p]));
    const next = { ...piezasPorProducto };
    let actualizados = 0;
    const noEncontrados = [];
    for (const row of rows.slice(1)) {
      const codigo = String(row[idxCodigo] || "").trim();
      if (!codigo) continue;
      const producto = porCodigo.get(codigo.toLowerCase());
      if (!producto) { noEncontrados.push(codigo); continue; }
      const piezas = Number(row[idxPiezas]);
      if (!Number.isFinite(piezas)) continue;
      next[producto.id] = piezas;
      actualizados++;
    }
    const ok = await guardarMapa(next);
    setImportMsg(
      ok
        ? `${actualizados} producto(s) actualizados desde el archivo.${noEncontrados.length ? ` Código(s) no encontrados: ${noEncontrados.join(", ")}.` : ""}`
        : "No se pudo guardar la importación — intenta de nuevo."
    );
  }

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700">
          Vista semanal · compromiso de venta del {formatFechaCorta(lunes)} al {formatFechaCorta(viernes)}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">
              ⭱ Importar
              <input type="file" accept=".csv" onChange={handleImportarArchivo} className="hidden" />
            </label>
          )}
          <button
            type="button"
            onClick={handleExportarSemana}
            title="Descarga código, producto, línea, precio y piezas de esta semana — mismo formato que espera Importar."
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
          >
            ⭳ Exportar
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSolicitarRecurso(true)}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-100"
            >
              🛠 Solicitar recurso
            </button>
          )}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-sky-500">Total piezas (semana)</p>
            <p className="text-sm font-black text-sky-900">{formatNumber(granTotalPiezas)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Total ventas (semana)</p>
            <p className="text-sm font-black text-emerald-900">{formatMoney(granTotalMonto)}</p>
          </div>
        </div>
      </div>

      {showSolicitarRecurso && (
        <SolicitarRecursoModal onSubmit={(draft) => onSolicitarRecurso(draft, currentUser)} onClose={() => setShowSolicitarRecurso(false)} />
      )}

      {importMsg && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">{importMsg}</div>
      )}

      {loading ? (
        <p className="py-8 text-center text-[11px] font-bold text-slate-300">Cargando…</p>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[420px] border-collapse text-[10px]">
            <thead>
              <tr className="text-left text-[9px] font-black uppercase tracking-widest text-white/60">
                <th className="sticky left-0 top-0 z-30 bg-[#001225] px-3 py-2 text-white">Producto</th>
                <th className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">Precio</th>
                <th className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">Semana {formatFechaCorta(lunes)}–{formatFechaCorta(viernes)}</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => {
                const lineaTotal = group.items.reduce((sum, p) => sum + Number(piezasPorProducto[p.id] || 0), 0);
                const style = LINEA_STYLE[group.linea] || LINEA_STYLE.Bases;
                return (
                  <Fragment key={group.linea}>
                    <tr>
                      <td colSpan={3} className={`px-3 py-1.5 ${style.row}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            {group.linea}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setAgregarEnLinea(agregarEnLinea === group.linea ? null : group.linea)}
                              title={`Agregar producto en ${group.linea}`}
                              className="rounded-full border border-slate-300 bg-white/70 px-2 py-0.5 text-[9px] font-black text-slate-500 hover:bg-white"
                            >
                              + Producto
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {agregarEnLinea === group.linea && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2">
                          <AgregarProductoForm
                            onCreate={onCreateProducto}
                            onClose={() => setAgregarEnLinea(null)}
                            currentUser={currentUser}
                            siguienteOrden={Math.max(0, ...productos.map((p) => p.orden || 0)) + 1}
                            defaultLinea={group.linea}
                          />
                        </td>
                      </tr>
                    )}
                    {group.items.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/70">
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
                              className="ml-1.5 text-[9px] font-black text-red-300 hover:text-red-600"
                            >
                              ×
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right text-[9px] font-bold text-slate-400">{formatMoney(p.precio)}</td>
                        <td className="px-1 py-1">
                          <EditableCell
                            value={piezasPorProducto[p.id] || 0}
                            canEdit
                            onSave={(n) => handleGuardarProducto(p.id, n)}
                          />
                          {saving === p.id && <span className="ml-1 text-[9px] text-slate-300">guardando…</span>}
                        </td>
                      </tr>
                    ))}
                    <tr className={`border-b border-slate-100 ${style.total}`}>
                      <td className={`sticky left-0 z-10 px-3 py-1 text-[9px] font-black uppercase ${style.total}`}>Total {group.linea}</td>
                      <td />
                      <td className="px-2 py-1 text-right text-[9px] font-black">{formatNumber(lineaTotal)}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#001225] text-white">
                <td className="sticky left-0 z-10 bg-[#001225] px-3 py-2 text-[9px] font-black uppercase tracking-widest">Total general (piezas)</td>
                <td />
                <td className="px-2 py-2 text-right text-[10px] font-black">{formatNumber(granTotalPiezas)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// Escenario unico (Base) — se dejo de mostrar el toggle Base/Objetivo en
// esta pestana, pero la columna "escenario" sigue existiendo en
// sop_plan_venta (compartida con Dashboard/Operacion/Financiero), asi que
// se sigue filtrando/guardando con este valor fijo.
const ESCENARIO_UNICO = "Base";

export default function PlanVentaTab({ productos, planVenta, control, canEdit, onSave, onSavePrecio, onSaveFamilia, onCreateProducto, onDeactivateProducto, currentUser, vistaSemanal, semanaLunes, onSolicitarRecurso }) {
  const escenario = ESCENARIO_UNICO;
  const [showAgregar, setShowAgregar] = useState(false);
  const [mesExportarIdx, setMesExportarIdx] = useState(0);

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

  // Insumo para MPS de Operaciones: codigo/producto/linea/piezas del mes
  // elegido, mas precio y % de participacion (mismo % que se ve en pantalla,
  // sobre el total de piezas del horizonte completo) para dar contexto sin
  // tener que volver a abrir el portal. Se exporta como CSV (no .xlsx) para
  // no depender de una libreria externa con vulnerabilidades conocidas
  // (SheetJS); Excel abre .csv sin problema.
  function handleExportarMes() {
    const mes = horizonte[mesExportarIdx];
    if (!mes) return;
    const header = ["Codigo", "Producto", "Linea", "Precio", "% Participacion", "Piezas"];
    const escapeCsv = (value) => {
      const s = String(value ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = productos.map((p) => {
      const productoPiezasTotal = horizonte.reduce((s, m) => s + getPiezas(p.id, m.anio, m.mes), 0);
      const pct = granTotalPiezas > 0 ? (productoPiezasTotal / granTotalPiezas) * 100 : 0;
      return [p.codigo, p.nombre, p.linea, p.precio, `${pct.toFixed(1)}%`, getPiezas(p.id, mes.anio, mes.mes)];
    });
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Plan_de_venta_${mes.label}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (vistaSemanal) {
    return (
      <PlanVentaSemanalTable
        productos={productos}
        grouped={grouped}
        currentUser={currentUser}
        canEdit={canEdit}
        onCreateProducto={onCreateProducto}
        onDeactivateProducto={onDeactivateProducto}
        onSolicitarRecurso={onSolicitarRecurso}
        semanaLunes={semanaLunes}
      />
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !showAgregar && (
            <button
              type="button"
              onClick={() => setShowAgregar(true)}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100"
            >
              + Agregar producto
            </button>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 pl-2 pr-1 py-1">
            <select
              value={mesExportarIdx}
              onChange={(e) => setMesExportarIdx(Number(e.target.value))}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-emerald-700 outline-none"
            >
              {horizonte.map((m, i) => (
                <option key={`${m.anio}-${m.mes}`} value={i}>{m.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportarMes}
              title="Descarga codigo, producto, linea y piezas del mes elegido — listo para usarse como insumo del MPS de Operaciones."
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
            >
              ⭳ Exportar
            </button>
          </div>
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
              <th className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-left" title="Familia real (Planeación de Producción) — de aquí sale su carga en Plan de operación">Familia</th>
              <th className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">% Part.</th>
              {horizonte.map((m) => (
                <th key={`${m.anio}-${m.mes}`} className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => {
              const lineaTotales = horizonte.map((m) => group.items.reduce((sum, p) => sum + getPiezas(p.id, m.anio, m.mes), 0));
              const lineaPiezasTotal = lineaTotales.reduce((s, t) => s + t, 0);
              const lineaPct = granTotalPiezas > 0 ? (lineaPiezasTotal / granTotalPiezas) * 100 : 0;
              const style = LINEA_STYLE[group.linea] || LINEA_STYLE.Bases;
              return (
                <>
                  <tr key={`h-${group.linea}`}>
                    <td colSpan={horizonte.length + 4} className={`px-3 py-1.5 ${style.row}`}>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {group.linea}
                      </span>
                    </td>
                  </tr>
                  {group.items.map((p) => {
                    const productoPiezasTotal = horizonte.reduce((s, m) => s + getPiezas(p.id, m.anio, m.mes), 0);
                    const productoPct = granTotalPiezas > 0 ? (productoPiezasTotal / granTotalPiezas) * 100 : 0;
                    return (
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
                      <td className="px-1 py-1">
                        {canEdit ? (
                          <select
                            value={p.familia || ""}
                            onChange={(e) => onSaveFamilia(p.id, e.target.value || null, currentUser)}
                            className="h-6 w-28 rounded border border-slate-200 bg-white px-1 text-[9px] font-bold text-slate-700 outline-none"
                          >
                            <option value="">Sin clasificar</option>
                            {FAMILIAS_PRODUCTO.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-500">{p.familia || "Sin clasificar"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right text-[9px] font-bold text-slate-400">{productoPct.toFixed(1)}%</td>
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
                    );
                  })}
                  <tr key={`t-${group.linea}`} className={`border-b border-slate-100 ${style.total}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1 text-[9px] font-black uppercase ${style.total}`}>Total {group.linea}</td>
                    <td />
                    <td />
                    <td className="px-2 py-1 text-right text-[9px] font-black">{lineaPct.toFixed(1)}%</td>
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
              <td />
              <td className="px-2 py-2 text-right text-[10px] font-black">100.0%</td>
              {totalesPorMes.map((m, i) => (
                <td key={i} className="px-2 py-2 text-right text-[10px] font-black">{formatNumber(m.piezas)}</td>
              ))}
            </tr>
            <tr className="bg-[#001225]/95 text-white">
              <td className="sticky left-0 z-10 bg-[#001225] px-3 py-2 text-[9px] font-black uppercase tracking-widest">Total general ($)</td>
              <td />
              <td />
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
