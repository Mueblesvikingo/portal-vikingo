import React, { useEffect, useMemo, useRef, useState } from "react";
import { cancelAssignment, confirmMeetingAttendance, createWorkloadAssignment, createWorkloadSourceActivity, deleteAssignment, deleteSavedWorkloadPlan, finalizeAssignment, findExistingSavedMonth, findExistingSavedWeek, getLiderProcesoOverrides, getSavedMonthlyPlans, getSavedWeeklyPlans, getWorkloadActivities, getWorkloadAssignments, getWorkloadMonthlyPlans, getWorkloadPeople, getWorkloadPersonRoles, getWorkloadWeeklyPlans, moveMonthlyPlanActivity, moveWeeklyPlanActivity, pauseAssignment, programAssignmentHours, reactivateAssignment, recalculateAssignmentHours, removeMonthlyPlanActivity, removeWeeklyPlanActivity, saveWorkloadPlan, scheduleActivityInMonthlyPlan, scheduleActivityInWeeklyPlan, updateMonthlyPlanHours, updateMonthlyPlanOrder, updateSavedWorkloadPlan, updateWeeklyPlanHours, updateWeeklyPlanOrder, updateWorkloadAssignment, updateWorkloadSourceActivity, upsertLiderProcesoOverride } from "../services/workloadService";
import { hasWorkloadFullAccess, canEditWorkloadPendingActivities, canEditWorkloadForPersonRoles, isStrategicTeamMember } from "../services/permissionsService";
import { updateActivitySemaforo } from "../services/organizationalDesignService";
import SemaforoDot from "../shared/components/SemaforoDot";

const WORKLOAD_VIDEO_URL =
  "https://www.youtube.com/embed/bun2Ku2R1JI?autoplay=1&rel=0&modestbranding=1";
const WORKLOAD_MANUAL_URL = "/manuales/Balance_de_Carga.pdf";
// Video/manual específicos de la pestaña Asignaciones (independientes del
// video/manual general del módulo). El equipo estratégico ve un recurso;
// el resto de los usuarios ve otro (ver isStrategicTeamMember más abajo).
const ASSIGNMENTS_VIDEO_URL_STRATEGIC = "/videos/Planeacion_de_Iniciativas.mp4";
const ASSIGNMENTS_MANUAL_URL_STRATEGIC = "/manuales/Strategic_Capacity_Execution.pdf";
const ASSIGNMENTS_VIDEO_TITLE_STRATEGIC = "Planeación de Iniciativas";
const ASSIGNMENTS_VIDEO_URL_DEFAULT =
  "https://www.youtube.com/embed/vY0MAsijAys?autoplay=1&rel=0&modestbranding=1";
const ASSIGNMENTS_MANUAL_URL_DEFAULT = "/manuales/Arquitectura_del_Tiempo.pdf";
const ASSIGNMENTS_VIDEO_TITLE_DEFAULT = "Arquitectura del Tiempo";
function isEmbeddedVideoUrl(url) {
  return /^https?:\/\//.test(url || "");
}

