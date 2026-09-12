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
