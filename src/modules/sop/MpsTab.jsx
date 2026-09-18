import { Fragment, useEffect, useMemo, useState } from "react";
import { downloadCsv, formatFechaCorta, formatNumber, LINEAS, toISODate } from "./sopHelpers";
import { getVentana, upsertVentana } from "../../services/sopVentanaSemanalService";

const LINEA_STYLE = {
  Bases: { badge: "border-sky-200 bg-sky-50 text-sky-700", row: "bg-sky-50/50", total: "bg-sky-50 text-sky-700", dot: "bg-sky-400" },
  Recámaras: { badge: "border-violet-200 bg-violet-50 text-violet-700", row: "bg-violet-50/50", total: "bg-violet-50 text-violet-700", dot: "bg-violet-400" },
  Salas: { badge: "border-amber-200 bg-amber-50 text-amber-700", row: "bg-amber-50/50", total: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
};

const HORIZONTE_SEMANAS = 6;
const VISTAS = [
  { key: "demanda", label: "Demanda" },
  { key: "mps", label: "A producir (MPS)" },
  { key: "saldo", label: "Saldo proyectado" },
];

function buildSemanas(semanaInicioISO, n) {
  const inicio = new Date(`${semanaInicioISO}T00:00:00`);
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i * 7);
    out.push(toISODate(d));
  }
  return out;
}

// Celda de "A producir" — igual patrón que CeldaAjustable de Plan
// financiero: el valor calculado (lote por lote) manda hasta que alguien
// lo sobreescribe; el punto ámbar marca que está sobreescrito y permite
// regresar al sugerido.
function CeldaMps({ sugerido, override, canEdit, onSave, onReset }) {
  const [editing, setEditing] = useState(false);
  const overridden = override != null;
  const valor = overridden ? override : sugerido;
  const [draft, setDraft] = useState(String(valor));

  if (!canEdit) {
    return <span className="text-slate-700">{formatNumber(valor)}</span>;
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => { setDraft(String(valor)); setEditing(true); }}
          className="rounded px-1 text-slate-700 transition hover:bg-sky-50"
        >
          {formatNumber(valor)}
        </button>
        {overridden && (
          <button
            type="button"
            onClick={onReset}
            title={`Sugerido por el sistema: ${formatNumber(sugerido)} — clic para regresar a ese valor`}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 hover:bg-amber-600"
          />
        )}
      </span>
    );
  }

  function commit() {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n) && n !== valor) onSave(n);
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
      className="h-6 w-16 rounded border border-sky-300 bg-white px-1 text-right text-[10px] font-bold text-slate-800 outline-none"
    />
  );
}

