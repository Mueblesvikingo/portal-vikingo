export const TIPOS_ACCION = [
  "Corrección",
  "Acción Correctiva",
  "Acción Preventiva",
  "Acción de Mejora",
  "Acuerdo Directivo",
  "Proyecto Estratégico",
  "Acción Operativa",
];

export const NIVELES_ACCION = ["Estratégica", "Táctica", "Operativa"];

export const ESTADOS_ACCION = [
  "Borrador",
  "Registrada",
  "En análisis",
  "Aprobada",
  "En ejecución",
  "En validación",
  "Verificación de eficacia",
  "Cerrada",
];

export const PRIORIDADES_ACCION = ["Baja", "Media", "Alta", "Crítica"];

export const ORIGENES_ACCION = [
  "Manual",
  "Centro de Decisiones",
  "Seguimiento Estratégico",
  "Auditoría",
  "Indicador",
  "Riesgo",
  "Dirección",
  "S&OP",
  "SST",
  "RRHH",
  "Procesos",
  "Clientes",
  "Mejora Continua",
];

// MVP de esta fase — el resto queda diseñado (mismo patrón de `contenido`
// jsonb por herramienta) pero se construye después.
export const HERRAMIENTAS_MVP = ["5 Porqués", "Ishikawa", "5W2H"];
export const HERRAMIENTAS_TODAS = [
  "5 Porqués",
  "Ishikawa",
  "Árbol de Causas",
  "Pareto",
  "AMEF",
  "5W2H",
  "Impacto-Esfuerzo",
  "PDCA",
  "Campo libre",
];

// Colores por tipo — misma paleta categórica validada ya usada en
// Desempeño Organizacional (performanceHelpers.js), orden fijo por
// identidad, nunca reasignado por ranking.
export const TIPO_COLOR = {
  "Corrección": "#2a78d6",
  "Acción Correctiva": "#e34948",
  "Acción Preventiva": "#4a3aa7",
  "Acción de Mejora": "#1baf7a",
  "Acuerdo Directivo": "#eda100",
  "Proyecto Estratégico": "#eb6834",
  "Acción Operativa": "#e87ba4",
};

// Versión hex de los mismos colores (para gráficas Recharts; los badges de
// texto usan las clases Tailwind de abajo).
export const NIVEL_COLOR = {
  "Estratégica": "#4a3aa7",
  "Táctica": "#1baf7a",
  "Operativa": "#eb6834",
};

export const ESTADO_COLOR = {
  "Borrador": "#94a3b8",
  "Registrada": "#0ea5e9",
  "En análisis": "#2a78d6",
  "Aprobada": "#0ca30c",
  "En ejecución": "#eda100",
  "En validación": "#4a3aa7",
  "Verificación de eficacia": "#1baf7a",
  "Cerrada": "#64748b",
};

export const NIVEL_BADGE = {
  "Estratégica": "border-indigo-100 bg-indigo-50 text-indigo-700",
  "Táctica": "border-teal-100 bg-teal-50 text-teal-700",
  "Operativa": "border-orange-100 bg-orange-50 text-orange-700",
};

export const PRIORIDAD_BADGE = {
  "Baja": "border-slate-200 bg-slate-50 text-slate-500",
  "Media": "border-sky-100 bg-sky-50 text-sky-700",
  "Alta": "border-amber-100 bg-amber-50 text-amber-700",
  "Crítica": "border-red-100 bg-red-50 text-red-600",
};

// Estado = etapa del flujo (informativo, no un juicio de salud) — "Con
// riesgo"/vencida son banderas aparte, siempre en rojo, superpuestas al
// estado.
export const ESTADO_BADGE = {
  "Borrador": "border-slate-200 bg-slate-50 text-slate-400",
  "Registrada": "border-sky-100 bg-sky-50 text-sky-700",
  "En análisis": "border-blue-100 bg-blue-50 text-blue-700",
  "Aprobada": "border-emerald-100 bg-emerald-50 text-emerald-700",
  "En ejecución": "border-amber-100 bg-amber-50 text-amber-700",
  "En validación": "border-violet-100 bg-violet-50 text-violet-700",
  "Verificación de eficacia": "border-cyan-100 bg-cyan-50 text-cyan-700",
  "Cerrada": "border-slate-200 bg-slate-100 text-slate-600",
};

export const RIESGO_BADGE = "border-red-100 bg-red-50 text-red-600";
export const VENCIDA_BADGE = "border-red-200 bg-red-100 text-red-700";

export function isVencida(accion) {
  if (!accion?.fecha_compromiso || accion.estado === "Cerrada") return false;
  const hoy = new Date(new Date().toDateString());
  return new Date(accion.fecha_compromiso) < hoy;
}

export function getFlujoEtapas(tiposFlujo, tipo) {
  const row = tiposFlujo.find((t) => t.tipo === tipo);
  return row?.etapas || [];
}

export function getFlujoConfig(tiposFlujo, tipo) {
  return (
    tiposFlujo.find((t) => t.tipo === tipo) || {
      etapas: ["Registrada", "En ejecución", "Cerrada"],
      requiere_analisis_causa: false,
      requiere_verificacion_eficacia: false,
      requiere_aprobacion: false,
    }
  );
}

export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
