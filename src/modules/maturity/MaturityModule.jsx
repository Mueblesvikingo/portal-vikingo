import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { isStrategicTeamMember } from "../../services/permissionsService";
import { getProcesos, updateProceso, getHistorial } from "../../services/madurezService";

const maturityLevels = {
  1: { label: "Inicial", alt: "Ejecutado", desc: "Solamente se realiza el trabajo", color: "#dc2626" },
  2: { label: "Administrada", alt: "Administrado", desc: "Se planifican las actividades", color: "#f97316" },
  3: { label: "Estandarizada", alt: "Definido", desc: "Está documentado e institucionalizado", color: "#ca8a04" },
  4: { label: "Predecible", alt: "Predecible", desc: "Está medido y cuantificado", color: "#2563eb" },
  5: { label: "Optimizada", alt: "Optimizado", desc: "Enfoque en la mejora continua", color: "#16a34a" },
};

const maturityInterpretations = {
  1: "El proceso existe operativamente, pero no cuenta con estructura formal, documentación ni control institucional.",
  2: "El proceso ya cuenta con lineamientos básicos y comienza a formalizarse, aunque todavía depende más de las personas que de la documentación institucional.",
  3: "El proceso está definido, documentado y aplicado bajo lineamientos institucionales del SIG.",
  4: "El proceso se mide mediante indicadores y permite análisis predictivos para toma de decisiones.",
  5: "El proceso opera bajo mejora continua, automatización y optimización organizacional.",
};

const maturityImprovementIdeas = {
  1: "Planear el proceso: definir responsable, frecuencia, recursos, entradas, salidas y actividades mínimas para que deje de ejecutarse de forma improvisada.",
  2: "Definir, documentar y modelar los flujos del proceso para alinearlo al Sistema Integrado de Gestión.",
  3: "Fortalecer el control del proceso mediante KPIs, tableros visuales, seguimiento periódico y análisis de desempeño para tomar decisiones basadas en datos.",
  4: "Automatizar análisis, usar datos predictivos y fortalecer la toma de decisiones.",
  5: "Consolidar la mejora continua y la innovación organizacional para soportar el crecimiento y escalabilidad del negocio.",
};

const phases = [
  { key: "bpmn", label: "BPMN", desc: "Macroproceso y subprocesos modelados en BIZAGI", info: "Representación visual del flujo operativo del proceso bajo metodología BPMN institucional." },
  { key: "caracterizacion", label: "Caracterización", desc: "Caracterización del macroproceso y subprocesos documentados y alineados al SIG", info: "Definir formalmente el macroproceso y los subprocesos, estableciendo objetivo, alcance, proveedor, insumos, actividades, responsables, clientes, productos, sistemas y documentos aplicables." },
  { key: "documentacion", label: "Documentación", desc: "Documentación institucional controlada", info: "Desarrollo y control de procedimientos, matrices de cumplimiento SIG, formatos, políticas y lineamientos del proceso." },
  { key: "validacion", label: "Validación", desc: "Proceso validado y liberado · Nivel 3 alcanzado", info: "Revisión técnica, validación y liberación formal del proceso conforme al Sistema Integrado de Gestión." },
  { key: "implementacion", label: "Implementación", desc: "Proceso implementado y adoptado operativamente", info: "Capacitación, aplicación y adopción operativa del proceso por todo el equipo involucrado." },
  { key: "digitalizacion", label: "Digitalización", desc: "Proceso digitalizado y actividades automatizadas", info: "Integración tecnológica, automatización y trazabilidad digital del proceso." },
  { key: "evaluacion", label: "Evaluación", desc: "Proceso medido y controlado · Nivel 4 alcanzado", info: "Monitoreo mediante indicadores, auditorías y acciones de mejora continua." },
  { key: "optimizacion", label: "Optimización", desc: "Mejora continua institucionalizada · Nivel 5 alcanzado", info: "Etapa enfocada en la mejora continua del proceso mediante acciones preventivas, correctivas e iniciativas de mejora organizacional." },
];

const PHASE_CYCLE = ["no", "si", "advertencia"];

// El catálogo de personas guarda "APELLIDOS NOMBRE"; la tabla de madurez
// siempre mostró solo el nombre de pila (ej. "Cristian") — mismo criterio
// de último-token que findPersonaByFirstName en el resto del portal.
function firstName(fullName) {
  if (!fullName) return "";
  const parts = String(fullName).trim().split(/\s+/);
  const last = parts[parts.length - 1] || "";
  return last.charAt(0) + last.slice(1).toLowerCase();
}

