import { useEffect, useState } from "react";
import {
  createStrategicDecision,
  deleteStrategicDecision,
  getStrategicDecisions,
  updateStrategicDecision,
} from "../../services/decisionService";

const emptyWrap = {
  options: [""],
  evidence: "",
  distance: "",
  prevention: "",
  finalDecision: "",
  executionType: "",
  pmOwner: "",
  pmPlatform: "",
  pmTransferDate: "",
  pmCode: "",
};

const executionTypes = [
  "Acción puntual",
  "Seguimiento ejecutivo",
  "Iniciativa estratégica",
  "Proyecto PM",
];

const statusOptions = [
  "Solicitud",
  "Stand by",
  "Detectada",
  "En análisis",
  "Decidida",
  "Escalada a PM",
  "Cerrada",
];

export default function DecisionCenterModule() {
  const [decisions, setDecisions] = useState([]);
  const [editingDecision, setEditingDecision] = useState(null);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [wrapDecision, setWrapDecision] = useState(null);
  const [showWrapInfo, setShowWrapInfo] = useState(false);
  const [wrapForm, setWrapForm] = useState(emptyWrap);
  const [decisionView, setDecisionView] = useState("resultados");

  useEffect(() => {
    loadDecisions();
  }, []);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setSelectedDecision(null);
        setWrapDecision(null);
        setShowWrapInfo(false);
        setEditingDecision(null);
      }
    };

    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  async function loadDecisions() {
    try {
      const data = await getStrategicDecisions();

      const formatted = data.map((item) => ({
        id: item.id,
        decision: item.titulo_de_decision,
        owner: item.responsable,
        status: item.estado || "Detectada",
        risk: item.riesgo,
        executionType: item.execution_type,
        dueDate: item.fecha_compromiso,
        consequence: item.consecuencia,
        recommendation: item.recomendacion,
        wrap: {
          options: item.wrap_options,
          evidence: item.wrap_evidence,
          distance: item.wrap_distance,
          prevention: item.wrap_prepare,
          finalDecision: item.decision_final,
        },
      }));

      setDecisions(formatted);
    } catch (err) {
      console.error(err);
    }
  }

  async function saveDecisionChanges(updatedDecision) {
    try {
      if (updatedDecision.id && !updatedDecision.isNew) {
        await updateStrategicDecision(updatedDecision.id, {
          titulo_de_decision: updatedDecision.decision,
          responsable: updatedDecision.owner,
          riesgo: updatedDecision.risk,
          estado: updatedDecision.status,
          execution_type: updatedDecision.executionType,
          consecuencia: updatedDecision.consequence,
          recomendacion: updatedDecision.recommendation,
          fecha_compromiso: updatedDecision.dueDate || null,
          wrap_options: updatedDecision.wrap?.options,
          wrap_evidence: updatedDecision.wrap?.evidence,
          wrap_distance: updatedDecision.wrap?.distance,
          wrap_prepare: updatedDecision.wrap?.prevention,
          decision_final: updatedDecision.wrap?.finalDecision,
        });
      } else {
        await createStrategicDecision({
          title: updatedDecision.decision,
          owner: updatedDecision.owner,
          risk: updatedDecision.risk,
          status: updatedDecision.status || "Detectada",
          executionType: updatedDecision.executionType || "",
          dueDate: updatedDecision.dueDate,
          consequence: updatedDecision.consequence,
          recommendation: updatedDecision.recommendation,
          process: "Gestión Estratégica",
          wrap: {
            options: null,
            evidence: null,
            distance: null,
            prevention: null,
            finalDecision: null,
          },
        });
      }

      await loadDecisions();
      setEditingDecision(null);
      alert("Decisión actualizada.");
    } catch (err) {
      console.error(err);
      alert("Error actualizando decisión.");
    }
  }

  async function deleteDecision(decision) {
    if (!decision?.id) {
      alert("Esta decisión no tiene identificador de base de datos y no se puede eliminar.");
      return;
    }
    const confirmed = window.confirm(`¿Eliminar la decisión "${decision.decision}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      await deleteStrategicDecision(decision.id);
      await loadDecisions();
      setEditingDecision(null);
      setSelectedDecision(null);
      setWrapDecision(null);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Error eliminando decisión.");
    }
  }

  async function updateDecisionStatus(decision, status) {
    try {
      await updateStrategicDecision(decision.id, {
        estado: status,
      });
      await loadDecisions();
      setSelectedDecision(null);
      setEditingDecision(null);
    } catch (err) {
      console.error(err);
      alert("Error actualizando el estado de la decisión.");
    }
  }

  const handleWrapChange = (field, index, value) => {
    setWrapForm((prev) => {
      const updated = [...prev[field]];
      updated[index] = value;

      return {
        ...prev,
        [field]: updated,
      };
    });
  };

  const addWrapRow = (field) => {
    setWrapForm((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
  };

  const removeWrapRow = (field, index) => {
    setWrapForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const getWrapStatus = () => {
    const hasFinalDecision = Boolean(wrapForm.finalDecision?.trim());
    const hasExecutionType = Boolean(wrapForm.executionType);
    const hasPmData = Boolean(
      wrapForm.pmOwner?.trim() &&
        wrapForm.pmPlatform &&
        wrapForm.pmTransferDate
    );

    if (wrapForm.executionType === "Proyecto PM" && hasPmData) {
      return "Escalada a PM";
    }

    if (hasFinalDecision && hasExecutionType) {
      return "Decidida";
    }

    return "En análisis";
  };

  const saveWrapDecision = async () => {
    const nextStatus = getWrapStatus();

    try {
      await updateStrategicDecision(wrapDecision.id, {
        titulo_de_decision: wrapDecision.decision,
        responsable: wrapDecision.owner,
        riesgo: wrapDecision.risk,
        estado: nextStatus,
        execution_type: wrapForm.executionType || null,
        consecuencia: wrapDecision.consequence,
        recomendacion: wrapDecision.recommendation,
        fecha_compromiso: wrapDecision.dueDate || null,
        wrap_options: wrapForm.options,
        wrap_evidence: wrapForm.evidence,
        wrap_distance: wrapForm.distance,
        wrap_prepare: wrapForm.prevention,
        decision_final: wrapForm.finalDecision,
      });

      await loadDecisions();
      setWrapDecision(null);
      setWrapForm(emptyWrap);
      alert("Decisión documentada actualizada.");
    } catch (error) {
      console.error(error);
      alert("Error actualizando decisión documentada.");
    }
  };

  const openWrap = (decision) => {
    setWrapDecision(decision);
    setWrapForm({
      options: Array.isArray(decision.wrap?.options)
        ? decision.wrap.options
        : [decision.wrap?.options || ""],
      evidence: Array.isArray(decision.wrap?.evidence)
        ? decision.wrap.evidence.join("\n")
        : decision.wrap?.evidence || "",
      distance: Array.isArray(decision.wrap?.distance)
        ? decision.wrap.distance.join("\n")
        : decision.wrap?.distance || "",
      prevention: Array.isArray(decision.wrap?.prevention)
        ? decision.wrap.prevention.join("\n")
        : decision.wrap?.prevention || "",
      finalDecision: decision.wrap?.finalDecision || "",
      executionType: decision.executionType || "",
      pmOwner: "",
      pmPlatform: "",
      pmTransferDate: "",
      pmCode: "",
    });
    setSelectedDecision(null);
  };

  const riskStyle = {
    Alto: "bg-red-100 text-red-600",
    Moderado: "bg-yellow-100 text-yellow-700",
    Medio: "bg-yellow-100 text-yellow-700",
    Bajo: "bg-green-100 text-green-700",
  };

  const statusStyle = {
    Solicitud: "bg-sky-50 text-sky-700",
    "Stand by": "bg-orange-50 text-orange-700",
    Detectada: "bg-gray-100 text-gray-600",
    "En análisis": "bg-blue-50 text-blue-700",
    Decidida: "bg-green-50 text-green-700",
    "Escalada a PM": "bg-purple-50 text-purple-700",
    Cerrada: "bg-slate-100 text-slate-600",
    Pendiente: "bg-gray-100 text-gray-600",
    Documentada: "bg-green-50 text-green-700",
  };

  const inboxDecisions = decisions.filter((item) => ["Solicitud", "Stand by"].includes(item.status));
  const activeDecisions = decisions.filter((item) => !inboxDecisions.includes(item) && (["Acción puntual", "Seguimiento ejecutivo", "Iniciativa estratégica", "Proyecto PM"].includes(item.executionType) || item.status === "Escalada a PM"));
  const closedDecisions = decisions.filter((item) => item.status === "Cerrada");
  const pendingDecisions = decisions.filter((item) => !inboxDecisions.includes(item) && !closedDecisions.includes(item) && !activeDecisions.includes(item));
  const visibleDecisions =
    decisionView === "bandeja"
      ? inboxDecisions
      : decisionView === "cerradas"
      ? closedDecisions
      : decisionView === "pendientes"
        ? pendingDecisions
        : activeDecisions;
  const decisionViewGuide = {
    resultados: "Resumen ejecutivo del ciclo de decisiones: solicitudes en bandeja, volumen activo, pendientes, cierres y riesgos críticos.",
    bandeja: "Solicitudes enviadas por líderes de proceso. El director puede aceptarlas, dejarlas en stand by o eliminarlas.",
    activas: "Decisiones ya escaladas a una acción, seguimiento, iniciativa o proyecto. Representan asuntos vivos en ejecución.",
    pendientes: "Decisiones detectadas, en análisis o documentadas que todavía no se han convertido en acción o proyecto.",
    cerradas: "Decisiones cuya acción fue ejecutada, revisada y cerrada para consulta histórica.",
  };

  const getDecisionHorizon = (dueDate) => {
    if (!dueDate) return "Sin plazo";

    const today = new Date();
    const target = new Date(dueDate);

    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Vencida";
    if (diffDays === 0) return "Hoy";
    if (diffDays <= 7) return "1 semana";
    if (diffDays <= 14) return "2 semanas";
    if (diffDays <= 21) return "3 semanas";
    if (diffDays <= 30) return "1 mes";
    if (diffDays <= 60) return "2 meses";
    if (diffDays <= 90) return "3 meses";

    return "Más de 3 meses";
  };

  const getDaysLabel = (dueDate) => {
    if (!dueDate) return null;

    const today = new Date();
    const target = new Date(dueDate);

    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  };

  return (
    <div className="space-y-5">

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#071226] px-5 py-2">
          <h2 className="text-sm font-black tracking-wide text-white">
            GESTIÓN DE DECISIONES
          </h2>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-white/10 p-0.5">
              <DecisionTab active={decisionView === "resultados"} onClick={() => setDecisionView("resultados")}>Resultados</DecisionTab>
              <DecisionTab active={decisionView === "bandeja"} onClick={() => setDecisionView("bandeja")}>Bandeja</DecisionTab>
              <DecisionTab active={decisionView === "activas"} onClick={() => setDecisionView("activas")}>Activas</DecisionTab>
              <DecisionTab active={decisionView === "pendientes"} onClick={() => setDecisionView("pendientes")}>Pendientes</DecisionTab>
              <DecisionTab active={decisionView === "cerradas"} onClick={() => setDecisionView("cerradas")}>Cerradas</DecisionTab>
            </div>

            <button
              type="button"
              onClick={() =>
                setEditingDecision({
                  id: null,
                  decision: "",
                  owner: "",
                  risk: "Moderado",
                  status: decisionView === "bandeja" ? "Solicitud" : "Detectada",
                  dueDate: "",
                  executionType: "",
                  consequence: "",
                  recommendation: "",
                  wrap: null,
                })
              }
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-red-700"
            >
              {decisionView === "bandeja" ? "+ Nueva solicitud" : "+ Nueva decisión"}
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-gray-50 px-5 py-1.5">
          <p className="text-[10px] font-semibold text-gray-500">
            {decisionViewGuide[decisionView]}
          </p>
        </div>

        <div className="space-y-2 p-3">
          {decisionView === "resultados" && (
            <div className="grid gap-3 lg:grid-cols-5">
              <ResultCard title="Bandeja" value={inboxDecisions.length} note="Solicitudes por revisar" color="border-indigo-100 bg-indigo-50/60 text-indigo-700" />
              <ResultCard title="Activas" value={activeDecisions.length} note="En gestión ejecutiva" color="border-sky-100 bg-sky-50/60 text-sky-700" />
              <ResultCard title="Pendientes" value={pendingDecisions.length} note="Por análisis o decisión" color="border-amber-100 bg-amber-50/70 text-amber-700" />
              <ResultCard title="Cerradas" value={closedDecisions.length} note="Con ciclo completado" color="border-emerald-100 bg-emerald-50/70 text-emerald-700" />
              <ResultCard title="Críticas" value={decisions.filter((item) => item.risk === "Alto").length} note="Riesgo alto" color="border-red-100 bg-red-50/70 text-red-700" />
            </div>
          )}

          {decisionView !== "resultados" && visibleDecisions.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDecision(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setSelectedDecision(item);
              }}
              className={`grid w-full items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-all hover:border-red-200 hover:bg-red-50/40 ${
                decisionView === "bandeja"
                  ? "grid-cols-[2.3fr_1.3fr_0.9fr_1.1fr_1.1fr_auto]"
                  : "grid-cols-[3fr_1.6fr_1fr_1.25fr_1.4fr_auto]"
              }`}
            >
              <div>
                <div className="text-[15px] font-black leading-tight text-[#0f172a]">
                  {item.decision}
                </div>
              </div>

              <div className="flex justify-center text-center text-[13px] font-semibold text-gray-700 whitespace-nowrap">
                {item.owner}
              </div>

              <div className="flex justify-center whitespace-nowrap">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${riskStyle[item.risk]}`}
                >
                  {item.risk}
                </span>
              </div>

              <div className="flex justify-center whitespace-nowrap">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    statusStyle[item.status] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.status || "Detectada"}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center whitespace-nowrap">
                <div className="text-sm font-black text-[#0f172a]">
                  {getDecisionHorizon(item.dueDate)}
                </div>

                {item.dueDate && (
                  <div className="text-[11px] text-gray-400">
                    ({getDaysLabel(item.dueDate)} días)
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 whitespace-nowrap">
                {decisionView === "bandeja" && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDecisionStatus(item, "Detectada");
                      }}
                      className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100"
                    >
                      Aceptar
                    </button>

                    {item.status !== "Stand by" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateDecisionStatus(item, "Stand by");
                        }}
                        className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-700 hover:border-orange-200 hover:bg-orange-100"
                      >
                        Stand by
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDecision(item);
                      }}
                      className="rounded-xl border border-red-100 bg-white px-3 py-1 text-[11px] font-black text-red-600 hover:border-red-200 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDecision(item);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-1 text-[11px] font-black text-gray-500 hover:border-red-200 hover:text-red-500"
                >
                  Editar
                </button>

              </div>
            </div>
          ))}

          {decisionView !== "resultados" && visibleDecisions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
              <p className="text-sm font-black text-[#0f172a]">
                No hay registros en esta pestaña.
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-400">
                Cambia de pestaña o crea una nueva solicitud.
              </p>
            </div>
          )}
        </div>
      </section>

      {selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-[#071226] px-5 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] font-black text-gray-400">
                  Detalle ejecutivo
                </div>

                <h2 className="mt-1 text-2xl font-black leading-tight text-white">
                  {selectedDecision.decision}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDecision(null)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-white hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-black uppercase text-gray-400">
                    ¿Qué está pasando?
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {(selectedDecision.consequence || "Sin información registrada.").split("\n\n")[0]}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-100 bg-red-50/40 p-3">
                  <div className="text-[10px] font-black uppercase text-red-500">
                    ¿Qué pasa si no se actúa?
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {selectedDecision.risk === "Alto"
                      ? "Existe riesgo de afectación operativa, financiera y organizacional."
                      : selectedDecision.risk === "Moderado" || selectedDecision.risk === "Medio"
                        ? "La situación podría generar desviaciones operativas progresivas."
                        : "La situación requiere seguimiento para evitar desviaciones futuras."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <InfoCard title="Responsable" value={selectedDecision.owner} />
                <InfoCard title="Riesgo" value={selectedDecision.risk} red />
                <InfoCard title="Horizonte" value={getDecisionHorizon(selectedDecision.dueDate)} />
                <InfoCard title="Tipo ejecución" value={selectedDecision.executionType || "Sin definir"} />
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-3">
                <div className="text-[10px] font-black uppercase text-red-500">
                  Recomendación estratégica
                </div>

                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {selectedDecision.recommendation}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openWrap(selectedDecision)}
                className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700"
              >
                {selectedDecision.wrap &&
                (selectedDecision.wrap.options ||
                  selectedDecision.wrap.evidence ||
                  selectedDecision.wrap.distance ||
                  selectedDecision.wrap.prevention ||
                  selectedDecision.wrap.finalDecision)
                  ? "Consultar / editar decisión documentada"
                  : "Documentar decisión estratégica"}
              </button>
            </div>
          </div>
        </div>
      )}

      {wrapDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-[#071226] px-6 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] font-black text-gray-400">
                  Decisión estratégica
                </div>

                <h2 className="mt-1 text-2xl font-black leading-tight text-white">
                  {wrapDecision.decision}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setWrapDecision(null)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-white hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] font-semibold text-gray-500">
                  Método WRAP · Pensamiento estratégico estructurado
                </div>

                <button
                  type="button"
                  onClick={() => setShowWrapInfo(true)}
                  className="rounded-xl border border-red-100 bg-white px-3 py-2 text-[11px] font-black text-red-500 transition-all hover:bg-red-50"
                >
                  Ver lógica WRAP
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="h-[150px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-[10px] uppercase font-black text-gray-400">
                    W · Opciones consideradas
                  </div>

                  <div className="mt-1.5 space-y-1.5">
                    {wrapForm.options.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="pt-3 text-xs font-black text-gray-400">
                          {index + 1}.
                        </div>

                        <input
                          value={row}
                          onChange={(e) =>
                            handleWrapChange("options", index, e.target.value)
                          }
                          placeholder="¿Qué opciones son viables hoy?"
                          className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none transition-all focus:border-red-300 ${
                            row
                              ? "border-red-200 bg-red-50/20"
                              : "border-gray-200 bg-white"
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => removeWrapRow("options", index)}
                          className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addWrapRow("options")}
                      className="ml-6 text-xs font-black text-red-500 hover:text-red-700"
                    >
                      + agregar línea
                    </button>
                  </div>
                </label>

                <WrapTextarea
                  title="R · Evidencia disponible"
                  value={wrapForm.evidence}
                  placeholder="¿Qué evidencia respalda esta decisión?"
                  onChange={(value) =>
                    setWrapForm((prev) => ({ ...prev, evidence: value }))
                  }
                />

                <WrapTextarea
                  title="A · Tomar distancia"
                  value={wrapForm.distance}
                  placeholder="¿Qué podría pasar si esperamos?"
                  onChange={(value) =>
                    setWrapForm((prev) => ({ ...prev, distance: value }))
                  }
                />

                <WrapTextarea
                  title="P · Prepararse para fallar"
                  value={wrapForm.prevention}
                  placeholder="¿Qué podría salir mal y cómo reaccionaríamos?"
                  onChange={(value) =>
                    setWrapForm((prev) => ({ ...prev, prevention: value }))
                  }
                />
              </div>

              <div className="mt-3">
                <label className="block rounded-2xl border border-red-100 bg-red-50/40 p-3">
                  <div className="text-[10px] uppercase font-black text-red-500">
                    Decisión tomada
                  </div>

                  <textarea
                    value={wrapForm.finalDecision}
                    onChange={(e) =>
                      setWrapForm((prev) => ({
                        ...prev,
                        finalDecision: e.target.value,
                      }))
                    }
                    placeholder="¿Qué decisión se ejecutará?"
                    className={`mt-2 h-16 w-full resize-none rounded-xl border p-3 text-sm outline-none transition-all focus:border-red-300 ${
                      wrapForm.finalDecision
                        ? "border-red-200 bg-red-50/20"
                        : "border-red-100 bg-white"
                    }`}
                  />
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <select
                    value={wrapForm.executionType || ""}
                    onChange={(e) =>
                      setWrapForm((prev) => ({
                        ...prev,
                        executionType: e.target.value,
                      }))
                    }
                    className="w-[280px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-red-300"
                  >
                    <option value="">Tipo de ejecución</option>
                    {executionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={saveWrapDecision}
                    className="flex-1 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700"
                  >
                    Guardar decisión documentada
                  </button>
                </div>

                {wrapForm.executionType === "Proyecto PM" && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                    <div className="mb-3 text-[10px] uppercase font-black tracking-[0.2em] text-blue-600">
                      Escalamiento PM
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="PM asignado"
                        value={wrapForm.pmOwner || ""}
                        onChange={(e) =>
                          setWrapForm((prev) => ({
                            ...prev,
                            pmOwner: e.target.value,
                          }))
                        }
                        className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                      />

                      <select
                        value={wrapForm.pmPlatform || ""}
                        onChange={(e) =>
                          setWrapForm((prev) => ({
                            ...prev,
                            pmPlatform: e.target.value,
                          }))
                        }
                        className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                      >
                        <option value="">Plataforma</option>
                        <option value="Teams">Teams</option>
                        <option value="Planner">Planner</option>
                        <option value="ClickUp">ClickUp</option>
                        <option value="Monday">Monday</option>
                      </select>

                      <input
                        type="date"
                        value={wrapForm.pmTransferDate || ""}
                        onChange={(e) =>
                          setWrapForm((prev) => ({
                            ...prev,
                            pmTransferDate: e.target.value,
                          }))
                        }
                        className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                      />

                      <input
                        placeholder="Código iniciativa"
                        value={wrapForm.pmCode || ""}
                        onChange={(e) =>
                          setWrapForm((prev) => ({
                            ...prev,
                            pmCode: e.target.value,
                          }))
                        }
                        className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                      />
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-blue-700/80">
                      Estos campos solo clasifican el escalamiento. La gestión formal del proyecto se realiza fuera del Centro de Decisiones.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#071226] px-5 py-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] font-black text-gray-400">
                  Editar decisión
                </div>

                <h2 className="mt-1 text-2xl font-black text-white">
                  {editingDecision.decision}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setEditingDecision(null)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 p-5">
              <input
                value={editingDecision.decision}
                onChange={(e) =>
                  setEditingDecision({
                    ...editingDecision,
                    decision: e.target.value,
                  })
                }
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm font-semibold outline-none focus:border-red-300"
              />

              <div className="grid grid-cols-4 gap-3">
                <input
                  value={editingDecision.owner}
                  onChange={(e) =>
                    setEditingDecision({
                      ...editingDecision,
                      owner: e.target.value,
                    })
                  }
                  placeholder="Responsable"
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-red-300"
                />

                <select
                  value={editingDecision.risk}
                  onChange={(e) =>
                    setEditingDecision({
                      ...editingDecision,
                      risk: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-red-300"
                >
                  <option>Alto</option>
                  <option>Moderado</option>
                  <option>Bajo</option>
                </select>

                <select
                  value={editingDecision.status || "Detectada"}
                  onChange={(e) =>
                    setEditingDecision({
                      ...editingDecision,
                      status: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-red-300"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={editingDecision?.dueDate || ""}
                  onChange={(e) =>
                    setEditingDecision({
                      ...editingDecision,
                      dueDate: e.target.value,
                    })
                  }
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none"
                />
              </div>

              <textarea
                value={editingDecision.consequence}
                onChange={(e) =>
                  setEditingDecision({
                    ...editingDecision,
                    consequence: e.target.value,
                  })
                }
                placeholder="Consecuencia"
                className="h-20 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-red-300"
              />

              <textarea
                value={editingDecision.recommendation}
                onChange={(e) =>
                  setEditingDecision({
                    ...editingDecision,
                    recommendation: e.target.value,
                  })
                }
                placeholder="Recomendación"
                className="h-20 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-red-300"
              />

              <div className="flex gap-3">
                {editingDecision.id && (
                  <button
                    type="button"
                    onClick={() => deleteDecision(editingDecision)}
                    className="w-[180px] rounded-2xl border border-red-100 bg-white px-5 py-4 text-sm font-black text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => saveDecisionChanges(editingDecision)}
                  className="flex-1 rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white hover:bg-red-700"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWrapInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#071226] px-6 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] font-black text-gray-400">
                  Modelo de decisión
                </div>

                <h2 className="mt-1 text-2xl font-black text-white">
                  Método WRAP
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowWrapInfo(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-5 text-sm leading-relaxed text-gray-600">
              <p className="font-semibold text-[#0f172a]">
                Modelo de pensamiento estratégico para mejorar la calidad,
                claridad y trazabilidad de las decisiones ejecutivas.
              </p>

              <p>
                El método WRAP ayuda a reducir decisiones impulsivas,
                sesgadas o poco estructuradas. Su objetivo es obligar a un
                análisis breve, pero consciente, antes de ejecutar una decisión
                importante.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <InfoWrap
                  title="W · Opciones consideradas"
                  text="Evita tomar la primera solución disponible. Obliga a explorar alternativas viables antes de decidir."
                />

                <InfoWrap
                  title="R · Evidencia disponible"
                  text="La decisión debe sustentarse en hechos, datos, indicadores o señales reales, no solo en percepción o presión operativa."
                />

                <InfoWrap
                  title="A · Tomar distancia"
                  text="Analiza qué puede ocurrir si se actúa, si se retrasa la decisión o si no se hace nada."
                />

                <InfoWrap
                  title="P · Prepararse para fallar"
                  text="Permite anticipar errores, desviaciones o impactos y definir cómo reaccionar."
                />
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
                <div className="text-[10px] uppercase font-black text-red-500">
                  Objetivo estratégico
                </div>

                <p className="mt-1 font-semibold text-gray-700">
                  Convertir decisiones críticas en conocimiento organizacional.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, note, red, compact }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm transition-all hover:shadow-md">
      <div>
        <div className="text-[9px] uppercase font-black tracking-[0.15em] text-gray-400">
          {title}
        </div>

        <div
          className={`mt-1 font-black leading-none ${
            compact ? "text-[28px]" : "text-[34px]"
          } ${red ? "text-red-600" : "text-[#0f172a]"}`}
        >
          {value}
        </div>

        <div className="mt-1 text-[10px] leading-none text-gray-500">
          {note}
        </div>
      </div>
    </div>
  );
}

function DecisionTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${
        active ? "bg-white text-[#071226] shadow-sm" : "text-gray-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ResultCard({ title, value, note, color }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${color}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
        {title}
      </p>
      <p className="mt-2 text-4xl font-black leading-none">
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold opacity-75">
        {note}
      </p>
    </div>
  );
}

function InfoCard({ title, value, red }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2.5">
      <div className="text-[10px] uppercase font-black text-gray-400">
        {title}
      </div>

      <div
        className={`mt-1 text-xl font-black ${
          red ? "text-red-600" : "text-[#0f172a]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function InfoWrap({ title, text }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-[10px] uppercase font-black text-gray-400">
        {title}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
    </div>
  );
}

function WrapTextarea({ title, value, placeholder, onChange }) {
  return (
    <label className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-[10px] uppercase font-black text-gray-400">
        {title}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 h-24 w-full resize-none rounded-xl border p-3 text-sm outline-none transition-all focus:border-red-300 ${
          value ? "border-red-200 bg-red-50/20" : "border-gray-200 bg-white"
        }`}
      />
    </label>
  );
}


