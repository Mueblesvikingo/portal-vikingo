import { useEffect, useState } from "react";
import { formatFechaCorta, formatMoney, EGRESO_CAMPOS_SEMANA, INGRESO_CAMPOS_SEMANA } from "./sopHelpers";
import { getVentana } from "../../services/sopVentanaSemanalService";

// El costo solo viaja como texto dentro de la recomendación (no hay columna
// dedicada en decisiones_estrategicas) — hoy únicamente "Solicitar recurso"
// lo redacta con este formato exacto ("Costo estimado: $X"), así que es lo
// único que se puede sumar contra la liquidez. Las demás solicitudes
// (capacidad/financiero/genéricas) se muestran igual, solo sin costo.
// Semanas por mes usadas en el resto del módulo (SEMANAS_POR_MES) — aquí
// para convertir un costo mensual a su equivalente semanal y poder
// compararlo contra la liquidez esperada de UNA semana.
const SEMANAS_POR_MES = 4.33;

function extraerCosto(recomendacion) {
  const m = /Costo estimado:\s*\$?\s*([\d,]+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i.exec(recomendacion || "");
  if (!m) return null;
  const monto = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(monto)) return null;
  const periodicidad = m[2] || "Único";
  // Único y Semanal se comparan tal cual contra la liquidez de una semana
  // (Único, asumiendo que se pagaría esa misma semana); Mensual se
  // prorratea entre semanas del mes para no sobreestimar el impacto de una
  // sola semana.
  const montoSemanal = /mensual/i.test(periodicidad) ? monto / SEMANAS_POR_MES : monto;
  return { monto, periodicidad, montoSemanal };
}

const ESTADO_STYLE = {
  Solicitud: { badge: "border-sky-200 bg-sky-50 text-sky-700", label: "Pendiente" },
  Decidida: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Aprobada" },
  "Stand by": { badge: "border-amber-200 bg-amber-50 text-amber-700", label: "Detenida" },
  Cerrada: { badge: "border-red-200 bg-red-50 text-red-700", label: "Rechazada" },
};

const FILTROS = [
  { key: "Solicitud", label: "Pendientes" },
  { key: "Decidida", label: "Aprobadas" },
  { key: "Stand by", label: "Detenidas" },
  { key: "Cerrada", label: "Rechazadas" },
  { key: "Todas", label: "Todas" },
];

// Aprobar/Detener/Rechazar, con comentario opcional y (solo al aprobar) la
// fecha para la que se aprueba — mismo patrón de "elegir acción → expandir
// formulario chico → confirmar" que ya usan las firmas del Ciclo S&OP.
function FilaAccion({ decision, onResolver }) {
  const [accion, setAccion] = useState(null);
  const [comentario, setComentario] = useState("");
  const [fechaAprobacion, setFechaAprobacion] = useState(decision.fecha_compromiso?.slice(0, 10) || "");
  const [saving, setSaving] = useState(false);

  async function confirmar() {
    setSaving(true);
    const ok = await onResolver(decision, accion, { comentario, fechaAprobacion });
    setSaving(false);
    if (ok) { setAccion(null); setComentario(""); }
  }

  if (!accion) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setAccion("aprobar")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700 hover:bg-emerald-100">✓ Aprobar</button>
        <button type="button" onClick={() => setAccion("detener")} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black text-amber-700 hover:bg-amber-100">⏸ Detener</button>
        <button type="button" onClick={() => setAccion("rechazar")} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-black text-red-700 hover:bg-red-100">✕ Rechazar</button>
      </div>
    );
  }

  return (
    <div className="w-64 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
      {accion === "aprobar" && (
        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
          ¿Para qué fecha se aprueba?
          <input
            type="date"
            value={fechaAprobacion}
            onChange={(e) => setFechaAprobacion(e.target.value)}
            className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold normal-case tracking-normal text-slate-700 outline-none"
          />
        </label>
      )}
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        placeholder="Comentario (opcional)..."
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold normal-case tracking-normal text-slate-700 outline-none"
      />
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={confirmar} className="rounded-lg bg-[#001225] px-3 py-1 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Guardando..." : `Confirmar`}
        </button>
        <button type="button" onClick={() => setAccion(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[9px] font-black text-slate-500">Cancelar</button>
      </div>
    </div>
  );
}