// MPS (Plan Maestro de Producción) — no es una captura nueva: cruza Plan
// de venta (demanda semanal) con el saldo inicial de Inventarios y arrastra
// el saldo proyectado semana a semana (lote por lote: se sugiere producir
// exactamente el faltante, sin stock de seguridad todavía). El planificador
// puede sobreescribir "A producir" cuando decide un lote distinto — esa
// decisión sí se guarda (pestaña "mps" de sop_ventana_semanal) y el saldo
// proyectado de las semanas siguientes se recalcula con el valor real que
// se decidió producir, no con el sugerido.
export default function MpsTab({ productos, canEdit, currentUser, semanaLunes }) {
  const [loading, setLoading] = useState(true);
  const [saldoInicial, setSaldoInicial] = useState({});
  const [demandaPorSemana, setDemandaPorSemana] = useState([]);
  const [overridesPorSemana, setOverridesPorSemana] = useState([]);
  const [vista, setVista] = useState("mps");

  const semanas = useMemo(() => buildSemanas(semanaLunes, HORIZONTE_SEMANAS), [semanaLunes]);

  const grouped = useMemo(() => {
    return LINEAS.map((linea) => ({ linea, items: productos.filter((p) => p.linea === linea) })).filter((g) => g.items.length > 0);
  }, [productos]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getVentana("inventarios", semanas[0]),
      ...semanas.map((s) => getVentana("plan-venta", s)),
      ...semanas.map((s) => getVentana("mps", s)),
    ]).then((resultados) => {
      if (cancelled) return;
      const inventarioResult = resultados[0];
      const demandaResults = resultados.slice(1, 1 + semanas.length);
      const overrideResults = resultados.slice(1 + semanas.length);
      setSaldoInicial(inventarioResult?.data?.datos?.saldosPorProducto || {});
      setDemandaPorSemana(demandaResults.map((r) => r?.data?.datos?.piezasPorProducto || {}));
      setOverridesPorSemana(overrideResults.map((r) => r?.data?.datos?.mpsPorProducto || {}));
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaLunes]);

  // Rodado producto × semana: cada semana consume el disponible de la
  // anterior, aplica la demanda y suma lo que efectivamente se decidió
  // producir (sobrescrito o sugerido) para llegar al saldo proyectado.
  const calculo = useMemo(() => {
    const disponible = {};
    for (const p of productos) disponible[p.id] = Number(saldoInicial[p.id] || 0);
    const porSemana = [];
    for (let i = 0; i < semanas.length; i++) {
      const demandaMap = demandaPorSemana[i] || {};
      const overrideMap = overridesPorSemana[i] || {};
      const fila = {};
      for (const p of productos) {
        const demanda = Number(demandaMap[p.id] || 0);
        const disp = disponible[p.id] || 0;
        const sugerido = Math.max(0, demanda - disp);
        const overridden = overrideMap[p.id] != null;
        const efectivo = overridden ? Number(overrideMap[p.id]) : sugerido;
        const saldoProyectado = disp - demanda + efectivo;
        fila[p.id] = { demanda, sugerido, override: overridden ? Number(overrideMap[p.id]) : null, efectivo, saldoProyectado };
        disponible[p.id] = saldoProyectado;
      }
      porSemana.push(fila);
    }
    return porSemana;
  }, [productos, saldoInicial, demandaPorSemana, overridesPorSemana, semanas]);

  async function handleGuardarOverride(semanaIdx, productoId, valor) {
    const next = { ...(overridesPorSemana[semanaIdx] || {}), [productoId]: valor };
    const result = await upsertVentana({ pestana: "mps", semanaLunes: semanas[semanaIdx], datos: { mpsPorProducto: next } }, { actor: currentUser });
    if (result?.ok) {
      setOverridesPorSemana((current) => current.map((m, i) => (i === semanaIdx ? next : m)));
    }
  }

  async function handleQuitarOverride(semanaIdx, productoId) {
    const next = { ...(overridesPorSemana[semanaIdx] || {}) };
    delete next[productoId];
    const result = await upsertVentana({ pestana: "mps", semanaLunes: semanas[semanaIdx], datos: { mpsPorProducto: next } }, { actor: currentUser });
    if (result?.ok) {
      setOverridesPorSemana((current) => current.map((m, i) => (i === semanaIdx ? next : m)));
    }
  }

  function valorVista(fila, key) {
    if (!fila) return 0;
    if (key === "demanda") return fila.demanda;
    if (key === "saldo") return fila.saldoProyectado;
    return fila.efectivo;
  }

  function handleExportar() {
    const header = ["Codigo", "Producto", "Linea", ...semanas.map((s) => formatFechaCorta(new Date(`${s}T00:00:00`)))];
    const rows = productos.map((p) => [
      p.codigo,
      p.nombre,
      p.linea,
      ...calculo.map((fila) => valorVista(fila[p.id], vista)),
    ]);
    downloadCsv(`MPS_${VISTAS.find((v) => v.key === vista).label.replace(/\s+/g, "_")}_${semanaLunes}.csv`, header, rows);
  }

  if (loading) return <div className="p-3"><p className="py-8 text-center text-[11px] font-bold text-slate-300">Cargando…</p></div>;

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
          MPS · {HORIZONTE_SEMANAS} semanas desde {formatFechaCorta(new Date(`${semanas[0]}T00:00:00`))}
        </p>
        <button
          type="button"
          onClick={handleExportar}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
        >
          ⭳ Exportar
        </button>
      </div>

      <p className="text-[9px] font-semibold normal-case tracking-normal text-slate-400">
        Saldo inicial = Inventarios de la semana de arranque (real). Las semanas siguientes son proyección: cada una arrastra el saldo de la anterior menos su demanda (Plan de venta) más lo que se produce. "A producir" sugiere lo justo para cubrir el faltante (lote por lote) — editable; el punto ámbar marca una cantidad distinta ya decidida por el planificador.
      </p>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {VISTAS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setVista(v.key)}
            className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${vista === v.key ? "bg-[#001225] text-white" : "text-slate-500 hover:bg-white"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] border-collapse text-[10px]">
          <thead>
            <tr className="text-left text-[9px] font-black uppercase tracking-widest text-white/60">
              <th className="sticky left-0 top-0 z-30 bg-[#001225] px-3 py-2 text-white">Producto</th>
              {semanas.map((s) => (
                <th key={s} className="sticky top-0 z-20 bg-[#001225] px-2 py-2 text-right">{formatFechaCorta(new Date(`${s}T00:00:00`))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => {
              const style = LINEA_STYLE[group.linea] || LINEA_STYLE.Bases;
              return (
                <Fragment key={group.linea}>
                <tr>
                  <td colSpan={semanas.length + 1} className={`px-3 py-1.5 ${style.row}`}>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {group.linea}
                    </span>
                  </td>
                </tr>
                {group.items.map((p, idx) => (
                  <tr key={p.id} className={`border-b border-slate-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-1 font-bold text-slate-700">
                      <span className="text-[9px] text-slate-300">{p.codigo}</span> {p.nombre}
                    </td>
                    {calculo.map((fila, semanaIdx) => {
                      const datoFila = fila[p.id];
                      if (vista === "mps") {
                        return (
                          <td key={semanaIdx} className="px-1 py-1 text-right">
                            <CeldaMps
                              sugerido={datoFila.sugerido}
                              override={datoFila.override}
                              canEdit={canEdit}
                              onSave={(n) => handleGuardarOverride(semanaIdx, p.id, n)}
                              onReset={() => handleQuitarOverride(semanaIdx, p.id)}
                            />
                          </td>
                        );
                      }
                      const valor = valorVista(datoFila, vista);
                      return (
                        <td key={semanaIdx} className={`px-2 py-1 text-right font-bold ${vista === "saldo" && valor < 0 ? "text-red-600" : "text-slate-600"}`}>
                          {formatNumber(valor)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
