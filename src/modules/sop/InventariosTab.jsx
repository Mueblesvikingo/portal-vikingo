import { Fragment, useEffect, useMemo, useState } from "react";
import { formatFechaCorta, formatMoney, formatNumber, LINEAS, parseCsvSimple } from "./sopHelpers";
import { getVentana, upsertVentana } from "../../services/sopVentanaSemanalService";

const LINEA_STYLE = {
  Bases: { badge: "border-sky-200 bg-sky-50 text-sky-700", row: "bg-sky-50/50", total: "bg-sky-50 text-sky-700", dot: "bg-sky-400" },
  Recámaras: { badge: "border-violet-200 bg-violet-50 text-violet-700", row: "bg-violet-50/50", total: "bg-violet-50 text-violet-700", dot: "bg-violet-400" },
  Salas: { badge: "border-amber-200 bg-amber-50 text-amber-700", row: "bg-amber-50/50", total: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
};

// Celda editable — mismo patrón que EditableCell de Plan de venta.
function EditableCell({ value, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));

  if (!canEdit) {
    return <span className="block px-1 text-right text-[10px] font-bold text-slate-600">{formatNumber(value)}</span>;
  }
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(String(value ?? 0)); setEditing(true); }}
        className="block w-full rounded px-1 text-right text-[10px] font-bold text-slate-600 transition hover:bg-sky-50"
      >
        {formatNumber(value)}
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
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-6 w-20 rounded border border-sky-300 bg-white px-1 text-right text-[10px] font-bold text-slate-800 outline-none"
    />
  );
}

// Pestaña de Inventarios — mismo concepto y misma mecánica que la Vista
// semanal de Plan de venta (catálogo agrupado por línea, celda editable,
// importar/exportar CSV), pero para el saldo real en existencia de cada
// producto en vez de piezas comprometidas a vender. Vive en la misma tabla
// genérica sop_ventana_semanal (pestaña "inventarios"), con un mapa
// {productoId: saldo} — así el saldo queda fechado por semana y consultable
// como el resto de la Vista semanal, sin tabla nueva.
export default function InventariosTab({ productos, canEdit, currentUser, semanaLunes }) {
  const [loading, setLoading] = useState(true);
  const [saldosPorProducto, setSaldosPorProducto] = useState({});
  const [importMsg, setImportMsg] = useState("");

  const lunes = new Date(`${semanaLunes}T00:00:00`);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);

  const grouped = useMemo(() => {
    return LINEAS.map((linea) => ({ linea, items: productos.filter((p) => p.linea === linea) })).filter((g) => g.items.length > 0);
  }, [productos]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setImportMsg("");
    getVentana("inventarios", semanaLunes).then((result) => {
      if (cancelled) return;
      setSaldosPorProducto(result?.data?.datos?.saldosPorProducto || {});
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [semanaLunes]);

  async function guardarMapa(next) {
    const result = await upsertVentana({ pestana: "inventarios", semanaLunes, datos: { saldosPorProducto: next } }, { actor: currentUser });
    if (result?.ok) setSaldosPorProducto(next);
    return result?.ok;
  }

  async function handleGuardarProducto(productoId, saldo) {
    await guardarMapa({ ...saldosPorProducto, [productoId]: saldo });
  }

  const granTotalPiezas = productos.reduce((sum, p) => sum + Number(saldosPorProducto[p.id] || 0), 0);
  const granTotalValorizado = productos.reduce((sum, p) => sum + Number(saldosPorProducto[p.id] || 0) * Number(p.precio || 0), 0);

  function handleExportar() {
    const header = ["Codigo", "Producto", "Linea", "Precio", "Saldo"];
    const escapeCsv = (value) => {
      const s = String(value ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = productos.map((p) => [p.codigo, p.nombre, p.linea, p.precio, saldosPorProducto[p.id] || 0]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Inventario_semana_${semanaLunes}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Importa por Código + Saldo — mismo formato que exporta este botón, para
  // poder cargar un conteo físico o el corte del sistema de almacén sin
  // capturar producto por producto.
  async function handleImportar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvSimple(text);
    if (rows.length < 2) { setImportMsg("El archivo no tiene filas para importar."); return; }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idxCodigo = header.indexOf("codigo");
    const idxSaldo = header.indexOf("saldo");
    if (idxCodigo === -1 || idxSaldo === -1) {
      setImportMsg('El archivo debe tener columnas "Codigo" y "Saldo".');
      return;
    }
    const porCodigo = new Map(productos.map((p) => [String(p.codigo).trim().toLowerCase(), p]));
    const next = { ...saldosPorProducto };
    let actualizados = 0;
    const noEncontrados = [];
    for (const row of rows.slice(1)) {
      const codigo = String(row[idxCodigo] || "").trim();
      if (!codigo) continue;
      const producto = porCodigo.get(codigo.toLowerCase());
      if (!producto) { noEncontrados.push(codigo); continue; }
      const saldo = Number(row[idxSaldo]);
      if (!Number.isFinite(saldo)) continue;
      next[producto.id] = saldo;
      actualizados++;
    }
    const ok = await guardarMapa(next);
    setImportMsg(
      ok
        ? `${actualizados} saldo(s) actualizados desde el archivo.${noEncontrados.length ? ` Código(s) no encontrados: ${noEncontrados.join(", ")}.` : ""}`
        : "No se pudo guardar la importación — intenta de nuevo."
    );
  }

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700">
          Saldo de inventario · semana del {formatFechaCorta(lunes)} al {formatFechaCorta(viernes)}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">
              ⭱ Importar
              <input type="file" accept=".csv" onChange={handleImportar} className="hidden" />
            </label>
          )}
          <button
            type="button"
            onClick={handleExportar}
            title="Descarga código, producto, línea, precio y saldo — mismo formato que espera Importar."
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
          >
            ⭳ Exportar
          </button>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-sky-500">Total en existencia</p>
            <p className="text-sm font-black text-sky-900">{formatNumber(granTotalPiezas)} pzas</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Valorizado</p>
            <p className="text-sm font-black text-emerald-900">{formatMoney(granTotalValorizado)}</p>
          </div>
        </div>
      </div>

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
                <th className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => {
                const lineaTotal = group.items.reduce((sum, p) => sum + Number(saldosPorProducto[p.id] || 0), 0);
                const style = LINEA_STYLE[group.linea] || LINEA_STYLE.Bases;
                return (
                  <Fragment key={group.linea}>
                    <tr>
                      <td colSpan={3} className={`px-3 py-1.5 ${style.row}`}>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {group.linea}
                        </span>
                      </td>
                    </tr>
                    {group.items.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="sticky left-0 z-10 bg-white px-3 py-1 font-bold text-slate-700">
                          <span className="text-[9px] text-slate-300">{p.codigo}</span> {p.nombre}
                        </td>
                        <td className="px-2 py-1 text-right text-[9px] font-bold text-slate-400">{formatMoney(p.precio)}</td>
                        <td className="px-1 py-1">
                          <EditableCell value={saldosPorProducto[p.id] || 0} canEdit={canEdit} onSave={(n) => handleGuardarProducto(p.id, n)} />
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