export default function DecisionesDirectorTab({ solicitudes, canDecide, onResolverSolicitud, semanaLunes }) {
  const [filtro, setFiltro] = useState("Solicitud");
  const [loadingLiquidez, setLoadingLiquidez] = useState(true);
  const [liquidezSemana, setLiquidezSemana] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingLiquidez(true);
    getVentana("financiero", semanaLunes).then((result) => {
      if (cancelled) return;
      const datos = result?.data?.datos;
      if (!datos) { setLiquidezSemana(null); setLoadingLiquidez(false); return; }
      const totalEgresos = EGRESO_CAMPOS_SEMANA.reduce((s, c) => s + Number(datos[c.key] || 0), 0);
      const totalIngresos = INGRESO_CAMPOS_SEMANA.reduce((s, c) => s + Number(datos[c.key] || 0), 0);
      setLiquidezSemana(totalIngresos - totalEgresos);
      setLoadingLiquidez(false);
    });
    return () => { cancelled = true; };
  }, [semanaLunes]);

  const pendientes = solicitudes.filter((d) => d.estado === "Solicitud");
  const costoPendiente = pendientes.reduce((s, d) => s + (extraerCosto(d.recomendacion)?.montoSemanal || 0), 0);
  const alcanza = liquidezSemana != null ? liquidezSemana - costoPendiente >= 0 : null;

  const filtradas = filtro === "Todas" ? solicitudes : solicitudes.filter((d) => d.estado === filtro);

  return (
    <div className="space-y-3 p-3">
      <div className={`rounded-2xl border p-4 shadow-sm ${alcanza === false ? "border-red-200 bg-red-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">¿La liquidez esperada de la semana cubre las solicitudes pendientes?</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-5">
          <div>
            <p className="text-[9px] font-bold text-slate-400">Liquidez esperada (semana activa)</p>
            <p className="text-lg font-black text-slate-900">{loadingLiquidez ? "…" : liquidezSemana != null ? formatMoney(liquidezSemana) : "Sin capturar en Plan financiero"}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">Costo de solicitudes pendientes</p>
            <p className="text-lg font-black text-slate-900">{formatMoney(costoPendiente)}</p>
          </div>
          {!loadingLiquidez && alcanza != null && (
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${alcanza ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-red-300 bg-red-100 text-red-700"}`}>
              {alcanza ? "✓ Alcanza" : "✕ No alcanza"}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[9px] font-bold text-slate-400">Solo suma el costo de las solicitudes que lo indicaron (ej. "Solicitar recurso") — los costos mensuales se prorratean entre semanas del mes, los únicos y semanales se comparan tal cual. La liquidez sale de Plan financiero → Vista semanal, de la semana seleccionada arriba.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest transition ${filtro === f.key ? "border-[#001225] bg-[#001225] text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[10px]">
            <thead>
              <tr className="bg-[#001225] text-left text-[9px] font-black uppercase tracking-widest text-white/60">
                <th className="px-3 py-2 text-white">Solicitud</th>
                <th className="px-2 py-2">Quién la mandó</th>
                <th className="px-2 py-2 text-right">Fecha</th>
                <th className="px-2 py-2 text-right">Costo</th>
                <th className="px-2 py-2">Estatus</th>
                <th className="px-2 py-2">Acción del Director</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[11px] font-bold text-slate-300">Sin solicitudes en este filtro.</td></tr>
              )}
              {filtradas.map((d) => {
                const costo = extraerCosto(d.recomendacion);
                const estilo = ESTADO_STYLE[d.estado] || { badge: "border-slate-200 bg-slate-50 text-slate-500", label: d.estado || "—" };
                return (
                  <tr key={d.id} className="border-b border-slate-50 align-top">
                    <td className="px-3 py-2">
                      <p className="font-black text-slate-700">{d.titulo_de_decision}</p>
                      {d.recomendacion && <p className="mt-0.5 text-[9px] font-semibold text-slate-400">{d.recomendacion}</p>}
                      {d.decision_final && <p className="mt-0.5 text-[9px] font-bold text-slate-500">Director: {d.decision_final}</p>}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{d.responsable || "—"}</td>
                    <td className="px-2 py-2 text-right text-slate-500">{d.fecha_compromiso ? formatFechaCorta(new Date(`${String(d.fecha_compromiso).slice(0, 10)}T00:00:00`)) : "—"}</td>
                    <td className="px-2 py-2 text-right font-bold text-slate-700">
                      {costo != null ? (
                        <>
                          {formatMoney(costo.monto)}
                          <span className="ml-1 text-[8px] font-black uppercase tracking-widest text-slate-400">{costo.periodicidad}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${estilo.badge}`}>{estilo.label}</span>
                    </td>
                    <td className="px-2 py-2">
                      {d.estado === "Solicitud" ? (
                        canDecide ? <FilaAccion decision={d} onResolver={onResolverSolicitud} /> : <span className="text-[9px] font-bold text-slate-300">Solo Director General</span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-300">Resuelta</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
