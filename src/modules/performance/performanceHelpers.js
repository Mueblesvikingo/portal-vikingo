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

export function getResultadoRow(resultados, kpiId, anio, mes, tipo) {
  return resultados.find(
    (r) => Number(r.kpi_id) === Number(kpiId) && Number(r.anio) === Number(anio) && Number(r.mes) === Number(mes) && r.tipo === tipo
  ) || null;
}

export function getResultadoValue(resultados, kpiId, anio, mes, tipo) {
  const row = getResultadoRow(resultados, kpiId, anio, mes, tipo);
  return row ? Number(row.valor) : null;
}

export function buildMonthlySeries(resultados, kpiId, anio) {
  return MESES.map((label, index) => ({
    mes: label,
    meta: getResultadoValue(resultados, kpiId, anio, index + 1, "meta"),
    real: getResultadoValue(resultados, kpiId, anio, index + 1, "real"),
  }));
}

// El "mes anterior" es siempre el mes calendario previo al actual (no el
// último mes con dato capturado) — así Real/Meta se muestran automáticamente
// sin que el usuario tenga que buscar el mes correcto.
export function getPreviousMonthInfo() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  if (currentMonth === 1) return { mes: 12, anio: currentYear - 1, label: MESES[11] };
  return { mes: currentMonth - 1, anio: currentYear, label: MESES[currentMonth - 2] };
}

// Real/Meta del mes anterior (calendario), contra ese mismo mes.
export function computeCumplimiento(resultados, kpiId, anio) {
  const { mes, anio: mesAnio, label } = getPreviousMonthInfo();
  const targetAnio = mesAnio ?? anio;
  const real = getResultadoValue(resultados, kpiId, targetAnio, mes, "real");
  const meta = getResultadoValue(resultados, kpiId, targetAnio, mes, "meta");
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

export const PERIODICIDAD_OPTIONS = ["Mensual", "Trimestral", "Semestral", "Anual"];
