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
