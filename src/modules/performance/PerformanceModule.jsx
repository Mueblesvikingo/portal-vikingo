import { useEffect, useMemo, useState } from "react";
import {
  getKpis,
  getResultados,
  getMacroprocesos,
  getPersonaMacroprocesosLiderProceso,
  getHistorialByKpiIds,
  createKpi,
  updateKpi,
  deactivateKpi,
  activateKpi,
  upsertResultado,
} from "../../services/performanceService";
import { isStrategicTeamMember, canEditStrategicKpis } from "../../services/permissionsService";
import { createStrategicDecision } from "../../services/decisionService";
import { PERSPECTIVAS, ESTRATEGICO_SCOPE, MESES, getResultadoValue, formatDateTime, formatKpiValue } from "./performanceHelpers";
import TableroTab from "./TableroTab";
import ResultadosTab from "./ResultadosTab";
import PerspectivaChartsTab from "./PerspectivaChartsTab";
import ProcesoChartsTab from "./ProcesoChartsTab";
import StrategicDeploymentModule from "../StrategicDeploymentModule";

const CURRENT_YEAR = new Date().getFullYear();

const PERFORMANCE_VIDEO_URL = "https://www.youtube.com/embed/STiz1vJ9EWU?autoplay=1&rel=0&modestbranding=1";
const PERFORMANCE_MANUAL_URL = "/manuales/Manual_Desempeno_Organizacional.pdf";

const KPI_FIELD_LABELS = {
  nombre_indicador: "Indicador",
  objetivo_estrategico: "Objetivo estratégico",
  formula_texto: "Fórmula",
  fuente_datos: "Fuente",
  periodicidad: "Periodicidad",
  unidad_medida: "Medida",
  responsable_rol: "Responsable",
  tipo_grafico: "Gráfico",
  perspectiva: "Perspectiva",
  activo: "Estado",
  creado: "Creación del KPI",
};

