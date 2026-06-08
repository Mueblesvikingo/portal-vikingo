import React, { useMemo, useState } from "react";

const COLORS = {
  estrategicos: "#991b1b",
  operativos: "#203f73",
  apoyo: "#c96d1a",
};

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
  {
    key: "bpmn",
    label: "BPMN",
    desc: "Macroproceso y subprocesos modelados en BIZAGI",
    info: "Representación visual del flujo operativo del proceso bajo metodología BPMN institucional.",
  },
  {
    key: "caracterizacion",
    label: "Caracterización",
    desc: "Caracterización del macroproceso y subprocesos documentados y alineados al SIG",
    info: "Definir formalmente el macroproceso y los subprocesos, estableciendo objetivo, alcance, proveedor, insumos, actividades, responsables, clientes, productos, sistemas y documentos aplicables.",
  },
  {
    key: "documentacion",
    label: "Documentación",
    desc: "Documentación institucional controlada",
    info: "Desarrollo y control de procedimientos, matrices de cumplimiento SIG, formatos, políticas y lineamientos del proceso.",
  },
  {
    key: "validacion",
    label: "Validación",
    desc: "Proceso validado y liberado · Nivel 3 alcanzado",
    info: "Revisión técnica, validación y liberación formal del proceso conforme al Sistema Integrado de Gestión.",
  },
  {
    key: "implementacion",
    label: "Implementación",
    desc: "Proceso implementado y adoptado operativamente",
    info: "Capacitación, aplicación y adopción operativa del proceso por todo el equipo involucrado.",
  },
  {
    key: "digitalizacion",
    label: "Digitalización",
    desc: "Proceso digitalizado y actividades automatizadas",
    info: "Integración tecnológica, automatización y trazabilidad digital del proceso.",
  },
  {
    key: "evaluacion",
    label: "Evaluación",
    desc: "Proceso medido y controlado · Nivel 4 alcanzado",
    info: "Monitoreo mediante indicadores, auditorías y acciones de mejora continua.",
  },
  {
    key: "optimizacion",
    label: "Optimización",
    desc: "Mejora continua institucionalizada · Nivel 5 alcanzado",
    info: "Etapa enfocada en la mejora continua del proceso mediante acciones preventivas, correctivas e iniciativas de mejora organizacional.",
  },
];

const processes = [
  { name: "Planeación estratégica del SIG", type: "estrategicos", leader: "Cristian", level: 3, objectives: ["OBJ-11", "OBJ-14"], phases: { bpmn: true, caracterizacion: true, documentacion: true, validacion: true, implementacion: true, digitalizacion: true } },
  { name: "Planeación financiera", type: "estrategicos", leader: "Samantha", level: 2, objectives: ["OBJ-01", "OBJ-03", "OBJ-04"], phases: { bpmn: true, caracterizacion: true, documentacion: true } },
  { name: "Gestión de competencias", type: "estrategicos", leader: "Jacqueline", level: 2, objectives: ["OBJ-12", "OBJ-13"], phases: { bpmn: true, caracterizacion: true } },
  { name: "Evaluación desempeño del SIG", type: "estrategicos", leader: "Cristian", level: 3, objectives: ["GLOBAL"], phases: { bpmn: true, caracterizacion: true, documentacion: true, validacion: true, implementacion: true, digitalizacion: true } },
  { name: "Ingeniería/Desarrollo de productos", type: "operativos", leader: "Beatriz", level: 0, objectives: ["OBJ-10"], phases: {} },
  { name: "Ventas", type: "operativos", leader: "Alejandro", level: 2, objectives: ["OBJ-02", "OBJ-05", "OBJ-06", "OBJ-09", "OBJ-10"], phases: { bpmn: true, caracterizacion: true, documentacion: true, implementacion: "warning" } },
  { name: "Control de almacenes", type: "operativos", leader: "Hugo", level: 2, objectives: ["OBJ-06"], phases: { implementacion: "warning" } },
  { name: "Gestión de inventarios", type: "operativos", leader: "Hugo", level: 2, objectives: ["OBJ-01", "OBJ-02", "OBJ-03", "OBJ-06"], phases: { implementacion: "warning" } },
  { name: "Planeación y control de la producción", type: "operativos", leader: "Hugo", level: 2, objectives: ["OBJ-01", "OBJ-02", "OBJ-05", "OBJ-06", "OBJ-09", "OBJ-10"], phases: { bpmn: true, caracterizacion: true, implementacion: "warning" } },
  { name: "Compras", type: "operativos", leader: "Hugo", level: 2, objectives: ["OBJ-01", "OBJ-09", "OBJ-11"], phases: { bpmn: true, implementacion: "warning" } },
  { name: "Gestión de calidad", type: "operativos", leader: "Beatriz", level: 0, objectives: ["OBJ-05", "OBJ-06", "OBJ-07"], phases: {} },
  { name: "Distribución", type: "operativos", leader: "Hugo", level: 2, objectives: ["OBJ-01", "OBJ-02", "OBJ-06", "OBJ-07"], phases: { implementacion: "warning" } },
  { name: "Contabilidad y cumplimiento fiscal", type: "apoyo", leader: "Samantha", level: 2, objectives: ["OBJ-03", "OBJ-04"], phases: { implementacion: "warning" } },
  { name: "Recursos humanos", type: "apoyo", leader: "Aurora", level: 2, objectives: ["OBJ-12", "OBJ-13"], phases: { bpmn: true, caracterizacion: true, implementacion: "warning" } },
  { name: "Gestión de SST", type: "apoyo", leader: "Aurora", level: 2, objectives: ["OBJ-12"], phases: { bpmn: true, caracterizacion: true, documentacion: true, implementacion: "warning" } },
  { name: "Transformación digital", type: "apoyo", leader: "Elizabeth", level: 2, objectives: ["OBJ-14"], phases: { implementacion: "warning" } },
];

