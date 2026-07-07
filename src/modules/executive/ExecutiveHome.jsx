import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../services/supabase";

const DEFAULT_WEEKLY_CAPACITY = 48;
const SIG_PROGRESS_FALLBACK = 38;
const CLOSED_DECISION_STATES = [
  "cerrada",
  "cerrado",
  "decidida",
  "decidido",
  "resuelta",
  "resuelto",
  "ejecutada",
  "ejecutado",
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getRecordId(record) {
  return record?.id ?? record?.actividad_id ?? record?.activityId ?? null;
}

function isActiveRecord(record, field = "activo") {
  if (!record) return false;
  if (record[field] === false) return false;
  if (record.activa === false) return false;
  if (record.activo === false) return false;
  const state = normalizeText(record.estado || record.status);
  return !["inactiva", "inactive", "cancelada", "cancelado", "cerrada", "cerrado"].includes(state);
}

function getDurationHours(activity) {
  const minutes = toNumber(
    activity?.duracion_minutos ??
      activity?.durationMinutes ??
      activity?.duration ??
      activity?.minutos,
    0
  );

  if (minutes > 0) return minutes / 60;

  return toNumber(
    activity?.horas_planificadas ?? activity?.carga_horas ?? activity?.horas,
    0
  );
}

function getPlannedHours(record) {
  const hours = toNumber(record?.horas_planificadas ?? record?.hours, 0);
  if (hours > 0) return hours;
  return getDurationHours(record);
}

function formatHours(value) {
  return `${toNumber(value, 0).toFixed(1)} h`;
}

function formatPercent(value) {
  return `${Math.round(toNumber(value, 0))}%`;
}

function getPersonWeeklyCapacity(person) {
  const dailyFields = [
    "horas_lunes",
    "horas_martes",
    "horas_miercoles",
    "horas_jueves",
    "horas_viernes",
  ];

  const dailyTotal = dailyFields.reduce(
    (sum, field) => sum + toNumber(person?.[field], 0),
    0
  );

  return dailyTotal > 0 ? dailyTotal : DEFAULT_WEEKLY_CAPACITY;
}

function getUserPersonId(currentUser) {
  return currentUser?.persona_id ?? currentUser?.personaId ?? currentUser?.person_id ?? null;
}

function getUserDisplayName(currentUser, person) {
  return (
    cleanText(person?.nombre) ||
    cleanText(currentUser?.persona_nombre) ||
    cleanText(currentUser?.nombre) ||
    cleanText(currentUser?.usuario) ||
    "Usuario"
  );
}

function activityMatchesRoleLink(activity, roleLink) {
  const activityRole = normalizeText(activity?.rol || activity?.puesto || activity?.responsable);
  const linkRole = normalizeText(roleLink?.rol || roleLink?.role || roleLink?.puesto);
  const activityProcess = normalizeText(activity?.proceso);
  const linkProcess = normalizeText(roleLink?.proceso);

  if (!activityRole || !linkRole || activityRole !== linkRole) return false;
  if (linkProcess && activityProcess && linkProcess !== activityProcess) return false;
  return true;
}

function getProcessName(item) {
  return cleanText(item?.proceso || item?.nombre || item?.name) || "Sin proceso";
}

function getDecisionState(decision) {
  return normalizeText(decision?.estado || decision?.status || decision?.estatus);
}

function KpiCard({ label, value, note, tone = "blue", onClick }) {
  const tones = {
    blue: "border-cyan-100 bg-cyan-50/50 text-cyan-700",
    green: "border-emerald-100 bg-emerald-50/60 text-emerald-700",
    amber: "border-amber-100 bg-amber-50/60 text-amber-700",
    red: "border-red-100 bg-red-50/60 text-red-700",
    slate: "border-slate-200 bg-white text-slate-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all ${tones[tone] || tones.slate}`}
    >
      <div className="text-[10px] uppercase tracking-[2px] font-black text-gray-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black text-[#071226]">{value}</div>
      <div className="mt-1 text-xs font-semibold text-gray-500 leading-snug">
        {note}
      </div>
    </button>
  );
}

function StatusPill({ status }) {
  const normalized = normalizeText(status);
  const className = normalized.includes("crit")
    ? "bg-red-100 text-red-700 border-red-200"
    : normalized.includes("atencion") || normalized.includes("parcial")
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-emerald-100 text-emerald-700 border-emerald-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${className}`}>
      {status}
    </span>
  );
}

export default function ExecutiveHome({ currentUser }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceData, setSourceData] = useState({
    people: [],
    roleLinks: [],
    activities: [],
    weeklyPlans: [],
    monthlyPlans: [],
    processes: [],
    subprocesses: [],
    decisions: [],
  });

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      setLoading(true);
      setError("");

      const requests = await Promise.allSettled([
        supabase
          .from("personas")
          .select("id,nombre,horas_lunes,horas_martes,horas_miercoles,horas_jueves,horas_viernes,activo,tipo"),
        supabase
          .from("persona_roles")
          .select("id,persona_id,proceso,rol,activo"),
        supabase
          .from("proceso_actividades")
          .select("*"),
        supabase
          .from("workload_plan_semanal_detalle")
          .select("*"),
        supabase
          .from("workload_plan_mensual")
          .select("*"),
        supabase
          .from("procesos")
          .select("*"),
        supabase
          .from("subprocesos")
          .select("*"),
        supabase
          .from("decisiones_estrategicas")
          .select("*"),
      ]);

      const [people, roleLinks, activities, weeklyPlans, monthlyPlans, processes, subprocesses, decisions] = requests.map(
        (result) => {
          if (result.status === "rejected") {
            console.error("Error cargando inicio ejecutivo:", result.reason);
            return [];
          }

          if (result.value?.error) {
            console.error("Error Supabase inicio ejecutivo:", result.value.error);
            return [];
          }

          return safeArray(result.value?.data);
        }
      );

      if (!mounted) return;

      setSourceData({
        people,
        roleLinks,
        activities,
        weeklyPlans,
        monthlyPlans,
        processes,
        subprocesses,
        decisions,
      });
      setError(requests.some((result) => result.status === "rejected" || result.value?.error) ? "Algunos indicadores no pudieron cargarse." : "");
      setLoading(false);
    }

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, []);

  const dashboard = useMemo(() => {
    const personId = getUserPersonId(currentUser);
    const person = safeArray(sourceData.people).find(
      (item) => String(item.id) === String(personId)
    );
    const personName = getUserDisplayName(currentUser, person);
    const isPersonalView = Boolean(personId);

    const activeRoleLinks = safeArray(sourceData.roleLinks).filter((link) => {
      if (!isActiveRecord(link, "activo")) return false;
      if (!personId) return true;
      return String(link.persona_id) === String(personId);
    });

    const allActivities = safeArray(sourceData.activities);
    const relevantActivities = personId
      ? allActivities.filter((activity) =>
          activeRoleLinks.some((link) => activityMatchesRoleLink(activity, link))
        )
      : allActivities;

    const activeActivities = relevantActivities.filter((activity) => isActiveRecord(activity, "activa"));
    const inactiveActivities = relevantActivities.filter((activity) => !isActiveRecord(activity, "activa"));

    const weeklyPlans = safeArray(sourceData.weeklyPlans).filter((plan) => {
      if (!isActiveRecord(plan, "activo")) return false;
      if (!personId) return true;
      return String(plan.persona_id ?? plan.personaId ?? "") === String(personId);
    });

    const monthlyPlans = safeArray(sourceData.monthlyPlans).filter((plan) => {
      if (!isActiveRecord(plan, "activo")) return false;
      if (!personId) return true;
      return String(plan.persona_id ?? plan.personaId ?? "") === String(personId);
    });

    const scheduledIds = new Set(
      [...weeklyPlans, ...monthlyPlans]
        .map((plan) => plan.actividad_id ?? plan.activity_id ?? plan.actividadId)
        .filter((id) => id !== null && id !== undefined)
        .map(String)
    );

    const scheduledActivities = activeActivities.filter((activity) => scheduledIds.has(String(getRecordId(activity))));
    const pendingActivities = activeActivities.filter((activity) => !scheduledIds.has(String(getRecordId(activity))));

    const weeklyPlannedHours = weeklyPlans.reduce((sum, plan) => sum + getPlannedHours(plan), 0);
    const monthlySpecificHours = monthlyPlans.reduce((sum, plan) => sum + getPlannedHours(plan), 0);
    const weeklyCapacity = getPersonWeeklyCapacity(person);
    const utilization = weeklyCapacity > 0 ? (weeklyPlannedHours / weeklyCapacity) * 100 : 0;

    const processMap = new Map();

    activeRoleLinks.forEach((link) => {
      const name = getProcessName(link);
      if (!processMap.has(name)) {
        processMap.set(name, {
          name,
          roles: new Set(),
          total: 0,
          active: 0,
          inactive: 0,
          critical: 0,
          estimatedHours: 0,
          subprocesses: 0,
        });
      }
      const process = processMap.get(name);
      if (cleanText(link.rol)) process.roles.add(cleanText(link.rol));
    });

    relevantActivities.forEach((activity) => {
      const name = getProcessName(activity);
      if (!processMap.has(name)) {
        processMap.set(name, {
          name,
          roles: new Set(),
          total: 0,
          active: 0,
          inactive: 0,
          critical: 0,
          estimatedHours: 0,
          subprocesses: 0,
        });
      }

      const process = processMap.get(name);
      process.total += 1;
      if (cleanText(activity.rol)) process.roles.add(cleanText(activity.rol));
      if (isActiveRecord(activity, "activa")) {
        process.active += 1;
        process.estimatedHours += getDurationHours(activity);
      } else {
        process.inactive += 1;
      }
      const criticality = normalizeText(activity.criticidad || activity.prioridad);
      if (criticality.includes("alta") || criticality.includes("crit")) {
        process.critical += 1;
      }
    });

    safeArray(sourceData.subprocesses).forEach((subprocess) => {
      const name = getProcessName(subprocess);
      if (processMap.has(name) && isActiveRecord(subprocess, "activo")) {
        processMap.get(name).subprocesses += 1;
      }
    });

    const processStatus = Array.from(processMap.values())
      .map((process) => {
        const health = process.total > 0 ? (process.active / process.total) * 100 : 0;
        const status = process.critical > 0 || process.inactive > 0
          ? "Atención"
          : health >= 85
            ? "Estable"
            : "Diseño parcial";
        return {
          ...process,
          health,
          status,
          rolesCount: process.roles.size,
        };
      })
      .sort((a, b) => b.critical - a.critical || b.active - a.active || a.name.localeCompare(b.name))
      .slice(0, 6);

    const openDecisions = safeArray(sourceData.decisions).filter((decision) => {
      const state = getDecisionState(decision);
      return !CLOSED_DECISION_STATES.includes(state);
    });

    const processHealth = relevantActivities.length > 0
      ? (activeActivities.length / relevantActivities.length) * 100
      : processStatus.length > 0
        ? 70
        : 0;
    const loadHealth = utilization <= 75 ? 100 : utilization <= 85 ? 85 : utilization <= 100 ? 65 : 40;
    const decisionHealth = Math.max(45, 100 - openDecisions.length * 8);
    const sigProgress = SIG_PROGRESS_FALLBACK;
    const globalPerformance = Math.round(
      processHealth * 0.35 + loadHealth * 0.25 + sigProgress * 0.25 + decisionHealth * 0.15
    );

    const plannedCoverage = activeActivities.length > 0
      ? (scheduledActivities.length / activeActivities.length) * 100
      : 0;

    const alerts = [];
    if (utilization > 90) alerts.push({ text: "Carga semanal crítica", route: "/workload-balance", tone: "red" });
    else if (utilization > 75) alerts.push({ text: "Carga semanal en atención", route: "/workload-balance", tone: "amber" });
    if (pendingActivities.length > 0) alerts.push({ text: `${pendingActivities.length} actividades pendientes de programar`, route: "/workload-balance", tone: "amber" });
    if (inactiveActivities.length > 0) alerts.push({ text: `${inactiveActivities.length} actividades inactivas o detenidas`, route: "/capacity", tone: "slate" });
    if (openDecisions.length > 0) alerts.push({ text: `${openDecisions.length} decisiones abiertas`, route: "/decision-center", tone: "red" });
    if (!alerts.length) alerts.push({ text: "Sin alertas críticas visibles", route: "/performance", tone: "green" });

    return {
      personName,
      isPersonalView,
      weeklyCapacity,
      weeklyPlannedHours,
      monthlySpecificHours,
      utilization,
      processStatus,
      globalPerformance,
      sigProgress,
      processHealth,
      plannedCoverage,
      openDecisionsCount: openDecisions.length,
      activeActivitiesCount: activeActivities.length,
      inactiveActivitiesCount: inactiveActivities.length,
      pendingActivitiesCount: pendingActivities.length,
      roleCount: activeRoleLinks.length,
      alerts: alerts.slice(0, 4),
    };
  }, [currentUser, sourceData]);

  const utilizationTone = dashboard.utilization > 90 ? "red" : dashboard.utilization >= 75 ? "amber" : "green";
  const utilizationBar = Math.min(100, Math.max(0, dashboard.utilization));

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] uppercase tracking-[3px] font-black text-gray-400">Inicio ejecutivo</div>
        <div className="mt-3 text-2xl font-black text-[#071226]">Cargando lectura del portal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error} La vista se muestra con la información disponible.
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#071226] px-6 py-4 text-white">
            <div className="text-[10px] uppercase tracking-[3px] font-black text-gray-300">
              Status general {dashboard.isPersonalView ? "del usuario" : "organizacional"}
            </div>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-black leading-tight">{dashboard.personName}</h2>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">
                {dashboard.roleCount} roles activos
              </span>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              label="Desempeño global"
              value={formatPercent(dashboard.globalPerformance)}
              note="Lectura combinada de procesos, carga, SIG y decisiones."
              tone={dashboard.globalPerformance >= 75 ? "green" : dashboard.globalPerformance >= 60 ? "amber" : "red"}
              onClick={() => navigate("/performance")}
            />
            <KpiCard
              label="Estado de procesos"
              value={formatPercent(dashboard.processHealth)}
              note={`${dashboard.activeActivitiesCount} activas · ${dashboard.inactiveActivitiesCount} en pausa`}
              tone={dashboard.processHealth >= 80 ? "green" : "amber"}
              onClick={() => navigate("/capacity")}
            />
            <KpiCard
              label="Carga semanal"
              value={formatHours(dashboard.weeklyPlannedHours)}
              note={`${formatPercent(dashboard.utilization)} de ${formatHours(dashboard.weeklyCapacity)} disponibles`}
              tone={utilizationTone}
              onClick={() => navigate("/workload-balance")}
            />
            <KpiCard
              label="Progreso SIG"
              value={formatPercent(dashboard.sigProgress)}
              note="Calificación global del diagnóstico SIG."
              tone={dashboard.sigProgress >= 75 ? "green" : dashboard.sigProgress >= 50 ? "amber" : "red"}
              onClick={() => navigate("/sig")}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-[10px] uppercase tracking-[3px] font-black text-gray-400">Carga resumida</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-black text-[#071226]">{formatPercent(dashboard.utilization)}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">Uso semanal planificado</div>
            </div>
            <StatusPill status={dashboard.utilization > 90 ? "Crítico" : dashboard.utilization >= 75 ? "Atención" : "Dentro del límite"} />
          </div>
          <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${dashboard.utilization > 90 ? "bg-red-500" : dashboard.utilization >= 75 ? "bg-amber-400" : "bg-emerald-400"}`}
              style={{ width: `${utilizationBar}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-[10px] uppercase tracking-[2px] font-black text-gray-400">Semana</div>
              <div className="mt-1 text-xl font-black text-[#071226]">{formatHours(dashboard.weeklyPlannedHours)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-[10px] uppercase tracking-[2px] font-black text-gray-400">Mes específico</div>
              <div className="mt-1 text-xl font-black text-[#071226]">{formatHours(dashboard.monthlySpecificHours)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/workload-balance")}
            className="mt-4 w-full rounded-2xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-700 transition-all"
          >
            Ver balance de carga
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-5">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-[3px] font-black text-gray-400">Estado de mis procesos</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">Procesos vinculados a los roles del usuario.</div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/capacity")}
              className="rounded-xl bg-[#071226] px-4 py-2 text-xs font-black text-white hover:bg-red-600 transition-all"
            >
              Abrir diseño
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {dashboard.processStatus.length > 0 ? (
              dashboard.processStatus.map((process) => (
                <div key={process.name} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 px-5 py-3 items-center">
                  <div className="min-w-0">
                    <div className="font-black text-[#071226] leading-snug">{process.name}</div>
                    <div className="mt-1 text-xs font-semibold text-gray-500">
                      {process.rolesCount} roles · {process.subprocesses} subprocesos · {process.active}/{process.total} actividades activas
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-sm font-black text-[#071226]">{formatHours(process.estimatedHours)}</div>
                    <div className="text-[10px] uppercase tracking-wide font-black text-gray-400">Carga base</div>
                  </div>
                  <StatusPill status={process.status} />
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-sm font-semibold text-gray-500">
                No hay procesos vinculados al usuario activo. Revisa sus roles en el catálogo de personas.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-3">
            <div className="text-[10px] uppercase tracking-[3px] font-black text-gray-400">Focos de atención</div>
            <div className="mt-1 text-xs font-semibold text-gray-500">Lo más importante para decidir rápido.</div>
          </div>

          <div className="p-4 space-y-2">
            {dashboard.alerts.map((alert) => (
              <button
                type="button"
                key={alert.text}
                onClick={() => navigate(alert.route)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-black text-[#071226] hover:border-red-200 hover:bg-red-50 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{alert.text}</span>
                  <span className="text-red-600">→</span>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 p-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate("/workload-balance")}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black hover:bg-gray-50"
            >
              {formatPercent(dashboard.plannedCoverage)} programado
            </button>
            <button
              type="button"
              onClick={() => navigate("/decision-center")}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black hover:bg-gray-50"
            >
              {dashboard.openDecisionsCount} decisiones
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