const MONTHLY_CAPACITY_HOURS = 192;
const WEEKLY_CAPACITY_HOURS = 48;
const DAILY_CAPACITY_MINUTES = 570;
const DAILY_CAPACITY_HOURS = DAILY_CAPACITY_MINUTES / 60;
const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_CAPACITY_FIELD_MAP = {
  Lunes: "horas_lunes",
  Martes: "horas_martes",
  Miércoles: "horas_miercoles",
  Jueves: "horas_jueves",
  Viernes: "horas_viernes",
};
const SOURCE_TYPES = ["Proceso", "Proyecto", "Mejora", "Formación", "Eventual", "Reunión", "Tarea"];
const SOURCE_CHART_COLORS = {
  Proceso: "#8ECDF8",
  Proyecto: "#B9A7F5",
  Mejora: "#9BE7C4",
  Formación: "#FDBA8C",
  Eventual: "#CBD5E1",
  Reunión: "#FCA5A5",
  Tarea: "#FCD34D",
};
const SOURCE_TEXT_COLORS = {
  Proceso: "#075985",
  Proyecto: "#5B21B6",
  Mejora: "#047857",
  Formación: "#C2410C",
  Eventual: "#475569",
  Reunión: "#B91C1C",
  Tarea: "#B45309",
};
const WEEK_VISIBLE_TYPES = ["Proceso", "Proyecto", "Formación", "Tarea", "Reunión"];
const MONTH_MATRIX_ROWS = ["Procesos", "Proyectos", "Formación"];
const ASSIGNMENT_TYPES = ["Proyecto", "Iniciativa estratégica", "Mejora", "Actividad extraordinaria", "Reunión recurrente", "Actividad especial", "Capacitación extraordinaria", "Iniciativa", "Auditoría", "Reunión", "Evento"];
const ASSIGNMENT_PRIORITIES = ["Alta", "Media", "Baja", "Crítica"];
const ASSIGNMENT_CHANNELS = ["Planner", "Teams", "ClickUp", "Otro", "No aplica", "SharePoint", "Outlook", "Sala de juntas"];
const ASSIGNMENT_SCHEDULE_DESTINATIONS = [
  { value: "weekly-standard", label: "Semana típica" },
  { value: "monthly-standard", label: "Mes típico" },
  { value: "weekly-planning", label: "Planeación semanal" },
  { value: "monthly-planning", label: "Planeación mensual" },
];
const ASSIGNMENT_SCHEDULE_ORIGINS = ["Procesos", "Proyectos", "Formación", "Mejora", "Eventual"];
const ASSIGNMENT_STRATEGIC_ORIGINS = ["Estrategia", "Balance de carga", "Operación", "Auditoría", "Indicadores", "Riesgo", "Mejora continua", "Dirección"];
const PROJECT_STATE_OPTIONS = ["Pendiente", "En ejecución", "En pausa", "Finalizado", "Cancelado"];
const SCHEDULING_STATE_OPTIONS = ["Sin programar", "Programado parcialmente", "Totalmente programado", "Programación suspendida", "Completado"];
function getProjectStateStyle(state) {
  if (state === "En ejecución") return "border-sky-200 bg-sky-50 text-sky-700";
  if (state === "En pausa") return "border-slate-300 bg-slate-100 text-slate-600";
  if (state === "Finalizado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "Cancelado") return "border-red-200 bg-red-50 text-red-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}
function getSchedulingStateStyle(state) {
  if (state === "Totalmente programado" || state === "Completado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "Programado parcialmente") return "border-sky-200 bg-sky-50 text-sky-700";
  if (state === "Programación suspendida") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}
function canProgramAssignment(assignment) {
  return !["En pausa", "Finalizado", "Cancelado"].includes(assignment?.estadoProyecto);
}

const demoSeeds = [
  [1, "Proceso", "Validar información del pedido", "Laura Martínez", "Jefe de Calidad", 90, "Lunes"],
  [2, "Proceso", "Verificar producto terminado", "Laura Martínez", "Jefe de Calidad", 120, "Lunes"],
  [3, "Proceso", "Actualizar matriz de riesgos", "Laura Martínez", "Coordinador SIG", 95, "Lunes"],
  [4, "Proyecto", "Configurar flujo comercial", "Laura Martínez", "Coordinador SIG", 140, "Lunes"],
  [5, "Formación", "Microformación de líderes de proceso", "Laura Martínez", "Capacitador interno", 105, "Lunes"],
  [6, "Proceso", "Revisar cartera de prospectos", "Carlos Hernández", "Analista comercial", 90, "Martes"],
  [7, "Proceso", "Revisar salidas de transporte", "Ana Torres", "Coordinador de logística", 110, "Martes"],
  [8, "Proceso", "Dar seguimiento a acción correctiva", "Laura Martínez", "Jefe de Calidad", 90, "Martes"],
  [9, "Proyecto", "Actualizar matriz de procesos", "Laura Martínez", "Coordinador SIG", 160, "Martes"],
  [10, "Formación", "Sesión práctica de Microsoft 365", "Laura Martínez", "Capacitador interno", 115, "Martes"],
  [11, "Proceso", "Actualizar indicadores de calidad", "Laura Martínez", "Jefe de Calidad", 85, "Miércoles"],
  [12, "Proceso", "Revisar solicitudes de compra", "María López", "Compras", 95, "Miércoles"],
  [13, "Proceso", "Confirmar evidencias de entrega", "Ana Torres", "Coordinador de logística", 110, "Miércoles"],
  [14, "Proyecto", "Validar módulo de capacidad", "Laura Martínez", "Coordinador SIG", 180, "Miércoles"],
  [15, "Formación", "Entrenamiento corto en HSEQ", "Laura Martínez", "Capacitador interno", 95, "Miércoles"],
  [16, "Proceso", "Revisar corte diario", "Sofía Rivera", "Administración", 80, "Jueves"],
  [17, "Proceso", "Auditar diferencias de inventario", "Pedro Sánchez", "Auditor de inventarios", 115, "Jueves"],
  [18, "Proceso", "Revisar procedimiento P-HSEQ-01", "Laura Martínez", "Coordinador SIG", 95, "Jueves"],
  [19, "Proyecto", "Diseñar flujo de viáticos", "Laura Martínez", "Coordinador SIG", 190, "Jueves"],
  [20, "Formación", "Formación interna de control documental", "Laura Martínez", "Capacitador interno", 90, "Jueves"],
  [21, "Proceso", "Validar asistencia de capacitación", "Daniela Cruz", "Recursos humanos", 85, "Viernes"],
  [22, "Proceso", "Revisar checklist de proceso", "Laura Martínez", "Jefe de Calidad", 95, "Viernes"],
  [23, "Proceso", "Registrar hallazgo de seguridad", "Laura Martínez", "Coordinador HSEQ", 105, "Viernes"],
  [24, "Proyecto", "Integrar datos de huella de carbono", "Laura Martínez", "Coordinador SIG", 190, "Viernes"],
  [25, "Formación", "Evaluación semanal de aprendizaje", "Laura Martínez", "Capacitador interno", 105, "Viernes"],
];

const demoActivities = demoSeeds.map(([id, origen, actividad, persona, rol, duracionMinutos, diaTipico, dias]) => ({
  id,
  origen,
  proceso: origen === "Proyecto" ? "Proyecto Estratégico" : origen === "Mejora" ? "Mejora Continua" : origen === "Eventual" ? "Solicitud Eventual" : "Proceso Operativo",
  subproceso: "Bloque semanal",
  actividad,
  persona,
  rol,
  responsable: persona,
  cargaSemanal: Number((duracionMinutos / 60).toFixed(2)),
  cargaMensual: Number(((duracionMinutos / 60) * 4).toFixed(2)),
  duracionMinutos,
  diaTipico,
  programaciones: dias?.map((dia, index) => ({ diaTipico: dia, orden: id * 10 + index })),
  semanaTipica: `Semana ${((id - 1) % 4) + 1}`,
  fecha: "2025-08-04",
  estadoAgenda: id % 3 === 0 ? "Pendiente" : "Programada",
}));

function safeArray(value) { return Array.isArray(value) ? value : []; }
function readStoredArray(key, fallback = []) {
  try {
    if (typeof window === "undefined") return fallback;
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function writeStoredArray(key, value) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(safeArray(value)));
  } catch {
    // Local storage is a convenience cache; ignore quota/private-mode failures.
  }
}
function getScopedStorageKey(baseKey, personId) {
  return `${baseKey}-${cleanText(personId) || "all"}`;
}
function readStoredValue(key, fallback = "") {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeStoredValue(key, value) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage es solo una preferencia de conveniencia; ignorar fallos de cuota/modo privado.
  }
}
// La jornada empieza a la hora que cada persona configure (guardada por
// persona en localStorage, no en Supabase) y a partir de ahí se acumulan
// las duraciones de los bloques, en el mismo orden que ya se muestran en
// Semana típica, para calcular la hora de inicio/fin de cada uno.
function parseTimeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 8 * 60;
  return hours * 60 + minutes;
}
function formatMinutesAsTime(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function formatHours(value) { return `${Number(value || 0).toFixed(1)} h`; }
function getNumericCapacity(value, fallback = DAILY_CAPACITY_HOURS) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}
function getPersonDayCapacityHours(person, dayName) {
  const fieldName = DAY_CAPACITY_FIELD_MAP[dayName];
  return getNumericCapacity(person?.[fieldName], DAILY_CAPACITY_HOURS);
}
function getPersonDayCapacityMinutes(person, dayName) {
  return Math.round(getPersonDayCapacityHours(person, dayName) * 60);
}
function getPersonWeeklyCapacityHours(person) {
  return WEEK_DAYS.reduce((sum, dayName) => sum + getPersonDayCapacityHours(person, dayName), 0);
}
function getPersonMonthlyCapacityHours(person) {
  return getPersonWeeklyCapacityHours(person) * 4;
}
function toDateInputValue(date) { return date.toISOString().slice(0, 10); }
function getCurrentWorkWeekRange() {
  const today = new Date();
  const monday = new Date(today);
  const dayOffset = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - dayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { start: toDateInputValue(monday), end: toDateInputValue(friday) };
}
function getDateDiffDays(startValue, endValue) {
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}
function formatPlanPeriodName(startValue, endValue) {
  if (!startValue) return "Sem sin-fecha";
  const date = new Date(`${startValue}T00:00:00`);
  const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const month = monthNames[date.getMonth()] || "mes";
  return `Sem ${startValue || "sin-fecha"} a ${endValue || "sin-fecha"} (${month})`;
}
function getMonthPlanParts(dateValue) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  return { mes: date.getMonth() + 1, anio: date.getFullYear() };
}
function formatMonthPlanName(mes, anio) {
  return `Mes ${String(mes || "").padStart(2, "0")}/${anio || new Date().getFullYear()}`;
}
function mapSavedWorkloadPlan(plan) {
  const tipoPlan = plan?.tipo_plan || plan?.tipoPlan || "semanal";
  return {
    id: plan?.id,
    tipoPlan,
    personaId: plan?.persona_id || plan?.personaId,
    responsable: plan?.responsable || "",
    name: plan?.nombre || plan?.name || (tipoPlan === "mensual" ? formatMonthPlanName(plan?.mes, plan?.anio) : formatPlanPeriodName(plan?.fecha_inicio, plan?.fecha_fin)),
    blocks: safeArray(plan?.bloques || plan?.blocks),
    completedBlockIds: safeArray(plan?.completados || plan?.completedBlockIds),
    completionSummary: plan?.resumen || plan?.completionSummary || null,
    weekStart: plan?.fecha_inicio || plan?.weekStart || "",
    weekEnd: plan?.fecha_fin || plan?.weekEnd || "",
    month: plan?.mes || plan?.month || null,
    year: plan?.anio || plan?.year || null,
    status: plan?.estado || plan?.status || "Borrador",
    approval: plan?.aprobado_vobo
      ? { status: "Aprobada con VOBO", approvedBy: plan?.aprobado_por || "", approvedRole: plan?.aprobado_rol || "", approvedAt: plan?.aprobado_at || "" }
      : { status: "Pendiente VOBO", approvedBy: "", approvedAt: "" },
    review: plan?.revisado
      ? { status: "Revisada", reviewedBy: plan?.revisado_por || "", reviewedRole: plan?.revisado_rol || "", reviewedAt: plan?.revisado_at || "" }
      : { status: "Pendiente revisión", reviewedBy: "", reviewedRole: "", reviewedAt: "" },
    reviewComment: plan?.comentario_revision || "",
    improvementProposal: plan?.propuesta_mejora || "",
    sourceRecord: plan,
  };
}
function getNextWorkWeekRange(startValue, endValue) {
  const base = endValue ? new Date(`${endValue}T00:00:00`) : startValue ? new Date(`${startValue}T00:00:00`) : new Date();
  const nextMonday = new Date(base);
  const daysUntilNextMonday = ((8 - base.getDay()) % 7) || 7;
  nextMonday.setDate(base.getDate() + daysUntilNextMonday);
  const nextFriday = new Date(nextMonday);
  nextFriday.setDate(nextMonday.getDate() + 4);
  return { start: toDateInputValue(nextMonday), end: toDateInputValue(nextFriday) };
}
function getNextAvailableWorkWeekRange(savedPlans, startValue, endValue) {
  let candidate = getNextWorkWeekRange(startValue, endValue);
  let attempts = 0;
  while (attempts < 52 && safeArray(savedPlans).some((plan) => plan.weekStart === candidate.start && plan.weekEnd === candidate.end)) {
    candidate = getNextWorkWeekRange(candidate.start, candidate.end);
    attempts += 1;
  }
  return candidate;
}
function getDurationMinutes(activity) {
  if (Number(activity?.duracionMinutos) > 0) return Number(activity.duracionMinutos);
  if (Number(activity?.duracionHoras) > 0) return Number(activity.duracionHoras) * 60;
  if (Number(activity?.tiempoPorEjecucion) > 0) return Number(activity.tiempoPorEjecucion) * 60;
  return 60;
}
function getUniqueValues(items, field) { return [...new Set(safeArray(items).map((item) => item?.[field]).filter(Boolean))].sort(); }
function cleanText(value) { return String(value || "").trim(); }
function normalizeText(value) { return cleanText(value).toLowerCase(); }
function isActiveRecord(record, activeField = "activo") {
  if (!record) return false;
  if (record[activeField] === false) return false;
  if (record.activo === false || record.activa === false || record.active === false) return false;
  return true;
}
function firstText(record, fields, fallback = "") {
  const value = fields.map((field) => cleanText(record?.[field])).find(Boolean);
  return value || fallback;
}
function getPersonId(person) { return person?.id ?? person?.persona_id ?? person?.person_id ?? ""; }
function getPersonName(person) { return firstText(person, ["nombre", "name", "persona", "nombre_completo", "full_name"], "Sin nombre"); }
function getPersonRoleName(link) { return firstText(link, ["rol", "role", "roleName", "nombre", "name", "responsable"]); }
function getPersonRoleProcess(link) { return firstText(link, ["proceso", "macroproceso", "process"]); }
function activityMatchesRoleLink(activity, link, { strictLiderProceso = false } = {}) {
  const activityRole = normalizeText(activity?.rol);
  const linkRole = normalizeText(getPersonRoleName(link));
  const linkProcess = normalizeText(getPersonRoleProcess(link));
  const activityProcess = normalizeText(activity?.proceso);

  if (!activityRole || !linkRole || activityRole !== linkRole) return false;

  const isLeaderProcessRole = activityRole === "lider de proceso" || activityRole === "líder de proceso";
  // Cualquier dueño de proceso ve TODAS las actividades de Líder de proceso en
  // Pendientes (visibilidad/coordinación), pero para Capacidad (horas/utilización)
  // solo debe contar el proceso donde esa persona realmente es la líder.
  if (isLeaderProcessRole && !strictLiderProceso) return true;

  return !linkProcess || linkProcess === activityProcess;
}
function getScheduledActivityId(record) {
  return cleanText(record?.proceso_actividad_id ?? record?.actividad_id ?? record?.activity_id ?? record?.source_activity_id ?? record?.actividadId ?? record?.id_actividad ?? "");
}
function collectScheduledActivityIds(plans) {
  const ids = new Set();
  const collect = (record) => {
    const directId = getScheduledActivityId(record);
    if (directId) ids.add(directId);
    safeArray(record?.blocks).forEach(collect);
    safeArray(record?.actividades).forEach(collect);
    safeArray(record?.activities).forEach(collect);
  };

  safeArray(plans).forEach(collect);
  return ids;
}
function getCriticalityRank(value) {
  const normalized = normalizeText(value);
  if (normalized.includes("alta") || normalized.includes("critica") || normalized.includes("crítica")) return 1;
  if (normalized.includes("media")) return 2;
  if (normalized.includes("baja")) return 3;
  return 4;
}
function translateFrequency(value) {
  const normalized = normalizeText(value);
  const labels = {
    monthly: "Mensual",
    semanal: "Semanal",
    weekly: "Semanal",
    daily: "Diaria",
    bimonthly: "Bimestral",
    quarterly: "Trimestral",
    "four-monthly": "Cuatrimestral",
    semiannual: "Semestral",
    biannual: "Semestral",
    annual: "Anual",
    yearly: "Anual",
    event: "Por evento",
  };
  return labels[normalized] || cleanText(value) || "Sin frecuencia";
}
function translateStatus(value) {
  const normalized = normalizeText(value);
  const labels = { active: "Activa", activa: "Activa", inactive: "Inactiva", inactiva: "Inactiva", pending: "Pendiente", pendiente: "Pendiente" };
  return labels[normalized] || cleanText(value) || "Activa";
}
function isInactiveWorkloadActivity(activity) {
  // Una actividad con override personal de Líder de proceso manda su propio
  // estado/activo — no debe quedar atrapada por el activa=false del registro
  // maestro (sourceRecord), que puede estar inactivo por otras razones ajenas
  // a esta persona en particular.
  if (activity?.hasLiderProcesoOverride) {
    return activity?.activa === false;
  }
  const status = normalizeText(activity?.estado || activity?.sourceRecord?.estado || activity?.estadoAgenda);
  return activity?.activa === false || activity?.sourceRecord?.activa === false || status === "inactive" || status === "inactiva";
}
function normalizePendingKeyPart(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
function getPendingActivityKey(activity) {
  return [
    activity?.proceso,
    activity?.rol,
    activity?.actividad,
    getDurationMinutes(activity),
    activity?.frecuencia,
  ].map(normalizePendingKeyPart).join("|");
}
function getPendingActivityUniqueKey(activity) {
  const explicitActivityId = cleanText(
    activity?.actividad_id ||
      activity?.proceso_actividad_id ||
      activity?.source_activity_id ||
      activity?.sourceRecord?.actividad_id ||
      activity?.sourceRecord?.proceso_actividad_id
  );

  return explicitActivityId ? `actividad:${explicitActivityId}` : getPendingActivityKey(activity);
}
function getActivityFlowOrder(activity) {
  const order = Number(activity?.sourceRecord?.orden_flujo ?? activity?.orden);
  return Number.isFinite(order) ? order : 100000;
}
function getPendingActivitySubprocess(activity) {
  return cleanText(activity?.subproceso || activity?.sourceRecord?.subproceso || activity?.sourceRecord?.nombre_subproceso || activity?.sourceRecord?.codigo_subproceso);
}
function getPendingActivityNumber(activity) {
  const value =
    activity?.numeroActividad ??
    activity?.numero_actividad ??
    activity?.sourceRecord?.numero_actividad ??
    activity?.sourceRecord?.numeroActividad ??
    activity?.ordenFlujo ??
    activity?.orden_flujo ??
    activity?.sourceRecord?.orden_flujo ??
    activity?.orden ??
    activity?.sourceRecord?.orden;
  return cleanText(value);
}
function getPendingActivityOperationalOrder(activity) {
  const fields = [
    activity?.ordenFlujo,
    activity?.orden_flujo,
    activity?.sourceRecord?.orden_flujo,
    activity?.orden,
    activity?.sourceRecord?.orden,
    activity?.numeroActividad,
    activity?.numero_actividad,
    activity?.sourceRecord?.numero_actividad,
    activity?.id,
  ];
  const value = fields.map(Number).find((number) => Number.isFinite(number));
  return Number.isFinite(value) ? value : null;
}
function getPendingActivityFrequencyGroup(activity) {
  const frequency = normalizePendingKeyPart(activity?.frecuencia || activity?.sourceRecord?.frecuencia);

  if (["semanal", "weekly", "quincenal", "biweekly", "mensual", "monthly", "diaria", "daily"].includes(frequency)) return "programmable";
  if (
    ["bimestral", "bimonthly", "trimestral", "quarterly", "cuatrimestral", "four-monthly", "semestral", "semiannual", "biannual", "anual", "annual", "yearly"].includes(
      frequency
    )
  )
    return "radar";
  if (["por evento", "eventual", "bajo demanda", "cuando aplique", "event"].includes(frequency)) return "eventual";

  return "programmable";
}
function getPendingActivityPlannedMonth(activity) {
  return cleanText(
    activity?.mesPlaneado ||
      activity?.mes_planeado ||
      activity?.sourceRecord?.mesPlaneado ||
      activity?.sourceRecord?.mes_planeado
  ) || "Sin definir";
}
function normalizePlannedMonthInput(value) {
  const text = cleanText(value);
  if (!text || normalizeText(text) === "sin definir") return "";
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  const parsed = new Date(`${text}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  return "";
}
function formatPlannedMonthLabel(value) {
  const normalized = normalizePlannedMonthInput(value);
  if (!normalized) return "Sin mes previsto";
  const [year, month] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(date);
}
function getMonthsUntilPlannedMonth(value) {
  const normalized = normalizePlannedMonthInput(value);
  if (!normalized) return null;
  const [year, month] = normalized.split("-").map(Number);
  const today = new Date();
  return (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth());
}
function getPlannedMonthStatusText(value) {
  const months = getMonthsUntilPlannedMonth(value);
  if (months === null) return "Pendiente de definir";
  if (months < 0) return `Vencida hace ${Math.abs(months)} ${Math.abs(months) === 1 ? "mes" : "meses"}`;
  if (months === 0) return "Planificar este mes";
  if (months === 1) return "Falta 1 mes";
  return `Faltan ${months} meses`;
}
function getPendingActivityPlannedMonthLabel(activity) {
  const plannedMonth = getPendingActivityPlannedMonth(activity);
  const normalized = normalizePlannedMonthInput(plannedMonth);
  if (!normalized) return "Sin mes previsto";
  return `${formatPlannedMonthLabel(normalized)} · ${getPlannedMonthStatusText(normalized)}`;
}
function comparePendingActivities(a, b) {
  const processDiff = cleanText(a?.proceso).localeCompare(cleanText(b?.proceso));
  if (processDiff !== 0) return processDiff;

  const subprocessDiff = getPendingActivitySubprocess(a).localeCompare(getPendingActivitySubprocess(b));
  if (subprocessDiff !== 0) return subprocessDiff;

  const aOrder = getPendingActivityOperationalOrder(a);
  const bOrder = getPendingActivityOperationalOrder(b);
  if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
  if (aOrder !== null && bOrder === null) return -1;
  if (aOrder === null && bOrder !== null) return 1;

  return Number(a?.id || 0) - Number(b?.id || 0);
}
function selectPendingActivityRepresentative(current, candidate) {
  if (!current) return candidate;
  const currentInactive = isInactiveWorkloadActivity(current);
  const candidateInactive = isInactiveWorkloadActivity(candidate);
  if (currentInactive && !candidateInactive) return candidate;
  if (!currentInactive && candidateInactive) return current;
  return getActivityFlowOrder(candidate) < getActivityFlowOrder(current) ? candidate : current;
}
function dedupePendingActivities(activities) {
  const groupedActivities = new Map();

  safeArray(activities).forEach((activity) => {
    const key = getPendingActivityUniqueKey(activity);
    if (!key) return;
    groupedActivities.set(key, selectPendingActivityRepresentative(groupedActivities.get(key), activity));
  });

  return [...groupedActivities.values()].filter(Boolean);
}
function dedupeByKey(list, keyFn) {
  const seen = new Set();
  return safeArray(list).filter((item) => {
    const key = keyFn(item);
    if (key == null) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
// Filas de `workload_plan_semanal_detalle` duplicadas (misma actividad+día,
// distinto id) producen bloques distintos aunque representen la misma
// programación — se detectan por sourceActivityId+diaTipico, no por
// occurrenceId (que siempre difiere entre filas duplicadas). El resto de
// orígenes (asignaciones, bloques manuales) no sufren este problema y
// conservan su comportamiento previo por occurrenceId/id.
function getAgendaDedupeKey(activity) {
  if (activity?.sourceActivityId != null) {
    return `semana-${activity.sourceActivityId}-${activity.diaTipico}`;
  }
  return activity?.occurrenceId || activity?.id;
}
function translateCriticality(value) {
  const normalized = normalizeText(value);
  const labels = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja" };
  return labels[normalized] || cleanText(value) || "Sin dato";
}
function getPlanPersonId(plan) { return String(plan?.persona_id ?? plan?.person_id ?? ""); }
function getPlanActivityId(plan) { return String(getScheduledActivityId(plan)); }
function getPlanDayName(plan) {
  const value = cleanText(plan?.dia_semana || plan?.dia || plan?.dayName);
  const numericDay = Number(value);
  if (numericDay >= 1 && numericDay <= 5) return WEEK_DAYS[numericDay - 1];
  return value || "Lunes";
}
function getPlannedHours(activity, plan) {
  return Number(plan?.horas_planificadas || plan?.horas || activity?.cargaSemanal || (getDurationMinutes(activity) / 60));
}
function getSortableOrder(record, index = 0) {
  const order = Number(record?.orden ?? record?.monthlyOrder);
  return Number.isFinite(order) && order > 0 ? order : 100000 + index;
}
function getCreatedAtTime(record) {
  const value = Date.parse(record?.created_at || record?.createdAt || "");
  return Number.isFinite(value) ? value : 0;
}
function compareOrderCreated(a, b) {
  const orderDiff = getSortableOrder(a) - getSortableOrder(b);
  if (orderDiff !== 0) return orderDiff;
  const dateDiff = getCreatedAtTime(a) - getCreatedAtTime(b);
  if (dateDiff !== 0) return dateDiff;
  return Number(a?.id || 0) - Number(b?.id || 0);
}
// Resuelve en qué posición del arreglo SIN el elemento arrastrado debe
// insertarse, a partir de un índice expresado sobre el arreglo CON el
// elemento arrastrado todavía en su lugar (que es como los onDrop/menú
// calculan targetIndex hoy). En vez de sumar/restar 1 a mano (fuente del
// bug de "cae una posición más adelante de donde se soltó"), busca por
// identidad cuál es el elemento de referencia y localiza su posición real
// en el arreglo ya sin el elemento arrastrado — así funciona igual de bien
// para moverse dentro del mismo día/semana que para cruzar a otro.
function resolveInsertIndexExcludingSelf(includingSelfList, draggedKey, targetIndex, getKey = (item) => item?.id) {
  const list = safeArray(includingSelfList);
  const clampedTarget = Math.max(0, Math.min(Number(targetIndex) || 0, list.length));
  const withoutSelf = list.filter((item) => getKey(item) !== draggedKey);
  const referenceItem = clampedTarget < list.length ? list[clampedTarget] : null;
  if (!referenceItem || getKey(referenceItem) === draggedKey) return withoutSelf.length;
  const resolvedIndex = withoutSelf.findIndex((item) => getKey(item) === getKey(referenceItem));
  return resolvedIndex === -1 ? withoutSelf.length : resolvedIndex;
}
function sortByOrderCreated(items) {
  return safeArray(items).map((item, index) => ({ ...item, __sortIndex: index })).sort((a, b) => compareOrderCreated(a, b) || a.__sortIndex - b.__sortIndex);
}
function buildOrderUpdates(items) {
  return sortByOrderCreated(items).filter((item) => item?.id).map((item, index) => ({ id: item.id, orden: index + 1 }));
}
function getSourceStyle(source) {
  const styles = {
    Proceso: "bg-sky-50 text-sky-700 border-sky-200", Procesos: "bg-sky-50 text-sky-700 border-sky-200",
    Proyecto: "bg-violet-50 text-violet-700 border-violet-200", Proyectos: "bg-violet-50 text-violet-700 border-violet-200",
    Mejora: "bg-emerald-50 text-emerald-700 border-emerald-200", Formación: "bg-orange-50 text-orange-700 border-orange-200", Eventual: "bg-orange-50 text-orange-700 border-orange-200",
    Reunión: "bg-red-50 text-red-600 border-red-200",
    Tarea: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return styles[source] || "bg-slate-50 text-slate-700 border-slate-200";
}
function getSourceChartColor(source) { return SOURCE_CHART_COLORS[source] || "#64748b"; }
function getSourceTextColor(source) { return SOURCE_TEXT_COLORS[source] || "#334155"; }
function getUtilizationSignal(utilization) {
  if (utilization < 75) return { label: "Dentro del límite", accent: "bg-emerald-300", text: "text-emerald-700", bar: "bg-emerald-300", dot: "bg-emerald-500" };
  if (utilization < 85) return { label: "Atención", accent: "bg-orange-300", text: "text-orange-700", bar: "bg-orange-300", dot: "bg-orange-500" };
  if (utilization <= 90) return { label: "Casi crítico", accent: "bg-red-200", text: "text-red-600", bar: "bg-red-200", dot: "bg-red-400" };
  return { label: "Crítico", accent: "bg-red-500", text: "text-red-700", bar: "bg-red-500", dot: "bg-red-600" };
}
function getCardStyle(source) {
  const styles = {
    Proceso: "border-sky-100 bg-sky-50/60 hover:border-sky-200 hover:bg-sky-50", Procesos: "border-sky-100 bg-sky-50/60 hover:border-sky-200 hover:bg-sky-50",
    Proyecto: "border-violet-200 bg-violet-100/80 hover:border-violet-300 hover:bg-violet-100", Proyectos: "border-violet-200 bg-violet-100/80 hover:border-violet-300 hover:bg-violet-100",
    Formación: "border-orange-100 bg-orange-50/60 hover:border-orange-200 hover:bg-orange-50",
    Tarea: "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
    Reunión: "border-red-200 bg-red-50/70 hover:border-red-300 hover:bg-red-50",
  };
  return styles[source] || "border-slate-100 bg-slate-50/60 hover:border-slate-200";
}
function getCardAccentStyle(source) {
  const styles = {
    Proceso: "bg-sky-100 text-sky-600 border-sky-200", Procesos: "bg-sky-100 text-sky-600 border-sky-200",
    Proyecto: "bg-violet-200 text-violet-700 border-violet-300", Proyectos: "bg-violet-200 text-violet-700 border-violet-300",
    Formación: "bg-orange-100 text-orange-600 border-orange-200",
    Tarea: "bg-slate-100 text-slate-600 border-slate-200",
    Reunión: "bg-red-100 text-red-600 border-red-200",
  };
  return styles[source] || "bg-slate-100 text-slate-600 border-slate-200";
}
function getWorkloadStatus(occupation) {
  const value = Number.isFinite(Number(occupation)) ? Number(occupation) : 0;
  if (value < 80) return { label: "Disponible", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" };
  if (value < 100) return { label: "Cercano al límite", pill: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", bar: "bg-yellow-500" };
  if (value <= 120) return { label: "Sobrecarga moderada", pill: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", bar: "bg-orange-500" };
  return { label: "Sobrecarga crítica", pill: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", bar: "bg-red-500" };
}
function getActivitySchedules(activity) {
  if (Array.isArray(activity?.programaciones) && activity.programaciones.length > 0) {
    return activity.programaciones.map((schedule, index) => ({ ...schedule, orden: Number.isFinite(Number(schedule?.orden)) ? Number(schedule.orden) : Number(activity?.id || 0) * 10 + index }));
  }
  return [{ diaTipico: activity?.diaTipico || "Lunes", orden: Number.isFinite(Number(activity?.orden)) ? Number(activity.orden) : Number(activity?.id || 0) * 10 }];
}
function expandWeeklyOccurrences(activities) {
  return safeArray(activities).flatMap((activity) => getActivitySchedules(activity).map((schedule, index) => ({ ...activity, occurrenceIndex: index, occurrenceId: `${activity?.id || "actividad"}-${index}`, diaTipico: schedule.diaTipico || activity?.diaTipico || "Lunes", orden: Number.isFinite(Number(schedule?.orden)) ? Number(schedule.orden) : Number(activity?.id || 0) * 10 + index, duracionMinutos: getDurationMinutes(activity) })));
}
function getStackBlockHeight(activity) {
  const duration = getDurationMinutes(activity);
  if (duration <= 30) return 28;
  if (duration <= 60) return 50;
  if (duration <= 90) return 80;
  if (duration <= 120) return 115;
  if (duration <= 180) return 160;
  if (duration <= 240) return 220;
  return 260;
}
function groupBySource(activities) {
  const grouped = SOURCE_TYPES.map((source) => ({ source, weekly: 0, monthly: 0 }));
  safeArray(activities).forEach((activity) => {
    const item = grouped.find((group) => group.source === (activity?.origen || "Proceso"));
    if (item) { item.weekly += Number(activity?.cargaSemanal || 0); item.monthly += Number(activity?.cargaMensual || 0); }
  });
  return grouped;
}
function buildTypicalMonth(activities) {
  return ["Semana 1", "Semana 2", "Semana 3", "Semana 4"].map((week) => {
    const weekActivities = safeArray(activities).filter((activity) => activity?.semanaTipica === week);
    const bySource = groupBySource(weekActivities);
    const total = bySource.reduce((sum, item) => sum + item.weekly, 0);
    const occupation = (total / WEEKLY_CAPACITY_HOURS) * 100;
    return { week, bySource, total, occupation, status: getWorkloadStatus(occupation) };
  });
}
function applyScheduleOverrides(activities, overrides) { return safeArray(activities).map((activity) => ({ ...activity, ...(overrides?.[activity?.id] || {}) })); }
function normalizeActivities(activities, scheduleOverrides = {}) {
  return applyScheduleOverrides(activities, scheduleOverrides).map((activity) => ({ ...activity, origen: activity?.origen || "Proceso", persona: activity?.persona || activity?.responsable || "Sin persona asignada", rol: activity?.rol || activity?.responsable || "Sin rol asignado", diaTipico: activity?.diaTipico || "Lunes", semanaTipica: activity?.semanaTipica || "Semana 1", estadoAgenda: activity?.estadoAgenda || "Pendiente", duracionMinutos: getDurationMinutes(activity) }));
}
function getActivityMonthlyOccurrences(frecuencia) {
  const key = normalizeText(frecuencia);
  if (key === "event" || key === "por evento") return 0;
  if (key === "daily" || key === "diaria") return 22;
  if (key === "weekly" || key === "semanal") return 4.33;
  if (key === "biweekly" || key === "quincenal") return 2.16;
  if (key === "quarterly" || key === "trimestral") return 1 / 3;
  if (key === "semiannual" || key === "semestral") return 1 / 6;
  if (key === "annual" || key === "anual") return 1 / 12;
  return 1; // monthly, manual, u otras frecuencias sin equivalencia definida
}
function getManualSourceType(item) {
  const processName = normalizeText(item?.proceso);
  if (processName.includes("formacion manual") || processName.includes("formación manual")) return "Formación";
  if (processName.includes("tarea manual")) return "Tarea";
  if (processName.includes("eventual manual")) return "Proceso";
  if (processName.includes("reunion manual") || processName.includes("reunión manual")) return "Reunión";
  if (processName.includes("proyecto manual")) return "Proyecto";
  return "";
}
function isManualReservationActivity(activity) {
  return normalizeText(activity?.proceso).endsWith("manual");
}
function applyLiderProcesoOverrideToActivity(activity, override) {
  if (!override) return activity;
  const overrideActive = override.activo !== false;
  const overrideFrequency = override.frecuencia || activity.frecuencia;
  return {
    ...activity,
    duracionMinutos: Number(override.duracion_minutos),
    cargaSemanal: Number(override.carga_horas),
    cargaMensual: Number((Number(override.carga_horas) * getActivityMonthlyOccurrences(overrideFrequency)).toFixed(2)),
    estado: overrideActive ? "Activa" : "Inactiva",
    activa: overrideActive,
    frecuencia: overrideFrequency,
    hasLiderProcesoOverride: true,
    excluidoPersonal: override.excluido === true,
    excluidoEn: override.updated_at || null,
    motivoExclusion: override.motivo || null,
  };
}
// El override personal (tabla workload_lider_proceso_overrides) aplica a
// cualquier actividad, no solo a "Líder de proceso": es la forma en que una
// persona oculta/ajusta una actividad SOLO en su propia vista sin tocar la
// actividad maestra ni afectar a otros que compartan el mismo rol.
function getPersonAdjustedActivities(activities, liderProcesoOverrides, personId) {
  return safeArray(activities).map((activity) => {
    const override = safeArray(liderProcesoOverrides).find(
      (item) => String(item.persona_id) === String(personId) && String(item.actividad_id) === String(activity.id)
    );
    return applyLiderProcesoOverrideToActivity(activity, override);
  });
}
function isLiderDeProcesoActivity(activity) {
  const rol = normalizeText(activity?.rol);
  return rol === "lider de proceso" || rol === "líder de proceso";
}
function createManualBlock({ id, dayName, name, duration, type, currentUser, order, personId = "", personName = "" }) {
  const manualProcess = type === "Formación" ? "Formación manual" : type === "Tarea" ? "Tarea manual" : "Proyecto manual";
  const ownerName = personName || currentUser?.name || "Usuario";
  return { id, occurrenceId: `${id}-0`, occurrenceIndex: 0, origen: type, proceso: manualProcess, subproceso: "Reserva de capacidad", actividad: name, persona: ownerName, personaId: personId, rol: "Líder de proceso", responsable: ownerName, cargaSemanal: Number((duration / 60).toFixed(2)), cargaMensual: Number(((duration / 60) * 4).toFixed(2)), duracionMinutos: duration, diaTipico: dayName, orden: order, semanaTipica: "Semana 1", fecha: "Sin fecha", estadoAgenda: "Programada", isManualProject: true };
}
function getWeeksForFrequency(frequency) { if (frequency === "Manual") return []; if (frequency === "Mensual") return [4]; if (frequency === "Quincenal") return [2, 4]; return [1, 2, 3, 4]; }
function getMonthlyBlockWeeks(block) { if (Array.isArray(block?.targetWeeks) && block.targetWeeks.length > 0) return block.targetWeeks; return getWeeksForFrequency(block?.frecuencia); }
function createMonthlyBlock({ id, name, duration, frequency, type, targetWeeks, monthlyOrder, personId = "", personName = "" }) {
  const weeks = targetWeeks || getWeeksForFrequency(frequency);
  const rowType = type === "Proyecto" ? "Proyectos" : type === "Formación" ? "Formación" : "Procesos";
  return { id, origen: rowType, tipoBloque: type, actividad: name, persona: personName, personaId: personId, responsable: personName, rol: rowType === "Procesos" ? "Proceso organizacional" : "Líder de proceso", duracionMinutos: duration, frecuencia: frequency, targetWeeks: weeks, ocurrenciasMes: weeks.length, cargaMensual: Number(((duration * weeks.length) / 60).toFixed(2)), monthlyOrder: Number.isFinite(Number(monthlyOrder)) ? Number(monthlyOrder) : Date.now(), isMonthlyBlock: true };
}
function isMeetingAssignment(assignment) {
  return normalizeText(assignment?.tipo).includes("reuni");
}
function getAssignmentTypeBadgeCategory(tipo) {
  const normalized = normalizeText(tipo);
  if (normalized.includes("reuni")) return "Reunión";
  if (normalized.includes("formaci") || normalized.includes("capacit")) return "Formación";
  if (normalized.includes("mejora")) return "Mejora";
  if (normalized.includes("extraordinari") || normalized.includes("especial")) return "Tarea";
  return "Proyecto";
}
function getAssignmentInfoBlockStyle(tipo) {
  const styles = {
    Proyecto: "border-violet-100 bg-violet-50/70",
    Reunión: "border-red-100 bg-red-50/70",
    Tarea: "border-amber-100 bg-amber-50/70",
    Formación: "border-orange-100 bg-orange-50/70",
    Mejora: "border-emerald-100 bg-emerald-50/70",
  };
  return styles[getAssignmentTypeBadgeCategory(tipo)] || "border-slate-100 bg-slate-50";
}
function getAssignmentDefaultOrigin(type) {
  const normalized = normalizeText(type);
  if (normalized.includes("capacitacion") || normalized.includes("capacitación") || normalized.includes("formacion") || normalized.includes("formación")) return "Formación";
  if (normalized.includes("mejora")) return "Mejora";
  if (normalized.includes("evento") || normalized.includes("eventual") || normalized.includes("reunion") || normalized.includes("reunión")) return "Eventual";
  if (normalized.includes("proceso")) return "Procesos";
  return "Proyectos";
}
function getWeeklyTypeFromAssignmentOrigin(origin) {
  if (origin === "Procesos") return "Proceso";
  if (origin === "Formación") return "Formación";
  if (origin === "Mejora") return "Mejora";
  if (origin === "Eventual") return "Eventual";
  return "Proyecto";
}
function getMonthlyTypeFromAssignmentOrigin(origin) {
  if (origin === "Procesos") return "Proceso";
  if (origin === "Formación") return "Formación";
  return "Proyecto";
}
function buildMonthlyMatrix({ weekOccurrences, monthlyBlocks }) {
  const sourceMap = { Procesos: "Proceso", Proyectos: "Proyecto", Formación: "Formación" };
  return MONTH_MATRIX_ROWS.map((type) => ({
    type,
    weeks: [1, 2, 3, 4].map((weekNumber) => {
      const sourceType = sourceMap[type] || type;
      const baseBlocksForType = safeArray(weekOccurrences).filter((activity) => activity.origen === sourceType);
      const baseMinutes = baseBlocksForType.reduce((sum, activity) => sum + getDurationMinutes(activity), 0);
      const consolidatedBaseBlock = baseBlocksForType.length > 0 ? { id: `${type}-semana-tipica-w${weekNumber}`, monthlyOccurrenceId: `${type}-semana-tipica-w${weekNumber}`, origen: type, actividad: `Carga base de ${type.toLowerCase()}`, rol: "Semana típica consolidada", duracionMinutos: baseMinutes, source: "Semana típica consolidada", isConsolidatedWeeklyBase: true, itemCount: baseBlocksForType.length } : null;
      const additionalBlocks = safeArray(monthlyBlocks).filter((block) => block.origen === type && getMonthlyBlockWeeks(block).includes(weekNumber)).map((block) => ({ ...block, source: "Bloque adicional", monthlyOccurrenceId: `${block.id}-w${weekNumber}`, orden: block.monthlyOrder, created_at: block.monthlyCreatedAt })).sort(compareOrderCreated);
      const blocks = [consolidatedBaseBlock, ...additionalBlocks].filter(Boolean);
      const usedMinutes = blocks.reduce((sum, block) => sum + getDurationMinutes(block), 0);
      return { weekNumber, weekLabel: `Semana ${weekNumber}`, blocks, usedMinutes };
    }),
  }));
}
function runModuleSmokeTests() {
  const occurrences = expandWeeklyOccurrences(demoActivities);
  const typicalMonth = buildTypicalMonth(demoActivities);
  const totalWeekly = groupBySource(demoActivities).reduce((sum, item) => sum + item.weekly, 0);
  const visibleWeek = occurrences.filter((activity) => WEEK_VISIBLE_TYPES.includes(activity.origen));
  const manualProject = createManualBlock({ id: "manual-test", dayName: "Lunes", name: "Portal Estratégico", duration: 120, type: "Proyecto", currentUser: { name: "Laura Martínez" }, order: 10 });
  const manualTraining = createManualBlock({ id: "manual-training-test", dayName: "Martes", name: "Formación ISO", duration: 60, type: "Formación", currentUser: { name: "Laura Martínez" }, order: 20 });
  const monthlyBlock = createMonthlyBlock({ id: "monthly-test", name: "Cierre mensual", duration: 120, frequency: "Mensual", type: "Eventual" });
  const monthlyManual = createMonthlyBlock({ id: "monthly-manual-test", name: "Apoyo puntual", duration: 60, frequency: "Manual", type: "Proyecto", targetWeeks: [1] });
  const matrix = buildMonthlyMatrix({ weekOccurrences: visibleWeek, monthlyBlocks: [monthlyBlock, monthlyManual] });
  const monthlyRow = matrix.find((row) => row.type === "Procesos");
  const projectRow = matrix.find((row) => row.type === "Proyectos");
  console.assert(demoActivities.length === 25, "Debe tener 25 actividades demo");
  console.assert(occurrences.length === demoActivities.length, "Debe expandir actividades de semana típica");
  console.assert(getDurationMinutes({ duracionMinutos: 45 }) === 45, "Debe calcular duración por ejecución");
  console.assert(getStackBlockHeight({ duracionMinutos: 240 }) > getStackBlockHeight({ duracionMinutos: 120 }), "XXL debe ser más alto que L");
  console.assert(getStackBlockHeight({ duracionMinutos: 300 }) <= 260, "Debe tener tope visual");
  console.assert(typicalMonth.length === 4, "Mes típico debe tener 4 semanas");
  console.assert(totalWeekly > 0, "Debe calcular carga semanal total");
  console.assert(visibleWeek.every((activity) => WEEK_VISIBLE_TYPES.includes(activity.origen)), "Semana solo debe mostrar Proceso, Proyecto o Formación");
  console.assert(manualProject.rol === "Líder de proceso", "Los bloques manuales deben usar el rol Líder de proceso");
  console.assert(manualTraining.origen === "Formación", "Debe permitir crear bloques manuales de Formación");
  console.assert(Array.isArray(monthlyRow?.weeks) && monthlyRow.weeks.length === 4, "La matriz mensual debe tener 4 semanas");
  console.assert(monthlyRow.weeks[3].blocks.some((block) => block.id === "monthly-test"), "Un bloque mensual debe aparecer en Semana 4");
  console.assert(projectRow.weeks[0].blocks.some((block) => block.id === "monthly-manual-test"), "Un bloque manual debe aparecer en su semana objetivo");
}
if (typeof window !== "undefined" && !window.__WORKLOAD_BALANCE_TESTS_RAN__) { window.__WORKLOAD_BALANCE_TESTS_RAN__ = true; runModuleSmokeTests(); }

function FilterSelect({ label, value, onChange, children }) {
  return <label className="flex min-w-0 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm"><span className="shrink-0 text-[10px] font-black uppercase tracking-[0.32em] text-slate-400">{label}:</span><select value={value} onChange={onChange} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-900 outline-none">{children}</select></label>;
}
function ViewTab({ active, children, onClick }) { return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${active ? "bg-[#001225] text-white shadow-sm" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{children}</button>; }
function StatusPill({ status }) { const resolvedStatus = status || getWorkloadStatus(0); return <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${resolvedStatus.pill}`} title={resolvedStatus.label}><span className={`h-2 w-2 rounded-full ${resolvedStatus.dot}`} /></span>; }
function SourcePill({ source }) { return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${getSourceStyle(source)}`}>{source || "Sin origen"}</span>; }
function TeamCapacityOverview({ team, onSelectPerson }) {
  if (team.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-400">No hay personas registradas.</div>;
  }
  const criticalCount = team.filter((person) => person.utilization > 90).length;
  const attentionCount = team.filter((person) => person.utilization >= 75 && person.utilization <= 90).length;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-800">Estado de capacidad del equipo</p>
          <p className="text-[10px] font-bold text-slate-400">Utilización mensual por persona. Clic en una fila para ver su detalle.</p>
        </div>
        <div className="flex gap-1.5">
          {criticalCount > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-black text-red-600">{criticalCount} en crítico</span>}
          {attentionCount > 0 && <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[9px] font-black text-orange-600">{attentionCount} en atención</span>}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {team.map((person) => (
          <button key={person.id} type="button" onClick={() => onSelectPerson(person.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50">
            <span className={`h-2 w-2 shrink-0 rounded-full ${person.signal.dot}`} />
            <span className="min-w-0 flex-1 truncate text-[11px] font-black text-slate-800">{person.name}</span>
            <span className="hidden shrink-0 text-[9px] font-bold text-slate-400 sm:block">{formatHours(person.pendingHours)} pend.</span>
            <div className="hidden w-28 shrink-0 md:block"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${person.signal.bar}`} style={{ width: `${Math.min(person.utilization, 100)}%` }} /></div></div>
            <span className={`w-12 shrink-0 text-right text-[11px] font-black ${person.signal.text}`}>{person.utilization.toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
function CapacityAvailabilityPopover({ hasSelectedPerson, pendingHours, weeklyCapacityHours, weeklyScheduledHours, days, onGoToPending, onGoToWeek }) {
  const [open, setOpen] = useState(false);
  if (!hasSelectedPerson) return null;
  const weeklyAvailable = weeklyCapacityHours - weeklyScheduledHours;
  const fitsPending = pendingHours <= Math.max(weeklyAvailable, 0);
  const saturatedDays = days.filter((day) => day.capacityHours > 0 && day.scheduledHours > day.capacityHours);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-1 rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm transition ${saturatedDays.length > 0 ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100" : "border-white/20 bg-white text-[#001225] hover:bg-slate-100"}`}
      >
        {saturatedDays.length > 0 ? "⚠" : "ⓘ"} Disponibilidad
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-72 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
            <button type="button" onClick={() => { setOpen(false); onGoToPending(); }} className="block w-full rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-left transition hover:border-sky-200 hover:bg-sky-50">
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${fitsPending ? "bg-emerald-500" : "bg-red-500"}`} />Por programar vs. libre esta semana</span>
              <span className="mt-0.5 block text-[12px] font-semibold text-[#001225]">{formatHours(pendingHours)} <span className="font-normal text-slate-400">de {formatHours(Math.max(weeklyAvailable, 0))} disponibles</span></span>
            </button>
            <div className="rounded-lg border border-slate-100 px-2.5 py-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Libre por día</p>
              <div className="mt-1.5 space-y-1">
                {days.map((day) => {
                  const available = day.capacityHours - day.scheduledHours;
                  const occupation = day.capacityHours > 0 ? (day.scheduledHours / day.capacityHours) * 100 : 0;
                  const status = getWorkloadStatus(occupation);
                  return (
                    <button
                      key={day.name}
                      type="button"
                      onClick={() => { setOpen(false); onGoToWeek(); }}
                      className="flex w-full items-center justify-between rounded-md px-1.5 py-0.5 text-left transition hover:bg-slate-50"
                    >
                      <span className="text-[10px] font-bold text-slate-600">{day.name}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${status.pill}`}>{formatHours(Math.max(available, 0))} libres</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {saturatedDays.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] font-semibold text-red-700">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-500">⚠ Días saturados</p>
                {saturatedDays.map((day) => <p key={day.name} className="mt-0.5">{day.name}: {formatHours(day.scheduledHours)} / {formatHours(day.capacityHours)} ({formatHours(day.scheduledHours - day.capacityHours)} de más)</p>)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function SourceDistributionPie({ items, weeklyPlanKpi, monthlyCapacityHours = MONTHLY_CAPACITY_HOURS, hasSelectedPerson = true }) {
  const effectiveItems = hasSelectedPerson ? items : [];
  const total = safeArray(effectiveItems).reduce((sum, item) => sum + Number(item.monthly || 0), 0);
  const utilization = monthlyCapacityHours > 0 ? (total / monthlyCapacityHours) * 100 : 0;
  const utilizationSignal = getUtilizationSignal(utilization);
  const centerX = 260;
  const centerY = 196;
  const radius = 112;
  let currentAngle = -90;
  const polarPoint = (angle, distance) => {
    const radians = (Math.PI / 180) * angle;
    return { x: centerX + distance * Math.cos(radians), y: centerY + distance * Math.sin(radians) };
  };
  const rawSlices = safeArray(effectiveItems).filter((item) => Number(item.monthly || 0) > 0).map((item) => {
    const value = Number(item.monthly || 0);
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + (percentage / 100) * 360;
    const middleAngle = startAngle + (endAngle - startAngle) / 2;
    const start = polarPoint(startAngle, radius);
    const end = polarPoint(endAngle, radius);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    currentAngle = endAngle;
    return {
      ...item,
      value,
      percentage,
      middleAngle,
      path: `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`,
    };
  });
  // Cuando varias rebanadas pequeñas quedan muy juntas en ángulo (ej. Proyecto
  // y Reunión arriba del donut), sus etiquetas con línea guía se encimarían.
  // Se agrupan y se reparten en abanico alrededor del ángulo promedio del
  // grupo -la línea guía sigue naciendo en el punto real del arco- para que
  // el texto quede separado sin mover las rebanadas.
  const LABEL_RADIUS = 168;
  const CLUSTER_ANGLE_GAP = 26;
  const clusters = [];
  rawSlices.forEach((item, index) => {
    const previousCluster = clusters[clusters.length - 1];
    const previousIndex = previousCluster?.[previousCluster.length - 1];
    if (previousCluster && item.middleAngle - rawSlices[previousIndex].middleAngle < CLUSTER_ANGLE_GAP) {
      previousCluster.push(index);
    } else {
      clusters.push([index]);
    }
  });
  const labelAngleByIndex = new Array(rawSlices.length);
  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      labelAngleByIndex[cluster[0]] = rawSlices[cluster[0]].middleAngle;
      return;
    }
    const avgAngle = cluster.reduce((sum, idx) => sum + rawSlices[idx].middleAngle, 0) / cluster.length;
    const span = CLUSTER_ANGLE_GAP * (cluster.length - 1);
    cluster.forEach((idx, order) => {
      labelAngleByIndex[idx] = avgAngle - span / 2 + order * CLUSTER_ANGLE_GAP;
    });
  });
  const slices = rawSlices.map((item, index) => ({ ...item, label: polarPoint(labelAngleByIndex[index], LABEL_RADIUS) }));

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_205px]"><div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60"><svg viewBox="0 0 520 400" role="img" aria-label="Diagrama de pastel de distribución mensual" className="h-[440px] w-full"><rect x="0" y="0" width="520" height="400" fill="#f8fafc" /><circle cx={centerX} cy={centerY} r="128" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />{slices.map((item) => <path key={item.source} d={item.path} fill={getSourceChartColor(item.source)} stroke="#ffffff" strokeWidth="3" />)}<circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#cbd5e1" strokeWidth="1" />{slices.map((item) => { const anchor = item.label.x < centerX - 8 ? "end" : item.label.x > centerX + 8 ? "start" : "middle"; const lineEnd = polarPoint(item.middleAngle, 138); return <g key={`${item.source}-label`}><line x1={lineEnd.x} y1={lineEnd.y} x2={item.label.x} y2={item.label.y} stroke="#cbd5e1" strokeWidth="1" /><circle cx={lineEnd.x} cy={lineEnd.y} r="3" fill={getSourceTextColor(item.source)} /><text x={item.label.x} y={item.label.y - 8} textAnchor={anchor} fill="#0f172a" fontSize="13" fontWeight="500"><tspan>{item.source}</tspan></text><text x={item.label.x} y={item.label.y + 10} textAnchor={anchor} fill={getSourceTextColor(item.source)} fontSize="13" fontWeight="500"><tspan>{formatHours(item.value)}</tspan><tspan dx="4">({item.percentage.toFixed(0)}%)</tspan></text></g>; })}{slices.length === 0 && <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="16" fontWeight="500">{hasSelectedPerson ? "Sin carga registrada" : "Selecciona una persona"}</text>}</svg></div><div className="flex flex-col justify-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3"><div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className="absolute inset-y-0 left-0 w-1 bg-sky-300" /><p className="text-[9px] font-medium uppercase tracking-widest text-slate-400">Capacidad estándar</p><p className="mt-1 text-2xl font-semibold text-[#001225]">{hasSelectedPerson ? formatHours(monthlyCapacityHours) : "—"}</p><p className="mt-1 text-[10px] font-normal text-slate-400">Base mensual disponible</p></div><div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className="absolute inset-y-0 left-0 w-1 bg-violet-300" /><p className="text-[9px] font-medium uppercase tracking-widest text-slate-400">Total mensual</p><p className="mt-1 text-2xl font-semibold text-[#001225]">{hasSelectedPerson ? formatHours(total) : "—"}</p><p className="mt-1 text-[10px] font-normal text-slate-400">Carga planificada</p></div><div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1 ${hasSelectedPerson ? utilizationSignal.accent : "bg-slate-200"}`} /><div className="flex items-start justify-between gap-2"><div><p className="text-[9px] font-medium uppercase tracking-widest text-slate-400">Utilización</p><p className={`mt-1 text-2xl font-semibold ${hasSelectedPerson ? utilizationSignal.text : "text-slate-300"}`}>{hasSelectedPerson ? `${utilization.toFixed(0)}%` : "—"}</p></div>{hasSelectedPerson && <span className={`mt-1 h-2.5 w-2.5 rounded-full ${utilizationSignal.dot}`} />}</div><p className={`mt-1 text-[10px] font-medium ${hasSelectedPerson ? utilizationSignal.text : "text-slate-400"}`}>{hasSelectedPerson ? utilizationSignal.label : "Selecciona una persona"}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">{hasSelectedPerson && <div className={`h-full rounded-full ${utilizationSignal.bar}`} style={{ width: `${Math.min(utilization, 100)}%` }} />}</div></div><div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1 ${hasSelectedPerson ? "bg-emerald-300" : "bg-slate-200"}`} /><p className="text-[9px] font-medium uppercase tracking-widest text-slate-400">Cumplimiento acumulado</p><p className={`mt-1 text-2xl font-semibold ${hasSelectedPerson ? "text-[#001225]" : "text-slate-300"}`}>{hasSelectedPerson ? `${weeklyPlanKpi?.completion || 0}%` : "—"}</p><p className="mt-1 text-[10px] font-normal text-slate-400">{hasSelectedPerson ? `${weeklyPlanKpi?.completed || 0} de ${weeklyPlanKpi?.planned || 0} actividades · ${weeklyPlanKpi?.weeks || 0} semanas` : "Selecciona una persona"}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">{hasSelectedPerson && <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(weeklyPlanKpi?.completion || 0, 100)}%` }} />}</div></div></div></div></div>;
}
function QuickBlockForm({ day, editingProjectId, quickProjectType, setQuickProjectType, quickProjectName, setQuickProjectName, quickProjectMinutes, setQuickProjectMinutes, saveQuickProject, cancelQuickProject }) {
  return <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-2">{editingProjectId && <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-violet-500">Editando bloque</p>}<select value={quickProjectType} onChange={(event) => setQuickProjectType(event.target.value)} className="mb-1 w-full rounded-md border border-violet-100 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-violet-300"><option value="Proyecto">Proyecto</option><option value="Formación">Formación</option><option value="Tarea">Tarea</option></select><input value={quickProjectName} onChange={(event) => setQuickProjectName(event.target.value)} placeholder="Nombre" className="mb-1 w-full rounded-md border border-violet-100 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-violet-300" /><div className="flex gap-1"><input value={quickProjectMinutes} onChange={(event) => setQuickProjectMinutes(event.target.value)} type="number" min="1" placeholder="Min" className="min-w-0 flex-1 rounded-md border border-violet-100 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-violet-300" /><button type="button" onClick={() => saveQuickProject(day)} className="rounded-md bg-violet-600 px-2 py-1 text-[9px] font-black text-white">OK</button><button type="button" onClick={cancelQuickProject} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-black text-slate-400">X</button></div></div>;
}
function AddBlockButton({ onClick, className = "" }) { return <button type="button" onClick={onClick} className={`w-full rounded-lg border border-dashed border-slate-200 py-1 text-[10px] font-bold text-slate-400 transition hover:border-sky-200 hover:text-sky-600 ${className}`}>+ Bloque</button>; }
function getViewGuideText(viewMode) {
  const guides = { capacity: "Vista consolidada de distribución de carga por origen. Identifica dónde se concentra el esfuerzo operativo, estratégico y de apoyo.", week: "Semana típica de trabajo. Arrastra actividades entre días, reorganiza prioridades y ajusta proyectos o formación según la capacidad disponible.", month: "Mes típico basado en cuatro semanas de capacidad. Visualiza carga mensual por procesos, proyectos y formación, incluyendo bloques recurrentes.", assignments: "Centro de asignaciones. Registra encargos autorizados y déjalos disponibles para programarse en una semana específica.", pending: "Bandeja de actividades activas asociadas a la persona seleccionada que aún no están programadas en Semana o Mes típico.", agenda: "Programación semanal y mensual. Los líderes planifican el viernes, Dirección da VOBO el lunes y durante la semana se palomean los avances." };
  return guides[viewMode] || "Consulta y ajusta la carga de trabajo según la capacidad disponible.";
}
function PendingActivitiesView({ hasSelectedPerson, activities, excludedActivities, totalHours, canEditActivities, onOpenSchedule, onEditActivity, onRestoreExcludedActivity }) {
  const [processFilter, setProcessFilter] = useState("all");
  const [subprocessFilter, setSubprocessFilter] = useState("all");
  const [showExcludedReport, setShowExcludedReport] = useState(false);
  const excludedList = safeArray(excludedActivities);
  const pendingList = safeArray(activities);
  const processOptions = useMemo(
    () => [...new Set(pendingList.map((activity) => cleanText(activity?.proceso)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [pendingList]
  );
  const subprocessOptions = useMemo(
    () => [...new Set(pendingList
      .filter((activity) => processFilter === "all" || cleanText(activity?.proceso) === processFilter)
      .map(getPendingActivitySubprocess)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [pendingList, processFilter]
  );

  useEffect(() => {
    setSubprocessFilter("all");
  }, [processFilter]);

  const filteredActivities = pendingList.filter((activity) => {
    const processMatches = processFilter === "all" || cleanText(activity?.proceso) === processFilter;
    const subprocessMatches = subprocessFilter === "all" || getPendingActivitySubprocess(activity) === subprocessFilter;
    return processMatches && subprocessMatches;
  });

  const sortedActivities = filteredActivities
    .map((activity, index) => ({ activity, index }))
    .sort((a, b) => {
      const inactiveDiff = Number(isInactiveWorkloadActivity(a.activity)) - Number(isInactiveWorkloadActivity(b.activity));
      if (inactiveDiff !== 0) return inactiveDiff;
      return comparePendingActivities(a.activity, b.activity) || a.index - b.index;
    })
    .map(({ activity }) => activity);
  const visibleTotalHours = sortedActivities.reduce((sum, activity) => sum + getDurationMinutes(activity) / 60, 0);
  const activeTotalHours = sortedActivities
    .filter((activity) => !isInactiveWorkloadActivity(activity))
    .reduce((sum, activity) => sum + getDurationMinutes(activity) / 60, 0);
  const sectionDefinitions = [
    { key: "programmable", title: "PENDIENTES PARA PROGRAMAR", countLabel: "programables", description: "Actividades recurrentes que deben incorporarse a la semana o mes típico." },
    { key: "radar", title: "RADAR DE ACTIVIDADES PERIÓDICAS", countLabel: "en radar", description: "Actividades de baja frecuencia que deberán planearse en el mes correspondiente." },
    { key: "eventual", title: "ACTIVIDADES EVENTUALES", countLabel: "eventuales", description: "Actividades que se ejecutan únicamente cuando exista una necesidad específica." },
  ];
  const sectionCounts = sectionDefinitions.reduce((counts, section) => {
    counts[section.key] = sortedActivities.filter((activity) => getPendingActivityFrequencyGroup(activity) === section.key).length;
    return counts;
  }, {});
  const visibleSections = sectionDefinitions
    .map((section) => ({
      ...section,
      activities: sortedActivities.filter((activity) => getPendingActivityFrequencyGroup(activity) === section.key),
    }))
    .filter((section) => section.activities.length > 0);
  const renderRows = (section) => section.activities.map((activity) => {
    const inactive = isInactiveWorkloadActivity(activity);
    const statusValue = inactive ? "inactive" : activity.estado || activity.sourceRecord?.estado || activity.estadoAgenda;
    const subprocess = getPendingActivitySubprocess(activity);
    const activityNumber = getPendingActivityNumber(activity);
    return <tr key={`${section.key}-${activity.id || getPendingActivityKey(activity)}`} className={`align-top hover:bg-slate-50/70 ${inactive ? "bg-gray-50 text-gray-400" : ""}`}><td className={`px-3 py-2 font-black leading-tight whitespace-normal ${inactive ? "text-gray-400" : "text-slate-800"}`}>{activity.actividad}</td><td className={`px-3 py-2 font-bold leading-tight whitespace-normal ${inactive ? "text-gray-400" : "text-slate-600"}`}><span className="block">{activity.proceso}</span>{subprocess && <span className={`mt-0.5 block text-[9px] font-bold ${inactive ? "text-gray-400" : "text-slate-400"}`}>{subprocess}{activityNumber ? ` · Act. ${activityNumber}` : ""}</span>}</td><td className={`px-3 py-2 font-bold leading-tight whitespace-normal ${inactive ? "text-gray-400" : "text-slate-600"}`}>{activity.rol}</td><td className={`px-3 py-2 font-bold ${inactive ? "text-gray-400" : "text-slate-500"}`}><span className="block">{translateFrequency(activity.frecuencia)}</span>{section.key === "radar" && <span className={`mt-0.5 block text-[8px] font-black ${inactive ? "text-gray-400" : "text-slate-400"}`}>Mes previsto: {getPendingActivityPlannedMonthLabel(activity)}</span>}</td><td className={`px-3 py-2 font-black ${inactive ? "text-gray-400" : "text-slate-600"}`}>{activity.duracionMinutos} min</td><td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${inactive ? "border-gray-200 bg-gray-100 text-gray-500" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{translateStatus(statusValue)}</span></td><td className="px-3 py-2 text-right"><div className="flex justify-end gap-1">{canEditActivities && <button type="button" onClick={() => onEditActivity(activity)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-black text-slate-500 shadow-sm hover:bg-slate-50">Editar</button>}<button type="button" onClick={() => onOpenSchedule(activity)} className="rounded-lg bg-[#001225] px-2 py-1 text-[9px] font-black text-white shadow-sm hover:bg-slate-800">{section.key === "radar" ? "Mes previsto" : "Programar"}</button></div></td></tr>;
  });

  return <><div className="p-3"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3"><div><p className="text-xs font-black uppercase tracking-widest text-slate-800">Pendientes de programación</p><p className="text-[10px] font-bold text-slate-400">Actividades de los roles asignados a la persona que aún no están en Semana o Mes típico.</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-500">{sortedActivities.length} actividades | {sectionCounts.programmable || 0} programables | {sectionCounts.radar || 0} en radar | {sectionCounts.eventual || 0} eventuales</span>{hasSelectedPerson && <button type="button" onClick={() => setShowExcludedReport(true)} title="Actividades que este usuario quitó de sus pendientes" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-400 transition hover:border-slate-300 hover:text-slate-600">Quitadas{excludedList.length > 0 ? ` (${excludedList.length})` : ""}</button>}</div></div>{hasSelectedPerson && <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-4 py-2"><select value={processFilter} onChange={(event) => setProcessFilter(event.target.value)} className="h-8 min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-[10px] font-black text-slate-600 outline-none"><option value="all">Todos los procesos</option>{processOptions.map((process) => <option key={process} value={process}>{process}</option>)}</select><select value={subprocessFilter} onChange={(event) => setSubprocessFilter(event.target.value)} disabled={subprocessOptions.length === 0} className="h-8 min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-[10px] font-black text-slate-600 outline-none disabled:text-slate-300"><option value="all">Todos los subprocesos</option>{subprocessOptions.map((subprocess) => <option key={subprocess} value={subprocess}>{subprocess}</option>)}</select><button type="button" onClick={() => { setProcessFilter("all"); setSubprocessFilter("all"); }} className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">Limpiar filtros</button></div>}{!hasSelectedPerson ? <div className="px-5 py-10 text-center text-sm font-bold text-slate-400">Selecciona una persona para ver sus actividades pendientes.</div> : sortedActivities.length === 0 ? <div className="px-5 py-10 text-center text-sm font-bold text-slate-400">No hay actividades pendientes por programar.</div> : <div className="divide-y divide-slate-100">{visibleSections.map((section) => <section key={section.key}><div className="flex items-center justify-between gap-2 bg-white px-4 py-2"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-700">{section.title} ({section.activities.length})</p><p className="text-[9px] font-bold text-slate-400">{section.description}</p></div><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black text-slate-400">{section.activities.length} {section.countLabel}</span></div><table className="min-w-full table-fixed divide-y divide-slate-100 text-[10px]"><thead className="bg-slate-50 text-left font-black uppercase tracking-[0.14em] text-slate-400"><tr><th className="w-[32%] px-3 py-2">Actividad</th><th className="w-[18%] px-3 py-2">Proceso</th><th className="w-[18%] px-3 py-2">Rol</th><th className="w-[10%] px-3 py-2">Frecuencia</th><th className="w-[8%] px-3 py-2">Duración</th><th className="w-[8%] px-3 py-2">Estado</th><th className="w-[6%] px-3 py-2 text-right">Acción</th></tr></thead><tbody className="divide-y divide-slate-100">{renderRows(section)}</tbody></table></section>)}</div>}</div></div>{showExcludedReport && <ExcludedActivitiesReportModal activities={excludedList} onClose={() => setShowExcludedReport(false)} onRestore={onRestoreExcludedActivity} />}</>;
}
function ExcludedActivitiesReportModal({ activities, onClose, onRestore }) {
  const list = safeArray(activities);
  const [restoringId, setRestoringId] = useState(null);

  async function handleRestore(activity) {
    setRestoringId(activity.id);
    await onRestore?.(activity);
    setRestoringId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Actividades quitadas de pendientes</p>
            <p className="text-[10px] font-bold text-slate-300">Actividades del rol Líder de proceso que este usuario quitó de su bandeja. A los demás Líderes de proceso no les afecta.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {list.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm font-bold text-slate-400">No se ha quitado ninguna actividad de pendientes.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {list.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-[11px] font-black text-slate-800">{activity.actividad}</p>
                    <p className="text-[10px] font-bold text-slate-400">{activity.proceso} · {activity.rol}</p>
                    <p className="mt-1 text-[10px] font-bold italic text-slate-500">{activity.motivoExclusion ? `Motivo: ${activity.motivoExclusion}` : "Sin motivo registrado"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap text-[9px] font-bold text-slate-400">
                      {activity.excluidoEn ? new Date(activity.excluidoEn).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                    <button
                      type="button"
                      disabled={restoringId === activity.id}
                      onClick={() => handleRestore(activity)}
                      className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {restoringId === activity.id ? "Restaurando…" : "Restaurar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function SchedulePendingModal({ activity, selectedDays, selectedWeeks, selectedMonth, onToggleDay, onToggleWeek, onChangeMonth, onSave, onClose }) {
  if (!activity) return null;

  const isRadarActivity = getPendingActivityFrequencyGroup(activity) === "radar";
  const monthStatus = getPlannedMonthStatusText(selectedMonth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">{isRadarActivity ? "Mes previsto" : "Programar actividad"}</p>
            <p className="text-[10px] font-bold text-slate-300">{activity.actividad}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-[11px] font-bold text-slate-600 md:grid-cols-2">
            <div><span className="text-slate-400">Proceso</span><p className="text-slate-800">{activity.proceso}</p></div>
            <div><span className="text-slate-400">Rol</span><p className="text-slate-800">{activity.rol}</p></div>
            <div><span className="text-slate-400">Frecuencia</span><p className="text-slate-800">{translateFrequency(activity.frecuencia)}</p></div>
            <div><span className="text-slate-400">Duración</span><p className="text-slate-800">{activity.duracionMinutos} min</p></div>
          </div>

          {isRadarActivity ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                Mes previsto para planificación
                <input
                  type="month"
                  value={selectedMonth || ""}
                  onChange={(event) => onChangeMonth(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-[12px] font-black normal-case tracking-normal text-slate-700 outline-none focus:border-amber-300"
                />
              </label>
              <div className="mt-2 rounded-xl border border-amber-100 bg-white px-3 py-2">
                <p className="text-[10px] font-black text-slate-700">{selectedMonth ? formatPlannedMonthLabel(selectedMonth) : "Sin mes previsto"}</p>
                <p className="mt-0.5 text-[9px] font-bold text-amber-700">{monthStatus}</p>
              </div>
              <p className="mt-2 text-[9px] font-bold leading-snug text-slate-500">Esta actividad queda en radar. No se agregará a Semana típica, Mes típico ni Planeación hasta que el usuario decida programarla llegada la fecha.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Semana típica</p>
                <div className="space-y-1">{WEEK_DAYS.map((day) => <label key={day} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-700"><input type="checkbox" checked={selectedDays.includes(day)} onChange={() => onToggleDay(day)} />{day}</label>)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Mes típico</p>
                <div className="space-y-1">{[1, 2, 3, 4].map((week) => <label key={week} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-700"><input type="checkbox" checked={selectedWeeks.includes(week)} onChange={() => onToggleWeek(week)} />Semana {week}</label>)}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
            <button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function AssignmentScheduleModal({ assignment, draft, setDraft, onSave, onClose }) {
  if (!assignment) return null;
  const destination = draft.destino || "monthly-standard";
  const showDay = destination === "weekly-standard" || destination === "weekly-planning";
  const showWeek = destination === "monthly-standard" || destination === "monthly-planning";
  const showOrigin = destination === "monthly-standard" || destination === "monthly-planning";
  const showPlanningWeek = destination === "weekly-planning";
  const showPlanningMonth = destination === "monthly-planning";

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Programar asignación</p><p className="text-[10px] font-bold text-slate-300">{assignment.titulo}</p></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button></div><div className="space-y-3 p-4"><div className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-[11px] font-bold text-slate-600 md:grid-cols-2"><div><span className="text-slate-400">Asignación</span><p className="text-slate-900">{assignment.titulo}</p></div><div><span className="text-slate-400">Carga estimada</span><p className="text-slate-900">{formatHours(draft.horas || assignment.horas || 0)}</p></div></div><div className="grid gap-2 md:grid-cols-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destino<select value={destination} onChange={(event) => setDraft((current) => ({ ...current, destino: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_SCHEDULE_DESTINATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carga estimada<input type="number" min="0.25" step="0.25" value={draft.horas} onChange={(event) => setDraft((current) => ({ ...current, horas: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label>{showPlanningWeek && <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inicio semana<input type="date" value={draft.planningWeekStart} onChange={(event) => { const start = event.target.value; const endDate = new Date(`${start}T00:00:00`); endDate.setDate(endDate.getDate() + 4); setDraft((current) => ({ ...current, planningWeekStart: start, planningWeekEnd: toDateInputValue(endDate) })); }} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label>}{showPlanningMonth && <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mes / periodo<input type="month" value={draft.planningMonth} onChange={(event) => setDraft((current) => ({ ...current, planningMonth: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label>}{showDay && <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Día<select value={draft.dia} onChange={(event) => setDraft((current) => ({ ...current, dia: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{WEEK_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>}{showWeek && <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Semana<select value={draft.semanaMes} onChange={(event) => setDraft((current) => ({ ...current, semanaMes: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{[1, 2, 3, 4].map((week) => <option key={week} value={week}>Semana {week}</option>)}</select></label>}{showOrigin && <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Origen<select value={draft.origen} onChange={(event) => setDraft((current) => ({ ...current, origen: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_SCHEDULE_ORIGINS.map((origin) => <option key={origin} value={origin}>{origin}</option>)}</select></label>}</div><div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar programación</button></div></div></div></div>;
}
function ProgramAssignmentModal({ modal, draft, setDraft, onSave, onClose, error, capacityWarning, onToggleDay, onToggleWeek, planningWeekStart, planningWeekEnd }) {
  if (!modal?.assignment) return null;
  const assignment = modal.assignment;
  const horasPendientes = Number(assignment.horasPendientes || 0);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Programar carga del proyecto</p><p className="text-[10px] font-bold text-slate-300">{assignment.nombre}</p></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button></div><div className="space-y-3 p-4"><div className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-[11px] font-bold text-slate-600 md:grid-cols-2"><div><span className="text-slate-400">Responsable</span><p className="text-slate-900">{assignment.responsable}</p></div><div><span className="text-slate-400">Horas totales</span><p className="text-slate-900">{formatHours(assignment.horasTotales)}</p></div><div><span className="text-slate-400">Ya programadas</span><p className="text-slate-900">{formatHours(assignment.horasProgramadas)}</p></div><div><span className="text-slate-400">Pendientes</span><p className="text-slate-900">{formatHours(horasPendientes)}</p></div></div><div className="flex gap-1 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setDraft((current) => ({ ...current, type: "weekly" }))} className={`flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest transition ${draft.type === "weekly" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}>Semana típica</button><button type="button" onClick={() => setDraft((current) => ({ ...current, type: "monthly" }))} className={`flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest transition ${draft.type === "monthly" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}>Mes típico</button><button type="button" onClick={() => setDraft((current) => ({ ...current, type: "planning" }))} className={`flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest transition ${draft.type === "planning" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}>Planificación</button></div>{draft.type === "planning" && <p className="text-[9px] font-bold leading-snug text-slate-500">Se agrega como actividad extraordinaria únicamente en la semana de Planificación {planningWeekStart} a {planningWeekEnd} (no se repite en otras semanas). Cambia esa semana desde la pestaña Planificación antes de programar si necesitas otra.</p>}<div className="grid gap-2 md:grid-cols-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{draft.type === "planning" ? "Horas de esta actividad" : `Horas por ${draft.type === "weekly" ? "día" : "semana"}`}<input type="number" min="0.25" step="0.25" max={horasPendientes} value={draft.horas} onChange={(event) => setDraft((current) => ({ ...current, horas: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total a programar</p><p className="mt-1 flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700">{formatHours(draft.type === "planning" ? Number(draft.horas || 0) : Number(draft.horas || 0) * (draft.type === "weekly" ? draft.dias.length : draft.semanas.length))}</p></div></div>{draft.type === "weekly" ? <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Días sugeridos (selecciona uno o varios)</p><div className="mt-1 flex flex-wrap gap-1.5">{WEEK_DAYS.map((day) => <label key={day} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${draft.dias.includes(day) ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500"}`}><input type="checkbox" checked={draft.dias.includes(day)} onChange={() => onToggleDay(day)} className="h-3 w-3" />{day}</label>)}</div></div> : draft.type === "monthly" ? <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Semanas (selecciona una o varias)</p><div className="mt-1 flex flex-wrap gap-1.5">{[1, 2, 3, 4].map((week) => <label key={week} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${draft.semanas.includes(week) ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500"}`}><input type="checkbox" checked={draft.semanas.includes(week)} onChange={() => onToggleWeek(week)} className="h-3 w-3" />Semana {week}</label>)}</div></div> : <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Día de esa semana<select value={draft.dias[0] || "Lunes"} onChange={(event) => setDraft((current) => ({ ...current, dias: [event.target.value] }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{WEEK_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>}<label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Comentario (opcional)<input value={draft.comentario} onChange={(event) => setDraft((current) => ({ ...current, comentario: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label>{capacityWarning && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">{capacityWarning}</div>}{error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{error}</div>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Programar</button></div></div></div></div>;
}
function NewAssignmentModal({ open, draft, setDraft, onSave, onClose, error, puestoOptions = [], currentUserLabel = "" }) {
  if (!open) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" style={{ maxHeight: "90vh" }}><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-900">Nueva asignación</p><p className="text-[10px] font-bold text-slate-400">Proyecto o iniciativa aprobada para el backlog de capacidad.</p></div><button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-400 hover:bg-slate-50">×</button></div><div className="grid gap-2 md:grid-cols-2"><label className="md:col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre de la iniciativa/proyecto<input value={draft.nombre} onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))} placeholder="Ej. Implementación de tablero de control" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="md:col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción breve<textarea value={draft.descripcion} onChange={(event) => setDraft((current) => ({ ...current, descripcion: event.target.value }))} rows={2} placeholder="Describe el objetivo o alcance general de la iniciativa." className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Origen<select value={draft.origenEstrategico} onChange={(event) => setDraft((current) => ({ ...current, origenEstrategico: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_STRATEGIC_ORIGINS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo<select value={draft.tipo} onChange={(event) => setDraft((current) => ({ ...current, tipo: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable asignado<select value={draft.responsable} onChange={(event) => setDraft((current) => ({ ...current, responsable: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="">Seleccionar puesto</option>{puestoOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prioridad<select value={draft.prioridad} onChange={(event) => setDraft((current) => ({ ...current, prioridad: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Revisará<select value={draft.revisara} onChange={(event) => setDraft((current) => ({ ...current, revisara: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="">Seleccionar puesto</option>{puestoOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aprobará<select value={draft.aprobara} onChange={(event) => setDraft((current) => ({ ...current, aprobara: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="">Seleccionar puesto</option>{puestoOptions.map((item) => <option key={item} value={item}>{item}</option>)}<option value="No requiere aprobación">No requiere aprobación</option></select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dará seguimiento<select value={draft.seguimiento} onChange={(event) => setDraft((current) => ({ ...current, seguimiento: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="PMO">PMO</option>{puestoOptions.map((item) => <option key={item} value={item}>{item}</option>)}<option value="Ninguno">Ninguno</option></select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Herramienta de gestión<select value={draft.gestionarEn} onChange={(event) => setDraft((current) => ({ ...current, gestionarEn: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">URL o referencia externa<input value={draft.urlExterna} onChange={(event) => setDraft((current) => ({ ...current, urlExterna: event.target.value }))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horas totales estimadas<input type="number" min="0.5" step="0.5" value={draft.horas} onChange={(event) => setDraft((current) => ({ ...current, horas: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha inicio estimada<input type="date" value={draft.fechaInicio} onChange={(event) => setDraft((current) => ({ ...current, fechaInicio: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha límite / compromiso<input type="date" value={draft.fechaLimite} onChange={(event) => setDraft((current) => ({ ...current, fechaLimite: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label></div>{error && <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{error}</div>}<div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="text-[10px] font-bold text-slate-400">Asignará: {currentUserLabel}</span><div className="flex gap-2"><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar asignación</button><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button></div></div></div></div>;
}
function EditMeetingModal({ assignment, draft, setDraft, onSave, onClose, error, peopleOptions = [], onToggleParticipant }) {
  if (!assignment) return null;

  const participantIds = safeArray(draft.participantIds);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-900">Editar reunión</p><p className="text-[10px] font-bold text-slate-400">Actualiza los datos generales; aplica a todos los participantes.</p></div><button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-400 hover:bg-slate-50">×</button></div><div className="grid gap-2 md:grid-cols-2"><label className="md:col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Título<input value={draft.titulo} onChange={(event) => setDraft((current) => ({ ...current, titulo: event.target.value }))} placeholder="Ej. Revisión semanal de ventas" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prioridad<select value={draft.prioridad} onChange={(event) => setDraft((current) => ({ ...current, prioridad: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gestionar en<select value={draft.gestionarEn} onChange={(event) => setDraft((current) => ({ ...current, gestionarEn: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duración estimada (horas)<input type="number" min="0.25" step="0.25" value={draft.horas} onChange={(event) => setDraft((current) => ({ ...current, horas: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha tentativa<input type="date" value={draft.fechaLimite} onChange={(event) => setDraft((current) => ({ ...current, fechaLimite: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora tentativa<input type="time" value={draft.horaLimite} onChange={(event) => setDraft((current) => ({ ...current, horaLimite: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><div className="md:col-span-2"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Participantes ({participantIds.length})</p><div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2"><div className="grid gap-1 md:grid-cols-2">{peopleOptions.map((person) => <label key={person.id} className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-[11px] font-bold normal-case tracking-normal text-slate-700 hover:border-slate-200 hover:bg-white"><input type="checkbox" checked={participantIds.includes(person.id)} onChange={() => onToggleParticipant(person.id)} />{person.name}</label>)}</div></div></div></div>{error && <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{error}</div>}<div className="mt-3 flex items-center justify-end gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2"><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar cambios</button><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button></div></div></div>;
}
function AssignmentEditModal({ assignment, draft, setDraft, onSave, onClose, error, puestoOptions = [] }) {
  if (!assignment) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" style={{ maxHeight: "90vh" }}><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-900">Editar asignación</p><p className="text-[10px] font-bold text-slate-400">Actualiza los datos del proyecto/iniciativa.</p></div><button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-400 hover:bg-slate-50">×</button></div><div className="grid gap-2 md:grid-cols-2"><label className="md:col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre<input value={draft.nombre} onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="md:col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción<textarea value={draft.descripcion} onChange={(event) => setDraft((current) => ({ ...current, descripcion: event.target.value }))} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Origen<select value={draft.origenEstrategico} onChange={(event) => setDraft((current) => ({ ...current, origenEstrategico: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_STRATEGIC_ORIGINS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo<select value={draft.tipo} onChange={(event) => setDraft((current) => ({ ...current, tipo: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{[...new Set([draft.tipo, ...ASSIGNMENT_TYPES])].filter(Boolean).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prioridad<select value={draft.prioridad} onChange={(event) => setDraft((current) => ({ ...current, prioridad: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado del proyecto<select value={draft.estadoProyecto} onChange={(event) => setDraft((current) => ({ ...current, estadoProyecto: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{PROJECT_STATE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gestionar en<select value={draft.gestionarEn} onChange={(event) => setDraft((current) => ({ ...current, gestionarEn: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">URL / referencia externa<input value={draft.urlExterna} onChange={(event) => setDraft((current) => ({ ...current, urlExterna: event.target.value }))} placeholder="https://..." className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horas totales estimadas<input type="number" min="0.25" step="0.25" value={draft.horas} onChange={(event) => setDraft((current) => ({ ...current, horas: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horas ejecutadas<input type="number" min="0" step="0.25" value={draft.horasEjecutadas} onChange={(event) => setDraft((current) => ({ ...current, horasEjecutadas: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha inicio estimada<input type="date" value={draft.fechaInicio} onChange={(event) => setDraft((current) => ({ ...current, fechaInicio: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha límite<input type="date" value={draft.fechaLimite} onChange={(event) => setDraft((current) => ({ ...current, fechaLimite: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Revisará<select value={draft.revisara} onChange={(event) => setDraft((current) => ({ ...current, revisara: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="">Seleccionar puesto</option>{puestoOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aprobará<select value={draft.aprobara} onChange={(event) => setDraft((current) => ({ ...current, aprobara: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="">Seleccionar puesto</option>{puestoOptions.map((item) => <option key={item} value={item}>{item}</option>)}<option value="No requiere aprobación">No requiere aprobación</option></select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dará seguimiento<select value={draft.seguimiento} onChange={(event) => setDraft((current) => ({ ...current, seguimiento: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="PMO">PMO</option>{puestoOptions.map((item) => <option key={item} value={item}>{item}</option>)}<option value="Ninguno">Ninguno</option></select></label></div>{error && <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{error}</div>}<div className="mt-3 flex items-center justify-end gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2"><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar cambios</button><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button></div></div></div>;
}
function PendingActivityEditModal({ activity, draft, error, saving, onChange, onSave, onClose, onExclude }) {
  if (!activity) return null;
  const subprocess = getPendingActivitySubprocess(activity);
  const frequencyOptions = ["Diaria", "Semanal", "Mensual", "Quincenal", "Trimestral", "Anual", "Por evento"];
  const options = [...new Set([draft.frecuencia, ...frequencyOptions].filter(Boolean))];
  const isLiderProceso = isLiderDeProcesoActivity(activity);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Edición rápida</p><p className="text-[10px] font-bold text-slate-300">Pendientes de programación</p></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button></div><div className="space-y-3 p-4"><div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-[11px] font-bold text-slate-600"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actividad</p><p className="mt-1 text-sm font-black text-slate-900">{activity.actividad}</p><div className="mt-2 grid gap-2 md:grid-cols-2"><div><span className="text-slate-400">Proceso</span><p className="text-slate-800">{activity.proceso}</p></div><div><span className="text-slate-400">Subproceso</span><p className="text-slate-800">{subprocess || "Sin subproceso"}</p></div></div></div>{<div className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2 text-[10px] font-bold text-sky-700">{isLiderProceso ? `Actividad del rol transversal "Líder de proceso": lo que captures aquí (estado, duración y frecuencia) es solo tuyo y no cambia lo que ven los demás líderes de proceso ni la actividad maestra en Diseño Organizacional.` : `Actividad del rol "${activity.rol}": Guardar aquí (estado, duración y frecuencia) actualiza la actividad maestra en Diseño Organizacional y aplica para cualquier persona que comparta este rol. En cambio, "Quitar de pendientes" solo te la oculta a ti — no cambia la actividad maestra ni afecta a nadie más.`}</div>}<div className="grid gap-3 md:grid-cols-3"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado{isLiderProceso ? " · personal" : ""}<select value={draft.estado} onChange={(event) => onChange("estado", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none"><option value="Activa">Activa</option><option value="Inactiva">Inactiva</option></select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duración (min){isLiderProceso ? " · personal" : ""}<input type="number" min="1" value={draft.duracionMinutos} onChange={(event) => onChange("duracionMinutos", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Frecuencia{isLiderProceso ? " · personal" : ""}<select value={draft.frecuencia} onChange={(event) => onChange("frecuencia", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{options.map((option) => <option key={option} value={option}>{translateFrequency(option)}</option>)}</select></label></div>{<label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo si la quitas de pendientes (opcional)<textarea value={draft.motivo || ""} onChange={(event) => onChange("motivo", event.target.value)} rows={2} placeholder="Ej. Ya no aplica a mi proceso, se reasignó, etc." className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label>}{error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{error}</div>}<div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">{onExclude ? <button type="button" disabled={saving} onClick={onExclude} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Quitar de pendientes</button> : <span />}<div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button><button type="button" disabled={saving} onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">{saving ? "Guardando..." : "Guardar"}</button></div></div></div></div></div>;
}
function MoveScheduledModal({ modal, target, setTarget, onSave, onClose }) {
  if (!modal?.activity) return null;
  const options = modal.type === "weekly" ? WEEK_DAYS : [1, 2, 3, 4];

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Mover actividad</p><p className="text-[10px] font-bold text-slate-300">{modal.activity.actividad}</p></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button></div><div className="space-y-3 p-4"><div className="space-y-1">{options.map((option) => { const value = modal.type === "weekly" ? option : String(option); const label = modal.type === "weekly" ? option : `Semana ${option}`; return <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-700"><input type="radio" checked={String(target) === String(value)} onChange={() => setTarget(value)} />{label}</label>; })}</div><div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button></div></div></div></div>;
}

function EditScheduledBlockModal({ modal, draft, onChange, onSave, onClose }) {
  if (!modal?.activity) return null;
  const isManual = isManualReservationActivity(modal.activity);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white"><div><p className="text-xs font-black uppercase tracking-widest">{isManual ? "Editar bloque manual" : "Ajustar duración de este día"}</p><p className="text-[10px] font-bold text-slate-300">{modal.activity.actividad}</p></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button></div><div className="space-y-3 p-4">{!isManual && <p className="rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-2 text-[10px] font-bold text-sky-700">Solo cambia el tiempo dedicado este día y para esta persona. No modifica la actividad en Diseño Organizacional ni en los demás días.</p>}{isManual && <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre<input value={draft.name} onChange={(event) => onChange("name", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label>}<label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duración (min)<input type="number" min="1" value={draft.minutes} onChange={(event) => onChange("minutes", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button></div></div></div></div>;
}
function AgendaMonthlyMoveModal({ modal, target, setTarget, onSave, onClose }) {
  if (!modal?.block) return null;
  const rowOptions = ["Procesos", "Proyectos", "Formación"];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Mover bloque</p><p className="text-[10px] font-bold text-slate-300">{modal.block.actividad}</p></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button></div><div className="space-y-3 p-4"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo<select value={target.rowType} onChange={(event) => setTarget((current) => ({ ...current, rowType: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{rowOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Semana<select value={target.weekNumber} onChange={(event) => setTarget((current) => ({ ...current, weekNumber: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{[1, 2, 3, 4].map((week) => <option key={week} value={String(week)}>Semana {week}</option>)}</select></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button></div></div></div></div>;
}
function AgendaMonthlyEditModal({ modal, draft, onChange, onSave, onClose }) {
  if (!modal?.block) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Editar bloque</p><p className="text-[10px] font-bold text-slate-300">{modal.block.actividad}</p></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button></div><div className="space-y-3 p-4"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre<input value={draft.name} onChange={(event) => onChange("name", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duración (min)<input type="number" min="1" value={draft.minutes} onChange={(event) => onChange("minutes", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button><button type="button" onClick={onSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button></div></div></div></div>;
}
function hasFullAccess(user) {
  return hasWorkloadFullAccess(user);
}
function canEditPendingSourceActivities(user) {
  return canEditWorkloadPendingActivities(user);
}

export default function WorkloadBalanceModule({
  currentUser: currentUserProp = {
    name: "Usuario estratégico",
    team: "estrategia",
    roles: ["Administrador"],
  },
}){
  // El usuario real de la sesión (tabla `usuarios`) trae `nombre`, no `name`;
  // este módulo usa `currentUser.name` para mostrar/matchear a la persona actual.
  const currentUser = {
    ...currentUserProp,
    name: currentUserProp?.name || currentUserProp?.nombre || currentUserProp?.usuario || "Usuario",
  };
  const assignmentsVideoUrl = isStrategicTeamMember(currentUser) ? ASSIGNMENTS_VIDEO_URL_STRATEGIC : ASSIGNMENTS_VIDEO_URL_DEFAULT;
  const assignmentsManualUrl = isStrategicTeamMember(currentUser) ? ASSIGNMENTS_MANUAL_URL_STRATEGIC : ASSIGNMENTS_MANUAL_URL_DEFAULT;
  const assignmentsVideoTitle = isStrategicTeamMember(currentUser) ? ASSIGNMENTS_VIDEO_TITLE_STRATEGIC : ASSIGNMENTS_VIDEO_TITLE_DEFAULT;
  const [activities, setActivities] = useState(demoActivities);
  const [showWorkloadVideo, setShowWorkloadVideo] = useState(false);
  const [showAssignmentsVideo, setShowAssignmentsVideo] = useState(false);
  const [showAssignmentsHistory, setShowAssignmentsHistory] = useState(false);
  const [peopleCatalog, setPeopleCatalog] = useState([]);
  const [personRoleLinks, setPersonRoleLinks] = useState([]);
  const [weeklyPlansCatalog, setWeeklyPlansCatalog] = useState([]);
  const [liderProcesoOverrides, setLiderProcesoOverrides] = useState([]);
  const [monthlyPlansCatalog, setMonthlyPlansCatalog] = useState([]);
  const [schedulingActivity, setSchedulingActivity] = useState(null);
  const [selectedScheduleDays, setSelectedScheduleDays] = useState([]);
  const [selectedScheduleWeeks, setSelectedScheduleWeeks] = useState([]);
  const [selectedScheduleMonth, setSelectedScheduleMonth] = useState("");
  const [editingPendingActivity, setEditingPendingActivity] = useState(null);
  const [pendingActivityDraft, setPendingActivityDraft] = useState({ estado: "Activa", duracionMinutos: "60", frecuencia: "Mensual", motivo: "" });
  const [pendingActivityEditError, setPendingActivityEditError] = useState("");
  const [savingPendingActivity, setSavingPendingActivity] = useState(false);
  const [movePlanModal, setMovePlanModal] = useState(null);
  const [movePlanTarget, setMovePlanTarget] = useState("");
  const [editBlockModal, setEditBlockModal] = useState(null);
  const [editBlockDraft, setEditBlockDraft] = useState({ name: "", minutes: "" });
  const [agendaMoveModal, setAgendaMoveModal] = useState(null);
  const [agendaMoveTarget, setAgendaMoveTarget] = useState("");
  const [agendaEditModal, setAgendaEditModal] = useState(null);
  const [agendaEditDraft, setAgendaEditDraft] = useState({ name: "", minutes: "" });
  const [agendaMonthlyMoveModal, setAgendaMonthlyMoveModal] = useState(null);
  const [agendaMonthlyMoveTarget, setAgendaMonthlyMoveTarget] = useState({ rowType: "", weekNumber: "" });
  const [agendaMonthlyEditModal, setAgendaMonthlyEditModal] = useState(null);
  const [agendaMonthlyEditDraft, setAgendaMonthlyEditDraft] = useState({ name: "", minutes: "" });
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [loadingActivities, setLoadingActivities] = useState(true);

  async function loadWorkloadData() {
    setLoadingActivities(true);

    const [data, peopleData, personRolesData, weeklyPlansData, monthlyPlansData, assignmentsData, liderProcesoOverridesData] = await Promise.all([
      getWorkloadActivities(),
      getWorkloadPeople(),
      getWorkloadPersonRoles(),
      getWorkloadWeeklyPlans(),
      getWorkloadMonthlyPlans(),
      getWorkloadAssignments(),
      getLiderProcesoOverrides(),
    ]);

    setPeopleCatalog(safeArray(peopleData).filter((person) => isActiveRecord(person)));
    setPersonRoleLinks(safeArray(personRolesData).filter((link) => isActiveRecord(link) && getPersonRoleName(link)));
    setWeeklyPlansCatalog(safeArray(weeklyPlansData).filter((plan) => isActiveRecord(plan)));
    setMonthlyPlansCatalog(safeArray(monthlyPlansData).filter((plan) => isActiveRecord(plan)));
    setLiderProcesoOverrides(safeArray(liderProcesoOverridesData));
    setAssignments(safeArray(assignmentsData).filter((assignment) => isActiveRecord(assignment)).map((assignment) => ({
      id: assignment.id,
      personaId: assignment.persona_id,
      tipo: assignment.tipo || "Proyecto",
      prioridad: assignment.prioridad || "Media",
      responsable: assignment.responsable || "",
      rol: assignment.rol || assignment.responsable || "",
      revisara: assignment.revisara || "",
      aprobara: assignment.aprobara || "",
      seguimiento: assignment.seguimiento || "",
      gestionarEn: assignment.gestion || assignment.gestionarEn || "",
      horas: Number(assignment.carga_horas || assignment.horas || (Number(assignment.duracion_minutos || 0) / 60) || 0),
      duracionMinutos: Number(assignment.duracion_minutos || (Number(assignment.carga_horas || 0) * 60) || 60),
      fechaLimite: assignment.fecha_limite || assignment.fechaLimite || "",
      horaLimite: assignment.hora_limite || "",
      estado: assignment.estado || "Pendiente",
      asigna: assignment.asigna || "Usuario",
      asignaRol: assignment.asigna_rol || assignment.asignaRol || "Usuario",
      titulo: assignment.titulo || `${assignment.tipo || "Asignación"} · ${assignment.gestion || ""}`,
      semanaMes: assignment.semana_mes,
      programadaDia: assignment.dia_semana,
      origen: assignment.origen || assignment.categoria || "Proyectos",
      programadaPor: assignment.programada_por,
      programadaAt: assignment.programada_at,
      grupoReunion: assignment.grupo_reunion || null,
      nombre: assignment.nombre || assignment.titulo || assignment.tipo || "Asignación",
      descripcion: assignment.descripcion || "",
      origenEstrategico: assignment.origen_estrategico || "",
      fechaInicio: assignment.fecha_inicio || "",
      urlExterna: assignment.url_externa || "",
      procesoActividadId: assignment.proceso_actividad_id || null,
      horasTotales: Number(assignment.horas_totales || assignment.carga_horas || 0),
      horasProgramadas: Number(assignment.horas_programadas || 0),
      horasEjecutadas: Number(assignment.horas_ejecutadas || 0),
      horasPendientes: Number(
        assignment.horas_pendientes ??
          Math.max(0, Number(assignment.horas_totales || assignment.carga_horas || 0) - Number(assignment.horas_programadas || 0))
      ),
      estadoProyecto: assignment.estado_proyecto || (assignment.estado === "Cancelada" ? "Cancelado" : "Pendiente"),
      estadoProgramacion: assignment.estado_programacion || (assignment.estado === "Programada" ? "Totalmente programado" : "Sin programar"),
      confirmadoAsistencia: Boolean(assignment.confirmado_asistencia),
      confirmadoAt: assignment.confirmado_at || null,
    })));

    if (data.length > 0) {
      const mappedActivities = data.map((item) => ({
        id: item.id,
        origen: item.tipo || item.origen || getManualSourceType(item) || "Proceso",
        proceso: item.proceso || "Proceso Operativo",
        subproceso: item.subproceso || item.sourceRecord?.subproceso || "",
        actividad: item.actividad || item.titulo,
        persona: "",
        rol: item.rol || item.puesto || "Sin rol asignado",
        responsable: item.responsable || "Sin responsable",
        cargaSemanal: Number(item.carga_horas || 0),
        cargaMensual: Number((Number(item.carga_horas || 0) * getActivityMonthlyOccurrences(item.frecuencia)).toFixed(2)),
        duracionMinutos: Number(item.duracion_minutos || 60),
        diaTipico: item.dia_tipico || item.observaciones?.replace("Día típico: ", "") || "Lunes",
        frecuencia: item.frecuencia,
        mesPlaneado: item.mes_planeado || item.mesPlaneado || "",
        mes_planeado: item.mes_planeado || item.mesPlaneado || "",
        frecuenciaValor: item.frecuencia_valor,
        ordenFlujo: item.orden_flujo ?? item.ordenFlujo ?? item.sourceRecord?.orden_flujo,
        orden_flujo: item.orden_flujo ?? item.ordenFlujo ?? item.sourceRecord?.orden_flujo,
        orden: item.orden ?? item.sourceRecord?.orden,
        numeroActividad: item.numero_actividad ?? item.numeroActividad ?? item.orden_flujo ?? item.orden,
        numero_actividad: item.numero_actividad ?? item.numeroActividad ?? item.orden_flujo ?? item.orden,
        fase: item.fase || item.sourceRecord?.fase || "",
        semanaTipica: "Semana 1",
        fecha: item.fecha_inicio || "Sin fecha",
        activa: item.activa !== false,
        estado: item.estado || (item.activa === false ? "inactive" : "active"),
        estadoAgenda: item.estado || "Pendiente",
        semaforo: item.semaforo ?? null,
        sourceRecord: item,
      }));

      setActivities(mappedActivities);
    }

    setLoadingActivities(false);
  }

  useEffect(() => {
    loadWorkloadData();
  }, []);
  // Semáforo: un solo campo compartido en la actividad maestra
  // (proceso_actividades.semaforo), no una copia por bloque/ocurrencia —
  // por eso el cambio se aplica a TODAS las apariciones de esa actividad
  // (Semana, Mes, Planificación) actualizando el estado local por id, en
  // vez de solo la tarjeta donde se dio clic.
  async function handleSemaforoChange(activityId, nextValue) {
    if (!activityId) return;
    setActivities((current) => current.map((item) => (item.id === activityId ? { ...item, semaforo: nextValue } : item)));
    try {
      await updateActivitySemaforo(activityId, nextValue);
    } catch (err) {
      console.error("SUPABASE proceso_actividades semaforo ERROR:", err);
      setScheduleMessage("No fue posible guardar el semáforo.");
    }
  }
  const [personFilter, setPersonFilter] = useState(() => (currentUser?.persona_id ? String(currentUser.persona_id) : "all"));
  const [roleFilter, setRoleFilter] = useState("all");
  const [jornadaInicio, setJornadaInicio] = useState("08:00");
  const [showScheduleColumn, setShowScheduleColumn] = useState(false);
  const [viewMode, setViewMode] = useState("capacity");
  const [scheduleOverrides, setScheduleOverrides] = useState({});
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [manualProjects, setManualProjects] = useState([]);
  const [quickProjectDay, setQuickProjectDay] = useState(null);
  const [quickProjectName, setQuickProjectName] = useState("");
  const [quickProjectMinutes, setQuickProjectMinutes] = useState("120");
  const [quickProjectType, setQuickProjectType] = useState("Proyecto");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [monthlyBlocks, setMonthlyBlocks] = useState([]);
  const [monthlyBlockName, setMonthlyBlockName] = useState("");
  const [monthlyBlockMinutes, setMonthlyBlockMinutes] = useState("60");
  const [monthlyBlockFrequency, setMonthlyBlockFrequency] = useState("Mensual");
  const [monthlyBlockType, setMonthlyBlockType] = useState("Proyecto");
  const [editingMonthlyBlockId, setEditingMonthlyBlockId] = useState(null);
  const [draggedMonthlyBlock, setDraggedMonthlyBlock] = useState(null);
  const [monthlyQuickTarget, setMonthlyQuickTarget] = useState(null);
  const [monthlyDropIndicator, setMonthlyDropIndicator] = useState(null);
  const [monthlySnapshotMode, setMonthlySnapshotMode] = useState(false);
  const [agendaView, setAgendaView] = useState("weekly");
  const [agendaManualBlocks, setAgendaManualBlocks] = useState([]);
  const [agendaRemovedBlockIds, setAgendaRemovedBlockIds] = useState([]);
  const [agendaQuickDay, setAgendaQuickDay] = useState(null);
  const [agendaBlockName, setAgendaBlockName] = useState("");
  const [agendaBlockMinutes, setAgendaBlockMinutes] = useState("60");
  const [agendaBlockType, setAgendaBlockType] = useState("Proyecto");
  const [agendaMonthlyBlocks, setAgendaMonthlyBlocks] = useState([]);
  const [agendaMonthlyQuickTarget, setAgendaMonthlyQuickTarget] = useState(null);
  const [agendaMonthlyBlockName, setAgendaMonthlyBlockName] = useState("");
  const [agendaMonthlyBlockMinutes, setAgendaMonthlyBlockMinutes] = useState("60");
  const [agendaMonthlyBlockType, setAgendaMonthlyBlockType] = useState("Proyecto");
  const [agendaMonthlyDraggedBlock, setAgendaMonthlyDraggedBlock] = useState(null);
  const [agendaMonthlyDropIndicator, setAgendaMonthlyDropIndicator] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [completedAgendaBlockIds, setCompletedAgendaBlockIds] = useState([]);
  const currentWorkWeek = useMemo(() => getCurrentWorkWeekRange(), []);
  const [planningWeekStart, setPlanningWeekStart] = useState(currentWorkWeek.start);
  const [planningWeekEnd, setPlanningWeekEnd] = useState(currentWorkWeek.end);
  const [agendaDraggedBlock, setAgendaDraggedBlock] = useState(null);
  const [agendaDropIndicator, setAgendaDropIndicator] = useState(null);
  const [planApproval, setPlanApproval] = useState({ status: "Pendiente VOBO", approvedBy: "", approvedAt: "" });
  const [planSaveWarning, setPlanSaveWarning] = useState("");
  const [overwritePlanId, setOverwritePlanId] = useState(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [improvementProposal, setImprovementProposal] = useState("");
  const storageScopeRef = useRef("");
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [reviewStatus, setReviewStatus] = useState({ status: "Pendiente revisión", reviewedBy: "", reviewedRole: "", reviewedAt: "" });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState({ nombre: "", descripcion: "", origenEstrategico: "Balance de carga", titulo: "", tipo: "Proyecto", prioridad: "Media", responsable: "", revisara: "", aprobara: "", seguimiento: "PMO", gestionarEn: "Planner", horas: 4, fechaInicio: "", fechaLimite: currentWorkWeek.end, urlExterna: "" });
  const [assignmentFormError, setAssignmentFormError] = useState("");
  const [programAssignmentModal, setProgramAssignmentModal] = useState(null);
  const [programAssignmentDraft, setProgramAssignmentDraft] = useState({ type: "weekly", horas: 1, dia: "Lunes", semanaMes: 1, comentario: "" });
  const [programAssignmentError, setProgramAssignmentError] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingDraft, setMeetingDraft] = useState({ titulo: "", participantIds: [], prioridad: "Media", gestionarEn: "Planner", horas: 1, fechaLimite: currentWorkWeek.end, horaLimite: "" });
  const [meetingMessage, setMeetingMessage] = useState("");
  const [assignmentStatusDetail, setAssignmentStatusDetail] = useState(null);
  const [assignmentManagementDetail, setAssignmentManagementDetail] = useState(null);
  const [assignmentScheduleModal, setAssignmentScheduleModal] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [assignmentEditDraft, setAssignmentEditDraft] = useState({ nombre: "", descripcion: "", origenEstrategico: "Balance de carga", titulo: "", tipo: "Proyecto", prioridad: "Media", estadoProyecto: "Pendiente", revisara: "Líder de proceso", aprobara: "Director General", seguimiento: "PMO", gestionarEn: "Planner", horas: 4, horasEjecutadas: 0, fechaInicio: "", fechaLimite: currentWorkWeek.end, urlExterna: "" });
  const [assignmentEditError, setAssignmentEditError] = useState("");
  const [editingMeetingAssignment, setEditingMeetingAssignment] = useState(null);
  const [meetingEditDraft, setMeetingEditDraft] = useState({ titulo: "", prioridad: "Media", gestionarEn: "Planner", horas: 1, fechaLimite: "", horaLimite: "" });
  const [meetingEditError, setMeetingEditError] = useState("");
  const [assignmentScheduleDraft, setAssignmentScheduleDraft] = useState({
    destino: "monthly-standard",
    semanaMes: 1,
    dia: "Lunes",
    origen: "Proyectos",
    horas: 4,
    planningWeekStart: currentWorkWeek.start,
    planningWeekEnd: currentWorkWeek.end,
    planningMonth: currentWorkWeek.start.slice(0, 7),
  });

  const canViewAllWorkloads = hasFullAccess(currentUser);
  const normalizedActivities = useMemo(() => normalizeActivities(activities, scheduleOverrides), [activities, scheduleOverrides]);
  const activePersonRoleLinks = useMemo(() => safeArray(personRoleLinks).filter((link) => isActiveRecord(link) && getPersonRoleName(link)), [personRoleLinks]);
  const peopleOptions = useMemo(
    () => safeArray(peopleCatalog)
      .filter((person) => isActiveRecord(person) && getPersonId(person))
      .map((person) => ({
        ...person,
        id: String(getPersonId(person)),
        name: getPersonName(person),
      }))
      .filter((person, index, list) => person.name && list.findIndex((item) => item.id === person.id) === index)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [peopleCatalog]
  );
  const currentUserPersonId = useMemo(() => {
    if (currentUser?.persona_id) {
      const byId = peopleOptions.find((person) => String(person.id) === String(currentUser.persona_id));
      if (byId) return byId.id;
    }
    const currentName = normalizeText(currentUser?.name);
    return peopleOptions.find((person) => normalizeText(person.name) === currentName)?.id || "";
  }, [currentUser?.persona_id, currentUser?.name, peopleOptions]);
  // Todos pueden VER la carga de cualquier persona (para eso está el filtro).
  // Solo pueden EDITAR/programar cuando están viendo su propia carga, salvo
  // los roles con acceso total (ver hasWorkloadFullAccess) o una excepción
  // puntual por persona/rol (ver canEditWorkloadForPersonRoles).
  const effectivePersonFilter = personFilter;
  const isOwnRecordSelected = Boolean(currentUserPersonId) && String(effectivePersonFilter) === String(currentUserPersonId);
  const selectedPersonRoles = useMemo(
    () =>
      effectivePersonFilter === "all"
        ? []
        : activePersonRoleLinks
            .filter((link) => String(link.persona_id ?? link.person_id ?? "") === String(effectivePersonFilter))
            .map((link) => getPersonRoleName(link)),
    [activePersonRoleLinks, effectivePersonFilter]
  );
  const canEditSelectedPerson =
    canViewAllWorkloads || isOwnRecordSelected || canEditWorkloadForPersonRoles(currentUser, selectedPersonRoles);
  const selectedPersonOption = useMemo(
    () => peopleOptions.find((person) => String(person.id) === String(effectivePersonFilter)) || null,
    [peopleOptions, effectivePersonFilter]
  );
  const selectedPersonName = selectedPersonOption?.name || (effectivePersonFilter === "all" ? "" : currentUser?.name || "");
  const selectedPersonCapacity = useMemo(() => {
    const capacityPerson = effectivePersonFilter === "all" ? null : selectedPersonOption;
    const days = WEEK_DAYS.reduce((summary, dayName) => {
      summary[dayName] = {
        hours: getPersonDayCapacityHours(capacityPerson, dayName),
        minutes: getPersonDayCapacityMinutes(capacityPerson, dayName),
      };
      return summary;
    }, {});

    const weeklyHours = getPersonWeeklyCapacityHours(capacityPerson);
    return {
      days,
      weeklyHours,
      weeklyMinutes: Math.round(weeklyHours * 60),
      monthlyHours: getPersonMonthlyCapacityHours(capacityPerson),
    };
  }, [effectivePersonFilter, selectedPersonOption]);
  const isMonthlyPlanning = agendaView === "monthly";
  const workloadStorageScope = effectivePersonFilter === "all" ? "all" : String(effectivePersonFilter || "all");
  const visibleAssignments = useMemo(
    () => assignments.filter((assignment) => {
      const personMatches =
        effectivePersonFilter === "all" ||
        String(assignment.personaId || assignment.persona_id || "") === String(effectivePersonFilter);
      const roleMatches =
        roleFilter === "all" ||
        normalizeText(assignment.rol || assignment.responsable) === normalizeText(roleFilter);
      const isConcluded = ["Finalizado", "Cancelado"].includes(assignment.estadoProyecto);
      return personMatches && roleMatches && assignment.estado !== "Cancelada" && isConcluded === showAssignmentsHistory;
    }),
    [assignments, effectivePersonFilter, roleFilter, showAssignmentsHistory]
  );
  const selectedPersonRoleLinks = useMemo(
    () => effectivePersonFilter === "all"
      ? activePersonRoleLinks
      : activePersonRoleLinks.filter((link) => String(link.persona_id ?? link.person_id ?? "") === String(effectivePersonFilter)),
    [activePersonRoleLinks, effectivePersonFilter]
  );
  useEffect(() => {
    storageScopeRef.current = workloadStorageScope;
    setStorageHydrated(false);
    setManualProjects(readStoredArray(getScopedStorageKey("vikingo-workload-manual-projects", workloadStorageScope)));
    setMonthlyBlocks(readStoredArray(getScopedStorageKey("vikingo-workload-monthly-blocks", workloadStorageScope)));
    setAgendaManualBlocks(readStoredArray(getScopedStorageKey("vikingo-workload-agenda-manual-blocks", workloadStorageScope)));
    setSavedPlans(readStoredArray(getScopedStorageKey("vikingo-workload-saved-plans", workloadStorageScope)));
    setJornadaInicio(readStoredValue(getScopedStorageKey("vikingo-workload-jornada-inicio", workloadStorageScope), "08:00"));
    setAgendaRemovedBlockIds([]);
    setCompletedAgendaBlockIds([]);
    setSelectedPlanId(null);
    setMonthlySnapshotMode(false);
    setScheduleOverrides({});
    setDraggedActivity(null);
    setDraggedMonthlyBlock(null);
    setAgendaDraggedBlock(null);
    setStorageHydrated(true);
  }, [workloadStorageScope]);

  useEffect(() => {
    if (!storageHydrated) return;
    writeStoredArray(getScopedStorageKey("vikingo-workload-manual-projects", storageScopeRef.current), manualProjects);
  }, [manualProjects, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    writeStoredArray(getScopedStorageKey("vikingo-workload-monthly-blocks", storageScopeRef.current), monthlyBlocks);
  }, [monthlyBlocks, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    writeStoredArray(getScopedStorageKey("vikingo-workload-agenda-manual-blocks", storageScopeRef.current), agendaManualBlocks);
  }, [agendaManualBlocks, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    writeStoredArray(getScopedStorageKey("vikingo-workload-saved-plans", storageScopeRef.current), savedPlans);
  }, [savedPlans, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    writeStoredValue(getScopedStorageKey("vikingo-workload-jornada-inicio", storageScopeRef.current), jornadaInicio);
  }, [jornadaInicio, storageHydrated]);

  useEffect(() => {
    loadSavedPlansFromSupabase();
  }, [effectivePersonFilter, isMonthlyPlanning]);

  const roleOptions = useMemo(
    () => [...new Set(selectedPersonRoleLinks.map(getPersonRoleName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [selectedPersonRoleLinks]
  );
  // Puesto (no rol) para los selectores de asignaciones: un puesto está
  // ligado 1:1 a una persona en `personas`, mientras que un rol puede
  // compartirse entre varias personas en distintos procesos. Usar puesto
  // permite relacionar directamente la asignación con el balance de carga
  // de esa persona.
  const puestoOptions = useMemo(
    () => [...new Set(peopleOptions.map((person) => cleanText(person.puesto)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [peopleOptions]
  );
  useEffect(() => {
    if (roleFilter !== "all" && !roleOptions.includes(roleFilter)) {
      setRoleFilter("all");
    }
  }, [roleFilter, roleOptions]);
  const visibleActivities = useMemo(() => {
    if (effectivePersonFilter === "all") return normalizedActivities;
    return getPersonAdjustedActivities(normalizedActivities, liderProcesoOverrides, effectivePersonFilter);
  }, [normalizedActivities, liderProcesoOverrides, effectivePersonFilter]);
  const filteredActivities = useMemo(() => {
    const roleLinks = roleFilter === "all"
      ? selectedPersonRoleLinks
      : selectedPersonRoleLinks.filter((link) => normalizeText(getPersonRoleName(link)) === normalizeText(roleFilter));

    return visibleActivities.filter((activity) => {
      if (isManualReservationActivity(activity)) {
        return normalizeText(activity.responsable) === normalizeText(selectedPersonName);
      }
      return roleLinks.some((link) => activityMatchesRoleLink(activity, link, { strictLiderProceso: true }));
    });
  }, [visibleActivities, selectedPersonRoleLinks, roleFilter, selectedPersonName]);
  const scheduledActivityIds = useMemo(
    () => {
      if (effectivePersonFilter === "all") return new Set();
      const weeklyIds = collectScheduledActivityIds(
        safeArray(weeklyPlansCatalog).filter((plan) => getPlanPersonId(plan) === String(effectivePersonFilter))
      );
      const monthlyIds = collectScheduledActivityIds(
        safeArray(monthlyPlansCatalog).filter((plan) => getPlanPersonId(plan) === String(effectivePersonFilter))
      );
      return new Set([...weeklyIds, ...monthlyIds]);
    },
    [weeklyPlansCatalog, monthlyPlansCatalog, effectivePersonFilter]
  );
  // Vista de equipo para Coordinador SIG/PM/Director: cuando el filtro de
  // persona está en "Todas las personas", se calcula la utilización mensual
  // de cada persona (mismo criterio que el gráfico de un solo integrante)
  // para que puedan ver de un vistazo quién está sobrecargado.
  const teamCapacityOverview = useMemo(() => {
    if (effectivePersonFilter !== "all") return [];
    return peopleOptions.map((person) => {
      const personRoleLinks = activePersonRoleLinks.filter(
        (link) => String(link.persona_id ?? link.person_id ?? "") === String(person.id)
      );
      const personActivities = getPersonAdjustedActivities(normalizedActivities, liderProcesoOverrides, person.id);
      const relevantActivities = personActivities.filter((activity) => {
        if (isManualReservationActivity(activity)) return normalizeText(activity.responsable) === normalizeText(person.name);
        return personRoleLinks.some((link) => activityMatchesRoleLink(activity, link, { strictLiderProceso: true }));
      });
      // Igual criterio que sourceSummary/SourceDistributionPie para el
      // integrante seleccionado: la utilización mensual no descuenta las
      // actividades "quitadas" (excluidoPersonal), para que el % coincida
      // con el que ve la propia persona en su vista individual.
      const monthlyTotal = relevantActivities.reduce((sum, activity) => sum + Number(activity.cargaMensual || 0), 0);
      const monthlyCapacity = getPersonMonthlyCapacityHours(person);
      const utilization = monthlyCapacity > 0 ? (monthlyTotal / monthlyCapacity) * 100 : 0;
      const personScheduledIds = new Set([
        ...collectScheduledActivityIds(safeArray(weeklyPlansCatalog).filter((plan) => getPlanPersonId(plan) === String(person.id))),
        ...collectScheduledActivityIds(safeArray(monthlyPlansCatalog).filter((plan) => getPlanPersonId(plan) === String(person.id))),
      ]);
      const pendingHours = relevantActivities
        .filter((activity) => !isManualReservationActivity(activity) && !activity.excluidoPersonal && !personScheduledIds.has(String(activity.id)))
        .reduce((sum, activity) => sum + getDurationMinutes(activity) / 60, 0);
      return {
        id: person.id,
        name: person.name,
        monthlyTotal,
        monthlyCapacity,
        utilization,
        pendingHours,
        signal: getUtilizationSignal(utilization),
      };
    }).sort((a, b) => b.utilization - a.utilization);
  }, [effectivePersonFilter, peopleOptions, activePersonRoleLinks, normalizedActivities, liderProcesoOverrides, weeklyPlansCatalog, monthlyPlansCatalog]);
  const pendingActivities = useMemo(() => {
    if (effectivePersonFilter === "all") return [];

    const groupedActivities = new Map();

    visibleActivities
      .filter((activity) => !isManualReservationActivity(activity))
      .filter((activity) => !activity.excluidoPersonal)
      .filter((activity) => selectedPersonRoleLinks.some((link) => activityMatchesRoleLink(activity, link)))
      .forEach((activity) => {
        const key = getPendingActivityUniqueKey(activity);
        if (!key) return;

        const current = groupedActivities.get(key) || { activity: null, scheduled: false };
        groupedActivities.set(key, {
          activity: selectPendingActivityRepresentative(current.activity, activity),
          scheduled: current.scheduled || scheduledActivityIds.has(String(activity.id)),
        });
      });

    return [...groupedActivities.values()]
      .filter((group) => group.activity && !group.scheduled)
      .map((group) => group.activity)
      .sort((a, b) => {
        const criticalityDiff = getCriticalityRank(a.sourceRecord?.criticidad || a.criticidad) - getCriticalityRank(b.sourceRecord?.criticidad || b.criticidad);
        if (criticalityDiff !== 0) return criticalityDiff;
        const processDiff = cleanText(a.proceso).localeCompare(cleanText(b.proceso));
        if (processDiff !== 0) return processDiff;
        return cleanText(a.actividad).localeCompare(cleanText(b.actividad));
      });
  }, [effectivePersonFilter, visibleActivities, selectedPersonRoleLinks, scheduledActivityIds]);
  const excludedPendingActivities = useMemo(() => {
    if (effectivePersonFilter === "all") return [];

    return visibleActivities
      .filter((activity) => !isManualReservationActivity(activity))
      .filter((activity) => activity.excluidoPersonal)
      .filter((activity) => selectedPersonRoleLinks.some((link) => activityMatchesRoleLink(activity, link)))
      .sort((a, b) => new Date(b.excluidoEn || 0) - new Date(a.excluidoEn || 0));
  }, [effectivePersonFilter, visibleActivities, selectedPersonRoleLinks]);
  const filteredPendingActivities = useMemo(() => {
    const filtered = roleFilter === "all"
      ? pendingActivities
      : pendingActivities.filter((activity) => normalizeText(activity.rol) === normalizeText(roleFilter));
    const unique = dedupePendingActivities(filtered);

    if (
      typeof window !== "undefined" &&
      window.location.hostname === "localhost" &&
      filtered.length !== unique.length
    ) {
      console.log("Pendientes deduplicados:", {
        antes: filtered.length,
        despues: unique.length,
      });
    }

    return unique;
  }, [pendingActivities, roleFilter]);
  const pendingTotalHours = useMemo(
    () => filteredPendingActivities.reduce((sum, activity) => sum + Number(activity.cargaSemanal || getDurationMinutes(activity) / 60), 0),
    [filteredPendingActivities]
  );
  const sourceSummary = useMemo(() => groupBySource(filteredActivities), [filteredActivities]);
  const scheduledWeeklyActivities = useMemo(() => {
    if (effectivePersonFilter === "all") return [];

    return sortByOrderCreated(safeArray(weeklyPlansCatalog)
      .filter((plan) => getPlanPersonId(plan) === String(effectivePersonFilter)))
      .map((plan, index) => {
        const activity = visibleActivities.find((item) => String(item.id) === getPlanActivityId(plan));
        if (!activity) return null;
        const plannedHours = getPlannedHours(activity, plan);

        return {
          ...activity,
          id: `${activity.id}-weekly-${plan.id || index}`,
          planId: plan.id,
          planType: "weekly",
          personaId: plan.persona_id,
          sourceActivityId: activity.id,
          cargaSemanal: plannedHours,
          cargaMensual: Number((plannedHours * 4).toFixed(2)),
          duracionMinutos: Math.round(plannedHours * 60),
          diaTipico: getPlanDayName(plan),
          programaciones: [{ diaTipico: getPlanDayName(plan), orden: getSortableOrder(plan, index) }],
          planCreatedAt: plan.created_at,
          planningSource: "Semana tipica",
        };
      })
      .filter(Boolean);
  }, [weeklyPlansCatalog, visibleActivities, effectivePersonFilter]);
  const scheduledMonthlyBlocks = useMemo(() => {
    if (effectivePersonFilter === "all") return [];

    return sortByOrderCreated(safeArray(monthlyPlansCatalog)
      .filter((plan) => getPlanPersonId(plan) === String(effectivePersonFilter)))
      .map((plan, index) => {
        const activity = visibleActivities.find((item) => String(item.id) === getPlanActivityId(plan));
        if (!activity) return null;
        const plannedHours = getPlannedHours(activity, plan);
        const weekNumber = Number(plan.semana_mes || plan.weekNumber || plan.semana || 1);

        return {
          ...activity,
          id: `${activity.id}-monthly-${plan.id || index}`,
          planId: plan.id,
          planType: "monthly",
          personaId: plan.persona_id,
          sourceActivityId: activity.id,
          semanaMes: weekNumber,
          origen: activity.origen === "Proceso" ? "Procesos" : activity.origen === "Proyecto" ? "Proyectos" : activity.origen,
          cargaMensual: plannedHours,
          duracionMinutos: Math.round(plannedHours * 60),
          targetWeeks: [weekNumber],
          monthlyOrder: getSortableOrder(plan, index),
          monthlyCreatedAt: plan.created_at,
          isMonthlyBlock: true,
        };
      })
      .filter(Boolean);
  }, [monthlyPlansCatalog, visibleActivities, effectivePersonFilter]);
  const scheduledAssignmentMonthlyBlocks = useMemo(
    () => visibleAssignments
      .filter((assignment) => assignment.estado === "Programada" && Number(assignment.semanaMes || assignment.semana_mes) >= 1)
      .map((assignment) => {
        const weekNumber = Number(assignment.semanaMes || assignment.semana_mes || 1);
        const durationMinutes = Number(assignment.duracionMinutos || assignment.duracion_minutos || Number(assignment.horas || assignment.carga_horas || 1) * 60);
        return {
          id: `assignment-monthly-${assignment.id}`,
          monthlyOccurrenceId: `assignment-monthly-${assignment.id}-w${weekNumber}`,
          assignmentId: assignment.id,
          origen: assignment.origen || "Proyectos",
          tipoBloque: assignment.tipo,
          actividad: assignment.titulo,
          personaId: assignment.personaId,
          responsable: assignment.responsable,
          rol: assignment.rol || assignment.responsable || "Asignación",
          duracionMinutos: durationMinutes,
          frecuencia: "Asignación",
          targetWeeks: [weekNumber],
          semanaMes: weekNumber,
          diaTipico: assignment.programadaDia || assignment.dia_semana,
          cargaMensual: Number((durationMinutes / 60).toFixed(2)),
          monthlyOrder: getSortableOrder({ orden: assignment.orden, monthlyOrder: assignment.id }, 0),
          monthlyCreatedAt: assignment.created_at,
          isMonthlyBlock: true,
          isAssignmentBlock: true,
        };
      }),
    [visibleAssignments]
  );
  const scheduledAssignmentWeeklyActivities = useMemo(
    () => visibleAssignments
      .filter((assignment) => assignment.estado === "Programada" && assignment.programadaDia && !Number(assignment.semanaMes || assignment.semana_mes))
      .map((assignment) => {
        const durationMinutes = Number(assignment.duracionMinutos || assignment.duracion_minutos || Number(assignment.horas || assignment.carga_horas || 1) * 60);
        const sourceType = getWeeklyTypeFromAssignmentOrigin(assignment.origen || getAssignmentDefaultOrigin(assignment.tipo));
        return {
          id: `assignment-weekly-${assignment.id}`,
          occurrenceId: `assignment-weekly-${assignment.id}-0`,
          occurrenceIndex: 0,
          assignmentId: assignment.id,
          origen: sourceType,
          proceso: "Asignación",
          subproceso: assignment.tipo || "",
          actividad: assignment.titulo,
          persona: assignment.responsable,
          personaId: assignment.personaId,
          responsable: assignment.responsable,
          rol: assignment.rol || assignment.responsable || "Asignación",
          duracionMinutos: durationMinutes,
          cargaSemanal: Number((durationMinutes / 60).toFixed(2)),
          cargaMensual: Number(((durationMinutes / 60) * 4).toFixed(2)),
          frecuencia: "Asignación",
          diaTipico: assignment.programadaDia,
          semanaTipica: "Semana 1",
          orden: getSortableOrder({ orden: assignment.orden, created_at: assignment.created_at, id: assignment.id }, 0),
          estadoAgenda: "Programada",
          planningSource: "Asignación",
          isAssignmentBlock: true,
        };
      }),
    [visibleAssignments]
  );
  const weekOccurrences = useMemo(() => expandWeeklyOccurrences(scheduledWeeklyActivities).filter((activity) => WEEK_VISIBLE_TYPES.includes(activity.origen)).concat(scheduledAssignmentWeeklyActivities, manualProjects).sort(compareOrderCreated), [scheduledWeeklyActivities, scheduledAssignmentWeeklyActivities, manualProjects]);
  const capacityInsightDays = useMemo(() => {
    const scheduledByDay = WEEK_DAYS.reduce((acc, day) => { acc[day] = 0; return acc; }, {});
    weekOccurrences.forEach((activity) => {
      if (scheduledByDay[activity.diaTipico] !== undefined) scheduledByDay[activity.diaTipico] += Number(activity.duracionMinutos || 0) / 60;
    });
    return WEEK_DAYS.map((day) => ({
      name: day,
      capacityHours: selectedPersonCapacity.days[day]?.hours || 0,
      scheduledHours: scheduledByDay[day],
    }));
  }, [weekOccurrences, selectedPersonCapacity]);
  const capacityInsightWeeklyScheduledHours = useMemo(
    () => capacityInsightDays.reduce((sum, day) => sum + day.scheduledHours, 0),
    [capacityInsightDays]
  );
  const planningMonthlyBlocks = monthlySnapshotMode ? monthlyBlocks : scheduledMonthlyBlocks.concat(scheduledAssignmentMonthlyBlocks, monthlyBlocks);
  const monthlyMatrix = useMemo(() => buildMonthlyMatrix({ weekOccurrences: [], monthlyBlocks: planningMonthlyBlocks }), [planningMonthlyBlocks]);
  const monthlyPlanningBaseBlocks = useMemo(() => monthlyMatrix.flatMap((row) =>
    row.weeks.flatMap((week) =>
      safeArray(week.blocks)
        .filter((block) => block.isMonthlyBlock)
        .map((block, index) => ({
          ...block,
          id: block.monthlyOccurrenceId || `${block.id || "month-base"}-agenda-w${week.weekNumber}-${index}`,
          sourceBlockId: block.id,
          monthlyOccurrenceId: block.monthlyOccurrenceId || `${block.id || "month-base"}-agenda-w${week.weekNumber}-${index}`,
          origen: row.type,
          targetWeeks: [week.weekNumber],
          semanaMes: week.weekNumber,
          monthlyOrder: Number(block.monthlyOrder || block.orden || index + 1),
          planningSource: block.planningSource || "Mes típico",
          isMonthlyBlock: true,
        }))
    )
  ), [monthlyMatrix]);
  useEffect(() => {
    if (agendaView !== "monthly" || selectedPlanId) return;
    setAgendaMonthlyBlocks(monthlyPlanningBaseBlocks);
    setAgendaMonthlyQuickTarget(null);
    setAgendaMonthlyDraggedBlock(null);
    setAgendaMonthlyDropIndicator(null);
  }, [agendaView, selectedPlanId, monthlyPlanningBaseBlocks]);
  const agendaMonthlyMatrix = useMemo(() => buildMonthlyMatrix({ weekOccurrences: [], monthlyBlocks: agendaMonthlyBlocks }), [agendaMonthlyBlocks]);
  const weeklyTypicalLoad = useMemo(() => {
    const usedMinutes = weekOccurrences.reduce((sum, activity) => sum + getDurationMinutes(activity), 0);
    const hours = usedMinutes / 60;
    const capacityHours = selectedPersonCapacity.weeklyHours;
    const occupation = capacityHours > 0 ? (hours / capacityHours) * 100 : 0;
    return { usedMinutes, hours, occupation, capacityHours };
  }, [weekOccurrences, selectedPersonCapacity]);
  // La capacidad semanal de "Mes típico"/"Mes" en Planificación debe ser la
  // de la PERSONA seleccionada (suma de sus horas por día), no un genérico
  // fijo de 48h — antes cada "Semana N" mostraba /48h aunque la capacidad
  // real de la persona (suma de horas_lunes..horas_viernes) fuera distinta.
  const typicalMonth = useMemo(() => [1, 2, 3, 4].map((weekNumber) => { const monthlySpecificMinutes = monthlyMatrix.reduce((sum, row) => { const week = row.weeks.find((item) => item.weekNumber === weekNumber); return sum + Number(week?.usedMinutes || 0); }, 0); const totalMinutes = weeklyTypicalLoad.usedMinutes + monthlySpecificMinutes; const totalSemana = totalMinutes / 60; const weeklyCapacityHours = selectedPersonCapacity.weeklyHours; const occupation = weeklyCapacityHours > 0 ? (totalSemana / weeklyCapacityHours) * 100 : 0; return { week: `Semana ${weekNumber}`, total: totalSemana, totalSemana, monthlySpecificMinutes, weeklyTypicalLoad, occupation, status: getWorkloadStatus(occupation), capacityHours: weeklyCapacityHours }; }), [monthlyMatrix, weeklyTypicalLoad, selectedPersonCapacity]);
  const jornadaInicioMinutos = useMemo(() => parseTimeToMinutes(jornadaInicio), [jornadaInicio]);
  const dayCapacitySummary = useMemo(() => WEEK_DAYS.map((day) => { const activitiesForDay = weekOccurrences.filter((activity) => activity.diaTipico === day).sort(compareOrderCreated); let cursorMinutos = jornadaInicioMinutos; const activitiesWithSchedule = activitiesForDay.map((activity) => { const duracion = getDurationMinutes(activity); const horaInicioMinutos = cursorMinutos; const horaFinMinutos = cursorMinutos + duracion; cursorMinutos = horaFinMinutos; return { ...activity, horaInicioMinutos, horaFinMinutos }; }); const usedMinutes = activitiesForDay.reduce((sum, activity) => sum + getDurationMinutes(activity), 0); const capacityMinutes = selectedPersonCapacity.days?.[day]?.minutes || DAILY_CAPACITY_MINUTES; const capacityHours = selectedPersonCapacity.days?.[day]?.hours || DAILY_CAPACITY_HOURS; const occupation = capacityMinutes > 0 ? (usedMinutes / capacityMinutes) * 100 : 0; return { day, activities: activitiesWithSchedule, usedMinutes, occupation, capacityMinutes, capacityHours, availabilityMinutes: capacityMinutes - usedMinutes, status: getWorkloadStatus(occupation) }; }), [weekOccurrences, selectedPersonCapacity, jornadaInicioMinutos]);
  const programCapacityWarning = useMemo(() => {
    if (!programAssignmentModal?.assignment) return "";
    const horas = Number(programAssignmentDraft.horas || 0);
    if (!Number.isFinite(horas) || horas <= 0) return "";
    if (programAssignmentDraft.type === "weekly") {
      const overflowDays = safeArray(programAssignmentDraft.dias)
        .map((dayName) => dayCapacitySummary.find((item) => item.day === dayName))
        .filter(Boolean)
        .filter((day) => (day.usedMinutes / 60) + horas > day.capacityHours)
        .map((day) => day.day);
      if (overflowDays.length === 0) return "";
      return `Al programar, ${overflowDays.join(", ")} quedaría${overflowDays.length > 1 ? "n" : ""} por encima de su capacidad diaria.`;
    }
    const overflowWeeks = safeArray(programAssignmentDraft.semanas)
      .map((weekNumber) => typicalMonth.find((item) => item.week === `Semana ${weekNumber}`))
      .filter(Boolean)
      .filter((week) => week.total + horas > week.capacityHours)
      .map((week) => week.week);
    if (overflowWeeks.length === 0) return "";
    return `Al programar, ${overflowWeeks.join(", ")} quedaría${overflowWeeks.length > 1 ? "n" : ""} por encima de la capacidad típica semanal.`;
  }, [programAssignmentModal, programAssignmentDraft, dayCapacitySummary, typicalMonth]);
  const activeAgendaBlocks = useMemo(() => dedupeByKey(weekOccurrences.filter((activity) => !agendaRemovedBlockIds.includes(activity.occurrenceId)).map((activity) => ({ ...activity, planningSource: "Semana tipica" })).concat(agendaManualBlocks).sort(compareOrderCreated), getAgendaDedupeKey), [weekOccurrences, agendaRemovedBlockIds, agendaManualBlocks]);
  const agendaWeekSummary = useMemo(() => WEEK_DAYS.map((day) => { const activitiesForDay = activeAgendaBlocks.filter((activity) => activity.diaTipico === day).sort(compareOrderCreated); let cursorMinutos = jornadaInicioMinutos; const activities = activitiesForDay.map((activity) => { const duracion = getDurationMinutes(activity); const horaInicioMinutos = cursorMinutos; const horaFinMinutos = cursorMinutos + duracion; cursorMinutos = horaFinMinutos; return { ...activity, horaInicioMinutos, horaFinMinutos }; }); const usedMinutes = activitiesForDay.reduce((sum, activity) => sum + getDurationMinutes(activity), 0); const capacityMinutes = selectedPersonCapacity.days?.[day]?.minutes || DAILY_CAPACITY_MINUTES; const capacityHours = selectedPersonCapacity.days?.[day]?.hours || DAILY_CAPACITY_HOURS; const occupation = capacityMinutes > 0 ? (usedMinutes / capacityMinutes) * 100 : 0; return { day, activities, usedMinutes, occupation, capacityMinutes, capacityHours, status: getWorkloadStatus(occupation) }; }), [activeAgendaBlocks, selectedPersonCapacity, jornadaInicioMinutos]);
  const agendaMonthSummary = useMemo(() => [1, 2, 3, 4].map((weekNumber) => { const monthlySpecificMinutes = agendaMonthlyMatrix.reduce((sum, row) => { const week = row.weeks.find((item) => item.weekNumber === weekNumber); return sum + Number(week?.usedMinutes || 0); }, 0); const usedMinutes = weeklyTypicalLoad.usedMinutes + monthlySpecificMinutes; const totalSemana = usedMinutes / 60; const weeklyCapacityHours = selectedPersonCapacity.weeklyHours; const occupation = weeklyCapacityHours > 0 ? (totalSemana / weeklyCapacityHours) * 100 : 0; return { weekNumber, label: `Semana ${weekNumber}`, usedMinutes, totalSemana, monthlySpecificMinutes, weeklyTypicalLoad, occupation, capacityHours: weeklyCapacityHours, status: getWorkloadStatus(occupation) }; }), [agendaMonthlyMatrix, weeklyTypicalLoad, selectedPersonCapacity]);
  const weeklyPlanKpi = useMemo(() => { const planned = activeAgendaBlocks.length; const completed = activeAgendaBlocks.filter((activity) => completedAgendaBlockIds.includes(getAgendaBlockKey(activity))).length; const completion = planned > 0 ? (completed / planned) * 100 : 0; return { planned, completed, pending: Math.max(planned - completed, 0), completion: Number(completion.toFixed(0)), hasApproval: planApproval.status === "Aprobada con VOBO" }; }, [activeAgendaBlocks, completedAgendaBlockIds, planApproval.status]);
  const allWeeksPlanKpi = useMemo(() => {
    const plans = savedPlans.length > 0 ? savedPlans : [{ blocks: activeAgendaBlocks, completedBlockIds: completedAgendaBlockIds }];
    const planned = plans.reduce((sum, plan) => sum + safeArray(plan.blocks).length, 0);
    const completed = plans.reduce((sum, plan) => {
      const completedIds = safeArray(plan.completedBlockIds);
      return sum + safeArray(plan.blocks).filter((block) => completedIds.includes(getAgendaBlockKey(block))).length;
    }, 0);
    const completion = planned > 0 ? (completed / planned) * 100 : 0;
    return { planned, completed, pending: Math.max(planned - completed, 0), completion: Number(completion.toFixed(0)), weeks: plans.length };
  }, [savedPlans, activeAgendaBlocks, completedAgendaBlockIds]);
  const selectedPlan = savedPlans.find((plan) => String(plan.id) === String(selectedPlanId));

  function getLastOrderForDay(day) { const dayActivities = weekOccurrences.filter((activity) => activity.diaTipico === day); return dayActivities.length === 0 ? 0 : Math.max(...dayActivities.map((activity) => Number(activity.orden || 0))); }
  function updateDraggedSchedule(dragged, updater) {
    if (!dragged?.activityId) return;
    if (dragged.isManualProject) { setManualProjects((currentProjects) => currentProjects.map((project) => (project.id === dragged.activityId ? { ...project, ...updater({ diaTipico: project.diaTipico, orden: project.orden }) } : project))); setDraggedActivity(null); setDropIndicator(null); return; }
    setScheduleOverrides((currentOverrides) => { const currentActivity = normalizedActivities.find((activity) => activity.id === dragged.activityId); const existingSchedules = getActivitySchedules(currentActivity); const nextSchedules = existingSchedules.map((schedule, index) => (index === dragged.occurrenceIndex ? updater(schedule) : schedule)); return { ...currentOverrides, [dragged.activityId]: { ...(currentOverrides[dragged.activityId] || {}), programaciones: nextSchedules, diaTipico: nextSchedules[0]?.diaTipico || currentActivity?.diaTipico || "Lunes" } }; });
    setDraggedActivity(null); setDropIndicator(null);
  }
  async function persistDraggedWeeklyPlan(activity, targetDay, targetIndex) {
    if (!activity?.planId || !targetDay) return false;
    const sourceDay = activity.diaTipico;
    const targetGroupIncludingSelf = getWeeklyPlanGroup(targetDay);
    const targetGroup = getWeeklyPlanGroup(targetDay, activity.planId);
    const insertIndex = resolveInsertIndexExcludingSelf(targetGroupIncludingSelf, String(activity.planId), targetIndex, (plan) => String(plan.id));
    const nextGroup = [...targetGroup];
    nextGroup.splice(insertIndex, 0, { id: activity.planId, orden: insertIndex + 1, created_at: activity.planCreatedAt });

    const moveResult = await moveWeeklyPlanActivity({
      planId: activity.planId,
      personaId: activity.personaId || effectivePersonFilter,
      activityId: activity.sourceActivityId,
      dayName: targetDay,
      orden: insertIndex + 1,
    });

    if (!moveResult?.ok) {
      console.error(moveResult?.error);
      setScheduleMessage(moveResult?.duplicated ? "Ya existe una programacion para esa ubicacion." : "No fue posible guardar los cambios.");
      return true;
    }

    const orderResult = await updateWeeklyPlanOrder(nextGroup.map((plan, index) => ({ id: plan.id, orden: index + 1 })));
    if (!orderResult?.ok) console.error(orderResult?.error);
    if (sourceDay !== targetDay) {
      const sourceOrderResult = await persistWeeklyGroupOrder(sourceDay, activity.planId);
      if (!sourceOrderResult?.ok) console.error(sourceOrderResult?.error);
    }

    setDraggedActivity(null);
    setDropIndicator(null);
    await loadWorkloadData();
    setScheduleMessage("Orden actualizado correctamente.");
    return true;
  }
  async function moveActivityToDay(dragged, day) {
    if (!dragged?.activityId || !day) return;
    if (await persistDraggedWeeklyPlan(dragged, day, getWeeklyPlanGroup(day).length)) return;
    updateDraggedSchedule(dragged, (schedule) => ({ ...schedule, diaTipico: day, orden: getLastOrderForDay(day) + 10 }));
  }
  async function moveActivityToDayPosition(dragged, dayName, targetIndex) {
    if (!dragged?.activityId || !dayName) return;
    if (await persistDraggedWeeklyPlan(dragged, dayName, targetIndex)) return;
    const dayData = dayCapacitySummary.find((item) => item.day === dayName);
    const rawActivities = safeArray(dayData?.activities);
    const draggedKey = `${dragged.activityId}:${dragged.occurrenceIndex}`;
    const getActivityKey = (activity) => `${activity.id}:${activity.occurrenceIndex}`;
    const adjustedIndex = resolveInsertIndexExcludingSelf(rawActivities, draggedKey, targetIndex, getActivityKey);
    const cleanActivities = rawActivities.filter((activity) => !(activity.id === dragged.activityId && activity.occurrenceIndex === dragged.occurrenceIndex));
    const previousActivity = cleanActivities[adjustedIndex - 1]; const nextActivity = cleanActivities[adjustedIndex];
    let calculatedOrder = 10;
    if (previousActivity && nextActivity) calculatedOrder = (Number(previousActivity.orden || 0) + Number(nextActivity.orden || 0)) / 2;
    else if (previousActivity) calculatedOrder = Number(previousActivity.orden || 0) + 10;
    else if (nextActivity) calculatedOrder = Number(nextActivity.orden || 0) - 10;
    updateDraggedSchedule(dragged, (schedule) => ({ ...schedule, diaTipico: dayName, orden: calculatedOrder }));
  }
function canCreatePersonScopedBlock() {
  const hasSelectedPerson =
    cleanText(effectivePersonFilter) &&
    cleanText(effectivePersonFilter) !== "all" &&
    cleanText(selectedPersonName);

  if (hasSelectedPerson) return true;

  setScheduleMessage("Selecciona una persona antes de crear o programar bloques.");
  return false;
}
  function openQuickProjectForm(dayName) {
    if (!canCreatePersonScopedBlock()) return;
    setQuickProjectDay(dayName); setQuickProjectName(""); setQuickProjectMinutes("120"); setQuickProjectType("Proyecto"); setEditingProjectId(null);
  }
  function cancelQuickProject() { setQuickProjectDay(null); setQuickProjectName(""); setQuickProjectMinutes("120"); setQuickProjectType("Proyecto"); setEditingProjectId(null); }
  function startEditManualProject(activity) { if (!activity?.isManualProject) return; setEditingProjectId(activity.id); setQuickProjectDay(activity.diaTipico); setQuickProjectName(activity.actividad || ""); setQuickProjectMinutes(String(activity.duracionMinutos || 120)); setQuickProjectType(["Proyecto", "Formación", "Tarea"].includes(activity.origen) ? activity.origen : "Proyecto"); }
  async function saveQuickProject(dayName) {
    const blockName = quickProjectName.trim(); const duration = Number(quickProjectMinutes);
    if (!blockName || !Number.isFinite(duration) || duration <= 0) return;
    if (!canCreatePersonScopedBlock()) return;
    if (editingProjectId) { setManualProjects((currentProjects) => currentProjects.map((project) => (project.id === editingProjectId ? { ...project, origen: quickProjectType, proceso: quickProjectType === "Formación" ? "Formación manual" : quickProjectType === "Tarea" ? "Tarea manual" : "Proyecto manual", actividad: blockName, persona: selectedPersonName, personaId: effectivePersonFilter, responsable: selectedPersonName, rol: "Líder de proceso", cargaSemanal: Number((duration / 60).toFixed(2)), cargaMensual: Number(((duration / 60) * 4).toFixed(2)), duracionMinutos: duration, diaTipico: dayName } : project))); cancelQuickProject(); return; }
    const manualProcess = quickProjectType === "Formación" ? "Formación manual" : quickProjectType === "Tarea" ? "Tarea manual" : "Proyecto manual";
    const manualOrder = getLastOrderForDay(dayName) + 10;
    const sourceResult = await createWorkloadSourceActivity({
      actividad: blockName,
      descripcion: "Bloque manual creado desde Semana típica.",
      proceso: manualProcess,
      subproceso: "Reserva de capacidad",
      responsable: selectedPersonName,
      puesto: "Líder de proceso",
      rol: "Líder de proceso",
      duracion_minutos: duration,
      frecuencia: "Manual",
      frecuencia_valor: 1,
      dia_tipico: dayName,
      orden_flujo: manualOrder,
      carga_horas: Number((duration / 60).toFixed(2)),
      estado: "Activa",
      activa: true,
    });

    if (!sourceResult?.ok || !sourceResult.data?.id) {
      console.error(sourceResult?.error);
      setScheduleMessage("No fue posible guardar el bloque manual en Supabase.");
      return;
    }

    const weeklyResult = await scheduleActivityInWeeklyPlan({
      personaId: effectivePersonFilter,
      activityId: sourceResult.data.id,
      dayName,
      plannedHours: Number((duration / 60).toFixed(2)),
    });

    if (!weeklyResult) {
      setScheduleMessage("El bloque se creó, pero no fue posible programarlo en Semana típica.");
      return;
    }

    await loadWorkloadData();
    cancelQuickProject();
    setScheduleMessage("Bloque manual guardado correctamente.");
  }
  function deleteManualProject(projectId) { setManualProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId)); }
  function showDropIndicator(dayName, targetIndex) { if (!draggedActivity) return; setDropIndicator({ day: dayName, index: targetIndex }); }
  function isDropIndicatorActive(dayName, targetIndex) { return dropIndicator?.day === dayName && dropIndicator?.index === targetIndex; }
  function renderQuickBlockControl(dayName, hasTopMargin = false) {
    if (quickProjectDay === dayName) return <div className={hasTopMargin ? "mt-1" : ""}><QuickBlockForm day={dayName} editingProjectId={editingProjectId} quickProjectType={quickProjectType} setQuickProjectType={setQuickProjectType} quickProjectName={quickProjectName} setQuickProjectName={setQuickProjectName} quickProjectMinutes={quickProjectMinutes} setQuickProjectMinutes={setQuickProjectMinutes} saveQuickProject={saveQuickProject} cancelQuickProject={cancelQuickProject} /></div>;
    return <AddBlockButton onClick={() => openQuickProjectForm(dayName)} className={hasTopMargin ? "mt-1" : ""} />;
  }
  function resetMonthlyBlockForm() { setMonthlyBlockName(""); setMonthlyBlockMinutes("60"); setMonthlyBlockFrequency("Mensual"); setMonthlyBlockType("Proyecto"); setEditingMonthlyBlockId(null); setMonthlyQuickTarget(null); }
  function getDefaultMonthlyTypeForRow(rowType) { if (rowType === "Proyectos") return "Proyecto"; if (rowType === "Formación") return "Formación"; return "Eventual"; }
  function openMonthlyBlockForm(rowType, weekNumber) {
    if (!canCreatePersonScopedBlock()) return;
    setMonthlyQuickTarget({ rowType, weekNumber }); setMonthlyBlockName(""); setMonthlyBlockMinutes("60"); setMonthlyBlockFrequency("Manual"); setMonthlyBlockType(getDefaultMonthlyTypeForRow(rowType)); setEditingMonthlyBlockId(null);
  }
  async function saveMonthlyBlock(target = monthlyQuickTarget) {
    const blockName = monthlyBlockName.trim(); const duration = Number(monthlyBlockMinutes);
    if (!blockName || !Number.isFinite(duration) || duration <= 0) return;
    if (!canCreatePersonScopedBlock()) return;
    if (editingMonthlyBlockId) { setMonthlyBlocks((currentBlocks) => currentBlocks.map((block) => (block.id === editingMonthlyBlockId ? createMonthlyBlock({ id: block.id, name: blockName, duration, frequency: monthlyBlockFrequency, type: monthlyBlockType, targetWeeks: target?.weekNumber ? [target.weekNumber] : block.targetWeeks, monthlyOrder: block.monthlyOrder, personId: effectivePersonFilter, personName: selectedPersonName }) : block))); resetMonthlyBlockForm(); return; }

    if (!target?.weekNumber) {
      const id = `monthly-block-${Date.now()}`;
      const newBlock = createMonthlyBlock({ id, name: blockName, duration, frequency: monthlyBlockFrequency, type: monthlyBlockType, monthlyOrder: Date.now(), personId: effectivePersonFilter, personName: selectedPersonName });
      setMonthlyBlocks((currentBlocks) => [...currentBlocks, newBlock]);
      resetMonthlyBlockForm();
      return;
    }

    const manualProcess = monthlyBlockType === "Formación" ? "Formación manual" : monthlyBlockType === "Eventual" ? "Eventual manual" : "Proyecto manual";
    const sourceResult = await createWorkloadSourceActivity({
      actividad: blockName,
      descripcion: "Bloque manual creado desde Mes típico.",
      proceso: manualProcess,
      responsable: selectedPersonName,
      puesto: "Líder de proceso",
      rol: "Líder de proceso",
      duracion_minutos: duration,
      frecuencia: "Manual",
      frecuencia_valor: 1,
      orden_flujo: Math.floor(Date.now() / 1000),
      carga_horas: Number((duration / 60).toFixed(2)),
      estado: "Activa",
      activa: true,
    });

    if (!sourceResult?.ok || !sourceResult.data?.id) {
      console.error(sourceResult?.error);
      setScheduleMessage("No fue posible guardar el bloque manual en Supabase.");
      return;
    }

    const monthlyResult = await scheduleActivityInMonthlyPlan({
      personaId: effectivePersonFilter,
      activityId: sourceResult.data.id,
      weekNumber: Number(target.weekNumber),
      plannedHours: Number((duration / 60).toFixed(2)),
    });

    if (!monthlyResult?.ok) {
      console.error(monthlyResult?.error);
      setScheduleMessage("El bloque se creó, pero no fue posible programarlo en Mes típico.");
      return;
    }

    await loadWorkloadData();
    resetMonthlyBlockForm();
    setScheduleMessage("Bloque manual guardado correctamente.");
  }
  function getMonthlyInsertOrder(currentBlocks, targetRow, targetWeekNumber, targetIndex, draggedId) {
    if (!Number.isFinite(Number(targetIndex))) return Date.now();
    const groupIncludingSelf = safeArray(currentBlocks).filter((block) => block.origen === targetRow && getMonthlyBlockWeeks(block).includes(targetWeekNumber)).sort((a, b) => Number(a.monthlyOrder || 0) - Number(b.monthlyOrder || 0));
    const adjustedIndex = resolveInsertIndexExcludingSelf(groupIncludingSelf, draggedId, targetIndex, (block) => block.id);
    const orderedBlocks = groupIncludingSelf.filter((block) => block.id !== draggedId);
    const previousBlock = orderedBlocks[adjustedIndex - 1]; const nextBlock = orderedBlocks[adjustedIndex];
    if (previousBlock && nextBlock) return (Number(previousBlock.monthlyOrder || 0) + Number(nextBlock.monthlyOrder || 0)) / 2;
    if (previousBlock) return Number(previousBlock.monthlyOrder || 0) + 10;
    if (nextBlock) return Number(nextBlock.monthlyOrder || 0) - 10;
    return Date.now();
  }
  async function moveMonthlyBlock(blockId, targetRow, targetWeekNumber, targetIndex) {
    if (draggedMonthlyBlock?.planId) {
      const sourceWeek = draggedMonthlyBlock.semanaMes || safeArray(draggedMonthlyBlock.targetWeeks)[0] || 1;
      const targetGroupIncludingSelf = getMonthlyPlanGroup(targetWeekNumber);
      const targetGroup = getMonthlyPlanGroup(targetWeekNumber, draggedMonthlyBlock.planId);
      const insertIndex = resolveInsertIndexExcludingSelf(targetGroupIncludingSelf, String(draggedMonthlyBlock.planId), targetIndex, (plan) => String(plan.id));
      const nextGroup = [...targetGroup];
      nextGroup.splice(insertIndex, 0, { id: draggedMonthlyBlock.planId, orden: insertIndex + 1, created_at: draggedMonthlyBlock.monthlyCreatedAt });
      const moveResult = await moveMonthlyPlanActivity({
        planId: draggedMonthlyBlock.planId,
        personaId: draggedMonthlyBlock.personaId || effectivePersonFilter,
        activityId: draggedMonthlyBlock.sourceActivityId,
        weekNumber: Number(targetWeekNumber),
        orden: insertIndex + 1,
      });

      if (!moveResult?.ok) {
        console.error(moveResult?.error);
        setScheduleMessage(moveResult?.duplicated ? "Ya existe una programacion para esa ubicacion." : "No fue posible guardar los cambios.");
        return;
      }

      const orderResult = await updateMonthlyPlanOrder(nextGroup.map((plan, index) => ({ id: plan.id, orden: index + 1 })));
      if (!orderResult?.ok) console.error(orderResult?.error);
      if (Number(sourceWeek) !== Number(targetWeekNumber)) {
        const sourceOrderResult = await persistMonthlyGroupOrder(sourceWeek, draggedMonthlyBlock.planId);
        if (!sourceOrderResult?.ok) console.error(sourceOrderResult?.error);
      }

      setDraggedMonthlyBlock(null);
      setMonthlyDropIndicator(null);
      await loadWorkloadData();
      setScheduleMessage("Orden actualizado correctamente.");
      return;
    }

    setMonthlyBlocks((currentBlocks) => currentBlocks.map((block) => { if (block.id !== blockId) return block; const nextType = targetRow === "Proyectos" ? "Proyecto" : targetRow === "Formación" ? "Formación" : "Eventual"; const nextOrder = getMonthlyInsertOrder(currentBlocks, targetRow, targetWeekNumber, targetIndex, blockId); return { ...block, origen: targetRow, tipoBloque: nextType, targetWeeks: [targetWeekNumber], monthlyOrder: nextOrder, ocurrenciasMes: 1, cargaMensual: Number((getDurationMinutes(block) / 60).toFixed(2)) }; }));
    setDraggedMonthlyBlock(null); setMonthlyDropIndicator(null);
  }
  function showMonthlyDropIndicator(rowType, weekNumber, targetIndex) { if (!draggedMonthlyBlock?.id) return; setMonthlyDropIndicator({ rowType, weekNumber, targetIndex }); }
  function isMonthlyDropIndicatorActive(rowType, weekNumber, targetIndex) { return monthlyDropIndicator?.rowType === rowType && monthlyDropIndicator?.weekNumber === weekNumber && monthlyDropIndicator?.targetIndex === targetIndex; }
  function renderMonthlyInsertLine(rowType, weekNumber, targetIndex) { const active = isMonthlyDropIndicatorActive(rowType, weekNumber, targetIndex); return <div onDragOver={(event) => { event.preventDefault(); showMonthlyDropIndicator(rowType, weekNumber, targetIndex); }} onDragEnter={(event) => { event.preventDefault(); showMonthlyDropIndicator(rowType, weekNumber, targetIndex); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const draggedId = draggedMonthlyBlock?.id || event.dataTransfer.getData("text/plain"); if (!draggedId) return; moveMonthlyBlock(draggedId, rowType, weekNumber, targetIndex); }} className="relative h-3"><div className={`absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition ${active ? "bg-sky-500 opacity-100 shadow-sm" : "bg-transparent opacity-0"}`} /><div className={`absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full transition ${active ? "bg-sky-500 opacity-100" : "bg-transparent opacity-0"}`} /></div>; }
  function getMonthlyFrequencyLabel(block) { if (block?.frecuencia === "Mensual") return "Mensual"; if (block?.frecuencia === "Quincenal") return "Quincenal"; if (block?.frecuencia === "Semanal") return "Semanal"; return "Adicional"; }
  function startEditMonthlyBlock(block, rowType, weekNumber) { if (!block?.isMonthlyBlock) return; setEditingMonthlyBlockId(block.id); setMonthlyQuickTarget({ rowType: rowType || block.origen, weekNumber }); setMonthlyBlockName(block.actividad || ""); setMonthlyBlockMinutes(String(block.duracionMinutos || 60)); setMonthlyBlockFrequency(block.frecuencia || "Mensual"); setMonthlyBlockType(block.tipoBloque || block.origen || "Proyecto"); }
  function renderMonthlyQuickForm(rowType, weekNumber) {
    const isOpen = monthlyQuickTarget?.rowType === rowType && monthlyQuickTarget?.weekNumber === weekNumber;
    if (!isOpen) return <button type="button" onClick={() => openMonthlyBlockForm(rowType, weekNumber)} className="mt-1 w-full rounded-lg border border-dashed border-slate-200 py-1 text-[9px] font-black text-slate-300 transition hover:border-sky-200 hover:text-sky-600">+ Bloque</button>;
    return <div className="mt-1 rounded-lg border border-sky-100 bg-sky-50/40 p-1.5"><select value={monthlyBlockType} onChange={(event) => setMonthlyBlockType(event.target.value)} className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none"><option value="Proyecto">Proyecto</option><option value="Formación">Formación</option><option value="Eventual">Eventual</option></select><input value={monthlyBlockName} onChange={(event) => setMonthlyBlockName(event.target.value)} placeholder="Nombre" className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none" /><div className="flex gap-1"><input value={monthlyBlockMinutes} onChange={(event) => setMonthlyBlockMinutes(event.target.value)} type="number" min="1" placeholder="Min" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none" /><button type="button" onClick={() => saveMonthlyBlock({ rowType, weekNumber })} className="rounded-md bg-[#001225] px-2 py-1 text-[8px] font-black text-white">OK</button><button type="button" onClick={resetMonthlyBlockForm} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[8px] font-black text-slate-400">X</button></div></div>;
  }
  async function deleteMonthlyBlock(block) {
    if (!block?.id) return;

    if (block.planId) {
      await removeScheduledActivity("monthly", block);
      return;
    }

    setMonthlyBlocks((currentBlocks) => currentBlocks.filter((item) => item.id !== block.id));
    setScheduleMessage("Bloque eliminado de Mes típico.");
  }
  function resetAgendaMonthlyBlockForm() { setAgendaMonthlyQuickTarget(null); setAgendaMonthlyBlockName(""); setAgendaMonthlyBlockMinutes("60"); setAgendaMonthlyBlockType("Proyecto"); }
  function openAgendaMonthlyBlockForm(rowType, weekNumber) {
    if (!canCreatePersonScopedBlock()) return;
    setAgendaMonthlyQuickTarget({ rowType, weekNumber });
    setAgendaMonthlyBlockName("");
    setAgendaMonthlyBlockMinutes("60");
    setAgendaMonthlyBlockType(getDefaultMonthlyTypeForRow(rowType));
  }
  function saveAgendaMonthlyBlock(target = agendaMonthlyQuickTarget) {
    const blockName = agendaMonthlyBlockName.trim();
    const duration = Number(agendaMonthlyBlockMinutes);
    if (!blockName || !Number.isFinite(duration) || duration <= 0 || !target?.weekNumber) return;
    if (!canCreatePersonScopedBlock()) return;
    const id = `agenda-monthly-${Date.now()}`;
    const newBlock = createMonthlyBlock({
      id,
      name: blockName,
      duration,
      frequency: "Manual",
      type: agendaMonthlyBlockType,
      targetWeeks: [Number(target.weekNumber)],
      monthlyOrder: Date.now(),
      personId: effectivePersonFilter,
      personName: selectedPersonName,
    });
    setAgendaMonthlyBlocks((currentBlocks) => [...currentBlocks, { ...newBlock, origen: target.rowType, semanaMes: Number(target.weekNumber), planningSource: "Bloque adicional" }]);
    resetAgendaMonthlyBlockForm();
  }
  function getAgendaMonthlyInsertOrder(currentBlocks, targetRow, targetWeekNumber, targetIndex, draggedId) {
    if (!Number.isFinite(Number(targetIndex))) return Date.now();
    const groupIncludingSelf = safeArray(currentBlocks).filter((block) => block.origen === targetRow && getMonthlyBlockWeeks(block).includes(targetWeekNumber)).sort(compareOrderCreated);
    const adjustedIndex = resolveInsertIndexExcludingSelf(groupIncludingSelf, draggedId, targetIndex, (block) => block.id);
    const orderedBlocks = groupIncludingSelf.filter((block) => block.id !== draggedId);
    const previousBlock = orderedBlocks[adjustedIndex - 1];
    const nextBlock = orderedBlocks[adjustedIndex];
    if (previousBlock && nextBlock) return (Number(previousBlock.monthlyOrder || 0) + Number(nextBlock.monthlyOrder || 0)) / 2;
    if (previousBlock) return Number(previousBlock.monthlyOrder || 0) + 10;
    if (nextBlock) return Number(nextBlock.monthlyOrder || 0) - 10;
    return Date.now();
  }
  function moveAgendaMonthlyBlock(blockId, targetRow, targetWeekNumber, targetIndex) {
    if (!blockId) return;
    setAgendaMonthlyBlocks((currentBlocks) => currentBlocks.map((block) => {
      if (String(block.id) !== String(blockId)) return block;
      const nextType = targetRow === "Proyectos" ? "Proyecto" : targetRow === "Formación" ? "Formación" : "Proceso";
      const nextOrder = getAgendaMonthlyInsertOrder(currentBlocks, targetRow, targetWeekNumber, targetIndex, blockId);
      return {
        ...block,
        origen: targetRow,
        tipoBloque: nextType,
        targetWeeks: [Number(targetWeekNumber)],
        semanaMes: Number(targetWeekNumber),
        monthlyOrder: nextOrder,
        cargaMensual: Number((getDurationMinutes(block) / 60).toFixed(2)),
      };
    }));
    setAgendaMonthlyDraggedBlock(null);
    setAgendaMonthlyDropIndicator(null);
  }
  function deleteAgendaMonthlyBlock(block) {
    if (!block?.id) return;
    setAgendaMonthlyBlocks((currentBlocks) => currentBlocks.filter((item) => String(item.id) !== String(block.id)));
  }
  function showAgendaMonthlyDropIndicator(rowType, weekNumber, targetIndex) { if (!agendaMonthlyDraggedBlock?.id) return; setAgendaMonthlyDropIndicator({ rowType, weekNumber, targetIndex }); }
  function isAgendaMonthlyDropIndicatorActive(rowType, weekNumber, targetIndex) { return agendaMonthlyDropIndicator?.rowType === rowType && agendaMonthlyDropIndicator?.weekNumber === weekNumber && agendaMonthlyDropIndicator?.targetIndex === targetIndex; }
  function renderAgendaMonthlyInsertLine(rowType, weekNumber, targetIndex) {
    const active = isAgendaMonthlyDropIndicatorActive(rowType, weekNumber, targetIndex);
    return <div onDragOver={(event) => { event.preventDefault(); showAgendaMonthlyDropIndicator(rowType, weekNumber, targetIndex); }} onDragEnter={(event) => { event.preventDefault(); showAgendaMonthlyDropIndicator(rowType, weekNumber, targetIndex); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const draggedId = agendaMonthlyDraggedBlock?.id || event.dataTransfer.getData("text/plain"); if (!draggedId) return; moveAgendaMonthlyBlock(draggedId, rowType, weekNumber, targetIndex); }} className="relative h-3"><div className={`absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition ${active ? "bg-sky-500 opacity-100 shadow-sm" : "bg-transparent opacity-0"}`} /><div className={`absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full transition ${active ? "bg-sky-500 opacity-100" : "bg-transparent opacity-0"}`} /></div>;
  }
  function renderAgendaMonthlyQuickForm(rowType, weekNumber) {
    const isOpen = agendaMonthlyQuickTarget?.rowType === rowType && agendaMonthlyQuickTarget?.weekNumber === weekNumber;
    if (!isOpen) return <button type="button" onClick={() => openAgendaMonthlyBlockForm(rowType, weekNumber)} className="mt-1 w-full rounded-lg border border-dashed border-slate-200 py-1 text-[9px] font-black text-slate-300 transition hover:border-sky-200 hover:text-sky-600">+ Bloque</button>;
    return <div className="mt-1 rounded-lg border border-sky-100 bg-sky-50/40 p-1.5"><select value={agendaMonthlyBlockType} onChange={(event) => setAgendaMonthlyBlockType(event.target.value)} className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none"><option value="Proceso">Proceso</option><option value="Proyecto">Proyecto</option><option value="Formación">Formación</option></select><input value={agendaMonthlyBlockName} onChange={(event) => setAgendaMonthlyBlockName(event.target.value)} placeholder="Nombre" className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none" /><div className="flex gap-1"><input value={agendaMonthlyBlockMinutes} onChange={(event) => setAgendaMonthlyBlockMinutes(event.target.value)} type="number" min="1" placeholder="Min" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none" /><button type="button" onClick={() => saveAgendaMonthlyBlock({ rowType, weekNumber })} className="rounded-md bg-[#001225] px-2 py-1 text-[8px] font-black text-white">OK</button><button type="button" onClick={resetAgendaMonthlyBlockForm} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[8px] font-black text-slate-400">X</button></div></div>;
  }
  function getLastAgendaOrderForDay(day) { const dayActivities = activeAgendaBlocks.filter((activity) => activity.diaTipico === day); return dayActivities.length === 0 ? 0 : Math.max(...dayActivities.map((activity) => Number(activity.orden || 0))); }
  function resetAgendaBlockForm() { setAgendaQuickDay(null); setAgendaBlockName(""); setAgendaBlockMinutes("60"); setAgendaBlockType("Proyecto"); }
  function saveAgendaBlock(dayName) {
    const blockName = agendaBlockName.trim(); const duration = Number(agendaBlockMinutes);
    if (!blockName || !Number.isFinite(duration) || duration <= 0) return;
    if (!canCreatePersonScopedBlock()) return;
    const id = `agenda-manual-${Date.now()}`;
    setAgendaManualBlocks((currentBlocks) => [...currentBlocks, createManualBlock({ id, dayName, name: blockName, duration, type: agendaBlockType, currentUser, order: getLastAgendaOrderForDay(dayName) + 10, personId: effectivePersonFilter, personName: selectedPersonName })]);
    resetAgendaBlockForm();
  }
  function getAgendaBlockKey(activity) { return activity?.occurrenceId || activity?.id; }
  function toggleAgendaBlockCompleted(activity) { const blockKey = getAgendaBlockKey(activity); if (!blockKey) return; setCompletedAgendaBlockIds((currentIds) => currentIds.includes(blockKey) ? currentIds.filter((id) => id !== blockKey) : [...currentIds, blockKey]); }
  function getPrimaryUserRole() {
    const roles = safeArray(currentUser?.roles);
    return currentUser?.role || roles[0] || "Usuario";
  }
function canApprovePlan() {
  return hasFullAccess(currentUser);
}
function canCreateAssignments() {
  return hasFullAccess(currentUser);
}
  function canEditPendingActivities() {
    return canEditPendingSourceActivities(currentUser);
  }
  function getAssignmentPriorityStyle(priority) {
    if (priority === "Crítica") return "bg-red-50 text-red-600 border-red-100";
    if (priority === "Alta") return "bg-orange-50 text-orange-600 border-orange-100";
    if (priority === "Media") return "bg-sky-50 text-sky-600 border-sky-100";
    return "bg-slate-50 text-slate-500 border-slate-200";
  }
  function openScheduleModal(activity) {
    setSchedulingActivity(activity);
    setSelectedScheduleDays([]);
    setSelectedScheduleWeeks([]);
    setSelectedScheduleMonth(normalizePlannedMonthInput(getPendingActivityPlannedMonth(activity)));
    setScheduleMessage("");
  }
  function closeScheduleModal() {
    setSchedulingActivity(null);
    setSelectedScheduleDays([]);
    setSelectedScheduleWeeks([]);
    setSelectedScheduleMonth("");
  }
  function openPendingActivityEditModal(activity) {
    if (!activity || !canEditPendingActivities()) return;
    const inactive = isInactiveWorkloadActivity(activity);
    setEditingPendingActivity(activity);
    setPendingActivityDraft({
      estado: inactive ? "Inactiva" : "Activa",
      duracionMinutos: String(getDurationMinutes(activity)),
      frecuencia: activity.frecuencia || activity.sourceRecord?.frecuencia || "Mensual",
      motivo: "",
    });
    setPendingActivityEditError("");
  }
  function closePendingActivityEditModal() {
    setEditingPendingActivity(null);
    setPendingActivityDraft({ estado: "Activa", duracionMinutos: "60", frecuencia: "Mensual", motivo: "" });
    setPendingActivityEditError("");
    setSavingPendingActivity(false);
  }
  function updatePendingActivityDraft(field, value) {
    setPendingActivityDraft((draft) => ({ ...draft, [field]: value }));
  }
  async function savePendingActivityEdit() {
    if (!editingPendingActivity?.id) return;
    const duration = Number(pendingActivityDraft.duracionMinutos);
    if (!Number.isFinite(duration) || duration <= 0) {
      setPendingActivityEditError("Captura una duración válida en minutos.");
      return;
    }

    setSavingPendingActivity(true);
    setPendingActivityEditError("");

    const result = isLiderDeProcesoActivity(editingPendingActivity)
      ? await upsertLiderProcesoOverride({
        personaId: effectivePersonFilter,
        actividadId: editingPendingActivity.id,
        duracionMinutos: Math.round(duration),
        activo: pendingActivityDraft.estado !== "Inactiva",
        frecuencia: pendingActivityDraft.frecuencia,
      })
      : await updateWorkloadSourceActivity(editingPendingActivity.id, {
        activa: pendingActivityDraft.estado !== "Inactiva",
        estado: pendingActivityDraft.estado,
        duracion_minutos: Math.round(duration),
        frecuencia: pendingActivityDraft.frecuencia,
      });

    if (!result?.ok) {
      console.error(result?.error);
      setSavingPendingActivity(false);
      setPendingActivityEditError(result?.error?.message || "No fue posible actualizar la actividad. Revisa permisos en Supabase.");
      return;
    }

    await loadWorkloadData();
    closePendingActivityEditModal();
    setScheduleMessage("Actividad actualizada correctamente.");
  }
  async function excludePendingActivityFromList() {
    if (!editingPendingActivity?.id) return;
    const motivo = pendingActivityDraft.motivo || "";
    const confirmMessage = "¿Quitar definitivamente esta actividad de tus pendientes? No volverá a aparecer para ti (a las demás personas que compartan este rol no les afecta ni cambia la actividad maestra).";
    if (!window.confirm(confirmMessage)) return;

    const duration = Number(pendingActivityDraft.duracionMinutos) || getDurationMinutes(editingPendingActivity) || 60;

    setSavingPendingActivity(true);
    setPendingActivityEditError("");

    const result = await upsertLiderProcesoOverride({
      personaId: effectivePersonFilter,
      actividadId: editingPendingActivity.id,
      duracionMinutos: Math.round(duration),
      activo: pendingActivityDraft.estado !== "Inactiva",
      frecuencia: pendingActivityDraft.frecuencia,
      excluido: true,
      motivo: motivo.trim(),
    });

    if (!result?.ok) {
      console.error(result?.error);
      setSavingPendingActivity(false);
      setPendingActivityEditError(result?.error?.message || "No fue posible quitar la actividad. Revisa permisos en Supabase.");
      return;
    }

    await loadWorkloadData();
    closePendingActivityEditModal();
    setScheduleMessage("Actividad quitada de tus pendientes.");
  }
  async function restoreExcludedActivity(activity) {
    if (!activity?.id) return;
    if (!window.confirm(`¿Restaurar "${activity.actividad}" a tus pendientes?`)) return;

    const result = await upsertLiderProcesoOverride({
      personaId: effectivePersonFilter,
      actividadId: activity.id,
      duracionMinutos: Math.round(getDurationMinutes(activity)),
      activo: activity.activa !== false,
      frecuencia: activity.frecuencia,
      excluido: false,
    });

    if (!result?.ok) {
      console.error(result?.error);
      setScheduleMessage("No fue posible restaurar la actividad. Revisa permisos en Supabase.");
      return;
    }

    await loadWorkloadData();
    setScheduleMessage("Actividad restaurada a tus pendientes.");
  }
  function toggleScheduleDay(dayName) {
    setSelectedScheduleDays((current) => current.includes(dayName) ? current.filter((day) => day !== dayName) : [...current, dayName]);
  }
  function toggleScheduleWeek(weekNumber) {
    setSelectedScheduleWeeks((current) => current.includes(weekNumber) ? current.filter((week) => week !== weekNumber) : [...current, weekNumber]);
  }
  async function savePendingSchedule() {
    if (!schedulingActivity || effectivePersonFilter === "all") return;

    if (getPendingActivityFrequencyGroup(schedulingActivity) === "radar") {
      if (!selectedScheduleMonth) {
        setScheduleMessage("Selecciona un mes previsto para esta actividad.");
        return;
      }

      const result = await updateWorkloadSourceActivity(schedulingActivity.id, {
        mes_planeado: selectedScheduleMonth,
      });

      if (!result?.ok) {
        console.error(result?.error);
        setScheduleMessage(result?.error?.message || "No se pudo guardar el mes previsto. Revisa permisos o columna mes_planeado en Supabase.");
        return;
      }

      await loadWorkloadData();
      closeScheduleModal();
      setScheduleMessage("Mes previsto actualizado. La actividad queda en radar para planificarla llegada la fecha.");
      return;
    }

    if (selectedScheduleDays.length === 0 && selectedScheduleWeeks.length === 0) {
      setScheduleMessage("Selecciona al menos un día o una semana.");
      return;
    }

    const plannedHours = Number((getDurationMinutes(schedulingActivity) / 60).toFixed(2));

    for (const dayName of selectedScheduleDays) {
      await scheduleActivityInWeeklyPlan({
        personaId: effectivePersonFilter,
        activityId: schedulingActivity.id,
        dayName,
        plannedHours,
      });
    }

    for (const weekNumber of selectedScheduleWeeks) {
      const monthlyResult = await scheduleActivityInMonthlyPlan({
        personaId: effectivePersonFilter,
        activityId: schedulingActivity.id,
        weekNumber,
        plannedHours,
      });

      if (!monthlyResult?.ok) {
        console.error(monthlyResult?.error);
        setScheduleMessage("No se pudo programar en Mes Típico. Revisa la consola para ver el error.");
        return;
      }
    }

    await loadWorkloadData();
    closeScheduleModal();
    setScheduleMessage("Actividad programada correctamente.");
  }
  function getWeeklyPlanGroup(dayName, excludedPlanId = "") {
    return sortByOrderCreated(safeArray(weeklyPlansCatalog).filter((plan) =>
      isActiveRecord(plan) &&
      getPlanPersonId(plan) === String(effectivePersonFilter) &&
      getPlanDayName(plan) === dayName &&
      (!excludedPlanId || String(plan.id) !== String(excludedPlanId))
    ));
  }
  function getMonthlyPlanGroup(weekNumber, excludedPlanId = "") {
    return sortByOrderCreated(safeArray(monthlyPlansCatalog).filter((plan) =>
      isActiveRecord(plan) &&
      getPlanPersonId(plan) === String(effectivePersonFilter) &&
      Number(plan.semana_mes || plan.weekNumber || plan.semana || 1) === Number(weekNumber) &&
      (!excludedPlanId || String(plan.id) !== String(excludedPlanId))
    ));
  }
  async function persistWeeklyGroupOrder(dayName, excludedPlanId = "") {
    const updates = buildOrderUpdates(getWeeklyPlanGroup(dayName, excludedPlanId));
    if (updates.length === 0) return { ok: true };
    return updateWeeklyPlanOrder(updates);
  }
  async function persistMonthlyGroupOrder(weekNumber, excludedPlanId = "") {
    const updates = buildOrderUpdates(getMonthlyPlanGroup(weekNumber, excludedPlanId));
    if (updates.length === 0) return { ok: true };
    return updateMonthlyPlanOrder(updates);
  }
  async function moveScheduledOrder(type, activity, direction) {
    if (!activity?.planId || !direction) return;
    const isWeekly = type === "weekly";
    const group = isWeekly ? getWeeklyPlanGroup(activity.diaTipico) : getMonthlyPlanGroup(activity.semanaMes || safeArray(activity.targetWeeks)[0] || 1);
    const currentIndex = group.findIndex((plan) => String(plan.id) === String(activity.planId));
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= group.length) return;

    const nextGroup = [...group];
    const [movedPlan] = nextGroup.splice(currentIndex, 1);
    nextGroup.splice(nextIndex, 0, movedPlan);
    const updates = nextGroup.map((plan, index) => ({ id: plan.id, orden: index + 1 }));
    const result = isWeekly ? await updateWeeklyPlanOrder(updates) : await updateMonthlyPlanOrder(updates);

    if (!result?.ok) {
      console.error(result?.error);
      setScheduleMessage("No fue posible guardar el orden.");
      return;
    }

    await loadWorkloadData();
    setScheduleMessage("Orden actualizado correctamente.");
  }
  function handleScheduledAction(type, activity, action) {
    if (!action) return;
    if (action === "up") {
      moveScheduledOrder(type, activity, -1);
      return;
    }
    if (action === "down") {
      moveScheduledOrder(type, activity, 1);
      return;
    }
    if (action === "move") {
      setMovePlanModal({ type, activity });
      setMovePlanTarget(type === "weekly" ? activity.diaTipico : String(activity.semanaMes || safeArray(activity.targetWeeks)[0] || 1));
      return;
    }
    if (action === "remove") {
      removeScheduledActivity(type, activity);
      return;
    }
    if (action === "edit") {
      setEditBlockModal({ type, activity });
      setEditBlockDraft({ name: activity.actividad || "", minutes: String(activity.duracionMinutos || 60) });
    }
  }
  async function saveEditScheduledBlock() {
    if (!editBlockModal?.activity) return;
    const { type, activity } = editBlockModal;
    const isManual = isManualReservationActivity(activity);
    const duration = Number(editBlockDraft.minutes);
    if (!Number.isFinite(duration) || duration <= 0) return;

    if (isManual) {
      const blockName = editBlockDraft.name.trim();
      if (!blockName) return;
      // Solo el nombre va al bloque maestro: un trigger de Supabase
      // (trg_sync_workload_duration_from_design) replica duracion_minutos a
      // TODOS los días/meses programados de esa actividad en cuanto cambia,
      // así que actualizar la duración aquí rompería el ajuste por día.
      const updateResult = await updateWorkloadSourceActivity(activity.sourceActivityId, {
        actividad: blockName,
      });

      if (!updateResult?.ok) {
        console.error(updateResult?.error);
        setScheduleMessage("No fue posible actualizar el nombre del bloque manual.");
        return;
      }
    }

    const hoursResult = type === "weekly"
      ? await updateWeeklyPlanHours(activity.planId, Number((duration / 60).toFixed(2)))
      : await updateMonthlyPlanHours(activity.planId, Number((duration / 60).toFixed(2)));

    if (!hoursResult?.ok) {
      console.error(hoursResult?.error);
      setScheduleMessage("No fue posible actualizar la duración de este día.");
      return;
    }

    setEditBlockModal(null);
    await loadWorkloadData();
    setScheduleMessage(isManual ? "Bloque manual actualizado correctamente." : "Duración de este día actualizada correctamente.");
  }
  async function removeScheduledActivity(type, activity) {
    if (!activity?.planId) return;
    const previousDay = activity.diaTipico;
    const previousWeek = activity.semanaMes || safeArray(activity.targetWeeks)[0] || 1;
    const result = type === "weekly"
      ? await removeWeeklyPlanActivity(activity.planId)
      : await removeMonthlyPlanActivity(activity.planId);

    if (!result?.ok) {
      console.error(result?.error);
      setScheduleMessage("No fue posible guardar los cambios.");
      return;
    }

    const orderResult = type === "weekly"
      ? await persistWeeklyGroupOrder(previousDay, activity.planId)
      : await persistMonthlyGroupOrder(previousWeek, activity.planId);

    if (!orderResult?.ok) console.error(orderResult?.error);

    await loadWorkloadData();
    setScheduleMessage("Actividad eliminada de la programacion.");
  }
  async function saveMoveScheduledActivity() {
    if (!movePlanModal?.activity || !movePlanTarget) return;
    const activity = movePlanModal.activity;
    const previousDay = activity.diaTipico;
    const previousWeek = activity.semanaMes || safeArray(activity.targetWeeks)[0] || 1;
    const targetOrder = movePlanModal.type === "weekly"
      ? getWeeklyPlanGroup(movePlanTarget, activity.planId).length + 1
      : getMonthlyPlanGroup(Number(movePlanTarget), activity.planId).length + 1;
    const result = movePlanModal.type === "weekly"
      ? await moveWeeklyPlanActivity({
        planId: activity.planId,
        personaId: activity.personaId || effectivePersonFilter,
        activityId: activity.sourceActivityId,
        dayName: movePlanTarget,
        orden: targetOrder,
      })
      : await moveMonthlyPlanActivity({
        planId: activity.planId,
        personaId: activity.personaId || effectivePersonFilter,
        activityId: activity.sourceActivityId,
        weekNumber: Number(movePlanTarget),
        orden: targetOrder,
      });

    if (result?.duplicated) {
      setScheduleMessage("Ya existe una programacion para esa ubicacion.");
      return;
    }

    if (!result?.ok) {
      console.error(result?.error);
      setScheduleMessage("No fue posible guardar los cambios.");
      return;
    }

    const orderResult = movePlanModal.type === "weekly"
      ? await persistWeeklyGroupOrder(previousDay, activity.planId)
      : await persistMonthlyGroupOrder(previousWeek, activity.planId);

    if (!orderResult?.ok) console.error(orderResult?.error);

    setMovePlanModal(null);
    setMovePlanTarget("");
    await loadWorkloadData();
    setScheduleMessage("Actividad reubicada correctamente.");
  }
  function getAssignmentPlanningWeekRange() {
    const start = assignmentScheduleDraft.planningWeekStart || currentWorkWeek.start;
    const endDate = new Date(`${start}T00:00:00`);
    endDate.setDate(endDate.getDate() + 4);
    return { start, end: assignmentScheduleDraft.planningWeekEnd || toDateInputValue(endDate) };
  }
  function buildAssignmentWeeklyBlock({ assignment, dayName, hours, origin, order = Date.now(), idPrefix = "assignment-weekly-block" }) {
    const duration = Math.max(1, Math.round(Number(hours || 0) * 60));
    const sourceType = getWeeklyTypeFromAssignmentOrigin(origin);
    return {
      ...createManualBlock({
        id: `${idPrefix}-${assignment.id}`,
        dayName,
        name: assignment.titulo,
        duration,
        type: sourceType,
        currentUser,
        order,
        personId: effectivePersonFilter,
        personName: selectedPersonName,
      }),
      proceso: "Asignación",
      subproceso: assignment.tipo || "",
      rol: assignment.rol || assignment.responsable || "Asignación",
      responsable: selectedPersonName,
      planningSource: "Asignación",
      assignmentId: assignment.id,
      isAssignmentBlock: true,
    };
  }
  function buildAssignmentMonthlyBlock({ assignment, weekNumber, hours, origin, order = Date.now(), idPrefix = "assignment-monthly-block" }) {
    const duration = Math.max(1, Math.round(Number(hours || 0) * 60));
    const normalizedOrigin = ASSIGNMENT_SCHEDULE_ORIGINS.includes(origin) ? origin : getAssignmentDefaultOrigin(assignment.tipo);
    const block = createMonthlyBlock({
      id: `${idPrefix}-${assignment.id}-w${weekNumber}`,
      name: assignment.titulo,
      duration,
      frequency: "Manual",
      type: getMonthlyTypeFromAssignmentOrigin(normalizedOrigin),
      targetWeeks: [Number(weekNumber || 1)],
      monthlyOrder: order,
      personId: effectivePersonFilter,
      personName: selectedPersonName,
    });

    return {
      ...block,
      origen: normalizedOrigin === "Formación" ? "Formación" : normalizedOrigin === "Procesos" ? "Procesos" : "Proyectos",
      tipoBloque: "Asignación",
      proceso: "Asignación",
      subproceso: assignment.tipo || "",
      rol: assignment.rol || assignment.responsable || "Asignación",
      responsable: selectedPersonName,
      planningSource: "Asignación",
      assignmentId: assignment.id,
      semanaMes: Number(weekNumber || 1),
      targetWeeks: [Number(weekNumber || 1)],
      monthlyOrder: order,
      isAssignmentBlock: true,
      isMonthlyBlock: true,
    };
  }
  async function saveAssignmentPlanningWeek(block, range) {
    const existingResult = await findExistingSavedWeek({
      personaId: effectivePersonFilter,
      fechaInicio: range.start,
      fechaFin: range.end,
    });
    if (!existingResult?.ok) return existingResult;

    // Si ya hay un plan guardado para esa semana exacta, se parte de sus
    // bloques reales (no de `activeAgendaBlocks`, que solo refleja la semana
    // actualmente cargada en pantalla y podría no ser la misma).
    const baseBlocks = existingResult.data ? safeArray(existingResult.data.bloques) : activeAgendaBlocks;
    const nextBlocks = baseBlocks
      .filter((item) => String(item.assignmentId || "") !== String(block.assignmentId || ""))
      .concat(block);

    const payload = {
      ...buildSavedWeeklyPayload(),
      fecha_inicio: range.start,
      fecha_fin: range.end,
      nombre: formatPlanPeriodName(range.start, range.end),
      bloques: nextBlocks,
      completados: existingResult.data ? safeArray(existingResult.data.completados) : completedAgendaBlockIds,
      resumen: {
        planned: nextBlocks.length,
        totalHours: Number((nextBlocks.reduce((sum, item) => sum + getDurationMinutes(item), 0) / 60).toFixed(1)),
      },
    };

    const result = existingResult.data
      ? await updateSavedWorkloadPlan(existingResult.data.id, payload)
      : await saveWorkloadPlan(payload);

    if (result?.ok && result.data?.id) setSelectedPlanId(result.data.id);
    return result;
  }
  async function saveAssignmentPlanningMonth(block, monthDate) {
    const { mes, anio } = getMonthPlanParts(monthDate);
    const baseBlocks = selectedPlanId && agendaView === "monthly" ? buildMonthlySnapshotBlocks() : monthlyPlanningBaseBlocks;
    const nextBlocks = baseBlocks
      .filter((item) => String(item.assignmentId || "") !== String(block.assignmentId || ""))
      .concat(block);
    const totalMinutes = nextBlocks.reduce((sum, item) => sum + getDurationMinutes(item), 0);
    const existingResult = await findExistingSavedMonth({ personaId: effectivePersonFilter, mes, anio });
    if (!existingResult?.ok) return existingResult;

    const payload = {
      tipo_plan: "mensual",
      persona_id: effectivePersonFilter,
      responsable: selectedPersonName,
      mes,
      anio,
      nombre: formatMonthPlanName(mes, anio),
      estado: "Borrador",
      bloques: nextBlocks,
      completados: [],
      resumen: { totalHours: Number((totalMinutes / 60).toFixed(1)) },
      creado_por: currentUser?.name || "Usuario",
      actualizado_por: currentUser?.name || "Usuario",
      activo: true,
    };

    return existingResult.data
      ? updateSavedWorkloadPlan(existingResult.data.id, payload)
      : saveWorkloadPlan(payload);
  }
  function validateAssignmentDraft(draft) {
    if (!cleanText(draft.nombre)) return "El nombre de la iniciativa/proyecto es obligatorio.";
    if (!cleanText(draft.responsable)) return "Selecciona un responsable.";
    if (!Number.isFinite(Number(draft.horas)) || Number(draft.horas) <= 0) return "Las horas totales estimadas deben ser mayores a 0.";
    if (!draft.fechaLimite) return "La fecha límite es obligatoria.";
    if (!draft.prioridad) return "Selecciona una prioridad.";
    return "";
  }
  async function createAssignment() {
    if (!canCreatePersonScopedBlock()) return;
    const validationError = validateAssignmentDraft(assignmentDraft);
    if (validationError) {
      setAssignmentFormError(validationError);
      return;
    }
    const hours = Number(assignmentDraft.horas || 4);
    const title = cleanText(assignmentDraft.nombre) || cleanText(assignmentDraft.titulo) || `${assignmentDraft.tipo} · ${assignmentDraft.gestionarEn}`;
    const roleName = roleFilter !== "all" ? roleFilter : selectedPersonRoleLinks[0] ? getPersonRoleName(selectedPersonRoleLinks[0]) : assignmentDraft.responsable;
    const result = await createWorkloadAssignment({
      persona_id: effectivePersonFilter,
      responsable: selectedPersonName,
      rol: roleName,
      tipo: assignmentDraft.tipo,
      prioridad: assignmentDraft.prioridad,
      gestion: assignmentDraft.gestionarEn,
      titulo: title,
      revisara: assignmentDraft.revisara,
      aprobara: assignmentDraft.aprobara,
      seguimiento: assignmentDraft.seguimiento,
      carga_horas: hours,
      duracion_minutos: Math.round(hours * 60),
      fecha_limite: assignmentDraft.fechaLimite,
      estado: "Pendiente",
      asigna: currentUser?.name || "Usuario",
      asigna_rol: getPrimaryUserRole(),
      activo: true,
      nombre: title,
      descripcion: cleanText(assignmentDraft.descripcion),
      origen_estrategico: assignmentDraft.origenEstrategico,
      horas_totales: hours,
      horas_programadas: 0,
      horas_ejecutadas: 0,
      horas_pendientes: hours,
      estado_proyecto: "Pendiente",
      estado_programacion: "Sin programar",
      fecha_inicio: assignmentDraft.fechaInicio || null,
      url_externa: cleanText(assignmentDraft.urlExterna),
    });

    if (!result?.ok) {
      console.error(result?.error);
      setAssignmentFormError("No se pudo crear la asignación. Revisa que exista la tabla workload_asignaciones.");
      return;
    }

    setShowAssignmentModal(false);
    setAssignmentFormError("");
    setAssignmentDraft((draft) => ({ ...draft, nombre: "", descripcion: "", titulo: "", horas: 4, fechaInicio: "", fechaLimite: currentWorkWeek.end, urlExterna: "" }));
    await loadWorkloadData();
    setScheduleMessage("Asignación creada correctamente.");
  }
  function toggleMeetingParticipant(personId) {
    setMeetingDraft((draft) => ({
      ...draft,
      participantIds: draft.participantIds.includes(personId)
        ? draft.participantIds.filter((id) => id !== personId)
        : [...draft.participantIds, personId],
    }));
  }
  function toggleMeetingEditParticipant(personId) {
    setMeetingEditDraft((draft) => ({
      ...draft,
      participantIds: safeArray(draft.participantIds).includes(personId)
        ? draft.participantIds.filter((id) => id !== personId)
        : [...safeArray(draft.participantIds), personId],
    }));
  }
  async function createMeeting() {
    if (!canCreateAssignments()) return;
    const title = cleanText(meetingDraft.titulo);
    if (!title) { setMeetingMessage("Escribe un título para la reunión."); return; }
    if (meetingDraft.participantIds.length === 0) { setMeetingMessage("Selecciona al menos un participante."); return; }

    const hours = Number(meetingDraft.horas || 1);
    const grupoReunion = `reunion-${Date.now()}`;

    const results = await Promise.all(
      meetingDraft.participantIds.map((personId) => {
        const person = peopleOptions.find((option) => option.id === personId);
        const personRole = activePersonRoleLinks.find((link) => String(link.persona_id ?? link.person_id ?? "") === String(personId));
        return createWorkloadAssignment({
          persona_id: personId,
          responsable: person?.name || "",
          rol: personRole ? getPersonRoleName(personRole) : "Reunión",
          tipo: "Reunión",
          prioridad: meetingDraft.prioridad,
          gestion: meetingDraft.gestionarEn,
          titulo: title,
          carga_horas: hours,
          duracion_minutos: Math.round(hours * 60),
          fecha_limite: meetingDraft.fechaLimite,
          hora_limite: meetingDraft.horaLimite || null,
          estado: "Pendiente",
          asigna: currentUser?.name || "Usuario",
          asigna_rol: getPrimaryUserRole(),
          activo: true,
          grupo_reunion: grupoReunion,
        });
      })
    );

    if (results.some((result) => !result?.ok)) {
      console.error(results.find((result) => !result?.ok)?.error);
      setMeetingMessage("No se pudo crear la reunión para todos los participantes. Revisa que exista la columna grupo_reunion.");
      return;
    }

    setShowMeetingModal(false);
    setMeetingDraft({ titulo: "", participantIds: [], prioridad: "Media", gestionarEn: "Planner", horas: 1, fechaLimite: currentWorkWeek.end, horaLimite: "" });
    await loadWorkloadData();
    setScheduleMessage(`Reunión creada para ${results.length} participante${results.length === 1 ? "" : "s"}.`);
  }
  function openAssignmentEditModal(assignment) {
    if (!assignment?.id) return;
    if (isMeetingAssignment(assignment)) {
      const participantIds = assignment.grupoReunion
        ? assignments.filter((item) => item.grupoReunion === assignment.grupoReunion).map((item) => item.personaId)
        : [assignment.personaId];
      setEditingMeetingAssignment(assignment);
      setMeetingEditError("");
      setMeetingEditDraft({
        titulo: assignment.nombre || assignment.titulo || "",
        prioridad: assignment.prioridad || "Media",
        gestionarEn: assignment.gestionarEn || "Planner",
        horas: Number(assignment.horasTotales || assignment.horas || 1),
        fechaLimite: assignment.fechaLimite || currentWorkWeek.end,
        horaLimite: assignment.horaLimite || "",
        participantIds,
      });
      return;
    }
    setEditingAssignment(assignment);
    setAssignmentEditError("");
    setAssignmentEditDraft({
      nombre: assignment.nombre || assignment.titulo || "",
      descripcion: assignment.descripcion || "",
      origenEstrategico: assignment.origenEstrategico || "Balance de carga",
      titulo: assignment.titulo || "",
      tipo: assignment.tipo || "Proyecto",
      prioridad: assignment.prioridad || "Media",
      estadoProyecto: assignment.estadoProyecto || "Pendiente",
      revisara: assignment.revisara || "Líder de proceso",
      aprobara: assignment.aprobara || "Director General",
      seguimiento: assignment.seguimiento || "PMO",
      gestionarEn: assignment.gestionarEn || "Planner",
      horas: Number(assignment.horasTotales || assignment.horas || 4),
      horasEjecutadas: Number(assignment.horasEjecutadas || 0),
      fechaInicio: assignment.fechaInicio || "",
      fechaLimite: assignment.fechaLimite || currentWorkWeek.end,
      urlExterna: assignment.urlExterna || "",
    });
  }
  async function saveAssignmentEdit() {
    if (!editingAssignment?.id) return;
    const hours = Number(assignmentEditDraft.horas || 0);
    const horasEjecutadas = Number(assignmentEditDraft.horasEjecutadas || 0);
    if (!cleanText(assignmentEditDraft.nombre)) {
      setAssignmentEditError("El nombre de la iniciativa/proyecto es obligatorio.");
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      setAssignmentEditError("Las horas totales estimadas deben ser mayores a 0.");
      return;
    }
    if (!assignmentEditDraft.fechaLimite) {
      setAssignmentEditError("La fecha límite es obligatoria.");
      return;
    }
    if (assignmentEditDraft.estadoProyecto === "Finalizado" && horasEjecutadas < hours) {
      setAssignmentEditError(`Aviso: marcaste el proyecto como Finalizado pero solo hay ${horasEjecutadas} h de ${hours} h ejecutadas. Se guardará igual.`);
    }
    const title = cleanText(assignmentEditDraft.nombre) || cleanText(assignmentEditDraft.titulo) || `${assignmentEditDraft.tipo} · ${assignmentEditDraft.gestionarEn}`;
    const result = await updateWorkloadAssignment(editingAssignment.id, {
      tipo: assignmentEditDraft.tipo,
      prioridad: assignmentEditDraft.prioridad,
      gestion: assignmentEditDraft.gestionarEn,
      titulo: title,
      revisara: assignmentEditDraft.revisara,
      aprobara: assignmentEditDraft.aprobara,
      seguimiento: assignmentEditDraft.seguimiento,
      carga_horas: hours,
      duracion_minutos: Math.round(hours * 60),
      fecha_limite: assignmentEditDraft.fechaLimite,
      nombre: title,
      descripcion: cleanText(assignmentEditDraft.descripcion),
      origen_estrategico: assignmentEditDraft.origenEstrategico,
      estado_proyecto: assignmentEditDraft.estadoProyecto,
      horas_totales: hours,
      horas_ejecutadas: horasEjecutadas,
      fecha_inicio: assignmentEditDraft.fechaInicio || null,
      url_externa: cleanText(assignmentEditDraft.urlExterna),
    });

    if (!result?.ok) {
      console.error(result?.error);
      setAssignmentEditError("No se pudo actualizar la asignación.");
      return;
    }

    // Si es una reunión con varios participantes (grupo_reunion), el resto de
    // sus filas comparte los mismos datos generales para que editarla desde
    // cualquier participante actualice a todos.
    if (editingAssignment.grupoReunion) {
      const siblings = assignments.filter(
        (item) => item.grupoReunion === editingAssignment.grupoReunion && item.id !== editingAssignment.id
      );
      await Promise.all(
        siblings.map((sibling) =>
          updateWorkloadAssignment(sibling.id, {
            tipo: assignmentEditDraft.tipo,
            prioridad: assignmentEditDraft.prioridad,
            gestion: assignmentEditDraft.gestionarEn,
            titulo: title,
            carga_horas: hours,
            duracion_minutos: Math.round(hours * 60),
            fecha_limite: assignmentEditDraft.fechaLimite,
          })
        )
      );
    }

    await recalculateAssignmentHours(editingAssignment.id);
    setEditingAssignment(null);
    setAssignmentEditError("");
    await loadWorkloadData();
    setScheduleMessage("Asignación actualizada correctamente.");
  }
  function closeMeetingEditModal() {
    setEditingMeetingAssignment(null);
    setMeetingEditError("");
  }
  async function saveMeetingEdit() {
    if (!editingMeetingAssignment?.id) return;
    const title = cleanText(meetingEditDraft.titulo);
    const hours = Number(meetingEditDraft.horas || 0);
    if (!title) {
      setMeetingEditError("El título de la reunión es obligatorio.");
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      setMeetingEditError("La duración estimada debe ser mayor a 0.");
      return;
    }
    if (safeArray(meetingEditDraft.participantIds).length === 0) {
      setMeetingEditError("Selecciona al menos un participante.");
      return;
    }

    const payload = {
      prioridad: meetingEditDraft.prioridad,
      gestion: meetingEditDraft.gestionarEn,
      titulo: title,
      nombre: title,
      carga_horas: hours,
      duracion_minutos: Math.round(hours * 60),
      fecha_limite: meetingEditDraft.fechaLimite,
      hora_limite: meetingEditDraft.horaLimite || null,
      horas_totales: hours,
    };

    const result = await updateWorkloadAssignment(editingMeetingAssignment.id, payload);
    if (!result?.ok) {
      console.error(result?.error);
      setMeetingEditError("No se pudo actualizar la reunión.");
      return;
    }

    // Propaga los datos generales al resto de participantes de la misma reunión.
    const siblings = editingMeetingAssignment.grupoReunion
      ? assignments.filter((item) => item.grupoReunion === editingMeetingAssignment.grupoReunion && item.id !== editingMeetingAssignment.id)
      : [];
    await Promise.all(siblings.map((sibling) => updateWorkloadAssignment(sibling.id, payload)));

    // Ajusta participantes: quita las filas deseleccionadas y crea filas nuevas
    // (mismo grupo_reunion) para los participantes recién agregados.
    const currentRows = [editingMeetingAssignment, ...siblings];
    const currentParticipantIds = currentRows.map((row) => String(row.personaId));
    const nextParticipantIds = safeArray(meetingEditDraft.participantIds).map(String);
    const rowsToRemove = currentRows.filter((row) => !nextParticipantIds.includes(String(row.personaId)));
    const idsToAdd = nextParticipantIds.filter((id) => !currentParticipantIds.includes(id));

    await Promise.all(rowsToRemove.map((row) => deleteAssignment(row.id)));
    await Promise.all(idsToAdd.map((personId) => {
      const person = peopleOptions.find((option) => String(option.id) === String(personId));
      const personRole = activePersonRoleLinks.find((link) => String(link.persona_id ?? link.person_id ?? "") === String(personId));
      return createWorkloadAssignment({
        persona_id: personId,
        responsable: person?.name || "",
        rol: personRole ? getPersonRoleName(personRole) : "Reunión",
        tipo: "Reunión",
        prioridad: meetingEditDraft.prioridad,
        gestion: meetingEditDraft.gestionarEn,
        titulo: title,
        carga_horas: hours,
        duracion_minutos: Math.round(hours * 60),
        fecha_limite: meetingEditDraft.fechaLimite,
        hora_limite: meetingEditDraft.horaLimite || null,
        estado: "Pendiente",
        asigna: currentUser?.name || "Usuario",
        asigna_rol: getPrimaryUserRole(),
        activo: true,
        grupo_reunion: editingMeetingAssignment.grupoReunion,
      });
    }));

    await recalculateAssignmentHours(editingMeetingAssignment.id);
    closeMeetingEditModal();
    await loadWorkloadData();
    setScheduleMessage("Reunión actualizada correctamente.");
  }
  function openProgramAssignmentModal(assignment) {
    if (!canProgramAssignment(assignment)) return;
    if (!canCreatePersonScopedBlock()) return;
    setProgramAssignmentModal({ assignment });
    setProgramAssignmentError("");
    setProgramAssignmentDraft({
      type: "weekly",
      horas: Math.min(Number(assignment.horasPendientes || 1), 4) || 1,
      dias: ["Lunes"],
      semanas: [1],
      comentario: "",
    });
  }
  function closeProgramAssignmentModal() {
    setProgramAssignmentModal(null);
    setProgramAssignmentError("");
  }
  function toggleProgramAssignmentDay(dayName) {
    setProgramAssignmentDraft((current) => ({
      ...current,
      dias: current.dias.includes(dayName) ? current.dias.filter((day) => day !== dayName) : [...current.dias, dayName],
    }));
  }
  function toggleProgramAssignmentWeek(weekNumber) {
    setProgramAssignmentDraft((current) => ({
      ...current,
      semanas: current.semanas.includes(weekNumber) ? current.semanas.filter((week) => week !== weekNumber) : [...current.semanas, weekNumber],
    }));
  }
  async function saveProgramAssignmentHours() {
    if (!programAssignmentModal?.assignment?.id) return;
    const assignment = programAssignmentModal.assignment;
    const horasPorDia = Number(programAssignmentDraft.horas);
    const horasPendientes = Number(assignment.horasPendientes || 0);

    if (!Number.isFinite(horasPorDia) || horasPorDia <= 0) {
      setProgramAssignmentError("Las horas a programar deben ser mayores a 0.");
      return;
    }

    if (programAssignmentDraft.type === "planning") {
      if (horasPorDia > horasPendientes) {
        setProgramAssignmentError(`No puedes programar más de las horas pendientes (${formatHours(horasPendientes)}).`);
        return;
      }

      const dayName = programAssignmentDraft.dias[0] || "Lunes";
      const origin = getAssignmentDefaultOrigin(assignment.tipo);
      const range = { start: planningWeekStart, end: planningWeekEnd };
      const block = buildAssignmentWeeklyBlock({ assignment, dayName, hours: horasPorDia, origin, idPrefix: "assignment-plan-weekly" });

      const result = await saveAssignmentPlanningWeek(block, range);
      if (!result?.ok) {
        console.error(result?.error);
        setProgramAssignmentError("No fue posible agregar la actividad a Planificación.");
        return;
      }

      setAgendaManualBlocks((current) => current.filter((item) => String(item.assignmentId || "") !== String(assignment.id)).concat(block));
      const hoursResult = await recalculateAssignmentHours(assignment.id);
      if (!hoursResult?.ok) console.error(hoursResult?.error);

      closeProgramAssignmentModal();
      await loadWorkloadData();
      setScheduleMessage(`Actividad agregada a Planificación (semana ${range.start} a ${range.end}) como extraordinaria. La asignación sigue activa en el backlog.`);
      return;
    }

    const targets = programAssignmentDraft.type === "weekly" ? programAssignmentDraft.dias : programAssignmentDraft.semanas;

    if (targets.length === 0) {
      setProgramAssignmentError(programAssignmentDraft.type === "weekly" ? "Selecciona al menos un día." : "Selecciona al menos una semana.");
      return;
    }
    const horasTotalAProgramar = horasPorDia * targets.length;
    if (horasTotalAProgramar > horasPendientes) {
      setProgramAssignmentError(`No puedes programar más de las horas pendientes (${formatHours(horasPendientes)}). Con ${targets.length} ${programAssignmentDraft.type === "weekly" ? "día(s)" : "semana(s)"} a ${formatHours(horasPorDia)} c/u serían ${formatHours(horasTotalAProgramar)}.`);
      return;
    }

    const origin = getAssignmentDefaultOrigin(assignment.tipo);
    for (const target of targets) {
      const result = await programAssignmentHours({
        assignmentId: assignment.id,
        personaId: effectivePersonFilter,
        type: programAssignmentDraft.type,
        hours: horasPorDia,
        dayName: programAssignmentDraft.type === "weekly" ? target : undefined,
        weekNumber: programAssignmentDraft.type === "monthly" ? target : undefined,
        origen: origin,
      });

      if (!result?.ok) {
        console.error(result?.error);
        setProgramAssignmentError(result?.error?.message || "No fue posible programar las horas de la asignación.");
        return;
      }
    }

    closeProgramAssignmentModal();
    await loadWorkloadData();
    setScheduleMessage("Carga programada correctamente. La asignación sigue activa en el backlog.");
  }
  async function handlePauseAssignment(assignment) {
    const result = await pauseAssignment(assignment.id);
    if (!result?.ok) { console.error(result?.error); setScheduleMessage("No se pudo pausar la asignación."); return; }
    await loadWorkloadData();
    setScheduleMessage("Proyecto puesto en pausa.");
  }
  async function handleReactivateAssignment(assignment) {
    const result = await reactivateAssignment(assignment.id);
    if (!result?.ok) { console.error(result?.error); setScheduleMessage("No se pudo reactivar la asignación."); return; }
    await loadWorkloadData();
    setScheduleMessage("Proyecto reactivado.");
  }
  async function handleFinalizeAssignment(assignment) {
    const result = await finalizeAssignment(assignment.id);
    if (!result?.ok) { console.error(result?.error); setScheduleMessage("No se pudo finalizar la asignación."); return; }
    await loadWorkloadData();
    setScheduleMessage("Proyecto marcado como finalizado.");
  }
  async function handleCancelAssignment(assignment) {
    const result = await cancelAssignment(assignment.id);
    if (!result?.ok) { console.error(result?.error); setScheduleMessage("No se pudo cancelar la asignación."); return; }
    await loadWorkloadData();
    setScheduleMessage("Asignación cancelada.");
  }
  async function handleDeleteAssignment(assignment) {
    if (!window.confirm(`¿Eliminar definitivamente "${assignment.nombre}"? Esta acción no se puede deshacer.`)) return;
    const result = await deleteAssignment(assignment.id);
    if (!result?.ok) { console.error(result?.error); setScheduleMessage("No se pudo eliminar la asignación."); return; }
    await loadWorkloadData();
    setScheduleMessage("Asignación eliminada.");
  }
  async function handleConfirmMyAttendance(assignment) {
    const result = await confirmMeetingAttendance(assignment.id);
    if (!result?.ok) { console.error(result?.error); setScheduleMessage("No se pudo confirmar la asistencia."); return; }
    await loadWorkloadData();
    setScheduleMessage("Asistencia confirmada.");
  }
  function scheduleAssignment(assignment) {
    if (assignment?.estado === "Programada") return;
    if (!canCreatePersonScopedBlock()) return;
    const nextWeek = getNextWorkWeekRange(currentWorkWeek.start, currentWorkWeek.end);
    const defaultOrigin = getAssignmentDefaultOrigin(assignment.tipo);
    setAssignmentScheduleModal(assignment);
    setAssignmentScheduleDraft({
      destino: "monthly-standard",
      semanaMes: Number(assignment.semanaMes || 1),
      dia: assignment.programadaDia || "Lunes",
      origen: defaultOrigin,
      horas: Number(assignment.horas || 1),
      planningWeekStart: nextWeek.start,
      planningWeekEnd: nextWeek.end,
      planningMonth: currentWorkWeek.start.slice(0, 7),
    });
  }
  async function saveAssignmentSchedule() {
    if (!assignmentScheduleModal?.id) return;
    const hours = Number(assignmentScheduleDraft.horas || assignmentScheduleModal.horas || 1);
    const durationMinutes = Math.max(1, Math.round(hours * 60));
    const destination = assignmentScheduleDraft.destino || "monthly-standard";
    const origin = assignmentScheduleDraft.origen || getAssignmentDefaultOrigin(assignmentScheduleModal.tipo);
    const commonAssignmentUpdate = {
      estado: "Programada",
      carga_horas: hours,
      duracion_minutos: durationMinutes,
      programada_por: currentUser?.name || "Usuario",
      programada_at: new Date().toISOString(),
    };
    let result = null;
    let nextViewMode = "month";
    let nextAgendaView = agendaView;

    if (destination === "weekly-standard") {
      result = await updateWorkloadAssignment(assignmentScheduleModal.id, {
        ...commonAssignmentUpdate,
        semana_mes: null,
        dia_semana: assignmentScheduleDraft.dia,
        origen: origin,
      });
      nextViewMode = "week";
    } else if (destination === "monthly-standard") {
      result = await updateWorkloadAssignment(assignmentScheduleModal.id, {
        ...commonAssignmentUpdate,
        semana_mes: Number(assignmentScheduleDraft.semanaMes || 1),
        dia_semana: assignmentScheduleDraft.dia,
        origen: origin,
      });
      nextViewMode = "month";
    } else if (destination === "weekly-planning") {
      const range = getAssignmentPlanningWeekRange();
      const block = buildAssignmentWeeklyBlock({
        assignment: assignmentScheduleModal,
        dayName: assignmentScheduleDraft.dia,
        hours,
        origin,
        idPrefix: "assignment-plan-weekly",
      });
      result = await saveAssignmentPlanningWeek(block, range);
      if (result?.ok) {
        setPlanningWeekStart(range.start);
        setPlanningWeekEnd(range.end);
        setAgendaManualBlocks((currentBlocks) => currentBlocks.filter((item) => String(item.assignmentId || "") !== String(assignmentScheduleModal.id)).concat(block));
        const assignmentResult = await updateWorkloadAssignment(assignmentScheduleModal.id, {
          ...commonAssignmentUpdate,
          semana_mes: null,
          dia_semana: null,
          origen: origin,
        });
        if (!assignmentResult?.ok) result = assignmentResult;
      }
      nextViewMode = "agenda";
      nextAgendaView = "weekly";
    } else if (destination === "monthly-planning") {
      const monthDate = `${assignmentScheduleDraft.planningMonth || currentWorkWeek.start.slice(0, 7)}-01`;
      const block = buildAssignmentMonthlyBlock({
        assignment: assignmentScheduleModal,
        weekNumber: Number(assignmentScheduleDraft.semanaMes || 1),
        hours,
        origin,
        idPrefix: "assignment-plan-monthly",
      });
      result = await saveAssignmentPlanningMonth(block, monthDate);
      if (result?.ok) {
        setAgendaMonthlyBlocks((currentBlocks) => currentBlocks.filter((item) => String(item.assignmentId || "") !== String(assignmentScheduleModal.id)).concat(block));
        const assignmentResult = await updateWorkloadAssignment(assignmentScheduleModal.id, {
          ...commonAssignmentUpdate,
          semana_mes: null,
          dia_semana: null,
          origen: origin,
        });
        if (!assignmentResult?.ok) result = assignmentResult;
      }
      nextViewMode = "agenda";
      nextAgendaView = "monthly";
    }

    if (!result?.ok) {
      console.error(result?.error);
      setScheduleMessage("No se pudo programar la asignación.");
      return;
    }

    setAssignmentScheduleModal(null);
    await loadWorkloadData();
    setViewMode(nextViewMode);
    if (nextViewMode === "agenda") setAgendaView(nextAgendaView);
    setScheduleMessage("Asignación programada correctamente.");
  }
  function openAssignmentStatusDetail(assignment) {
    if (!assignment) return;
    setAssignmentStatusDetail(assignment);
  }
  function openAssignmentManagementDetail(assignment) {
    if (!assignment) return;
    setAssignmentManagementDetail(assignment);
  }
  async function persistPlanApprovalReview({ approval, review } = {}) {
    if (!canCreatePersonScopedBlock()) return;
    if (!isMonthlyPlanning) {
      const validationMessage = validatePlanningPeriod();
      if (validationMessage) { setPlanSaveWarning(validationMessage); return; }
    }

    const approvalFields = {
      aprobado_vobo: (approval || planApproval).status === "Aprobada con VOBO",
      aprobado_por: (approval || planApproval).approvedBy || null,
      aprobado_rol: (approval || planApproval).approvedRole || null,
      aprobado_at: (approval || planApproval).approvedAt || null,
      revisado: (review || reviewStatus).status === "Revisada",
      revisado_por: (review || reviewStatus).reviewedBy || null,
      revisado_rol: (review || reviewStatus).reviewedRole || null,
      revisado_at: (review || reviewStatus).reviewedAt || null,
      comentario_revision: reviewComment || null,
      propuesta_mejora: improvementProposal || null,
    };

    const basePayload = isMonthlyPlanning ? buildSavedMonthlyPayload() : buildSavedWeeklyPayload();
    const payload = { ...basePayload, ...approvalFields };

    const existingResult = isMonthlyPlanning
      ? await findExistingSavedMonth({ personaId: effectivePersonFilter, ...getMonthPlanParts(planningWeekStart) })
      : await findExistingSavedWeek({ personaId: effectivePersonFilter, fechaInicio: planningWeekStart, fechaFin: planningWeekEnd });

    if (!existingResult?.ok) { console.error(existingResult?.error); return; }

    const result = existingResult.data
      ? await updateSavedWorkloadPlan(existingResult.data.id, payload)
      : await saveWorkloadPlan(payload);

    if (!result?.ok) { console.error(result?.error); return; }
    setSelectedPlanId(result.data.id);
    await loadSavedPlansFromSupabase();
  }
  function approveCurrentPlan() {
    setApprovalError("");
    if (!canApprovePlan()) {
      setApprovalError("Tu usuario no tiene permisos para dar VOBO a esta planificación.");
      return;
    }
    const nextApproval = {
      status: "Aprobada con VOBO",
      approvedBy: currentUser?.name || "Usuario autorizado",
      approvedRole: getPrimaryUserRole(),
      approvedAt: new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
    };
    setPlanApproval(nextApproval);
    setShowApprovalForm(false);
    persistPlanApprovalReview({ approval: nextApproval });
  }
function canReviewPlan() {
  return hasFullAccess(currentUser);
}
  function markPlanReviewed() {
    if (!canReviewPlan()) return;
    const nextReview = {
      status: "Revisada",
      reviewedBy: currentUser?.name || "Usuario autorizado",
      reviewedRole: getPrimaryUserRole(),
      reviewedAt: new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
      completionSummary: weeklyPlanKpi,
    };
    setReviewStatus(nextReview);
    persistPlanApprovalReview({ review: nextReview });
  }
  async function reorderAgendaBlock(activity, targetDay, targetIndex) {
    if (!activity || !targetDay) return;
    const activityKey = getAgendaBlockKey(activity);

    if (activity.planId && activity.planType === "weekly") {
      const sourceDay = activity.diaTipico;
      const targetGroupIncludingSelf = getWeeklyPlanGroup(targetDay);
      const targetGroup = getWeeklyPlanGroup(targetDay, activity.planId);
      const insertIndex = resolveInsertIndexExcludingSelf(targetGroupIncludingSelf, String(activity.planId), targetIndex, (plan) => String(plan.id));
      const nextGroup = [...targetGroup];
      nextGroup.splice(insertIndex, 0, { id: activity.planId, orden: insertIndex + 1, created_at: activity.planCreatedAt });
      const moveResult = await moveWeeklyPlanActivity({
        planId: activity.planId,
        personaId: activity.personaId || effectivePersonFilter,
        activityId: activity.sourceActivityId,
        dayName: targetDay,
        orden: insertIndex + 1,
      });

      if (!moveResult?.ok) {
        console.error(moveResult?.error);
        setScheduleMessage(moveResult?.duplicated ? "Ya existe una programacion para esa ubicacion." : "No fue posible guardar los cambios.");
        return;
      }

      const orderResult = await updateWeeklyPlanOrder(nextGroup.map((plan, index) => ({ id: plan.id, orden: index + 1 })));
      if (!orderResult?.ok) console.error(orderResult?.error);
      if (sourceDay !== targetDay) {
        const sourceOrderResult = await persistWeeklyGroupOrder(sourceDay, activity.planId);
        if (!sourceOrderResult?.ok) console.error(sourceOrderResult?.error);
      }

      setAgendaDraggedBlock(null);
      setAgendaDropIndicator(null);
      await loadWorkloadData();
      setScheduleMessage("Orden actualizado correctamente.");
      return;
    }

    const dayGroupIncludingSelf = activeAgendaBlocks.filter((block) => block.diaTipico === targetDay);
    const adjustedIndex = resolveInsertIndexExcludingSelf(dayGroupIncludingSelf, activityKey, targetIndex, (block) => getAgendaBlockKey(block));
    const currentBlocks = dayGroupIncludingSelf.filter((block) => getAgendaBlockKey(block) !== activityKey);
    const previousBlock = currentBlocks[adjustedIndex - 1];
    const nextBlock = currentBlocks[adjustedIndex];
    let nextOrder = 10;
    if (previousBlock && nextBlock) nextOrder = (Number(previousBlock.orden || 0) + Number(nextBlock.orden || 0)) / 2;
    else if (previousBlock) nextOrder = Number(previousBlock.orden || 0) + 10;
    else if (nextBlock) nextOrder = Number(nextBlock.orden || 0) - 10;

    const movedBlock = { ...activity, diaTipico: targetDay, orden: nextOrder, planningSource: activity.planningSource || "Reprogramado" };
    const existsInManualAgenda = agendaManualBlocks.some((block) => getAgendaBlockKey(block) === activityKey || block.id === activity.id);

    if (existsInManualAgenda) {
      setAgendaManualBlocks((currentBlocksManual) =>
        currentBlocksManual.map((block) =>
          getAgendaBlockKey(block) === activityKey || block.id === activity.id ? { ...block, ...movedBlock } : block
        )
      );
    } else {
      setAgendaRemovedBlockIds((currentIds) => [...new Set([...currentIds, activity.occurrenceId])]);
      const movedId = `agenda-moved-${activity.occurrenceId || Date.now()}`;
      setAgendaManualBlocks((currentBlocksManual) => [
        ...currentBlocksManual,
        { ...movedBlock, id: movedId, occurrenceId: movedId, isManualProject: true },
      ]);
    }

    if (activity.assignmentId) {
      setAssignments((currentAssignments) =>
        currentAssignments.map((assignment) =>
          assignment.id === activity.assignmentId
            ? {
                ...assignment,
                programadaSemanaInicio: planningWeekStart,
                programadaSemanaFin: planningWeekEnd,
                programadaDia: targetDay,
                programadaPor: currentUser?.name || assignment.programadaPor || "Usuario",
                programadaAt: new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
              }
            : assignment
        )
      );
      if (assignmentStatusDetail?.id === activity.assignmentId) {
        setAssignmentStatusDetail((currentDetail) => currentDetail ? { ...currentDetail, programadaSemanaInicio: planningWeekStart, programadaSemanaFin: planningWeekEnd, programadaDia: targetDay, programadaPor: currentUser?.name || currentDetail.programadaPor || "Usuario", programadaAt: new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) } : currentDetail);
      }
    }

    setAgendaDraggedBlock(null);
    setAgendaDropIndicator(null);
  }
  function showAgendaDropIndicator(dayName, targetIndex) { if (!agendaDraggedBlock) return; setAgendaDropIndicator({ day: dayName, index: targetIndex }); }
  function isAgendaDropIndicatorActive(dayName, targetIndex) { return agendaDropIndicator?.day === dayName && agendaDropIndicator?.index === targetIndex; }
  function renderAgendaInsertLine(dayName, targetIndex) { const active = isAgendaDropIndicatorActive(dayName, targetIndex); return <div onDragOver={(event) => { event.preventDefault(); showAgendaDropIndicator(dayName, targetIndex); }} onDragEnter={(event) => { event.preventDefault(); showAgendaDropIndicator(dayName, targetIndex); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); reorderAgendaBlock(agendaDraggedBlock, dayName, targetIndex); }} className="relative h-3"><div className={`absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition ${active ? "bg-sky-500 opacity-100 shadow-sm" : "bg-transparent opacity-0"}`} /><div className={`absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full transition ${active ? "bg-sky-500 opacity-100" : "bg-transparent opacity-0"}`} /></div>; }
  function canRemoveAgendaBlock() { return true; }
  // isManualProject (no el prefijo del id) es la señal correcta de "vive en
  // agendaManualBlocks": se pone en true tanto para bloques agregados con
  // "+ Bloque" (id agenda-manual-…) como para una ocurrencia de Semana
  // típica ya movida/editada dentro de Planificación (id agenda-moved-…) o
  // cargada desde una semana guardada (id original o saved-block-…). Filtrar
  // solo por el prefijo "agenda-manual-" dejaba fuera estos dos últimos
  // casos: el "Quitar" no hacía nada porque intentaba excluirlos de
  // weekOccurrences, de donde ya no provienen.
  function removeAgendaBlock(activity) { if (!canRemoveAgendaBlock(activity)) return; if (activity?.isManualProject) { setAgendaManualBlocks((currentBlocks) => currentBlocks.filter((block) => block.id !== activity.id)); return; } setAgendaRemovedBlockIds((currentIds) => [...new Set([...currentIds, activity.occurrenceId])]); }
  // Subir/Bajar/Mover/Editar de Planificación (borrador local): reutilizan
  // reorderAgendaBlock, la misma función que ya usa el drag-and-drop de esta
  // pestaña, para que el menú se comporte exactamente igual que ya se
  // comporta hoy arrastrar una tarjeta — nada nuevo se escribe a
  // workload_plan_semanal_detalle salvo lo que esa función ya escribía antes.
  function moveAgendaBlockWithinDay(activity, direction) {
    if (!activity || !direction) return;
    const day = activity.diaTipico;
    const group = activeAgendaBlocks.filter((block) => block.diaTipico === day);
    const currentIndex = group.findIndex((block) => getAgendaBlockKey(block) === getAgendaBlockKey(activity));
    if (currentIndex < 0) return;
    // reorderAgendaBlock espera "índice, dentro del arreglo con el elemento
    // todavía en su lugar, del elemento que debe quedar justo después" — para
    // subir es el que está una posición antes; para bajar hay que saltar al
    // que está DOS posiciones después (el vecino inmediato ya no sirve de
    // referencia una vez que el elemento arrastrado se quita de en medio).
    if (direction < 0) {
      if (currentIndex === 0) return;
      reorderAgendaBlock(activity, day, currentIndex - 1);
    } else {
      if (currentIndex >= group.length - 1) return;
      reorderAgendaBlock(activity, day, currentIndex + 2);
    }
  }
  function handleAgendaScheduledAction(activity, action) {
    if (!action) return;
    if (action === "up") { moveAgendaBlockWithinDay(activity, -1); return; }
    if (action === "down") { moveAgendaBlockWithinDay(activity, 1); return; }
    if (action === "move") {
      setAgendaMoveModal({ activity });
      setAgendaMoveTarget(activity.diaTipico);
      return;
    }
    if (action === "remove") { removeAgendaBlock(activity); return; }
    if (action === "edit") {
      setAgendaEditModal({ activity });
      setAgendaEditDraft({ name: activity.actividad || "", minutes: String(activity.duracionMinutos || 60) });
    }
  }
  function closeAgendaMoveModal() { setAgendaMoveModal(null); setAgendaMoveTarget(""); }
  function saveAgendaMove() {
    if (!agendaMoveModal?.activity || !agendaMoveTarget) return;
    // Number.MAX_SAFE_INTEGER siempre se recorta al final de la lista
    // destino dentro de resolveInsertIndexExcludingSelf, sin importar si el
    // día destino es el mismo u otro.
    reorderAgendaBlock(agendaMoveModal.activity, agendaMoveTarget, Number.MAX_SAFE_INTEGER);
    closeAgendaMoveModal();
  }
  function closeAgendaEditModal() { setAgendaEditModal(null); setAgendaEditDraft({ name: "", minutes: "" }); }
  function updateAgendaEditDraft(field, value) { setAgendaEditDraft((draft) => ({ ...draft, [field]: value })); }
  function saveAgendaEdit() {
    if (!agendaEditModal?.activity) return;
    const activity = agendaEditModal.activity;
    const isManual = isManualReservationActivity(activity);
    const duration = Number(agendaEditDraft.minutes);
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (isManual && !agendaEditDraft.name.trim()) return;
    const nextName = isManual ? agendaEditDraft.name.trim() : activity.actividad;
    const activityKey = getAgendaBlockKey(activity);
    const existsInManualAgenda = agendaManualBlocks.some((block) => getAgendaBlockKey(block) === activityKey || block.id === activity.id);

    if (existsInManualAgenda) {
      setAgendaManualBlocks((currentBlocks) => currentBlocks.map((block) =>
        (getAgendaBlockKey(block) === activityKey || block.id === activity.id)
          ? { ...block, actividad: nextName, duracionMinutos: duration }
          : block
      ));
    } else {
      setAgendaRemovedBlockIds((currentIds) => [...new Set([...currentIds, activity.occurrenceId])]);
      const editedId = `agenda-moved-${activity.occurrenceId || Date.now()}`;
      setAgendaManualBlocks((currentBlocksManual) => [
        ...currentBlocksManual,
        { ...activity, id: editedId, occurrenceId: editedId, isManualProject: true, actividad: nextName, duracionMinutos: duration, planningSource: activity.planningSource || "Reprogramado" },
      ]);
    }

    closeAgendaEditModal();
  }
  // Equivalentes para la vista mensual de Planificación — solo aplican a los
  // bloques agregados (block.isMonthlyBlock), igual que en Mes típico las 5
  // acciones tampoco aplican a las filas base/consolidadas.
  function moveAgendaMonthlyBlockOrder(block, direction) {
    if (!block?.id || !direction) return;
    const weekNumber = Number(block.semanaMes || safeArray(block.targetWeeks)[0] || 1);
    const siblings = agendaMonthlyBlocks
      .filter((item) => item.origen === block.origen && getMonthlyBlockWeeks(item).includes(weekNumber))
      .sort(compareOrderCreated);
    const currentIndex = siblings.findIndex((item) => String(item.id) === String(block.id));
    if (currentIndex < 0) return;
    if (direction < 0) {
      if (currentIndex === 0) return;
      moveAgendaMonthlyBlock(block.id, block.origen, weekNumber, currentIndex - 1);
    } else {
      if (currentIndex >= siblings.length - 1) return;
      moveAgendaMonthlyBlock(block.id, block.origen, weekNumber, currentIndex + 2);
    }
  }
  function handleAgendaMonthlyScheduledAction(block, action) {
    if (!action) return;
    if (action === "up") { moveAgendaMonthlyBlockOrder(block, -1); return; }
    if (action === "down") { moveAgendaMonthlyBlockOrder(block, 1); return; }
    if (action === "move") {
      setAgendaMonthlyMoveModal({ block });
      setAgendaMonthlyMoveTarget({ rowType: block.origen, weekNumber: String(block.semanaMes || safeArray(block.targetWeeks)[0] || 1) });
      return;
    }
    if (action === "remove") { deleteAgendaMonthlyBlock(block); return; }
    if (action === "edit") {
      setAgendaMonthlyEditModal({ block });
      setAgendaMonthlyEditDraft({ name: block.actividad || "", minutes: String(block.duracionMinutos || 60) });
    }
  }
  function closeAgendaMonthlyMoveModal() { setAgendaMonthlyMoveModal(null); setAgendaMonthlyMoveTarget({ rowType: "", weekNumber: "" }); }
  function saveAgendaMonthlyMove() {
    if (!agendaMonthlyMoveModal?.block || !agendaMonthlyMoveTarget.rowType || !agendaMonthlyMoveTarget.weekNumber) return;
    const block = agendaMonthlyMoveModal.block;
    const weekNumber = Number(agendaMonthlyMoveTarget.weekNumber);
    moveAgendaMonthlyBlock(block.id, agendaMonthlyMoveTarget.rowType, weekNumber, Number.MAX_SAFE_INTEGER);
    closeAgendaMonthlyMoveModal();
  }
  function closeAgendaMonthlyEditModal() { setAgendaMonthlyEditModal(null); setAgendaMonthlyEditDraft({ name: "", minutes: "" }); }
  function updateAgendaMonthlyEditDraft(field, value) { setAgendaMonthlyEditDraft((draft) => ({ ...draft, [field]: value })); }
  function saveAgendaMonthlyEdit() {
    if (!agendaMonthlyEditModal?.block) return;
    const block = agendaMonthlyEditModal.block;
    const duration = Number(agendaMonthlyEditDraft.minutes);
    const name = agendaMonthlyEditDraft.name.trim();
    if (!Number.isFinite(duration) || duration <= 0 || !name) return;
    setAgendaMonthlyBlocks((currentBlocks) => currentBlocks.map((item) =>
      String(item.id) === String(block.id)
        ? { ...item, actividad: name, duracionMinutos: duration, cargaMensual: Number((duration / 60).toFixed(2)) }
        : item
    ));
    closeAgendaMonthlyEditModal();
  }
  function resetAgendaPlanningState(range = getCurrentWorkWeekRange()) {
    setPlanningWeekStart(range.start);
    setPlanningWeekEnd(range.end);
    setAgendaManualBlocks([]);
    setAgendaRemovedBlockIds([]);
    setCompletedAgendaBlockIds([]);
    setAgendaQuickDay(null);
    setAgendaBlockName("");
    setAgendaBlockMinutes("60");
    setAgendaBlockType("Proyecto");
    setAgendaDraggedBlock(null);
    setAgendaDropIndicator(null);
    setAgendaMonthlyBlocks([]);
    setAgendaMonthlyQuickTarget(null);
    setAgendaMonthlyBlockName("");
    setAgendaMonthlyBlockMinutes("60");
    setAgendaMonthlyBlockType("Proyecto");
    setAgendaMonthlyDraggedBlock(null);
    setAgendaMonthlyDropIndicator(null);
    setPlanApproval({ status: "Pendiente VOBO", approvedBy: "", approvedAt: "" });
    setReviewStatus({ status: "Pendiente revisión", reviewedBy: "", reviewedRole: "", reviewedAt: "" });
    setReviewComment("");
    setImprovementProposal("");
    setPlanSaveWarning("");
    setOverwritePlanId(null);
    setSelectedPlanId(null);
  }

  async function loadSavedPlansFromSupabase() {
    if (!effectivePersonFilter || effectivePersonFilter === "all") {
      setSavedPlans([]);
      setSelectedPlanId(null);
      return [];
    }

    const result = isMonthlyPlanning
      ? await getSavedMonthlyPlans({ personaId: effectivePersonFilter })
      : await getSavedWeeklyPlans({ personaId: effectivePersonFilter });

    if (!result?.ok) {
      console.error(result?.error);
      return savedPlans;
    }

    const nextPlans = safeArray(result.data).map(mapSavedWorkloadPlan);
    setSavedPlans(nextPlans);
    if (selectedPlanId && !nextPlans.some((plan) => String(plan.id) === String(selectedPlanId))) {
      setSelectedPlanId(null);
    }
    return nextPlans;
  }

  function startNewAgendaWeek() {
    resetAgendaPlanningState(getCurrentWorkWeekRange());
  }

  function startNewAgendaMonth() {
    setAgendaMonthlyBlocks(monthlyPlanningBaseBlocks);
    setAgendaMonthlyQuickTarget(null);
    setAgendaMonthlyBlockName("");
    setAgendaMonthlyBlockMinutes("60");
    setAgendaMonthlyBlockType("Proyecto");
    setAgendaMonthlyDraggedBlock(null);
    setAgendaMonthlyDropIndicator(null);
    setCompletedAgendaBlockIds([]);
    setPlanApproval({ status: "Pendiente VOBO", approvedBy: "", approvedAt: "" });
    setReviewStatus({ status: "Pendiente revisión", reviewedBy: "", reviewedRole: "", reviewedAt: "" });
    setReviewComment("");
    setImprovementProposal("");
    setPlanSaveWarning("");
    setOverwritePlanId(null);
    setSelectedPlanId(null);
  }

  function startNextAgendaWeek(nextSavedPlans = savedPlans) {
    resetAgendaPlanningState(getNextAvailableWorkWeekRange(nextSavedPlans, planningWeekStart, planningWeekEnd));
  }

  function buildPlanPayload(planId) {
    const totalMinutes = activeAgendaBlocks.reduce((sum, activity) => sum + getDurationMinutes(activity), 0);
    return {
      id: planId,
      personaId: effectivePersonFilter,
      responsable: selectedPersonName,
      name: formatPlanPeriodName(planningWeekStart, planningWeekEnd),
      createdAt: new Date().toLocaleDateString("es-MX"),
      updatedAt: new Date().toLocaleDateString("es-MX"),
      blocks: activeAgendaBlocks,
      completedBlockIds: completedAgendaBlockIds,
      completionSummary: weeklyPlanKpi,
      approval: planApproval,
      review: reviewStatus,
      reviewComment,
      improvementProposal,
      weekStart: planningWeekStart,
      weekEnd: planningWeekEnd,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
    };
  }

  function buildPlanApprovalReviewFields() {
    return {
      aprobado_vobo: planApproval.status === "Aprobada con VOBO",
      aprobado_por: planApproval.approvedBy || null,
      aprobado_rol: planApproval.approvedRole || null,
      aprobado_at: planApproval.approvedAt || null,
      revisado: reviewStatus.status === "Revisada",
      revisado_por: reviewStatus.reviewedBy || null,
      revisado_rol: reviewStatus.reviewedRole || null,
      revisado_at: reviewStatus.reviewedAt || null,
      comentario_revision: reviewComment || null,
      propuesta_mejora: improvementProposal || null,
    };
  }
  function buildSavedWeeklyPayload() {
    return {
      tipo_plan: "semanal",
      persona_id: effectivePersonFilter,
      responsable: selectedPersonName,
      fecha_inicio: planningWeekStart,
      fecha_fin: planningWeekEnd,
      nombre: formatPlanPeriodName(planningWeekStart, planningWeekEnd),
      estado: "Borrador",
      bloques: activeAgendaBlocks,
      completados: completedAgendaBlockIds,
      resumen: weeklyPlanKpi,
      creado_por: currentUser?.name || "Usuario",
      actualizado_por: currentUser?.name || "Usuario",
      activo: true,
      ...buildPlanApprovalReviewFields(),
    };
  }

  function buildMonthlySnapshotBlocks() {
    return agendaMonthlyBlocks.map((block, index) => {
      const targetWeeks = safeArray(block.targetWeeks).length > 0 ? block.targetWeeks.map(Number) : [Number(block.semanaMes || block.semana_mes || 1)];
      const weekNumber = Number(block.semanaMes || block.semana_mes || targetWeeks[0] || 1);
      return {
        ...block,
        id: block.id || `month-plan-${weekNumber}-${index}`,
        monthlyOccurrenceId: block.monthlyOccurrenceId || block.id || `month-plan-${weekNumber}-${index}`,
        targetWeeks,
        semanaMes: weekNumber,
        monthlyOrder: Number(block.monthlyOrder || block.orden || index + 1),
        orden: Number(block.monthlyOrder || block.orden || index + 1),
        isMonthlyBlock: true,
      };
    });
  }

  function buildSavedMonthlyPayload() {
    const { mes, anio } = getMonthPlanParts(planningWeekStart);
    const snapshotBlocks = buildMonthlySnapshotBlocks();
    const totalMinutes = snapshotBlocks.reduce((sum, block) => sum + getDurationMinutes(block), 0);
    return {
      tipo_plan: "mensual",
      persona_id: effectivePersonFilter,
      responsable: selectedPersonName,
      mes,
      anio,
      nombre: formatMonthPlanName(mes, anio),
      estado: "Borrador",
      bloques: snapshotBlocks,
      completados: [],
      resumen: {
        weeks: agendaMonthSummary.map((week) => ({
          week: week.label,
          total: Number((week.usedMinutes / 60).toFixed(1)),
          occupation: Number(week.occupation.toFixed(0)),
        })),
        totalHours: Number((totalMinutes / 60).toFixed(1)),
      },
      creado_por: currentUser?.name || "Usuario",
      actualizado_por: currentUser?.name || "Usuario",
      activo: true,
      ...buildPlanApprovalReviewFields(),
    };
  }

  function validatePlanningPeriod() {
    const diffDays = getDateDiffDays(planningWeekStart, planningWeekEnd);
    if (!planningWeekStart || !planningWeekEnd) return "Selecciona fecha inicial y fecha final para guardar la planificación.";
    if (diffDays < 0) return "La fecha inicial no puede ser posterior a la fecha final.";
    if (diffDays !== 4) return "La planificación debe corresponder a una semana laboral real de lunes a viernes o un rango de 5 días.";
    return "";
  }

  async function saveCurrentAgendaPlan() {
    if (!canCreatePersonScopedBlock()) return;
    const validationMessage = validatePlanningPeriod();
    if (validationMessage) {
      setPlanSaveWarning(validationMessage);
      setOverwritePlanId(null);
      return;
    }

    const existingResult = await findExistingSavedWeek({
      personaId: effectivePersonFilter,
      fechaInicio: planningWeekStart,
      fechaFin: planningWeekEnd,
    });

    if (!existingResult?.ok) {
      console.error(existingResult?.error);
      setPlanSaveWarning("No fue posible validar si la semana ya existe en Supabase.");
      return;
    }

    if (existingResult.data) {
      const duplicatedPlan = mapSavedWorkloadPlan(existingResult.data);
      setPlanSaveWarning(`Ya existe ${duplicatedPlan.name}. ¿Deseas sobreescribir la planificación guardada?`);
      setOverwritePlanId(duplicatedPlan.id);
      setSelectedPlanId(duplicatedPlan.id);
      return;
    }

    const saveResult = await saveWorkloadPlan(buildSavedWeeklyPayload());
    if (!saveResult?.ok) {
      console.error(saveResult?.error);
      setPlanSaveWarning("No fue posible guardar la semana en Supabase.");
      return;
    }

    setPlanSaveWarning("");
    setOverwritePlanId(null);
    const nextPlans = await loadSavedPlansFromSupabase();
    startNextAgendaWeek(nextPlans);
  }

  async function saveCurrentAgendaMonth() {
    if (!canCreatePersonScopedBlock()) return;
    const { mes, anio } = getMonthPlanParts(planningWeekStart);
    const existingResult = await findExistingSavedMonth({ personaId: effectivePersonFilter, mes, anio });

    if (!existingResult?.ok) {
      console.error(existingResult?.error);
      setPlanSaveWarning("No fue posible validar si el mes ya existe en Supabase.");
      return;
    }

    if (existingResult.data) {
      const duplicatedPlan = mapSavedWorkloadPlan(existingResult.data);
      setPlanSaveWarning(`Ya existe ${duplicatedPlan.name}. ¿Deseas sobreescribir la planificación guardada?`);
      setOverwritePlanId(duplicatedPlan.id);
      setSelectedPlanId(duplicatedPlan.id);
      return;
    }

    const saveResult = await saveWorkloadPlan(buildSavedMonthlyPayload());
    if (!saveResult?.ok) {
      console.error(saveResult?.error);
      setPlanSaveWarning("No fue posible guardar el mes en Supabase.");
      return;
    }

    setPlanSaveWarning("");
    setOverwritePlanId(null);
    setMonthlySnapshotMode(false);
    await loadSavedPlansFromSupabase();
  }

  async function overwriteSavedPlan() {
    if (!overwritePlanId) return;
    if (!canCreatePersonScopedBlock()) return;
    if (!isMonthlyPlanning) {
      const validationMessage = validatePlanningPeriod();
      if (validationMessage) {
        setPlanSaveWarning(validationMessage);
        return;
      }
    }

    const payload = isMonthlyPlanning ? buildSavedMonthlyPayload() : buildSavedWeeklyPayload();
    const updateResult = await updateSavedWorkloadPlan(overwritePlanId, payload);
    if (!updateResult?.ok) {
      console.error(updateResult?.error);
      setPlanSaveWarning("No fue posible sobreescribir la planificación en Supabase.");
      return;
    }

    setPlanSaveWarning("");
    setOverwritePlanId(null);
    const nextPlans = await loadSavedPlansFromSupabase();
    if (isMonthlyPlanning) setMonthlySnapshotMode(false);
    else startNextAgendaWeek(nextPlans);
  }

  function cancelOverwritePlan() {
    setOverwritePlanId(null);
    setPlanSaveWarning("");
  }

  function loadSavedPlan(planId) {
    const plan = savedPlans.find((item) => String(item.id) === String(planId));
    if (!plan) return;
    setPlanSaveWarning("");
    setOverwritePlanId(null);
    setSelectedPlanId(planId);
    if (plan.tipoPlan === "mensual") {
      const savedBlocks = safeArray(plan.blocks).map((block, index) => ({
        ...block,
        id: block.id || `saved-month-block-${plan.id}-${index}`,
        monthlyOccurrenceId: block.monthlyOccurrenceId || block.id || `saved-month-block-${plan.id}-${index}`,
        targetWeeks: safeArray(block.targetWeeks).length > 0 ? block.targetWeeks : [Number(block.semanaMes || block.semana_mes || 1)],
        semanaMes: Number(block.semanaMes || block.semana_mes || safeArray(block.targetWeeks)[0] || 1),
        monthlyOrder: Number(block.monthlyOrder || block.orden || index + 1),
        isMonthlyBlock: true,
      }));

      setAgendaMonthlyBlocks(savedBlocks);
      setCompletedAgendaBlockIds(plan.completedBlockIds || []);
      setAgendaMonthlyQuickTarget(null);
      setAgendaMonthlyDraggedBlock(null);
      setAgendaMonthlyDropIndicator(null);
      return;
    }

    if (plan.approval) setPlanApproval(plan.approval);
    if (plan.review) setReviewStatus(plan.review);
    if (typeof plan.reviewComment === "string") setReviewComment(plan.reviewComment);
    if (typeof plan.improvementProposal === "string") setImprovementProposal(plan.improvementProposal);
    if (plan.completedBlockIds) setCompletedAgendaBlockIds(plan.completedBlockIds);
    if (plan.weekStart) setPlanningWeekStart(plan.weekStart);
    if (plan.weekEnd) setPlanningWeekEnd(plan.weekEnd);

    const savedBlocks = safeArray(plan.blocks).map((block, index) => ({
      ...block,
      id: block.id || `saved-block-${plan.id}-${index}`,
      occurrenceId: block.occurrenceId || block.id || `saved-block-${plan.id}-${index}`,
      isManualProject: true,
      planningSource: block.planningSource || "Semana guardada",
    }));

    setAgendaRemovedBlockIds(weekOccurrences.map((activity) => activity.occurrenceId));
    setAgendaManualBlocks(savedBlocks);
    setAgendaQuickDay(null);
    setAgendaDraggedBlock(null);
    setAgendaDropIndicator(null);
  }

  async function deleteSavedPlan(planId) {
    const plan = savedPlans.find((item) => String(item.id) === String(planId));
    if (!plan) return;
    if (!window.confirm(`¿Eliminar definitivamente "${plan.name}"? Esta acción no se puede deshacer.`)) return;

    const result = await deleteSavedWorkloadPlan(plan.id);
    if (!result?.ok) {
      console.error(result?.error);
      setScheduleMessage("No se pudo eliminar la semana guardada.");
      return;
    }

    setSavedPlans((current) => current.filter((item) => String(item.id) !== String(planId)));
    if (String(selectedPlanId) === String(planId)) {
      resetAgendaPlanningState(getCurrentWorkWeekRange());
    }
    setScheduleMessage(isMonthlyPlanning ? "Mes guardado eliminado." : "Semana guardada eliminada.");
  }

  function renderAgendaMonthlyPlanning() {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[90px_repeat(4,minmax(0,1fr))] border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
          <div className="px-3 py-2.5">Origen</div>
          {agendaMonthSummary.map((week) => (
            <div key={week.weekNumber} className="border-l border-slate-100 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span>{week.label}</span>
                <StatusPill status={week.status} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] font-black normal-case tracking-normal text-slate-500">
                <span>{week.occupation.toFixed(0)}%</span>
                <span>{formatHours(week.totalSemana)} / {formatHours(week.capacityHours)}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${week.status.bar}`} style={{ width: `${Math.min(week.occupation, 140)}%` }} />
              </div>
              <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-1 normal-case tracking-normal">
                <div className="text-[8px] font-black uppercase tracking-wider text-sky-700">Carga semanal típica</div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] font-black text-slate-600">
                  <span>{formatHours(week.weeklyTypicalLoad.hours)} / {formatHours(week.weeklyTypicalLoad.capacityHours)}</span>
                  <span>{week.weeklyTypicalLoad.occupation.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {agendaMonthlyMatrix.map((row) => (
          <div key={row.type} className="grid grid-cols-[90px_repeat(4,minmax(0,1fr))] border-b border-slate-100 last:border-b-0" style={{ alignItems: "start" }}>
            <div className="flex items-start px-2 py-2"><SourcePill source={row.type} /></div>
            {row.weeks.map((week) => {
              const monthlyBlockCount = week.blocks.filter((block) => block.isMonthlyBlock).length;
              return (
                <div
                  key={`agenda-${row.type}-${week.weekNumber}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const draggedId = agendaMonthlyDraggedBlock?.id || event.dataTransfer.getData("text/plain");
                    if (!draggedId) return;
                    moveAgendaMonthlyBlock(draggedId, row.type, week.weekNumber, monthlyBlockCount);
                  }}
                  className={`min-h-[74px] border-l border-slate-100 p-2 transition ${agendaMonthlyDraggedBlock ? "bg-sky-50/30 ring-1 ring-sky-100" : ""}`}
                >
                  <div className="mb-2 text-[9px] font-black text-slate-400">{formatHours(week.usedMinutes / 60)}</div>
                  <div className="space-y-1">
                    {week.blocks.length > 0 ? week.blocks.map((block, blockIndex) => {
                      const monthlyTargetIndex = week.blocks.slice(0, blockIndex).filter((item) => item.isMonthlyBlock).length;
                      return (
                        <React.Fragment key={block.monthlyOccurrenceId || block.id}>
                          {renderAgendaMonthlyInsertLine(row.type, week.weekNumber, monthlyTargetIndex)}
                          <div
                            draggable={Boolean(block.isMonthlyBlock)}
                            onDragStart={(event) => {
                              if (!block.isMonthlyBlock) return;
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", block.id);
                              setAgendaMonthlyDraggedBlock(block);
                            }}
                            onDragEnd={() => {
                              setAgendaMonthlyDraggedBlock(null);
                              setAgendaMonthlyDropIndicator(null);
                            }}
                            className={`relative rounded-lg border px-1.5 py-1 shadow-sm transition ${block.isMonthlyBlock ? "cursor-grab active:cursor-grabbing hover:shadow-md" : ""} ${agendaMonthlyDraggedBlock?.id === block.id ? "opacity-40" : ""} ${getCardStyle(block.origen)}`}
                          >
                            <SemaforoDot value={block.semaforo} onChange={(next) => handleSemaforoChange(block.sourceActivityId || block.id, next)} disabled={!canEditSelectedPerson} className="z-20" />
                            {block.isMonthlyBlock && <select value="" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => { handleAgendaMonthlyScheduledAction(block, event.target.value); event.target.value = ""; }} className="absolute right-1 top-1 z-30 h-5 w-6 rounded-full border border-slate-200 bg-white text-[9px] font-black text-slate-500 outline-none" title="Opciones"><option value="">⋯</option><option value="up">Subir</option><option value="down">Bajar</option><option value="move">Mover</option><option value="edit">Editar</option><option value="remove">Quitar</option></select>}
                            <div className="pr-7">
                              <p className="line-clamp-2 text-[9px] font-black leading-tight text-slate-950">{block.actividad}</p>
                              <p className="mt-0.5 truncate text-[8px] font-bold text-slate-500">{block.planningSource || block.rol}</p>
                              <div className="mt-1 flex items-end justify-between gap-2">
                                <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${getCardAccentStyle(block.origen)}`}>{getMonthlyFrequencyLabel(block)}</span>
                                <span className="text-[8px] font-black text-slate-500">{block.duracionMinutos} min</span>
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    }) : (
                      <>
                        {renderAgendaMonthlyInsertLine(row.type, week.weekNumber, 0)}
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-2 text-center text-[9px] font-bold text-slate-300">Sin bloques</div>
                      </>
                    )}
                    {week.blocks.length > 0 && renderAgendaMonthlyInsertLine(row.type, week.weekNumber, monthlyBlockCount)}
                  </div>
                  {renderAgendaMonthlyQuickForm(row.type, week.weekNumber)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="bg-[#f4f7fb] px-6 pb-6 text-slate-950">
      <div className="mx-auto max-w-[1280px] space-y-2">
        <div className="rounded-[22px] border border-slate-200 bg-white/70 p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <FilterSelect label="Filtrar por persona" value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="all">Todas las personas</option>{peopleOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</FilterSelect>
            <FilterSelect label="Filtrar por rol" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">Todos los roles</option>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</FilterSelect>
          </div>
          <div className="mt-2 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 bg-[#001225] px-4 py-1.5 text-white">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-black uppercase tracking-tight">Gestión de Carga y Capacidad</h2>
                <button type="button" onClick={() => setShowWorkloadVideo(true)} className="rounded-lg bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-red-700">▶ Ver video</button>
                <button type="button" onClick={() => window.open(WORKLOAD_MANUAL_URL, "_blank")} className="rounded-lg border border-white/20 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#001225] shadow-sm transition hover:bg-slate-100">📄 Manual</button>
                {viewMode === "capacity" && <CapacityAvailabilityPopover hasSelectedPerson={effectivePersonFilter !== "all"} pendingHours={pendingTotalHours} weeklyCapacityHours={selectedPersonCapacity.weeklyHours} weeklyScheduledHours={capacityInsightWeeklyScheduledHours} days={capacityInsightDays} onGoToPending={() => setViewMode("pending")} onGoToWeek={() => setViewMode("week")} />}
              </div>
              <div className="flex gap-1 rounded-xl bg-white/10 p-0.5"><ViewTab active={viewMode === "capacity"} onClick={() => setViewMode("capacity")}>Capacidad</ViewTab><ViewTab active={viewMode === "assignments"} onClick={() => setViewMode("assignments")}>Asignaciones</ViewTab><ViewTab active={viewMode === "pending"} onClick={() => setViewMode("pending")}>Pendientes</ViewTab><ViewTab active={viewMode === "agenda"} onClick={() => setViewMode("agenda")}>Planificación</ViewTab><ViewTab active={viewMode === "week"} onClick={() => setViewMode("week")}>Semana</ViewTab><ViewTab active={viewMode === "month"} onClick={() => setViewMode("month")}>Mes</ViewTab></div>
            </div>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-1"><p className="text-[10px] font-semibold text-slate-500">{getViewGuideText(viewMode)}</p></div>
            {!canEditSelectedPerson && <div className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">Modo solo lectura: estás viendo la carga de {selectedPersonName || "otra persona"}. Solo puedes editar tu propia carga.</div>}
            <div className={!canEditSelectedPerson ? "pointer-events-none select-none opacity-60" : ""}>

{viewMode === "capacity" && <div className="p-3">{effectivePersonFilter === "all" ? <TeamCapacityOverview team={teamCapacityOverview} onSelectPerson={setPersonFilter} /> : <SourceDistributionPie items={sourceSummary} weeklyPlanKpi={allWeeksPlanKpi} monthlyCapacityHours={selectedPersonCapacity.monthlyHours} hasSelectedPerson={effectivePersonFilter !== "all"} />}</div>}
            {scheduleMessage && <div className="mx-3 mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">{scheduleMessage}</div>}
            {viewMode === "pending" && <PendingActivitiesView hasSelectedPerson={effectivePersonFilter !== "all"} activities={filteredPendingActivities} excludedActivities={excludedPendingActivities} totalHours={pendingTotalHours} canEditActivities={canEditPendingActivities()} onOpenSchedule={openScheduleModal} onEditActivity={openPendingActivityEditModal} onRestoreExcludedActivity={restoreExcludedActivity} />}

            {viewMode === "week" && <div><div className="flex items-center justify-between gap-1.5 px-2 py-1"><div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-wide text-slate-400"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Alto</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Medio</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Bajo</span></div><div className="flex items-center gap-1.5"><div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5"><button type="button" onClick={() => setShowScheduleColumn(false)} title="Ver hora solo al pasar el cursor sobre el bloque" className={`h-5 rounded px-1.5 text-[8px] font-black uppercase tracking-widest transition ${!showScheduleColumn ? "bg-[#001225] text-white" : "text-slate-400 hover:bg-slate-50"}`}>Solo cursor</button><button type="button" onClick={() => setShowScheduleColumn(true)} title="Mostrar siempre la hora de inicio en cada bloque" className={`h-5 rounded px-1.5 text-[8px] font-black uppercase tracking-widest transition ${showScheduleColumn ? "bg-[#001225] text-white" : "text-slate-400 hover:bg-slate-50"}`}>🕐 Columna</button></div><label className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-500">Hora de inicio de jornada<input type="time" value={jornadaInicio} onChange={(event) => setJornadaInicio(event.target.value || "08:00")} className="h-5 rounded-md border border-slate-200 bg-white px-1.5 text-[9px] font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-sky-300" /></label></div></div><div className="grid grid-cols-5 gap-2 p-2">{dayCapacitySummary.map((day) => { const overflow = day.occupation > 100; return <div key={day.day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dropIndicator?.day === day.day) return; moveActivityToDay(draggedActivity, day.day); }} className={`min-w-0 rounded-2xl border bg-white shadow-sm transition ${draggedActivity ? "border-sky-200 bg-sky-50/30" : "border-slate-200"}`}><div className="border-b border-slate-100 px-2.5 py-2"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{day.day}</p><StatusPill status={day.status} /></div><div className="mt-1.5 flex items-center justify-between text-[9px] font-black text-slate-500"><span>{formatHours(day.usedMinutes / 60)} / {formatHours(day.capacityHours)}</span><span className={overflow ? "text-red-500" : "text-slate-700"}>{day.occupation.toFixed(0)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${day.status.bar}`} style={{ width: `${Math.min(day.occupation, 140)}%` }} /></div></div><div className="relative space-y-0.5 p-2" style={{ minHeight: 248 }}>{day.activities.length > 0 ? <>{day.activities.map((activity, activityIndex) => <React.Fragment key={activity.occurrenceId}><div onDragOver={(event) => { event.preventDefault(); showDropIndicator(day.day, activityIndex); }} onDragEnter={(event) => { event.preventDefault(); showDropIndicator(day.day, activityIndex); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); moveActivityToDayPosition(draggedActivity, day.day, activityIndex); }} className="relative h-3"><div className={`absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full transition ${isDropIndicatorActive(day.day, activityIndex) ? "bg-sky-500 opacity-100 shadow-sm" : "bg-transparent opacity-0"}`} /></div><div draggable onDragStart={() => setDraggedActivity({ ...activity, activityId: activity.id, occurrenceIndex: activity.occurrenceIndex, orden: activity.orden, isManualProject: activity.isManualProject })} onDragEnd={() => { setDraggedActivity(null); setDropIndicator(null); }} title={`${activity.actividad}: ${formatMinutesAsTime(activity.horaInicioMinutos)} – ${formatMinutesAsTime(activity.horaFinMinutos)}`} className={`relative z-10 cursor-grab overflow-hidden rounded-lg border p-1.5 shadow-sm transition active:cursor-grabbing hover:shadow-md ${getCardStyle(activity.origen)}`} style={{ minHeight: getStackBlockHeight(activity) }}>{!activity.isManualProject && <SemaforoDot value={activity.semaforo} onChange={(next) => handleSemaforoChange(activity.sourceActivityId || activity.id, next)} disabled={!canEditSelectedPerson} className="z-20" />}{activity.isManualProject && <><button type="button" onClick={(event) => { event.stopPropagation(); startEditManualProject(activity); }} className="absolute right-5 top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-slate-300 transition hover:bg-sky-50 hover:text-sky-600">✎</button><button type="button" onClick={(event) => { event.stopPropagation(); deleteManualProject(activity.id); }} className="absolute right-1 top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black text-slate-300 transition hover:bg-red-50 hover:text-red-500">×</button></>}{!activity.isManualProject && activity.planId && <select value="" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => { handleScheduledAction("weekly", activity, event.target.value); event.target.value = ""; }} className="absolute right-1 top-1 z-20 h-5 w-8 rounded-full border border-slate-200 bg-white text-[10px] font-black text-slate-500 outline-none"><option value="">⋯</option><option value="up">Subir</option><option value="down">Bajar</option><option value="move">Mover</option><option value="edit">Editar</option><option value="remove">Quitar</option></select>}<div className="flex h-full min-w-0 gap-1">{showScheduleColumn && <div className="flex w-6 shrink-0 flex-col items-center justify-center border-r border-black/10 pr-0.5 text-center text-[6px] font-black leading-none tracking-tighter text-slate-500">{formatMinutesAsTime(activity.horaInicioMinutos)}</div>}<div className="flex h-full min-w-0 flex-1 flex-col justify-between gap-1 pr-3"><div><p className="line-clamp-2 text-[9px] font-black leading-tight text-slate-950">{activity.actividad}</p><p className="mt-0.5 truncate text-[8px] font-bold text-slate-500">{activity.rol}</p></div><div className="flex items-end justify-between gap-2"><span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${getCardAccentStyle(activity.origen)}`}>{activity.origen}</span><span className="text-[8px] font-black text-slate-500">{activity.duracionMinutos} min</span></div></div></div></div></React.Fragment>)}<div onDragOver={(event) => { event.preventDefault(); showDropIndicator(day.day, day.activities.length); }} onDragEnter={(event) => { event.preventDefault(); showDropIndicator(day.day, day.activities.length); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); moveActivityToDayPosition(draggedActivity, day.day, day.activities.length); }} className="relative h-3"><div className={`absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full transition ${isDropIndicatorActive(day.day, day.activities.length) ? "bg-sky-500 opacity-100 shadow-sm" : "bg-transparent opacity-0"}`} /></div>{renderQuickBlockControl(day.day, true)}</> : <div className="space-y-2"><div className="rounded-lg border border-dashed border-slate-200 bg-white p-2 text-center text-[9px] font-bold text-slate-300">{draggedActivity ? "Soltar aquí" : "Sin carga asignada"}</div>{renderQuickBlockControl(day.day)}</div>}</div></div>; })}</div></div>}

            {viewMode === "month" && <div className="p-3"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="grid grid-cols-[90px_repeat(4,minmax(0,1fr))] border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400"><div className="px-3 py-2.5">Origen</div>{typicalMonth.map((week) => <div key={week.week} className="border-l border-slate-100 px-3 py-2.5"><div className="flex items-center justify-between gap-2"><span>{week.week}</span><StatusPill status={week.status} /></div><div className="mt-1 flex items-center justify-between text-[9px] font-black normal-case tracking-normal text-slate-500"><span>{week.occupation.toFixed(0)}%</span><span>{formatHours(week.totalSemana)} / {formatHours(week.capacityHours)}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${week.status.bar}`} style={{ width: `${Math.min(week.occupation, 140)}%` }} /></div><div className="mt-2 rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-1 normal-case tracking-normal"><div className="text-[8px] font-black uppercase tracking-wider text-sky-700">Carga semanal típica</div><div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] font-black text-slate-600"><span>{formatHours(weeklyTypicalLoad.hours)} / {formatHours(weeklyTypicalLoad.capacityHours)}</span><span>{weeklyTypicalLoad.occupation.toFixed(0)}%</span></div></div></div>)}</div>{monthlyMatrix.map((row) => <div key={row.type} className="grid grid-cols-[90px_repeat(4,minmax(0,1fr))] border-b border-slate-100 last:border-b-0" style={{ alignItems: "start" }}><div className="flex items-start px-2 py-2"><SourcePill source={row.type} /></div>{row.weeks.map((week) => { const monthlyBlockCount = week.blocks.filter((block) => block.isMonthlyBlock).length; return <div key={`${row.type}-${week.weekNumber}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = draggedMonthlyBlock?.id || event.dataTransfer.getData("text/plain"); if (!draggedId) return; moveMonthlyBlock(draggedId, row.type, week.weekNumber, monthlyBlockCount); }} className={`min-h-[60px] border-l border-slate-100 p-2 transition ${draggedMonthlyBlock ? "bg-sky-50/30 ring-1 ring-sky-100" : ""}`}><div className="mb-2 text-[9px] font-black text-slate-400">{formatHours(week.usedMinutes / 60)}</div><div className="space-y-1">{week.blocks.length > 0 ? week.blocks.map((block, blockIndex) => { const monthlyTargetIndex = week.blocks.slice(0, blockIndex).filter((item) => item.isMonthlyBlock).length; return <React.Fragment key={block.monthlyOccurrenceId}>{renderMonthlyInsertLine(row.type, week.weekNumber, monthlyTargetIndex)}<div draggable={Boolean(block.isMonthlyBlock)} onDragStart={(event) => { if (!block.isMonthlyBlock) return; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); setDraggedMonthlyBlock(block); }} onDragEnd={() => { setDraggedMonthlyBlock(null); setMonthlyDropIndicator(null); }} className={`relative rounded-lg border px-1.5 py-1 shadow-sm transition ${block.isMonthlyBlock ? "cursor-grab active:cursor-grabbing hover:shadow-md" : ""} ${draggedMonthlyBlock?.id === block.id ? "opacity-40" : ""} ${getCardStyle(block.origen)}`}>{!block.isConsolidatedWeeklyBase && <SemaforoDot value={block.semaforo} onChange={(next) => handleSemaforoChange(block.sourceActivityId || block.id, next)} disabled={!canEditSelectedPerson} className="z-20" />}{block.isMonthlyBlock && <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); deleteMonthlyBlock(block); }} className="absolute right-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-black leading-none text-slate-400 shadow-sm transition hover:border-red-100 hover:bg-red-50 hover:text-red-500" title="Quitar de Mes típico">×</button>}{block.isMonthlyBlock && block.planId && <select value="" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => { handleScheduledAction("monthly", block, event.target.value); event.target.value = ""; }} className="absolute right-7 top-1 z-20 h-5 w-8 rounded-full border border-slate-200 bg-white text-[10px] font-black text-slate-500 outline-none"><option value="">⋯</option><option value="up">Subir</option><option value="down">Bajar</option><option value="move">Mover</option><option value="edit">Editar</option><option value="remove">Quitar</option></select>}<div className={block.isMonthlyBlock && block.planId ? "pr-14" : "pr-7"}><p className="line-clamp-2 text-[9px] font-black leading-tight text-slate-950">{block.actividad}</p><p className="mt-0.5 truncate text-[8px] font-bold text-slate-500">{block.isConsolidatedWeeklyBase ? `${block.itemCount} actividades` : block.rol}</p><div className="mt-1 flex items-end justify-between gap-2">{block.isMonthlyBlock ? <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${getCardAccentStyle(block.origen)}`}>{getMonthlyFrequencyLabel(block)}</span> : <span />}<span className="text-[8px] font-black text-slate-500">{block.duracionMinutos} min</span></div></div></div></React.Fragment>; }) : <>{renderMonthlyInsertLine(row.type, week.weekNumber, 0)}<div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-2 text-center text-[9px] font-bold text-slate-300">Sin bloques</div></>}{week.blocks.length > 0 && renderMonthlyInsertLine(row.type, week.weekNumber, monthlyBlockCount)}</div>{renderMonthlyQuickForm(row.type, week.weekNumber)}</div>; })}</div>)}</div></div>}

            {viewMode === "assignments" && <div className="p-3"><div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2"><div><p className="text-xs font-black uppercase tracking-widest text-slate-800">{showAssignmentsHistory ? "Historial de asignaciones concluidas" : "Backlog de iniciativas y proyectos"}</p><p className="text-[10px] font-bold text-slate-400">{showAssignmentsHistory ? "Proyectos y reuniones ya finalizados o cancelados, para trazabilidad." : "Compromiso total aprobado. Se programa parcialmente en Semana/Mes sin cerrarse hasta finalizar."}</p></div><div className="flex items-center gap-1">{assignmentsVideoUrl && <button type="button" onClick={() => setShowAssignmentsVideo(true)} title="Ver video de Asignaciones" className="flex h-6 items-center gap-1 rounded-md bg-red-600 px-2 text-[9px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-red-700">▶</button>}{assignmentsManualUrl && <button type="button" onClick={() => window.open(assignmentsManualUrl, "_blank")} title="Ver manual de Asignaciones" className="flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[9px] font-black uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50">📄</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setShowAssignmentsHistory((current) => !current)} className={`h-8 rounded-lg border px-3 text-[10px] font-black shadow-sm ${showAssignmentsHistory ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{showAssignmentsHistory ? "← Volver al backlog" : "🕘 Ver historial"}</button>{!showAssignmentsHistory && <><button type="button" disabled={!canCreateAssignments()} onClick={() => setShowMeetingModal(true)} className={`h-8 rounded-lg px-3 text-[10px] font-black shadow-sm ${canCreateAssignments() ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>+ Reunión</button><button type="button" disabled={!canCreateAssignments()} onClick={() => setShowAssignmentModal(true)} className={`h-8 rounded-lg px-3 text-[10px] font-black shadow-sm ${canCreateAssignments() ? "bg-[#001225] text-white" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>+ Nueva asignación</button></>}</div></div><div className="space-y-2">{visibleAssignments.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-[11px] font-bold text-slate-400">{showAssignmentsHistory ? "Aún no hay asignaciones concluidas en el historial." : "No hay proyectos ni iniciativas en el backlog."}</div>}{visibleAssignments.map((assignment) => { const progHoras = Math.min(100, assignment.horasTotales > 0 ? (assignment.horasProgramadas / assignment.horasTotales) * 100 : 0); const ejecHoras = Math.min(100, assignment.horasTotales > 0 ? (assignment.horasEjecutadas / assignment.horasTotales) * 100 : 0); const canProgram = canProgramAssignment(assignment); const isClosed = ["Finalizado", "Cancelado"].includes(assignment.estadoProyecto); return <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[12px] font-black text-slate-900">{assignment.nombre}</p><div className="mt-1 flex flex-wrap items-center gap-1"><span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black ${getSourceStyle(getAssignmentTypeBadgeCategory(assignment.tipo))}`}>{assignment.tipo}</span><span className="truncate text-[9px] font-bold text-slate-400">{assignment.origenEstrategico || "Sin origen"} · {assignment.gestionarEn}</span></div></div><div className="flex flex-wrap items-center gap-1"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${getAssignmentPriorityStyle(assignment.prioridad)}`}>{assignment.prioridad}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${getProjectStateStyle(assignment.estadoProyecto)}`}>{assignment.estadoProyecto}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${getSchedulingStateStyle(assignment.estadoProgramacion)}`}>{assignment.estadoProgramacion}</span></div></div><div className="mt-2 grid gap-2 md:grid-cols-[1.2fr_1fr_1fr]"><div className={`rounded-xl border px-2.5 py-1.5 ${getAssignmentInfoBlockStyle(assignment.tipo)}`}><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Responsable</p><p className="truncate text-[10px] font-black text-slate-800">{assignment.responsable || "Sin asignar"}</p><p className="truncate text-[8px] font-bold text-slate-400">{assignment.rol}</p></div><div className={`rounded-xl border px-2.5 py-1.5 ${getAssignmentInfoBlockStyle(assignment.tipo)}`}><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Carga</p><p className="text-[10px] font-black text-slate-800">{formatHours(assignment.horasTotales)} totales</p><p className="text-[8px] font-bold text-slate-500">{formatHours(assignment.horasProgramadas)} prog. · {formatHours(assignment.horasEjecutadas)} ejec. · {formatHours(assignment.horasPendientes)} pend.</p></div><div className={`rounded-xl border px-2.5 py-1.5 ${getAssignmentInfoBlockStyle(assignment.tipo)}`}><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Compromiso</p><p className="text-[10px] font-black text-slate-800">{assignment.fechaLimite || "Sin fecha"}{assignment.horaLimite ? ` · ${assignment.horaLimite.slice(0, 5)}` : ""}</p>{assignment.urlExterna && <a href={assignment.urlExterna} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[8px] font-bold text-sky-600 underline">Ver en {assignment.gestionarEn}</a>}</div></div>{isMeetingAssignment(assignment) && assignment.grupoReunion && (() => { const siblings = assignments.filter((item) => item.grupoReunion === assignment.grupoReunion); const confirmedCount = siblings.filter((item) => item.confirmadoAsistencia).length; const isMine = String(assignment.personaId) === String(currentUser?.persona_id); return <div className="mt-2 rounded-xl border border-red-100 bg-red-50/50 px-2.5 py-1.5"><div className="flex flex-wrap items-center justify-between gap-1"><p className="text-[8px] font-black uppercase tracking-widest text-red-500">Confirmación de asistencia ({confirmedCount}/{siblings.length})</p>{isMine && !assignment.confirmadoAsistencia && <button type="button" onClick={() => handleConfirmMyAttendance(assignment)} className="rounded-md bg-emerald-600 px-2 py-0.5 text-[8px] font-black text-white hover:bg-emerald-700">✓ Confirmar mi asistencia</button>}</div><div className="mt-1 flex flex-wrap gap-1">{siblings.map((sibling) => <span key={sibling.id} className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black ${sibling.confirmadoAsistencia ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}>{sibling.confirmadoAsistencia ? "✓" : "○"} {sibling.responsable || "Sin nombre"}</span>)}</div></div>; })()}<div className="mt-2 grid gap-2 md:grid-cols-2"><div><div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-400"><span>Avance de programación</span><span>{progHoras.toFixed(0)}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${progHoras}%` }} /></div></div><div><div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-400"><span>Avance de ejecución</span><span>{ejecHoras.toFixed(0)}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${ejecHoras}%` }} /></div></div></div><div className="mt-2 flex flex-wrap justify-end gap-1 border-t border-slate-100 pt-2"><button type="button" onClick={() => openAssignmentEditModal(assignment)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-black text-slate-500 hover:bg-slate-50">Editar</button><button type="button" disabled={!canProgram} onClick={() => openProgramAssignmentModal(assignment)} className={`rounded-lg border px-2 py-1 text-[9px] font-black ${canProgram ? "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100" : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"}`}>Programar</button>{assignment.estadoProyecto === "En pausa" ? <button type="button" onClick={() => handleReactivateAssignment(assignment)} className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 hover:bg-emerald-100">Reactivar</button> : <button type="button" disabled={isClosed} onClick={() => handlePauseAssignment(assignment)} className={`rounded-lg border px-2 py-1 text-[9px] font-black ${isClosed ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>Pausar</button>}<button type="button" disabled={isClosed} onClick={() => handleFinalizeAssignment(assignment)} className={`rounded-lg border px-2 py-1 text-[9px] font-black ${isClosed ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300" : "border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50"}`}>Finalizar</button><button type="button" disabled={isClosed} onClick={() => handleCancelAssignment(assignment)} className={`rounded-lg border px-2 py-1 text-[9px] font-black ${isClosed ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300" : "border-red-100 bg-white text-red-600 hover:bg-red-50"}`}>Cancelar</button><button type="button" disabled={!canCreateAssignments()} onClick={() => handleDeleteAssignment(assignment)} className={`rounded-lg border px-2 py-1 text-[9px] font-black ${canCreateAssignments() ? "border-red-200 bg-red-600 text-white hover:bg-red-700" : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"}`}>Eliminar</button></div></div>; })}</div>{assignmentManagementDetail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="border-b border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-800">Detalle de gestión</p><p className="text-[10px] font-bold text-slate-500">{assignmentManagementDetail.titulo}</p></div><button type="button" onClick={() => setAssignmentManagementDetail(null)} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-black text-slate-500 shadow-sm hover:bg-slate-50">×</button></div></div><div className="h-1 w-full bg-gradient-to-r from-[#001225] via-[#0B5ED7] to-[#7AA7D9]" /><div className="space-y-2 bg-white p-4 text-[11px] font-bold text-slate-700"><div className="flex justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-[#0066CC]">Canal</span><span>{assignmentManagementDetail.gestionarEn}</span></div><div className="flex justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-500">Revisará</span><span>{assignmentManagementDetail.revisara}</span></div><div className="flex justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-emerald-600">Aprobará</span><span>{assignmentManagementDetail.aprobara}</span></div><div className="flex justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-orange-600">Dará seguimiento</span><span>{assignmentManagementDetail.seguimiento}</span></div></div><div className="flex justify-end border-t border-slate-100 bg-white px-4 pb-4 pt-3"><button type="button" onClick={() => setAssignmentManagementDetail(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 hover:bg-slate-50">Cerrar</button></div></div></div>}{assignmentStatusDetail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-900">Detalle de estado</p><p className="text-[10px] font-bold text-slate-400">{assignmentStatusDetail.titulo}</p></div><button type="button" onClick={() => setAssignmentStatusDetail(null)} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-400 hover:bg-slate-50">×</button></div><div className="space-y-2 text-[11px] font-bold text-slate-600"><div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-400">Estado</span><span>{assignmentStatusDetail.estado}</span></div><div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-400">Asignó</span><span>{assignmentStatusDetail.asigna} · {assignmentStatusDetail.asignaRol}</span></div>{assignmentStatusDetail.estado === "Programada" ? <><div className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700"><span>Semana</span><span>{assignmentStatusDetail.programadaSemanaInicio} a {assignmentStatusDetail.programadaSemanaFin}</span></div><div className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700"><span>Día</span><span>{assignmentStatusDetail.programadaDia}</span></div><div className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700"><span>Programó</span><span>{assignmentStatusDetail.programadaPor} · {assignmentStatusDetail.programadaAt}</span></div></> : <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">Esta asignación aún no ha sido programada en una semana.</div>}</div><div className="mt-3 flex justify-end"><button type="button" onClick={() => setAssignmentStatusDetail(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cerrar</button></div></div></div>}<NewAssignmentModal open={showAssignmentModal} draft={assignmentDraft} setDraft={setAssignmentDraft} onSave={createAssignment} onClose={() => { setShowAssignmentModal(false); setAssignmentFormError(""); }} error={assignmentFormError} puestoOptions={puestoOptions} currentUserLabel={`${currentUser?.name || "Usuario"} · ${getPrimaryUserRole()}`} />{showMeetingModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-slate-900">Nueva reunión</p><p className="text-[10px] font-bold text-slate-400">Aún sin día u hora fija: marca a los participantes para que cada uno la vea en su propio balance.</p></div><button type="button" onClick={() => setShowMeetingModal(false)} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-400 hover:bg-slate-50">×</button></div><div className="grid gap-2 md:grid-cols-2"><label className="md:col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Título<input value={meetingDraft.titulo} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, titulo: event.target.value }))} placeholder="Ej. Revisión semanal de ventas" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prioridad<select value={meetingDraft.prioridad} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, prioridad: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gestionar en<select value={meetingDraft.gestionarEn} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, gestionarEn: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">{ASSIGNMENT_CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duración estimada (horas)<input type="number" min="0.25" step="0.25" value={meetingDraft.horas} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, horas: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha tentativa<input type="date" value={meetingDraft.fechaLimite} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, fechaLimite: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hora tentativa<input type="time" value={meetingDraft.horaLimite} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, horaLimite: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" /></label><div className="md:col-span-2"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Participantes ({meetingDraft.participantIds.length})</p><div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2"><div className="grid gap-1 md:grid-cols-2">{peopleOptions.map((person) => <label key={person.id} className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-[11px] font-bold normal-case tracking-normal text-slate-700 hover:border-slate-200 hover:bg-white"><input type="checkbox" checked={meetingDraft.participantIds.includes(person.id)} onChange={() => toggleMeetingParticipant(person.id)} />{person.name}</label>)}</div></div></div></div>{meetingMessage && <p className="mt-2 text-[10px] font-bold text-amber-600">{meetingMessage}</p>}<div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="text-[10px] font-bold text-slate-400">Crea: {currentUser?.name || "Usuario"} · {getPrimaryUserRole()}</span><div className="flex gap-2"><button type="button" onClick={createMeeting} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar reunión</button><button type="button" onClick={() => { setShowMeetingModal(false); setMeetingMessage(""); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button></div></div></div></div>}</div>}

            {viewMode === "agenda" && <div className="p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2"><div className="flex flex-wrap items-center gap-2"><div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm"><button type="button" onClick={() => setAgendaView("weekly")} className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${agendaView === "weekly" ? "bg-[#001225] text-white" : "text-slate-400 hover:bg-slate-50"}`}>Vista semanal</button><button type="button" onClick={() => setAgendaView("monthly")} className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${agendaView === "monthly" ? "bg-[#001225] text-white" : "text-slate-400 hover:bg-slate-50"}`}>Vista mensual</button></div><div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-wide text-slate-400"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Alto</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Medio</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Bajo</span></div>{agendaView === "weekly" && <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5"><button type="button" onClick={() => setShowScheduleColumn(false)} title="Ver hora solo al pasar el cursor sobre el bloque" className={`h-5 rounded px-1.5 text-[8px] font-black uppercase tracking-widest transition ${!showScheduleColumn ? "bg-[#001225] text-white" : "text-slate-400 hover:bg-slate-50"}`}>Solo cursor</button><button type="button" onClick={() => setShowScheduleColumn(true)} title="Mostrar siempre la hora de inicio en cada bloque" className={`h-5 rounded px-1.5 text-[8px] font-black uppercase tracking-widest transition ${showScheduleColumn ? "bg-[#001225] text-white" : "text-slate-400 hover:bg-slate-50"}`}>🕐 Columna</button></div>}<div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Semana</span><input type="date" value={planningWeekStart} onChange={(event) => setPlanningWeekStart(event.target.value)} className="rounded-md border border-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 outline-none" /><span className="text-[9px] font-black text-slate-300">a</span><input type="date" value={planningWeekEnd} onChange={(event) => setPlanningWeekEnd(event.target.value)} className="rounded-md border border-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 outline-none" /></div></div><div className="flex items-center gap-2"><select value={selectedPlanId || ""} onChange={(event) => loadSavedPlan(event.target.value)} className="h-9 w-[190px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 outline-none"><option value="">{isMonthlyPlanning ? "Consultar mes guardado" : "Consultar semana guardada"}</option>{savedPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><button type="button" disabled={!selectedPlanId} title={selectedPlanId ? "Eliminar semana/mes guardado" : "Selecciona una semana guardada primero"} onClick={() => deleteSavedPlan(selectedPlanId)} className={`h-9 w-9 shrink-0 rounded-lg border text-[12px] font-black shadow-sm ${selectedPlanId ? "border-red-200 bg-white text-red-500 hover:bg-red-50" : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"}`}>🗑</button><button type="button" onClick={isMonthlyPlanning ? startNewAgendaMonth : startNewAgendaWeek} className="h-9 w-[86px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-center text-[10px] font-black leading-tight text-slate-600 shadow-sm hover:bg-slate-50">Nueva<br />{isMonthlyPlanning ? "mes" : "semana"}</button><button type="button" onClick={isMonthlyPlanning ? saveCurrentAgendaMonth : saveCurrentAgendaPlan} className="h-9 w-[92px] shrink-0 rounded-lg bg-[#001225] px-2 text-center text-[10px] font-black leading-tight text-white shadow-sm">Guardar<br />{isMonthlyPlanning ? "mes" : "semana"}</button><button type="button" disabled={!canApprovePlan()} title={planApproval.status === "Aprobada con VOBO" ? `Aprobada por ${planApproval.approvedBy} · ${planApproval.approvedRole || "Autorizador"} · ${planApproval.approvedAt}` : "Pendiente VOBO"} onClick={() => setShowApprovalForm((current) => !current)} className={`h-9 w-[76px] shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-black shadow-sm ${planApproval.status === "Aprobada con VOBO" ? "border-emerald-600 bg-emerald-600 text-white" : canApprovePlan() ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"}`}>VOBO</button><button type="button" title={reviewStatus.status === "Revisada" ? `Revisada por ${reviewStatus.reviewedBy} · ${reviewStatus.reviewedRole} · ${reviewStatus.reviewedAt}${reviewComment ? ` · Comentarios: ${reviewComment}` : ""}${improvementProposal ? ` · Mejora propuesta: ${improvementProposal}` : ""}` : "Pendiente revisión"} onClick={() => setShowReviewModal(true)} className={`h-9 w-[86px] shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-black shadow-sm transition ${reviewStatus.status === "Revisada" ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>Revisión</button></div></div>{showApprovalForm && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2"><span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Autoriza: {currentUser?.name || "Usuario"}</span><span className="rounded-lg border border-emerald-100 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">Rol: {getPrimaryUserRole()}</span><button type="button" onClick={approveCurrentPlan} className="rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-black text-white">Confirmar VOBO</button><button type="button" onClick={() => { setShowApprovalForm(false); setApprovalError(""); }} className="rounded-lg border border-emerald-100 bg-white px-3 py-1 text-[10px] font-black text-emerald-600">Cancelar</button>{approvalError && <span className="text-[10px] font-bold text-red-500">{approvalError}</span>}</div>}{planSaveWarning && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-[10px] font-bold text-red-600"><span>{planSaveWarning}</span>{overwritePlanId && <div className="flex gap-1"><button type="button" onClick={overwriteSavedPlan} className="rounded-md bg-red-600 px-2 py-1 text-[9px] font-black text-white">Sobreescribir</button><button type="button" onClick={cancelOverwritePlan} className="rounded-md border border-red-100 bg-white px-2 py-1 text-[9px] font-black text-red-500">Cancelar</button></div>}</div>}
{showReviewModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-widest text-slate-900">Revisión semanal</p><p className="text-[10px] font-bold text-slate-400">Retroalimentación, firma de revisado y acciones de mejora</p></div><button type="button" onClick={() => setShowReviewModal(false)} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-400 hover:bg-slate-50">×</button></div><div className="mb-3 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.1fr_0.9fr_0.9fr]"><div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Plan semanal cumplido</p><div className="mt-2 flex items-end gap-2"><span className="text-3xl font-black text-[#001225]">{weeklyPlanKpi.completion}%</span><span className={`mb-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${weeklyPlanKpi.hasApproval ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-700"}`}>{weeklyPlanKpi.hasApproval ? "Con VOBO" : "Pendiente VOBO"}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(weeklyPlanKpi.completion, 100)}%` }} /></div></div><div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Actividades del plan</p><p className="mt-2 text-2xl font-black text-slate-900">{weeklyPlanKpi.planned}</p><p className="mt-1 text-[10px] font-bold text-slate-400">Base aprobada para la semana</p></div><div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Palomeadas</p><p className="mt-2 text-2xl font-black text-emerald-700">{weeklyPlanKpi.completed}</p><p className="mt-1 text-[10px] font-bold text-slate-400">Pendientes: {weeklyPlanKpi.pending}</p></div></div><div className="grid gap-3 md:grid-cols-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentarios / retroalimentación<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Comentarios del usuario o jefe directo sobre la semana..." className="mt-1 h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold normal-case tracking-normal text-slate-700 outline-none" /></label><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acción o mejora propuesta<textarea value={improvementProposal} onChange={(event) => setImprovementProposal(event.target.value)} placeholder="Proponer acción, mejora, ajuste de carga o circunstancia relevante..." className="mt-1 h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold normal-case tracking-normal text-slate-700 outline-none" /></label></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2"><span className={`rounded-full border px-3 py-1 text-center text-[10px] font-black ${reviewStatus.status === "Revisada" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}>{reviewStatus.status === "Revisada" ? `Revisada por ${reviewStatus.reviewedBy} · ${reviewStatus.reviewedRole} · ${reviewStatus.reviewedAt}` : reviewStatus.status}</span><div className="flex gap-2"><button type="button" disabled={!canReviewPlan()} onClick={markPlanReviewed} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${canReviewPlan() ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}>Firmar revisado</button><button type="button" onClick={() => setShowReviewModal(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cerrar</button></div></div></div></div>}{agendaView === "weekly" && <div className="grid grid-cols-5 gap-2">{agendaWeekSummary.map((day) => { const overflow = day.occupation > 100; return <div key={day.day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorderAgendaBlock(agendaDraggedBlock, day.day, day.activities.length); }} className={`min-w-0 rounded-2xl border bg-white shadow-sm transition ${agendaDraggedBlock ? "border-sky-200 bg-sky-50/30" : "border-slate-200"}`}><div className="border-b border-slate-100 px-2.5 py-2"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{day.day}</p><StatusPill status={day.status} /></div><div className="mt-1.5 flex items-center justify-between text-[9px] font-black text-slate-500"><span>{formatHours(day.usedMinutes / 60)} / {formatHours(day.capacityHours)}</span><span className={overflow ? "text-red-500" : "text-slate-700"}>{day.occupation.toFixed(0)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${day.status.bar}`} style={{ width: `${Math.min(day.occupation, 140)}%` }} /></div></div><div className="space-y-1 p-2">{day.activities.map((activity, activityIndex) => <React.Fragment key={activity.occurrenceId || activity.id}>{renderAgendaInsertLine(day.day, activityIndex)}<div draggable onDragStart={() => setAgendaDraggedBlock(activity)} onDragEnd={() => { setAgendaDraggedBlock(null); setAgendaDropIndicator(null); }} title={`${activity.actividad}: ${formatMinutesAsTime(activity.horaInicioMinutos)} – ${formatMinutesAsTime(activity.horaFinMinutos)}`} className={`relative cursor-grab rounded-lg border px-1.5 py-1 shadow-sm transition active:cursor-grabbing ${agendaDraggedBlock && getAgendaBlockKey(agendaDraggedBlock) === getAgendaBlockKey(activity) ? "opacity-40" : ""} ${getCardStyle(activity.origen)}`}><SemaforoDot value={activity.semaforo} onChange={(next) => handleSemaforoChange(activity.sourceActivityId || activity.id, next)} disabled={!canEditSelectedPerson} className="z-20" /><button type="button" onClick={() => toggleAgendaBlockCompleted(activity)} className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black transition ${completedAgendaBlockIds.includes(getAgendaBlockKey(activity)) ? "bg-emerald-500 text-white" : "text-slate-300 hover:text-emerald-500"}`} title="Marcar realizado">✓</button><select value="" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => { handleAgendaScheduledAction(activity, event.target.value); event.target.value = ""; }} className="absolute right-1 top-1 z-20 h-4 w-6 rounded-full border border-slate-200 bg-white text-[9px] font-black text-slate-500 outline-none"><option value="">⋯</option><option value="up">Subir</option><option value="down">Bajar</option><option value="move">Mover</option><option value="edit">Editar</option>{canRemoveAgendaBlock(activity) && <option value="remove">Quitar</option>}</select><div className="flex items-start gap-1 px-5">{showScheduleColumn && <div className="w-6 shrink-0 border-r border-black/10 pr-0.5 text-center text-[6px] font-black leading-none tracking-tighter text-slate-500">{formatMinutesAsTime(activity.horaInicioMinutos)}</div>}<div className="min-w-0 flex-1"><p className="line-clamp-2 text-[9px] font-black leading-tight text-slate-950">{activity.actividad}</p><p className="mt-0.5 truncate text-[8px] font-bold text-slate-500">{activity.planningSource || "Bloque adicional"}</p><div className="mt-1 flex items-end justify-between gap-2"><span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${getCardAccentStyle(activity.origen)}`}>{activity.origen}</span><span className="text-[8px] font-black text-slate-500">{activity.duracionMinutos} min</span></div></div></div></div></React.Fragment>)}{renderAgendaInsertLine(day.day, day.activities.length)}{agendaQuickDay === day.day ? <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-1.5"><select value={agendaBlockType} onChange={(event) => setAgendaBlockType(event.target.value)} className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none"><option value="Proyecto">Proyecto</option><option value="Formación">Formación</option><option value="Tarea">Tarea</option><option value="Eventual">Eventual</option></select><input value={agendaBlockName} onChange={(event) => setAgendaBlockName(event.target.value)} placeholder="Nombre" className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none" /><div className="flex gap-1"><input value={agendaBlockMinutes} onChange={(event) => setAgendaBlockMinutes(event.target.value)} type="number" min="1" placeholder="Min" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 outline-none" /><button type="button" onClick={() => saveAgendaBlock(day.day)} className="rounded-md bg-[#001225] px-2 py-1 text-[8px] font-black text-white">OK</button><button type="button" onClick={resetAgendaBlockForm} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[8px] font-black text-slate-400">X</button></div></div> : <button type="button" onClick={() => setAgendaQuickDay(day.day)} className="w-full rounded-lg border border-dashed border-slate-200 py-1 text-[9px] font-black text-slate-300 transition hover:border-sky-200 hover:text-sky-600">+ Bloque</button>}</div></div>; })}</div>}{agendaView === "monthly" && renderAgendaMonthlyPlanning()}{false && <div className="grid grid-cols-4 gap-2">{agendaMonthSummary.map((week) => <div key={week.weekNumber} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{week.label}</p><StatusPill status={week.status} /></div><div className="mb-2 flex items-center justify-between text-[9px] font-black text-slate-500"><span>{formatHours(week.usedMinutes / 60)} / {formatHours(week.capacityHours)}</span><span>{week.occupation.toFixed(0)}%</span></div><div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${week.status.bar}`} style={{ width: `${Math.min(week.occupation, 140)}%` }} /></div><div className="space-y-1">{MONTH_MATRIX_ROWS.map((rowType) => { const sourceType = rowType === "Procesos" ? "Proceso" : rowType === "Proyectos" ? "Proyecto" : "Formación"; const count = activeAgendaBlocks.filter((activity) => activity.origen === sourceType).length; const minutes = activeAgendaBlocks.filter((activity) => activity.origen === sourceType).reduce((sum, activity) => sum + getDurationMinutes(activity), 0); return <div key={rowType} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1"><div className="flex items-center justify-between gap-2"><SourcePill source={rowType} /><span className="text-[9px] font-black text-slate-500">{formatHours(minutes / 60)}</span></div><p className="mt-0.5 text-[8px] font-bold text-slate-400">{count} bloques planificados</p></div>; })}</div></div>)}</div>}</div>}

            {viewMode === "capacity" && filteredActivities.length === 0 && <div className="px-5 py-10 text-center text-sm font-bold text-slate-400">No hay actividades con los filtros seleccionados.</div>}
            </div>
          </div>
        </div>
      </div>
      <SchedulePendingModal
        activity={schedulingActivity}
        selectedDays={selectedScheduleDays}
        selectedWeeks={selectedScheduleWeeks}
        selectedMonth={selectedScheduleMonth}
        onToggleDay={toggleScheduleDay}
        onToggleWeek={toggleScheduleWeek}
        onChangeMonth={setSelectedScheduleMonth}
        onSave={savePendingSchedule}
        onClose={closeScheduleModal}
      />
      <AssignmentEditModal
        assignment={editingAssignment}
        draft={assignmentEditDraft}
        setDraft={setAssignmentEditDraft}
        onSave={saveAssignmentEdit}
        onClose={() => { setEditingAssignment(null); setAssignmentEditError(""); }}
        error={assignmentEditError}
        puestoOptions={puestoOptions}
      />
      <EditMeetingModal
        assignment={editingMeetingAssignment}
        draft={meetingEditDraft}
        setDraft={setMeetingEditDraft}
        onSave={saveMeetingEdit}
        onClose={closeMeetingEditModal}
        error={meetingEditError}
        peopleOptions={peopleOptions}
        onToggleParticipant={toggleMeetingEditParticipant}
      />
      <AssignmentScheduleModal
        assignment={assignmentScheduleModal}
        draft={assignmentScheduleDraft}
        setDraft={setAssignmentScheduleDraft}
        onSave={saveAssignmentSchedule}
        onClose={() => setAssignmentScheduleModal(null)}
      />
      <ProgramAssignmentModal
        modal={programAssignmentModal}
        draft={programAssignmentDraft}
        setDraft={setProgramAssignmentDraft}
        onSave={saveProgramAssignmentHours}
        onClose={closeProgramAssignmentModal}
        error={programAssignmentError}
        capacityWarning={programCapacityWarning}
        onToggleDay={toggleProgramAssignmentDay}
        onToggleWeek={toggleProgramAssignmentWeek}
        planningWeekStart={planningWeekStart}
        planningWeekEnd={planningWeekEnd}
      />
      <PendingActivityEditModal
        activity={editingPendingActivity}
        draft={pendingActivityDraft}
        error={pendingActivityEditError}
        saving={savingPendingActivity}
        onChange={updatePendingActivityDraft}
        onSave={savePendingActivityEdit}
        onClose={closePendingActivityEditModal}
        onExclude={excludePendingActivityFromList}
      />
      <MoveScheduledModal
        modal={movePlanModal}
        target={movePlanTarget}
        setTarget={setMovePlanTarget}
        onSave={saveMoveScheduledActivity}
        onClose={() => {
          setMovePlanModal(null);
          setMovePlanTarget("");
        }}
      />
      <EditScheduledBlockModal
        modal={editBlockModal}
        draft={editBlockDraft}
        onChange={(field, value) => setEditBlockDraft((draft) => ({ ...draft, [field]: value }))}
        onSave={saveEditScheduledBlock}
        onClose={() => setEditBlockModal(null)}
      />
      <MoveScheduledModal
        modal={agendaMoveModal ? { type: "weekly", activity: agendaMoveModal.activity } : null}
        target={agendaMoveTarget}
        setTarget={setAgendaMoveTarget}
        onSave={saveAgendaMove}
        onClose={closeAgendaMoveModal}
      />
      <EditScheduledBlockModal
        modal={agendaEditModal}
        draft={agendaEditDraft}
        onChange={updateAgendaEditDraft}
        onSave={saveAgendaEdit}
        onClose={closeAgendaEditModal}
      />
      <AgendaMonthlyMoveModal
        modal={agendaMonthlyMoveModal}
        target={agendaMonthlyMoveTarget}
        setTarget={setAgendaMonthlyMoveTarget}
        onSave={saveAgendaMonthlyMove}
        onClose={closeAgendaMonthlyMoveModal}
      />
      <AgendaMonthlyEditModal
        modal={agendaMonthlyEditModal}
        draft={agendaMonthlyEditDraft}
        onChange={updateAgendaMonthlyEditDraft}
        onSave={saveAgendaMonthlyEdit}
        onClose={closeAgendaMonthlyEditModal}
      />

      {showWorkloadVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#001225] px-5 py-3 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Video tutorial</p>
                <h3 className="text-lg font-black">Balance de Carga</h3>
              </div>
              <button type="button" onClick={() => setShowWorkloadVideo(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white hover:bg-red-700">×</button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe className="h-full w-full" src={WORKLOAD_VIDEO_URL} title="Video Balance de Carga" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </div>
      )}
      {showAssignmentsVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#001225] px-5 py-3 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Video tutorial</p>
                <h3 className="text-lg font-black">{assignmentsVideoTitle}</h3>
              </div>
              <button type="button" onClick={() => setShowAssignmentsVideo(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white hover:bg-red-700">×</button>
            </div>
            <div className="aspect-video w-full bg-black">
              {isEmbeddedVideoUrl(assignmentsVideoUrl)
                ? <iframe className="h-full w-full" src={assignmentsVideoUrl} title={assignmentsVideoTitle} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                : <video className="h-full w-full" src={assignmentsVideoUrl} controls autoPlay />}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}






