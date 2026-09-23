import { useEffect, useMemo, useState } from "react";
import {
  getKpis,
  getResultados,
  getHistorialByKpiIds,
  createKpi,
  updateKpi,
  deactivateKpi,
  activateKpi,
  upsertResultado,
  AREAS_OPERATIVAS,
} from "../../services/operationalPerformanceService";
import { isStrategicTeamMember, canEditDesempenoOperativoArea, getOwnDesempenoOperativoArea } from "../../services/permissionsService";
import { createStrategicDecision } from "../../services/decisionService";
import { getResultadoValue, formatDateTime, formatKpiValue, computeCumplimiento, getCumplimientoStatus } from "./performanceHelpers";
import TableroTab from "./TableroTab";
import ResultadosTab from "./ResultadosTab";
import ProcesoChartsTab from "./ProcesoChartsTab";

const CURRENT_YEAR = new Date().getFullYear();

// Un ícono por indicador — ayuda a reconocer cada tarjeta de un vistazo sin
// tener que leer el nombre completo, pensado para consultarse rápido desde
// el piso de producción. Si un supervisor agrega un KPI propio con otro
// nombre, cae en el ícono genérico.
const KPI_ICONS = {
  "% Utilización de EPP": "🦺",
  "Número de incidencias": "⚠️",
  "% Merma": "♻️",
  "Productividad (% Plan logrado)": "🎯",
  "Eficiencia en el uso del personal": "👷",
};

// Tarjeta de resumen por KPI (golden reference #2 del mantra de diseño: la
// dona + riel de KPI de Balance de Carga) — el estado se codifica 3 veces a
// la vez (color del borde/ícono, palabra "En meta/Atención/Crítico" y barra
// de avance), pensado para que un supervisor sepa cómo va sin leer números.
function OperationalKpiSummaryCard({ kpi, resultados, anio }) {
  const { real, meta, cumplimiento, esMesAnterior, mesUsadoLabel } = computeCumplimiento(resultados, kpi, anio);
  const status = getCumplimientoStatus(cumplimiento);
  const barValue = cumplimiento === null || cumplimiento === undefined ? 0 : Math.min(cumplimiento, 100);
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-3 shadow-sm" style={{ borderColor: `${status.color}35` }}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: status.color }} />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <span className="text-lg leading-none">{KPI_ICONS[kpi.nombre_indicador] || "📌"}</span>
        <span className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide" style={{ backgroundColor: `${status.color}1f`, color: status.color }}>
          {status.label}
        </span>
      </div>
      <p className="mt-2 truncate pl-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400" title={kpi.nombre_indicador}>
        {kpi.nombre_indicador}
      </p>
      <div className="mt-0.5 flex items-baseline gap-1.5 pl-1.5">
        <p className="text-2xl font-black leading-none text-slate-900">{formatKpiValue(real, kpi.unidad_medida)}</p>
        {esMesAnterior && real !== null && <span className="text-[8px] font-bold text-amber-500">{mesUsadoLabel}</span>}
      </div>
      <p className="pl-1.5 text-[9px] font-bold text-slate-400">Meta: {formatKpiValue(meta, kpi.unidad_medida)}</p>
      <div className="mx-1.5 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${barValue}%`, background: status.color }} />
      </div>
    </div>
  );
}

function OperationalKpiSummaryBand({ kpis, resultados, anio }) {
  if (kpis.length === 0) return null;
  const statuses = kpis.map((kpi) => getCumplimientoStatus(computeCumplimiento(resultados, kpi, anio).cumplimiento).label);
  const enMeta = statuses.filter((label) => label === "En meta").length;
  const criticos = statuses.filter((label) => label === "Crítico").length;
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-bold text-slate-500">
        {criticos > 0
          ? `⚠️ ${criticos} de ${kpis.length} indicador(es) en estado Crítico esta semana — revísalos abajo.`
          : `✅ ${enMeta} de ${kpis.length} indicadores en meta esta semana.`}
        <span className="ml-2 text-slate-300">Verde = vas bien · Ámbar = ponle ojo · Rojo = actúa ya</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <OperationalKpiSummaryCard key={kpi.id} kpi={kpi} resultados={resultados} anio={anio} />
        ))}
      </div>
    </div>
  );
}

const KPI_FIELD_LABELS = {
  nombre_indicador: "Indicador",
  objetivo_estrategico: "Objetivo",
  formula_texto: "Fórmula",
  fuente_datos: "Fuente",
  periodicidad: "Periodicidad",
  unidad_medida: "Medida",
  responsable_rol: "Responsable",
  tipo_grafico: "Gráfico",
  sentido: "Sentido",
  activo: "Estado",
  creado: "Creación del KPI",
};

