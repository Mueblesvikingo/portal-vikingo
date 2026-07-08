import { useMemo, useState } from "react";

const SEVERITY_STYLE = {
  alta: "border-red-200 bg-red-50 text-red-700",
  media: "border-orange-200 bg-orange-50 text-orange-700",
  baja: "border-sky-200 bg-sky-50 text-sky-700",
  info: "border-gray-200 bg-gray-50 text-gray-600",
};

const SEVERITY_LABEL = {
  alta: "Prioridad alta",
  media: "Prioridad media",
  baja: "Prioridad baja",
  info: "Informativo",
};

const SEVERITY_ORDER = { alta: 0, media: 1, baja: 2, info: 3 };

const GUIDE_TOPICS = [
  {
    id: "priorizar-automatizacion",
    question: "¿Cómo priorizo qué automatizar primero?",
    answer:
      "Empieza por actividades de criticidad Alta que consuman muchas horas y se repitan con frecuencia Diaria o Semanal: son las que más impacto tienen en la capacidad del equipo. El campo 'IA y Automatización' de cada actividad ya sugiere una idea concreta de dónde empezar.",
  },
  {
    id: "rol-saturado",
    question: "¿Qué significa que un rol esté 'saturado'?",
    answer:
      "Un rol saturado concentra una proporción muy alta de las horas totales del proceso. Esto genera dependencia de una sola persona (riesgo de continuidad) y suele indicar que conviene redistribuir actividades, documentar el conocimiento o evaluar apoyo adicional para ese puesto.",
  },
  {
    id: "dividir-actividad",
    question: "¿Cuándo conviene dividir una actividad en varias?",
    answer:
      "Cuando una sola actividad agrupa pasos con responsables distintos, o su duración es desproporcionadamente alta frente al resto del subproceso. Dividirla facilita medir la carga real de cada rol y detectar en qué paso específico vale la pena automatizar.",
  },
  {
    id: "bus-factor",
    question: "¿Cómo reduzco el riesgo de depender de una sola persona?",
    answer:
      "Revisa qué actividades críticas tiene asignado un único rol sin respaldo. Documentar bien el campo de descripción/impacto de esas actividades y capacitar a una segunda persona son las mejoras más rápidas de aplicar.",
  },
  {
    id: "subproceso-vacio",
    question: "¿Qué hago si un subproceso no tiene actividades?",
    answer:
      "Puede ser un subproceso recién creado que falta capturar, o uno que ya no aplica y debería desactivarse. Revísalo en el editor visual antes de que quede huérfano en los reportes de carga.",
  },
];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function computeFindings({ activities = [], subprocesses = [], processRoles = [] }) {
  const findings = [];
  const activeActivities = activities.filter((a) => a.active !== false);

  // 1. Documentación incompleta
  const missingDocs = activeActivities.filter(
    (a) => !hasText(a.impact) || !hasText(a.benefit) || !hasText(a.aiAutomation)
  );
  if (missingDocs.length > 0) {
    findings.push({
      id: "docs-incompletos",
      severity: "media",
      title: `${missingDocs.length} actividad(es) con impacto, beneficio o automatización IA sin documentar`,
      detail: missingDocs
        .slice(0, 5)
        .map((a) => a.name)
        .join(" · "),
      tip: "Completar estos campos ayuda a que futuras herramientas de IA del portal puedan usar esta información para dar recomendaciones más precisas.",
    });
  }

  // 2. Alta criticidad sin automatización sugerida
  const criticalNoAutomation = activeActivities.filter(
    (a) => a.criticality === "high" && !hasText(a.aiAutomation)
  );
  if (criticalNoAutomation.length > 0) {
    findings.push({
      id: "critica-sin-automatizacion",
      severity: "alta",
      title: `${criticalNoAutomation.length} actividad(es) críticas sin oportunidad de automatización identificada`,
      detail: criticalNoAutomation
        .slice(0, 5)
        .map((a) => a.name)
        .join(" · "),
      tip: "Son actividades de alto impacto para el negocio. Define qué parte del trabajo podría apoyarse con IA o Vikingo, aunque sea parcialmente.",
    });
  }

  // 3. Concentración de carga por rol
  const loadByRole = new Map();
  let totalLoad = 0;
  activeActivities.forEach((a) => {
    const rol = a.rol || "Sin rol";
    const hours = Number(a.timeHours) || 0;
    loadByRole.set(rol, (loadByRole.get(rol) || 0) + hours);
    totalLoad += hours;
  });
  if (totalLoad > 0) {
    loadByRole.forEach((hours, rol) => {
      const share = hours / totalLoad;
      if (share >= 0.5 && loadByRole.size > 1) {
        findings.push({
          id: `carga-concentrada-${rol}`,
          severity: "alta",
          title: `El rol "${rol}" concentra ${Math.round(share * 100)}% de la carga del proceso`,
          detail: `${hours.toFixed(1)}h de ${totalLoad.toFixed(1)}h totales están asignadas a este rol.`,
          tip: "Una concentración tan alta suele indicar un posible cuello de botella o dependencia de una sola persona. Evalúa redistribuir actividades o reforzar el puesto.",
        });
      }
    });
  }

  // 4. Subprocesos sin actividades
  const subprocessIdsWithActivity = new Set(
    activities.map((a) => a.subproceso_id).filter((id) => id !== null && id !== undefined)
  );
  const emptySubprocesses = subprocesses.filter(
    (s) => s.active !== false && !subprocessIdsWithActivity.has(s.id)
  );
  if (emptySubprocesses.length > 0) {
    findings.push({
      id: "subprocesos-vacios",
      severity: "media",
      title: `${emptySubprocesses.length} subproceso(s) activos sin actividades registradas`,
      detail: emptySubprocesses
        .slice(0, 5)
        .map((s) => s.name)
        .join(" · "),
      tip: "Revisa si falta capturar sus actividades o si el subproceso ya no aplica y conviene desactivarlo.",
    });
  }

  // 5. Roles configurados sin ninguna actividad asignada
  const rolesUsados = new Set(activeActivities.map((a) => a.rol));
  const rolesSinUso = (processRoles || [])
    .filter((r) => r.activo !== false)
    .map((r) => r.rol)
    .filter((rol) => hasText(rol) && !rolesUsados.has(rol));
  if (rolesSinUso.length > 0) {
    findings.push({
      id: "roles-sin-uso",
      severity: "baja",
      title: `${rolesSinUso.length} rol(es) configurados en este proceso sin actividades asignadas`,
      detail: rolesSinUso.slice(0, 5).join(" · "),
      tip: "Puede ser un carril agregado por adelantado. Si no vas a asignarle actividades pronto, considera ocultarlo para no saturar el editor visual.",
    });
  }

  // 6. Actividades duplicadas dentro del mismo subproceso
  const seen = new Map();
  activeActivities.forEach((a) => {
    const key = `${a.subproceso_id || a.codigo_subproceso || "sp"}::${(a.name || "").trim().toLowerCase()}`;
    if (!hasText(a.name)) return;
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  const duplicated = Array.from(seen.entries()).filter(([, count]) => count > 1);
  if (duplicated.length > 0) {
    findings.push({
      id: "actividades-duplicadas",
      severity: "media",
      title: `${duplicated.length} nombre(s) de actividad repetidos dentro de un mismo subproceso`,
      detail: duplicated.map(([key]) => key.split("::")[1]).slice(0, 5).join(" · "),
      tip: "Verifica si son pasos realmente distintos que deberían tener nombres diferenciados, o si es una duplicación por captura.",
    });
  }

  // 7. Actividades largas y frecuentes (candidatas a rediseño)
  const heavyFrequent = activeActivities.filter((a) => {
    const freq = String(a.frequencyType || "").toLowerCase();
    return (a.durationMinutes || 0) >= 180 && (freq.includes("diaria") || freq.includes("semanal"));
  });
  if (heavyFrequent.length > 0) {
    findings.push({
      id: "actividades-pesadas",
      severity: "alta",
      title: `${heavyFrequent.length} actividad(es) de alta duración con frecuencia Diaria/Semanal`,
      detail: heavyFrequent
        .slice(0, 5)
        .map((a) => `${a.name} (${a.timeHours}h, ${a.frequencyType})`)
        .join(" · "),
      tip: "Estas actividades pesan mucho en la capacidad del equipo por repetirse seguido. Son las candidatas más rentables para rediseñar o automatizar primero.",
    });
  }

  // 8. Actividades inactivas
  const inactive = activities.filter((a) => a.active === false);
  if (inactive.length > 0) {
    findings.push({
      id: "actividades-inactivas",
      severity: "info",
      title: `${inactive.length} actividad(es) marcadas como inactivas en este proceso`,
      detail: inactive.slice(0, 5).map((a) => a.name).join(" · "),
      tip: "Confirma si deben seguir existiendo como referencia histórica o si conviene eliminarlas para simplificar el diseño.",
    });
  }

  return findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export default function OrgDesignAssistant({ processName, activities = [], subprocesses = [], processRoles = [] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("hallazgos");
  const [expandedId, setExpandedId] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);

  const findings = useMemo(
    () => computeFindings({ activities, subprocesses, processRoles }),
    [activities, subprocesses, processRoles]
  );

  const topic = GUIDE_TOPICS.find((t) => t.id === activeTopic) || null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700"
        aria-label="Abrir asistente de diseño organizacional"
        title="Asistente de diseño organizacional"
      >
        <span className="text-xl">✦</span>
        {!open && findings.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-red-600 shadow">
            {findings.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex max-h-[75vh] w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-[#071226] px-4 py-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Asistente de diseño</div>
              <div className="text-[11px] text-gray-400">{processName || "Proceso"}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-lg bg-white/10 text-sm font-black text-white hover:bg-white/20"
              aria-label="Cerrar asistente"
            >
              ×
            </button>
          </div>

          <div className="flex border-b border-gray-200 text-[11px] font-black uppercase tracking-wide">
            <button
              type="button"
              onClick={() => setTab("hallazgos")}
              className={`flex-1 px-3 py-2 ${tab === "hallazgos" ? "bg-red-600 text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"}`}
            >
              Hallazgos {findings.length > 0 ? `(${findings.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setTab("guia")}
              className={`flex-1 px-3 py-2 ${tab === "guia" ? "bg-red-600 text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"}`}
            >
              Guía
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {tab === "hallazgos" && (
              <div className="space-y-2">
                {findings.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-700">
                    No se detectaron hallazgos relevantes en este proceso con las reglas actuales. ¡Buen trabajo!
                  </div>
                ) : (
                  findings.map((finding) => {
                    const isExpanded = expandedId === finding.id;
                    return (
                      <button
                        key={finding.id}
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${SEVERITY_STYLE[finding.severity]}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest">{SEVERITY_LABEL[finding.severity]}</span>
                          <span className="text-[10px] font-bold">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                        <div className="mt-1 text-[12px] font-black leading-snug">{finding.title}</div>
                        {isExpanded && (
                          <div className="mt-2 space-y-1.5 border-t border-black/10 pt-2">
                            {finding.detail && <div className="text-[11px] text-gray-700">{finding.detail}</div>}
                            <div className="text-[11px] font-semibold text-gray-600">{finding.tip}</div>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {tab === "guia" && (
              <div className="space-y-2">
                {GUIDE_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTopic(t.id === activeTopic ? null : t.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-[12px] font-bold transition ${
                      activeTopic === t.id ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50 text-gray-700 hover:border-red-200"
                    }`}
                  >
                    {t.question}
                  </button>
                ))}
                {topic && (
                  <div className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] font-semibold leading-relaxed text-gray-600">
                    {topic.answer}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-3 py-2 text-[9px] leading-snug text-gray-400">
            Asistente basado en reglas locales, sin IA generativa ni envío de datos externos.
          </div>
        </div>
      )}
    </>
  );
}