function Progress({ value }) {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-[#203f73]" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function CheckCell({ value, canEdit, onCycle }) {
  const checked = value === "si";
  const warning = value === "advertencia";
  const classes = warning
    ? "bg-amber-100 border-amber-300 text-green-700"
    : checked
      ? "bg-green-100 border-green-300 text-green-700"
      : "bg-white border-gray-200 text-gray-300";

  return (
    <div className="relative group inline-flex mx-auto">
      <button
        type="button"
        disabled={!canEdit}
        onClick={onCycle}
        className={`relative w-5 h-5 rounded-md flex items-center justify-center border text-[11px] font-black ${classes} ${canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
      >
        {(checked || warning) ? "✓" : ""}
        {warning && (
          <span className="absolute -bottom-[2px] -right-[1px] text-[7px] leading-none text-amber-700 font-black">⚠</span>
        )}
      </button>
      {warning && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 whitespace-nowrap rounded-lg bg-[#111827] px-2 py-1 text-[10px] font-bold text-white shadow-xl">
          Implementado sin validación
        </div>
      )}
    </div>
  );
}

function getPhaseCompletion(proceso) {
  return Math.round((phases.filter((phase) => proceso[phase.key] === "si").length / phases.length) * 100);
}

function getMaturityLevel(level) {
  return maturityLevels[level] || { label: "No iniciado", alt: "No iniciado", desc: "Sin evidencia registrada", color: "#6b7280" };
}

function getHeaderClass(phaseKey) {
  if (phaseKey === "validacion") return "bg-amber-50 text-amber-700 border-x border-amber-200";
  if (phaseKey === "evaluacion") return "bg-green-50 text-green-700 border-x border-green-300";
  if (phaseKey === "optimizacion") return "bg-yellow-50 text-yellow-700 border-x border-yellow-400";
  return "text-gray-500";
}

function getCellClass(phaseKey) {
  if (phaseKey === "validacion") return "bg-amber-50 border-x border-amber-100";
  if (phaseKey === "evaluacion") return "bg-green-50 border-x border-green-300";
  if (phaseKey === "optimizacion") return "bg-yellow-50 border-x border-yellow-300";
  return "";
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MaturityModule({ currentUser }) {
  const [procesos, setProcesos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedMaturity, setSelectedMaturity] = useState(null);
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [playIntroVideo, setPlayIntroVideo] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [showLeaderInfo, setShowLeaderInfo] = useState(false);
  const [leaderFilter, setLeaderFilter] = useState("Todos");
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialEntries, setHistorialEntries] = useState([]);

  const canEdit = isStrategicTeamMember(currentUser);

  async function loadAll() {
    setLoading(true);
    const [procesosData, { data: personasData }] = await Promise.all([
      getProcesos(),
      supabase.from("personas").select("id,nombre").eq("tipo", "persona").eq("activo", true).order("nombre"),
    ]);
    setProcesos(procesosData);
    setPersonas(personasData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const averageLevel = useMemo(() => {
    if (!procesos.length) return "0.0";
    const total = procesos.reduce((acc, proceso) => acc + Number(proceso.nivel || 0), 0);
    return (total / procesos.length).toFixed(1);
  }, [procesos]);

  const leaders = useMemo(
    () => ["Todos", ...new Set(procesos.map((p) => firstName(p.lider?.nombre)).filter(Boolean))],
    [procesos]
  );

  const filteredProcesos = leaderFilter === "Todos"
    ? procesos
    : procesos.filter((proceso) => firstName(proceso.lider?.nombre) === leaderFilter);

  async function handleUpdateProceso(proceso, changes) {
    if (!canEdit) return;
    const result = await updateProceso(proceso.id, changes, { actor: currentUser, previous: proceso });
    if (!result.ok) { console.error(result.error); setMessage("No fue posible guardar el cambio."); return; }
    setProcesos((current) => current.map((item) => (item.id === proceso.id ? result.data : item)));
  }

  function handleCyclePhase(proceso, phaseKey) {
    const current = proceso[phaseKey] || "no";
    const next = PHASE_CYCLE[(PHASE_CYCLE.indexOf(current) + 1) % PHASE_CYCLE.length];
    handleUpdateProceso(proceso, { [phaseKey]: next });
  }

  async function openHistorial() {
    setHistorialOpen(true);
    setHistorialLoading(true);
    const entries = await getHistorial();
    const nombrePorId = new Map(procesos.map((p) => [p.id, p.nombre]));
    setHistorialEntries(entries.map((h) => ({ ...h, procesoNombre: nombrePorId.get(h.proceso_id) || "Proceso" })));
    setHistorialLoading(false);
  }

  return (
   <div className="space-y-5">
      <main className="w-full">
        <section className="p-3 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 relative text-center">
              <div className="absolute left-3 top-2 flex items-center gap-1.5">
                <button
                  onClick={openHistorial}
                  className="px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 text-[10px] font-black transition-all"
                >
                  ⏱ Historial
                </button>
                {!canEdit && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">Modo solo lectura</span>
                )}
              </div>
              <button
                onClick={() => setShowIntroVideo(true)}
                className="absolute right-3 top-2 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black transition-all"
              >
                ▶ Video
              </button>

              <div className="text-lg font-black tracking-tight">Madurez organizacional</div>
              <div className="text-[11px] text-gray-500 font-semibold">Nivel global actual: {averageLevel}/5</div>
            </div>

            <div className="grid grid-cols-5 text-center border-b border-gray-200">
              {Object.entries(maturityLevels).map(([key, item], index) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedMaturity({ level: key, ...item })}
                  className={`py-2 border-r border-gray-200 transition-all hover:opacity-90 ${index === 0 ? "bg-red-600 text-white" : "bg-white text-gray-900"}`}
                >
                  <div className="text-2xl font-black">{key}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-5 text-center text-[10px] font-semibold text-gray-700 border-b border-gray-200">
              {Object.entries(maturityLevels).map(([key, item]) => (
                <div key={key} className="py-1 border-r border-gray-200 leading-tight px-1">
                  <div className="font-black">{item.label}</div>
                  <div className="text-[8px] text-gray-400 font-semibold mt-[2px]">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {message && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{message}</div>}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="h-11 bg-[#111827] text-white px-4 flex items-center justify-between text-sm font-black">
              <div>HEATMAP DE IMPLEMENTACIÓN POR PROCESO</div>
              <div className="flex items-center gap-2">
                <select
                  value={leaderFilter}
                  onChange={(e) => setLeaderFilter(e.target.value)}
                  className="bg-white text-gray-700 text-[10px] rounded-md px-1.5 py-0.5 border border-gray-300 font-semibold h-6"
                >
                  {leaders.map((leader) => (
                    <option key={leader} value={leader}>{leader}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-center text-[11px] font-bold text-gray-300">Cargando…</div>
            ) : (
            <div className="overflow-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-black text-gray-500">N°</th>
                    <th className="text-left px-3 py-2 font-black text-gray-500">Proceso</th>
                    <th className="text-center px-2 py-2 font-black text-gray-500">Etapa</th>
                    <th
                      onClick={() => setShowLeaderInfo(true)}
                      className="text-left px-2 py-2 font-black text-gray-500 cursor-pointer hover:bg-gray-100 transition-all"
                    >
                      Líder
                    </th>
                    {phases.map((phase) => (
                      <th
                        key={phase.key}
                        onClick={() => setSelectedPhase(phase)}
                        className={`text-center px-[2px] py-1 font-black w-[78px] cursor-pointer hover:bg-gray-100 transition-all ${getHeaderClass(phase.key)}`}
                      >
                        <div className="text-[9px] leading-tight uppercase">{phase.label}</div>
                        {(phase.key === "validacion" || phase.key === "evaluacion" || phase.key === "optimizacion") && (
                          <div className="text-[11px] mt-[2px] leading-none font-black">
                            {phase.key === "optimizacion" ? "🏆" : "🚩"}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {filteredProcesos.map((proceso, index) => (
                    <tr key={proceso.id} className="border-b border-gray-100 hover:bg-red-50 transition-all">
                      <td className="px-3 py-2 font-bold text-gray-500">{index + 1}</td>
                      <td className="px-2 py-2 min-w-[180px] max-w-[180px]">
                        <div className="font-black leading-tight text-[10px]">{proceso.nombre}</div>
                      </td>
                      <td className="text-center px-2 py-2">
                        {canEdit ? (
                          <select
                            value={proceso.nivel}
                            onChange={(e) => handleUpdateProceso(proceso, { nivel: Number(e.target.value) })}
                            className="w-12 rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-black outline-none"
                            style={{ color: maturityLevels[proceso.nivel]?.color || "#6b7280" }}
                          >
                            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        ) : (
                          <span className="font-black" style={{ color: maturityLevels[proceso.nivel]?.color || "#6b7280" }}>
                            {proceso.nivel}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-semibold text-gray-600 min-w-[90px]">
                        {canEdit ? (
                          <select
                            value={proceso.lider_persona_id || ""}
                            onChange={(e) => handleUpdateProceso(proceso, { lider_persona_id: e.target.value ? Number(e.target.value) : null })}
                            className="w-full rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[9.5px] font-bold outline-none"
                          >
                            <option value="">Sin asignar</option>
                            {personas.map((p) => <option key={p.id} value={p.id}>{firstName(p.nombre)}</option>)}
                          </select>
                        ) : (
                          firstName(proceso.lider?.nombre) || "Pendiente"
                        )}
                      </td>
                      {phases.map((phase) => (
                        <td key={phase.key} className={`px-1 py-1 ${getCellClass(phase.key)}`}>
                          <CheckCell value={proceso[phase.key]} canEdit={canEdit} onCycle={() => handleCyclePhase(proceso, phase.key)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {showIntroVideo && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
              <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
                <div className="h-12 bg-red-600 text-white px-5 flex items-center justify-between text-sm font-black">
                  <div>Video explicativo — Madurez organizacional</div>
                  <button
                    onClick={() => { setShowIntroVideo(false); setPlayIntroVideo(false); }}
                    className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                  >
                    ×
                  </button>
                </div>

                <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                  {playIntroVideo ? (
                    <iframe
                      src="https://www.youtube.com/embed/UWCAbLdF-RU?autoplay=1&rel=0"
                      title="Video madurez organizacional"
                      className="w-full h-full"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      <img
                        src="https://img.youtube.com/vi/UWCAbLdF-RU/maxresdefault.jpg"
                        alt="Video"
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-black/30" />
                      <button
                        onClick={() => setPlayIntroVideo(true)}
                        className="absolute px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black"
                      >
                        ▶ Reproducir video
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {showLeaderInfo && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[65] flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
                <div className="h-12 bg-[#203f73] text-white px-5 flex items-center justify-between text-sm font-black">
                  <div>Líder de proceso</div>
                  <button onClick={() => setShowLeaderInfo(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all">×</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">¿Qué significa?</div>
                    <div className="text-sm text-gray-700 leading-relaxed font-semibold">
                      Es la persona responsable de asegurar que el proceso se defina, ejecute, controle y mejore conforme al Sistema Integrado de Gestión.
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">Rol principal</div>
                    <div className="text-sm text-gray-600 leading-relaxed font-medium">
                      Coordina la implementación del proceso, promueve su adopción por el equipo, da seguimiento a indicadores y gestiona ajustes, riesgos y oportunidades de mejora.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedPhase && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[65] flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
                <div className="h-12 bg-[#111827] text-white px-5 flex items-center justify-between text-sm font-black">
                  <div>{selectedPhase.label}</div>
                  <button onClick={() => setSelectedPhase(null)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all">×</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">Objetivo de la fase</div>
                    <div className="text-sm text-gray-700 leading-relaxed font-semibold">{selectedPhase.info}</div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">Resultado esperado</div>
                    <div className="text-sm text-gray-600 leading-relaxed font-medium">{selectedPhase.desc}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedMaturity && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
                <div className="px-5 py-4 text-white" style={{ backgroundColor: selectedMaturity.color }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase font-black opacity-80">Nivel de madurez</div>
                      <div className="text-3xl font-black mt-1">{selectedMaturity.level}</div>
                    </div>
                    <button onClick={() => setSelectedMaturity(null)} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-all">×</button>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-lg font-black text-gray-900">{selectedMaturity.label}</div>
                    <div className="text-sm text-gray-500 font-semibold mt-1">{selectedMaturity.desc}</div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">Interpretación</div>
                    <div className="text-sm text-gray-600 leading-relaxed font-medium">{maturityInterpretations[selectedMaturity.level]}</div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">Idea clave para avanzar</div>
                    <div className="text-sm text-gray-700 leading-relaxed font-semibold">{maturityImprovementIdeas[selectedMaturity.level]}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {historialOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[65] flex items-center justify-center p-4">
              <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
                <div className="h-12 bg-[#111827] text-white px-5 flex items-center justify-between text-sm font-black">
                  <div>Historial de cambios — Madurez organizacional</div>
                  <button onClick={() => setHistorialOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all">×</button>
                </div>
                <div className="max-h-[60vh] overflow-auto p-4">
                  {historialLoading ? (
                    <div className="py-8 text-center text-[11px] font-bold text-gray-300">Cargando…</div>
                  ) : historialEntries.length === 0 ? (
                    <div className="py-8 text-center text-[11px] font-bold text-gray-300">Aún no hay cambios registrados.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {historialEntries.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-gray-700">{entry.procesoNombre} · {entry.campo}</span>
                            <span className="text-[9px] font-bold text-gray-400">{formatDateTime(entry.created_at)}</span>
                          </div>
                          <p className="text-[9px] font-bold text-gray-500">{entry.nombre || "Usuario desconocido"}</p>
                          <p className="mt-0.5 text-[10px]">
                            <span className="text-gray-400 line-through">{entry.valor_anterior || "—"}</span>{" → "}
                            <span className="font-bold text-gray-700">{entry.valor_nuevo || "—"}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