function formatHistorialReferencia(entry) {
  if (entry.tipo_registro === "resultado") {
    const parts = String(entry.referencia || "").split("-");
    const [anio, mes] = parts;
    const semanaPart = parts.length === 4 ? parts[2] : null;
    const tipo = parts[parts.length - 1];
    const semanaLabel = semanaPart ? ` · Semana ${semanaPart.replace("s", "")}` : "";
    return `${tipo === "real" ? "Real" : "Meta"} · ${mes}/${anio}${semanaLabel}`;
  }
  return KPI_FIELD_LABELS[entry.referencia] || entry.referencia;
}

function HistorialModal({ open, onClose, loading, entries, kpisById }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Historial de captura</p>
            <p className="text-[10px] font-bold text-slate-300">Quién y cuándo editó cada dato de este tablero</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">
          {loading ? (
            <div className="py-8 text-center text-[11px] font-bold text-slate-300">Cargando…</div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-[11px] font-bold text-slate-300">Aún no hay ediciones registradas.</div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-slate-800">{kpisById[entry.kpi_id]?.nombre_indicador || `KPI #${entry.kpi_id}`}</span>
                    <span className="text-[9px] font-bold text-slate-400">{formatDateTime(entry.created_at)}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-slate-500">
                    {formatHistorialReferencia(entry)} · {entry.usuario_nombre || "Usuario desconocido"}
                  </div>
                  {(entry.valor_anterior || entry.valor_nuevo) && (
                    <div className="mt-1 text-[10px] text-slate-600">
                      <span className="text-slate-400 line-through">{entry.valor_anterior || "—"}</span>
                      {" → "}
                      <span className="font-bold text-slate-800">{entry.valor_nuevo || "—"}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OperationalPerformanceModule({ currentUser }) {
  const [kpis, setKpis] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState(AREAS_OPERATIVAS[0]);
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState("tablero");
  const [message, setMessage] = useState("");
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialEntries, setHistorialEntries] = useState([]);

  const isStrategic = isStrategicTeamMember(currentUser);

  async function loadAll() {
    setLoading(true);
    const [kpisData, resultadosData] = await Promise.all([getKpis(), getResultados({ anio: CURRENT_YEAR })]);
    setKpis(kpisData);
    setResultados(resultadosData);
    setLoading(false);

    if (!scopeInitialized) {
      const ownArea = getOwnDesempenoOperativoArea(currentUser);
      if (!isStrategic && ownArea) setScope(ownArea);
      setScopeInitialized(true);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.persona_id]);

  const scopedKpisAll = useMemo(() => kpis.filter((k) => k.area === scope), [kpis, scope]);

  const canEdit = canEditDesempenoOperativoArea(currentUser, scope);
  function canEditKpi() {
    return canEdit;
  }

  // El Tablero muestra los KPIs inactivos en gris solo a quien puede
  // editarlos (para que los pueda reactivar); a todos los demás se les
  // oculta por completo — mismo criterio que Desempeño Organizacional.
  const scopedKpis = useMemo(() => scopedKpisAll.filter((k) => k.activo || canEdit), [scopedKpisAll, canEdit]);
  const activeScopedKpis = useMemo(() => scopedKpisAll.filter((k) => k.activo), [scopedKpisAll]);

  const tabs = [
    { key: "tablero", label: "Tablero" },
    { key: "resultados", label: "Resultados" },
    { key: "graficas", label: "Gráficas" },
  ];

  async function handleUpdateKpi(id, updates) {
    const previous = kpis.find((k) => k.id === id);
    const result = await updateKpi(id, updates, { actor: currentUser, previous });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible actualizar el KPI."); return; }
    setKpis((current) => current.map((k) => (k.id === id ? { ...k, ...result.data } : k)));
  }

  async function handleCreateKpi(defaults) {
    const result = await createKpi({ ...defaults, orden: scopedKpis.length + 1 }, currentUser);
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible crear el KPI."); return; }
    setKpis((current) => [...current, result.data]);
  }

  async function handleToggleKpiActivo(kpi) {
    const previous = kpis.find((k) => k.id === kpi.id);
    const toggle = kpi.activo ? deactivateKpi : activateKpi;
    const result = await toggle(kpi.id, { actor: currentUser, previous });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible cambiar el estado del KPI."); return; }
    setKpis((current) => current.map((k) => (k.id === kpi.id ? { ...k, ...result.data } : k)));
  }

  async function handleSaveResultado(payload) {
    const semana = payload.semana ?? null;
    const previousValor = getResultadoValue(resultados, payload.kpiId, payload.anio, payload.mes, payload.tipo, semana);
    const result = await upsertResultado(payload, { actor: currentUser, previousValor });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible guardar el resultado."); return; }
    setResultados((current) => {
      const filtered = current.filter(
        (r) =>
          !(
            Number(r.kpi_id) === payload.kpiId &&
            Number(r.anio) === payload.anio &&
            Number(r.mes) === payload.mes &&
            (r.semana ?? null) === semana &&
            r.tipo === payload.tipo
          )
      );
      return [...filtered, result.data];
    });
  }

  // Escalar un KPI en estado Crítico al Centro de Decisiones — mismo
  // mecanismo ya usado en Desempeño Organizacional, S&OP y Seguimiento
  // Estratégico para mandar solicitudes a la Bandeja de Dirección.
  async function handleEscalarKpi(kpi, { real, meta, cumplimiento }) {
    if (!window.confirm(`¿Escalar "${kpi.nombre_indicador}" (${scope}) a Dirección por estar en estado Crítico?`)) return;
    try {
      await createStrategicDecision({
        title: `KPI crítico: ${kpi.nombre_indicador}`,
        owner: kpi.responsable_rol || currentUser?.nombre || currentUser?.usuario || "",
        risk: "Alto",
        status: "Solicitud",
        executionType: null,
        dueDate: null,
        consequence: kpi.objetivo_estrategico || "",
        recommendation: `Área: ${scope}. Real: ${formatKpiValue(real, kpi.unidad_medida)} vs Meta: ${formatKpiValue(meta, kpi.unidad_medida)} (cumplimiento ${cumplimiento === null ? "sin datos" : `${cumplimiento}%`}).`,
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "Desempeño Operativo",
      });
      setMessage("");
      alert("KPI escalado a la Bandeja del Centro de Decisiones.");
    } catch (err) {
      console.error(err);
      setMessage("No fue posible escalar el KPI a Dirección.");
    }
  }

  async function openHistorial() {
    setHistorialOpen(true);
    setHistorialLoading(true);
    const entries = await getHistorialByKpiIds(scopedKpis.map((k) => k.id));
    setHistorialEntries(entries);
    setHistorialLoading(false);
  }

  const kpisById = useMemo(() => Object.fromEntries(kpis.map((k) => [k.id, k])), [kpis]);

  return (
    <section className="space-y-3">
      <div className="rounded-[22px] border border-slate-200 bg-white/70 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Filtrar por área:
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="ml-2 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              >
                {AREAS_OPERATIVAS.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </label>
            {canEdit && (
              <button
                type="button"
                onClick={() => handleCreateKpi({ area: scope })}
                className="h-9 rounded-lg border border-dashed border-slate-300 px-3 text-[10px] font-black text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
              >
                + Agregar KPI
              </button>
            )}
            <button
              type="button"
              onClick={openHistorial}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              Ver historial
            </button>
          </div>
          {!canEdit && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">Modo solo lectura</span>}
        </div>

        {!loading && (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <OperationalKpiSummaryBand kpis={activeScopedKpis} resultados={resultados} anio={CURRENT_YEAR} />
          </div>
        )}

        <div className="mt-2 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-[#001225] px-4 py-1.5 text-white">
            <h2 className="text-[13px] font-black uppercase tracking-tight">Desempeño Operativo · {scope}</h2>
            <div className="flex gap-1 rounded-xl bg-white/10 p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                    activeTab === tab.key ? "bg-white text-[#001225]" : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {message && <div className="mx-3 mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{message}</div>}

          <div className="p-3">
            {loading ? (
              <div className="py-10 text-center text-[11px] font-bold text-slate-300">Cargando…</div>
            ) : activeTab === "tablero" ? (
              <TableroTab
                kpis={scopedKpis}
                resultados={resultados}
                anio={CURRENT_YEAR}
                scope={scope}
                canEdit={canEdit}
                canEditKpi={canEditKpi}
                onUpdateKpi={handleUpdateKpi}
                onToggleKpiActivo={handleToggleKpiActivo}
                onEscalarKpi={handleEscalarKpi}
                gaugesPosition="bottom"
              />
            ) : activeTab === "resultados" ? (
              <ResultadosTab
                kpis={activeScopedKpis}
                resultados={resultados}
                anio={CURRENT_YEAR}
                scope={scope}
                canEdit={canEdit}
                canEditKpi={canEditKpi}
                onSaveResultado={handleSaveResultado}
              />
            ) : (
              <ProcesoChartsTab kpis={activeScopedKpis} resultados={resultados} anio={CURRENT_YEAR} />
            )}
          </div>
        </div>
      </div>
      <HistorialModal
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        loading={historialLoading}
        entries={historialEntries}
        kpisById={kpisById}
      />
    </section>
  );
}
