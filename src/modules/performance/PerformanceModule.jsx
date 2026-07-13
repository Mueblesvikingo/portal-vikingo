import { useEffect, useMemo, useState } from "react";
import {
  getKpis,
  getResultados,
  getMacroprocesos,
  getPersonaMacroprocesosLiderProceso,
  createKpi,
  updateKpi,
  deactivateKpi,
  upsertResultado,
} from "../../services/performanceService";
import { isStrategicTeamMember } from "../../services/permissionsService";
import { PERSPECTIVAS, ESTRATEGICO_SCOPE } from "./performanceHelpers";
import TableroTab from "./TableroTab";
import ResultadosTab from "./ResultadosTab";
import PerspectivaChartsTab from "./PerspectivaChartsTab";

const CURRENT_YEAR = new Date().getFullYear();

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
  const scopedKpis = useMemo(
    () => kpis.filter((k) => (isEstrategico ? k.ambito === "estrategico" : k.ambito === "tactico" && k.macroproceso === scope)),
    [kpis, scope, isEstrategico]
  );

  const canEdit = isEstrategico ? isStrategic : ownMacroprocesos.includes(scope);

  const tabs = isEstrategico
    ? [
      { key: "tablero", label: "Tablero" },
      { key: "resultados", label: "Resultados" },
      ...PERSPECTIVAS.map((p) => ({ key: `persp-${p}`, label: p })),
    ]
    : [
      { key: "tablero", label: "Tablero" },
      { key: "resultados", label: "Resultados" },
    ];

  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab)) setActiveTab("tablero");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function handleUpdateKpi(id, updates) {
    const result = await updateKpi(id, updates);
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible actualizar el KPI."); return; }
    setKpis((current) => current.map((k) => (k.id === id ? { ...k, ...result.data } : k)));
  }

  async function handleCreateKpi(defaults) {
    const result = await createKpi({ ...defaults, orden: scopedKpis.length + 1 });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible crear el KPI."); return; }
    setKpis((current) => [...current, result.data]);
  }

  async function handleDeactivateKpi(id) {
    if (!window.confirm("¿Quitar este KPI del tablero?")) return;
    const result = await deactivateKpi(id);
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible quitar el KPI."); return; }
    setKpis((current) => current.filter((k) => k.id !== id));
  }

  async function handleSaveResultado(payload) {
    const result = await upsertResultado(payload);
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible guardar el resultado."); return; }
    setResultados((current) => {
      const filtered = current.filter(
        (r) => !(Number(r.kpi_id) === payload.kpiId && Number(r.anio) === payload.anio && Number(r.mes) === payload.mes && r.tipo === payload.tipo)
      );
      return [...filtered, result.data];
    });
  }

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
            {canEdit && (
              <button
                type="button"
                onClick={() => handleCreateKpi({ perspectiva: isEstrategico ? PERSPECTIVAS[0] : null, macroproceso: isEstrategico ? null : scope, ambito: isEstrategico ? "estrategico" : "tactico" })}
                className="h-9 rounded-lg border border-dashed border-slate-300 px-3 text-[10px] font-black text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
              >
                + Agregar KPI
              </button>
            )}
          </div>
          {!canEdit && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">Modo solo lectura</span>}
        </div>

        <div className="mt-2 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-[#001225] px-4 py-1.5 text-white">
            <h2 className="text-[13px] font-black uppercase tracking-tight">Desempeño Organizacional {isEstrategico ? "· Estratégico" : `· ${scope}`}</h2>
            <div className="flex gap-1 rounded-xl bg-white/10 p-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${activeTab === tab.key ? "bg-white text-[#001225]" : "text-white/70 hover:bg-white/10"}`}
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
                onUpdateKpi={handleUpdateKpi}
                onDeactivateKpi={handleDeactivateKpi}
              />
            ) : activeTab === "resultados" ? (
              <ResultadosTab
                kpis={scopedKpis}
                resultados={resultados}
                anio={CURRENT_YEAR}
                scope={scope}
                canEdit={canEdit}
                onSaveResultado={handleSaveResultado}
              />
            ) : (
              <PerspectivaChartsTab
                kpis={scopedKpis}
                resultados={resultados}
                anio={CURRENT_YEAR}
                perspectiva={activeTab.replace("persp-", "")}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