function formatHistorialReferencia(entry) {
  if (entry.tipo_registro === "resultado") {
    const parts = String(entry.referencia || "").split("-");
    const [anio, mes] = parts;
    const semanaPart = parts.length === 4 ? parts[2] : null;
    const tipo = parts[parts.length - 1];
    const mesLabel = MESES[Number(mes) - 1] || mes;
    const semanaLabel = semanaPart ? ` · Semana ${semanaPart.replace("s", "")}` : "";
    return `${tipo === "real" ? "Real" : "Meta"} · ${mesLabel} ${anio}${semanaLabel}`;
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

export default function PerformanceModule({ currentUser }) {
  const [kpis, setKpis] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [macroprocesos, setMacroprocesos] = useState([]);
  const [ownMacroprocesos, setOwnMacroprocesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState(ESTRATEGICO_SCOPE);
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState("tablero");
  const [message, setMessage] = useState("");
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialEntries, setHistorialEntries] = useState([]);
  const [showVideo, setShowVideo] = useState(false);

  const isStrategic = isStrategicTeamMember(currentUser);

  async function loadAll() {
    setLoading(true);
    const [kpisData, resultadosData, macroData, ownData] = await Promise.all([
      getKpis(),
      getResultados({ anio: CURRENT_YEAR }),
      getMacroprocesos(),
      currentUser?.persona_id ? getPersonaMacroprocesosLiderProceso(currentUser.persona_id) : Promise.resolve([]),
    ]);
    setKpis(kpisData);
    setResultados(resultadosData);
    setMacroprocesos(macroData);
    setOwnMacroprocesos(ownData);
    setLoading(false);

    if (!scopeInitialized) {
      if (!isStrategic && ownData.length > 0) {
        setScope(ownData[0]);
      } else {
        setScope(ESTRATEGICO_SCOPE);
      }
      setScopeInitialized(true);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.persona_id]);

  const isEstrategico = scope === ESTRATEGICO_SCOPE;
  const scopedKpisAll = useMemo(
    () => kpis.filter((k) => (isEstrategico ? k.ambito === "estrategico" : (k.ambito === "tactico" || k.ambito === "operativo") && k.macroproceso === scope)),
    [kpis, scope, isEstrategico]
  );

  // Los tácticos (cascadeados desde Despliegue Estratégico) los edita el
  // equipo estratégico O el líder del proceso dueño de ese tablero — antes
  // solo el equipo estratégico podía, lo que dejaba a la mayoría de los
  // líderes de proceso sin poder capturar resultado alguno en su propio
  // tablero (casi ningún macroproceso tiene KPIs operativos activos como
  // alternativa). Los operativos (que cada líder captura para su propio
  // proceso) solo los edita el líder de ESE proceso, o el equipo
  // estratégico como respaldo.
  const canEditTactico = isStrategic || ownMacroprocesos.includes(scope);
  const canEditOperativo = isStrategic || ownMacroprocesos.includes(scope);
  function canEditKpi(kpi) {
    if (isEstrategico) return canEditStrategicKpis(currentUser);
    return kpi.ambito === "tactico" ? canEditTactico : canEditOperativo;
  }
  const canEdit = isEstrategico ? canEditStrategicKpis(currentUser) : canEditTactico || canEditOperativo;

  // El Tablero muestra los KPIs inactivos en gris solo a quien puede
  // editarlos (para que los pueda reactivar); a todos los demás se les
  // oculta por completo. Resultados y Gráficas nunca muestran inactivos —
  // no tiene sentido capturar/graficar algo que está apagado.
  const scopedKpis = useMemo(
    () => scopedKpisAll.filter((k) => k.activo || canEditKpi(k)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedKpisAll, isStrategic, ownMacroprocesos, currentUser]
  );
  const activeScopedKpis = useMemo(() => scopedKpisAll.filter((k) => k.activo), [scopedKpisAll]);

  const tabs = isEstrategico
    ? [
      { key: "tablero", label: "Tablero" },
      { key: "resultados", label: "Resultados" },
      ...PERSPECTIVAS.map((p) => ({ key: `persp-${p}`, label: p })),
      { key: "despliegue", label: "🧭 Despliegue", accent: true },
    ]
    : [
      { key: "tablero", label: "Tablero" },
      { key: "resultados", label: "Resultados" },
      { key: "graficas", label: "Gráficas" },
    ];

  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab)) setActiveTab("tablero");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

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
  // mecanismo (createStrategicDecision con status "Solicitud") que ya usan
  // S&OP y Seguimiento Estratégico para mandar solicitudes a la Bandeja de
  // Dirección.
  async function handleEscalarKpi(kpi, { real, meta, cumplimiento }) {
    const scopeLabel = isEstrategico ? "Estratégico" : scope;
    if (!window.confirm(`¿Escalar "${kpi.nombre_indicador}" (${scopeLabel}) a Dirección por estar en estado Crítico?`)) return;
    try {
      await createStrategicDecision({
        title: `KPI crítico: ${kpi.nombre_indicador}`,
        owner: kpi.responsable_rol || currentUser?.nombre || currentUser?.usuario || "",
        risk: "Alto",
        status: "Solicitud",
        executionType: null,
        dueDate: null,
        consequence: kpi.objetivo_estrategico || "",
        recommendation: `Tablero: ${scopeLabel}. Real: ${formatKpiValue(real, kpi.unidad_medida)} vs Meta: ${formatKpiValue(meta, kpi.unidad_medida)} (cumplimiento ${cumplimiento === null ? "sin datos" : `${cumplimiento}%`}).`,
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "Desempeño Organizacional",
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

  const scopeOptions = [
    { value: ESTRATEGICO_SCOPE, label: "Estratégico" },
    ...macroprocesos.map((p) => ({ value: p.nombre, label: p.nombre })),
  ];

  return (
    <section className="space-y-3">
      <div className="rounded-[22px] border border-slate-200 bg-white/70 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Filtrar por tablero:
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="ml-2 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"
              >
                {scopeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            {(isEstrategico ? canEditStrategicKpis(currentUser) : canEditOperativo) && (
              <button
                type="button"
                onClick={() => handleCreateKpi({ perspectiva: isEstrategico ? PERSPECTIVAS[0] : null, macroproceso: isEstrategico ? null : scope, ambito: isEstrategico ? "estrategico" : "operativo" })}
                className="h-9 rounded-lg border border-dashed border-slate-300 px-3 text-[10px] font-black text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
              >
                + Agregar KPI {!isEstrategico && "operativo"}
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

        <div className="mt-2 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-nowrap items-center justify-between gap-3 bg-[#001225] px-4 py-1.5 text-white">
            <div className="flex shrink-0 items-center gap-1.5">
              <h2 className="text-[13px] font-black uppercase tracking-tight">Desempeño Organizacional {isEstrategico ? "· Estratégico" : `· ${scope}`}</h2>
              <button
                type="button"
                onClick={() => setShowVideo(true)}
                className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/20"
              >
                ▶ Guía en video
              </button>
              <button
                type="button"
                onClick={() => window.open(PERFORMANCE_MANUAL_URL, "_blank")}
                className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/20"
              >
                📄 Guía en PDF
              </button>
            </div>
            <div className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl bg-white/10 p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                    activeTab === tab.key
                      ? tab.accent ? "bg-gradient-to-r from-amber-400 to-orange-500 text-[#001225] shadow-sm" : "bg-white text-[#001225]"
                      : tab.accent ? "bg-gradient-to-r from-amber-400/20 to-orange-500/20 text-amber-200 hover:from-amber-400/30 hover:to-orange-500/30" : "text-white/70 hover:bg-white/10"
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
            ) : activeTab === "graficas" ? (
              <ProcesoChartsTab kpis={activeScopedKpis} resultados={resultados} anio={CURRENT_YEAR} />
            ) : activeTab === "despliegue" ? (
              <StrategicDeploymentModule currentUser={currentUser} />
            ) : (
              <PerspectivaChartsTab
                kpis={activeScopedKpis}
                resultados={resultados}
                anio={CURRENT_YEAR}
                perspectiva={activeTab.replace("persp-", "")}
              />
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
      {showVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#001225] px-5 py-3 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Video tutorial</p>
                <h3 className="text-lg font-black">Desempeño Organizacional</h3>
              </div>
              <button type="button" onClick={() => setShowVideo(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white hover:bg-red-700">×</button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe className="h-full w-full" src={PERFORMANCE_VIDEO_URL} title="Video Desempeño Organizacional" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
