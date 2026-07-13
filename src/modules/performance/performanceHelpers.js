export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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

export const PERSPECTIVA_COLOR = {
  Financiera: CATEGORICAL_COLORS[0],
  Clientes: CATEGORICAL_COLORS[1],
  Procesos: CATEGORICAL_COLORS[2],
  Desarrollo: CATEGORICAL_COLORS[7],
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

export function getResultadoValue(resultados, kpiId, anio, mes, tipo) {
  const row = resultados.find(
    (r) => Number(r.kpi_id) === Number(kpiId) && Number(r.anio) === Number(anio) && Number(r.mes) === Number(mes) && r.tipo === tipo
  );
  return row ? Number(row.valor) : null;
}

export function buildMonthlySeries(resultados, kpiId, anio) {
  return MESES.map((label, index) => ({
    mes: label,
    meta: getResultadoValue(resultados, kpiId, anio, index + 1, "meta"),
    real: getResultadoValue(resultados, kpiId, anio, index + 1, "real"),
  }));
}

// Cumplimiento = último mes con valor Real capturado, contra su Meta del
// mismo mes. Si no hay Real aún, cae al promedio de Meta vs Real disponibles.
export function computeCumplimiento(resultados, kpiId, anio) {
  const serie = buildMonthlySeries(resultados, kpiId, anio);
  let lastReal = null;
  let lastMeta = null;
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].real !== null) {
      lastReal = serie[i].real;
      lastMeta = serie[i].meta;
      break;
    }
  }
  if (lastReal === null || !lastMeta) return { real: lastReal, meta: lastMeta, cumplimiento: null };
  const cumplimiento = Math.round((lastReal / lastMeta) * 100);
  return { real: lastReal, meta: lastMeta, cumplimiento };
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