function Progress({ value }) {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;

  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-[#203f73]" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function CheckCell({ checked, warning = false }) {
  const classes = warning
    ? "bg-amber-100 border-amber-300 text-green-700"
    : checked
      ? "bg-green-100 border-green-300 text-green-700"
      : "bg-white border-gray-200 text-gray-300";

  return (
    <div className="relative group inline-flex mx-auto">
      <div className={`relative w-5 h-5 rounded-md flex items-center justify-center border text-[11px] font-black ${classes}`}>
        {(checked || warning) ? "✓" : ""}

        {warning && (
          <span className="absolute -bottom-[2px] -right-[1px] text-[7px] leading-none text-amber-700 font-black">
            ⚠
          </span>
        )}
      </div>

      {warning && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 whitespace-nowrap rounded-lg bg-[#111827] px-2 py-1 text-[10px] font-bold text-white shadow-xl">
          Implementado sin validación
        </div>
      )}
    </div>
  );
}

function getPhaseCompletion(process) {
  return Math.round((phases.filter((phase) => process.phases[phase.key]).length / phases.length) * 100);
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

function runPreviewTests() {
  console.assert(processes.length === 16, "Debe haber 16 procesos en la matriz de madurez");
  console.assert(Object.keys(maturityLevels).length === 5, "Debe existir escala de madurez del 1 al 5");
  console.assert(phases.length === 8, "Debe haber 8 fases de implementación");
  console.assert(getPhaseCompletion(processes[0]) === 75, "Planeación estratégica del SIG debe tener avance aproximado de 75%");
  console.assert(processes.some((process) => process.name === "Transformación digital"), "Debe existir el proceso Transformación digital");
  console.assert(maturityImprovementIdeas[1].includes("Planear"), "Nivel 1 debe orientar la mejora hacia la planeación del proceso");
  console.assert(maturityInterpretations[5].includes("mejora continua"), "Nivel 5 debe explicar mejora continua");
  console.assert(getMaturityLevel(0).label === "No iniciado", "Nivel 0 debe mostrarse como No iniciado");
  console.assert(getHeaderClass("optimizacion").includes("yellow"), "Optimización debe mostrarse en color dorado/amarillo");
  console.assert(getCellClass("evaluacion").includes("green"), "Evaluación debe mostrarse en verde");
  console.assert(processes.filter((process) => process.leader === "Hugo").length > 0, "Debe existir filtro por líder");
}

runPreviewTests();

export default function App() {
  const [selectedMaturity, setSelectedMaturity] = useState(null);
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [playIntroVideo, setPlayIntroVideo] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [showLeaderInfo, setShowLeaderInfo] = useState(false);
  const [leaderFilter, setLeaderFilter] = useState("Todos");

  const averageLevel = useMemo(() => {
    const total = processes.reduce((acc, process) => acc + process.level, 0);
    return (total / processes.length).toFixed(1);
  }, []);

  const leaders = ["Todos", ...new Set(processes.map((process) => process.leader).filter(Boolean))];

  const filteredProcesses = leaderFilter === "Todos"
    ? processes
    : processes.filter((process) => process.leader === leaderFilter);

  return (
   <div className="space-y-5">
      <main className="w-full">
      

        <section className="p-3 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 relative text-center">
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
                    <option key={leader} value={leader}>
                      {leader}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                  {filteredProcesses.map((process, index) => (
                    <tr key={process.name} className="border-b border-gray-100 hover:bg-red-50 transition-all">
                      <td className="px-3 py-2 font-bold text-gray-500">{index + 1}</td>
                      <td className="px-2 py-2 min-w-[180px] max-w-[180px]">
                        <div className="font-black leading-tight text-[10px]">{process.name}</div>
                      </td>
                      <td className="text-center px-2 py-2">
                        <span className="font-black" style={{ color: maturityLevels[process.level]?.color || "#6b7280" }}>
                          {process.level}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-semibold text-gray-600 min-w-[90px]">{process.leader || "Pendiente"}</td>
                      {phases.map((phase) => (
                        <td key={phase.key} className={`px-1 py-1 ${getCellClass(phase.key)}`}>
                          <CheckCell checked={process.phases[phase.key] === true} warning={process.phases[phase.key] === "warning"} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showIntroVideo && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
              <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
                <div className="h-12 bg-red-600 text-white px-5 flex items-center justify-between text-sm font-black">
                  <div>Video explicativo — Madurez organizacional</div>
                  <button
                    onClick={() => {
  setShowIntroVideo(false);
  setPlayIntroVideo(false);
}}
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
                  <button
                    onClick={() => setShowLeaderInfo(false)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                  >
                    ×
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">
                      ¿Qué significa?
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed font-semibold">
                      Es la persona responsable de asegurar que el proceso se defina, ejecute, controle y mejore conforme al Sistema Integrado de Gestión.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">
                      Rol principal
                    </div>
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
                  <button
                    onClick={() => setSelectedPhase(null)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                  >
                    ×
                  </button>
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
                    <button
                      onClick={() => setSelectedMaturity(null)}
                      className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-lg font-black text-gray-900">{selectedMaturity.label}</div>
                    <div className="text-sm text-gray-500 font-semibold mt-1">{selectedMaturity.desc}</div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">Interpretación</div>
                    <div className="text-sm text-gray-600 leading-relaxed font-medium">
                      {maturityInterpretations[selectedMaturity.level]}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                    <div className="text-xs uppercase font-black text-gray-400 mb-2">Idea clave para avanzar</div>
                    <div className="text-sm text-gray-700 leading-relaxed font-semibold">
                      {maturityImprovementIdeas[selectedMaturity.level]}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
