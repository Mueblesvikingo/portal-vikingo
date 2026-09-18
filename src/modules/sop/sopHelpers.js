export const MES_NOMBRE = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function parseMesActivo(mesActivo) {
  if (!mesActivo) return null;
  const [anio, mes] = mesActivo.split("-").map(Number);
  return { anio, mes };
}

// Genera los N meses del horizonte visible a partir del mes activo (incluido).
export function buildHorizonte(mesActivo, horizonteMeses = 6) {
  const start = parseMesActivo(mesActivo);
  if (!start) return [];
  const meses = [];
  let { anio, mes } = start;
  for (let i = 0; i < horizonteMeses; i++) {
    meses.push({ anio, mes, label: `${MES_NOMBRE[mes]}-${String(anio).slice(2)}` });
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
}

export function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

export const LINEAS = ["Bases", "Recámaras", "Salas"];

// Parser CSV minimo (respeta comillas) — compartido por Plan de venta e
// Inventarios para leer de vuelta un archivo exportado desde el portal o
// armado en Excel con las mismas columnas. El separador se detecta solo
// (punto y coma o coma) mirando la primera línea (o la directiva "sep=" si
// el archivo la trae — ver downloadCsv), para leer tanto los archivos
// nuevos como uno viejo o pegado a mano en coma.
export function parseCsvSimple(text) {
  let clean = text.replace(/^﻿/, "");
  const sepMatch = /^sep=(.)\r?\n/.exec(clean);
  let delimitador;
  if (sepMatch) {
    delimitador = sepMatch[1];
    clean = clean.slice(sepMatch[0].length);
  } else {
    const primeraLinea = clean.split(/\r\n|\n|\r/, 1)[0] || "";
    const puntoYComas = (primeraLinea.match(/;/g) || []).length;
    const comas = (primeraLinea.match(/,/g) || []).length;
    delimitador = puntoYComas > comas ? ";" : ",";
  }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimitador) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// El separador de columnas que Excel usa para abrir un .csv de un doble
// clic depende de la configuración regional de Windows de cada equipo (no
// siempre es ";" aunque el sistema esté en español/México) — así que en
// vez de adivinarlo, se declara explícito con la directiva "sep=;" como
// primera línea del archivo, un truco que Excel reconoce y respeta sin
// importar la configuración regional. parseCsvSimple la reconoce y la
// quita antes de leer el resto.
export function downloadCsv(filename, header, rows) {
  const escapeCsv = (value) => {
    const s = String(value ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "sep=;\r\n" + [header, ...rows].map((r) => r.map(escapeCsv).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Semana de referencia para la "Vista semanal" de S&OP (capa temporal
// mientras el ciclo mensual madura): siempre el próximo lunes a viernes, la
// semana que se revisa en la junta de alineación de cada martes.
export function getProximoLunes() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=domingo ... 1=lunes ... 6=sábado
  const diasHastaLunes = dia === 1 ? 7 : ((8 - dia) % 7) || 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diasHastaLunes);
  return lunes;
}

export function formatFechaCorta(date) {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

// Rango [lunes, domingo] de la semana de referencia, en ISO — útil para
// filtrar registros reales (ej. sop_decisiones) que caigan en esa semana.
export function getSemanaReferenciaISO() {
  const lunes = getProximoLunes();
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { lunes, domingo, lunesISO: toISODate(lunes), domingoISO: toISODate(domingo) };
}

// El costo solo viaja como texto dentro de la recomendación (no hay columna
// dedicada en decisiones_estrategicas) — hoy únicamente "Solicitar recurso"
// lo redacta con este formato exacto ("Costo estimado: $X"), así que es lo
// único que se puede sumar contra la liquidez o mostrar como egreso.
// Compartido por Decisiones (Director) y Plan financiero.
export const SEMANAS_POR_MES = 4.33;

export function extraerCosto(recomendacion) {
  const m = /Costo estimado:\s*\$?\s*([\d,]+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/i.exec(recomendacion || "");
  if (!m) return null;
  const monto = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(monto)) return null;
  const periodicidad = m[2] || "Único";
  // Único y Semanal se comparan tal cual (Único, asumiendo que se pagaría
  // esa misma semana); Mensual se prorratea entre semanas del mes para no
  // sobreestimar el impacto de una sola semana.
  const montoSemanal = /mensual/i.test(periodicidad) ? monto / SEMANAS_POR_MES : monto;
  return { monto, periodicidad, montoSemanal };
}

// Categorías de la Vista semanal de Plan financiero (egresos/ingresos
// esperados) — compartidas con la pestaña Decisiones (Director) para poder
// calcular ahí mismo la liquidez esperada de la semana sin duplicar la lista.
export const EGRESO_CAMPOS_SEMANA = [
  { key: "proveedores", label: "Proveedores / Compras" },
  { key: "nomina", label: "Nómina" },
  { key: "gastosGenerales", label: "Gastos generales" },
];
export const INGRESO_CAMPOS_SEMANA = [
  { key: "ventasContado", label: "Ventas de contado" },
  { key: "cobranza", label: "Cobranza" },
];

// Ciclo mensual S&OP (VEN-SP-03): 4 etapas en orden, con su día límite
// dentro del mes del ciclo — tomado directo del taller con el consultor
// (comercial primeros 5 días, operativo hasta el 15, financiero hasta el 20
// con margen, ejecutivo cierra con la reunión de fin de mes).
export const ETAPAS_CICLO = [
  { key: "comercial", label: "Validación comercial", dia: 5 },
  { key: "operativo", label: "Validación operativa", dia: 15 },
  { key: "financiero", label: "Validación financiera", dia: 20 },
  { key: "ejecutivo", label: "Alineación integral (reunión ejecutiva)", dia: 0 }, // 0 = último día del mes
];

// Devuelve la fecha límite (Date) de una etapa dentro del ciclo (anio, mes).
// dia=0 se interpreta como "último día del mes" usando el truco de pedir el
// día 0 del mes siguiente (JS Date normaliza eso al último día del mes actual).
export function getFechaLimite(anio, mes, etapaKey) {
  const etapa = ETAPAS_CICLO.find((e) => e.key === etapaKey);
  if (!etapa || !anio || !mes) return null;
  if (etapa.dia === 0) return new Date(anio, mes, 0);
  return new Date(anio, mes - 1, etapa.dia);
}
