export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const PERSPECTIVAS = ["Financiera", "Clientes", "Procesos", "Desarrollo"];

// Paleta categórica validada (dataviz skill), orden fijo — nunca se reasigna
// por posición/ranking, siempre por identidad (perspectiva o KPI).
export const CATEGORICAL_COLORS = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#e87ba4", // magenta
  "#eb6834", // orange
];

// Mismos colores oficiales de perspectiva usados en el mapa estratégico de
// Despliegue Estratégico (StrategicDeploymentModule.jsx, const COLORS) —
// se replican aquí en vez de la paleta categórica genérica para mantener
// consistencia visual entre ambos módulos.
export const PERSPECTIVA_COLOR = {
  Financiera: "#b88a00",
  Clientes: "#3f5f2f",
  Procesos: "#203f73",
  Desarrollo: "#c96d1a",
};

export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export function getKpiColor(kpi, indexInGroup = 0) {
  return CATEGORICAL_COLORS[indexInGroup % CATEGORICAL_COLORS.length];
}

export function formatKpiValue(valor, unidad) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  const num = Number(valor);
  if (unidad === "porcentaje") return `${(num * 100).toFixed(1)}%`;
  if (unidad === "moneda") return `$${num.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
  return num.toLocaleString("es-MX", { maximumFractionDigits: 1 });
}

export function formatAxisValue(valor, unidad) {
  if (valor === null || valor === undefined) return "";
  const num = Number(valor);
  if (unidad === "porcentaje") return `${Math.round(num * 100)}%`;
  if (unidad === "moneda") {
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(0)}k`;
    return `$${num}`;
  }
  return num.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

// `semana` (1-4) solo aplica a KPIs de captura semanal — para los demás
// siempre es null. NULL en Postgres no es igual a NULL en comparaciones de
// JS tampoco, por eso se normaliza con `?? null` antes de comparar.
export function getResultadoRow(resultados, kpiId, anio, mes, tipo, semana = null) {
  return resultados.find(
    (r) =>
      Number(r.kpi_id) === Number(kpiId) &&
      Number(r.anio) === Number(anio) &&
      Number(r.mes) === Number(mes) &&
      r.tipo === tipo &&
      (r.semana ?? null) === semana
  ) || null;
}

export function getResultadoValue(resultados, kpiId, anio, mes, tipo, semana = null) {
  const row = getResultadoRow(resultados, kpiId, anio, mes, tipo, semana);
  return row ? Number(row.valor) : null;
}

// Cuenta los lunes del mes: la forma más simple y explicable de saber si un
// mes tiene 4 o 5 semanas (nunca menos de 4, a veces 5).
export function getWeeksInMonth(anio, mes) {
  let count = 0;
  const daysInMonth = new Date(anio, mes, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(anio, mes - 1, day).getDay() === 1) count += 1;
  }
  return count;
}

// El "real" mensual de un KPI de captura semanal es el promedio de las
// semanas capturadas ese mes (4 o 5 según el mes — ver getWeeksInMonth). La
// Meta sigue siendo un solo valor mensual sin importar la periodicidad.
export function getMonthlyRealValue(resultados, kpi, anio, mes) {
  if (kpi.periodicidad === "Semanal") {
    const totalSemanas = getWeeksInMonth(anio, mes);
    const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1)
      .map((semana) => getResultadoValue(resultados, kpi.id, anio, mes, "real", semana))
      .filter((v) => v !== null);
    if (semanas.length === 0) return null;
    return semanas.reduce((sum, v) => sum + v, 0) / semanas.length;
  }
  return getResultadoValue(resultados, kpi.id, anio, mes, "real");
}

export function buildMonthlySeries(resultados, kpi, anio) {
  return MESES.map((label, index) => ({
    mes: label,
    meta: getResultadoValue(resultados, kpi.id, anio, index + 1, "meta"),
    real: getMonthlyRealValue(resultados, kpi, anio, index + 1),
  }));
}

// El mes "actual" es siempre el mes calendario en curso — así el Tablero y
// las Gráficas reflejan de inmediato lo que se va capturando en Resultados,
// sin esperar a que el mes cierre (igual que ya hace el % semanal de
// Resultados, que también se calcula contra la meta del mes en curso).
export function getCurrentMonthInfo() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  return { mes: currentMonth, anio: currentYear, label: MESES[currentMonth - 1] };
}

// Real/Meta del mes en curso, contra ese mismo mes. `kpi` es el objeto
// completo (no solo el id) porque el real de un KPI de captura semanal se
// calcula distinto (promedio de semanas capturadas hasta ahora, ver
// getMonthlyRealValue).
export function computeCumplimiento(resultados, kpi, anio) {
  const { mes, anio: mesAnio, label } = getCurrentMonthInfo();
  const targetAnio = mesAnio ?? anio;
  const real = getMonthlyRealValue(resultados, kpi, targetAnio, mes);
  const meta = getResultadoValue(resultados, kpi.id, targetAnio, mes, "meta");
  if (real === null || !meta) return { real, meta, cumplimiento: null, mesLabel: label };
  const cumplimiento = Math.round((real / meta) * 100);
  return { real, meta, cumplimiento, mesLabel: label };
}

export function getCumplimientoStatus(cumplimiento) {
  if (cumplimiento === null || cumplimiento === undefined) return { label: "Sin datos", color: "#898781" };
  if (cumplimiento >= 95) return { label: "En meta", color: STATUS_COLORS.good };
  if (cumplimiento >= 80) return { label: "Atención", color: STATUS_COLORS.warning };
  if (cumplimiento >= 60) return { label: "En riesgo", color: STATUS_COLORS.serious };
  return { label: "Crítico", color: STATUS_COLORS.critical };
}

export const ESTRATEGICO_SCOPE = "ESTRATEGICO";

export const UNIDAD_OPTIONS = [
  { value: "numero", label: "Número" },
  { value: "porcentaje", label: "Porcentaje" },
  { value: "moneda", label: "Moneda" },
];

export const TIPO_GRAFICO_OPTIONS = [
  { value: "barra", label: "Barra" },
  { value: "linea", label: "Línea" },
  { value: "circular", label: "Circular" },
];

export const PERIODICIDAD_OPTIONS = ["Semanal", "Mensual", "Trimestral", "Semestral", "Anual"];
