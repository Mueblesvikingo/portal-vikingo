// Motor del Simulador de inversión y análisis (Diagnóstico SIG). Funciones puras, sin acceso a datos.
//
// Cada alternativa se evalúa contra una referencia por unidad:
//  - modo "ahorro": la referencia es lo que cuesta hoy la opción actual (p. ej. el servicio externo); el beneficio por unidad
//    es referencia − costo variable propio.
//  - modo "ingreso": la referencia es el precio de venta; el beneficio por unidad es precio − costo variable (margen).
// Beneficio anual = unidades × beneficio por unidad − costos fijos. Flujos después de impuestos, con escudo fiscal por depreciación
// y valor de rescate al final del horizonte. Todo en pesos y sin IVA.

export const MAX_ANIOS = 10;

export const num = (v, def = 0) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,\s%]/g, ""));
  return Number.isFinite(n) ? n : def;
};

const vpnDe = (flujos, tasa) => flujos.reduce((s, f, t) => s + f / Math.pow(1 + tasa, t), 0);

function tirDe(flujos) {
  const hayPositivo = flujos.some((f) => f > 0), hayNegativo = flujos.some((f) => f < 0);
  if (!hayPositivo || !hayNegativo) return null;
  let lo = -0.99, hi = 50;
  if (vpnDe(flujos, lo) * vpnDe(flujos, hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (vpnDe(flujos, m) > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// g: { volumen, referencia, tasa (%), isr (%), anios, crecimiento (%), depreciacion: [% año 1..] }
// alt: { nombre, inversion, costoVariable, costoFijo, rescate (%) }
export function evaluar(alt, g, sobrescribe = {}) {
  const p = { ...g, ...sobrescribe };
  const anios = Math.min(MAX_ANIOS, Math.max(1, Math.round(num(p.anios, 5))));
  const tasa = num(p.tasa) / 100, isr = num(p.isr) / 100, crec = num(p.crecimiento) / 100;
  const inv = num(alt.inversion), cvar = num(alt.costoVariable), fijo = num(alt.costoFijo), rescate = num(alt.rescate) / 100;
  const dep = Array.from({ length: anios }, (_, i) => num(p.depreciacion?.[i]) / 100);
  const beneficios = [], flujos = [-inv], acumulado = [-inv];
  for (let t = 1; t <= anios; t++) {
    const unidades = num(p.volumen) * Math.pow(1 + crec, t - 1);
    const beneficio = unidades * (num(p.referencia) - cvar) - fijo;
    let flujo = beneficio * (1 - isr) + inv * dep[t - 1] * isr;
    if (t === anios) flujo += inv * rescate * (1 - isr);
    beneficios.push(beneficio); flujos.push(flujo); acumulado.push(acumulado[t - 1] + flujo);
  }
  let payback = null;
  for (let t = 1; t <= anios; t++) if (acumulado[t] >= 0) { payback = flujos[t] > 0 ? t - 1 + -acumulado[t - 1] / flujos[t] : t; break; }
  if (inv <= 0) payback = 0;
  return { anios, beneficios, flujos, acumulado, vpn: vpnDe(flujos, tasa), tir: tirDe(flujos), payback };
}

// El VPN es lineal en el volumen y en la referencia: se resuelve con dos evaluaciones.
export function equilibrioVolumen(alt, g) {
  const v0 = evaluar(alt, g, { volumen: 0 }).vpn, v1 = evaluar(alt, g, { volumen: 1 }).vpn, pend = v1 - v0;
  return pend > 1e-9 ? Math.max(0, -v0 / pend) : null;
}
export function equilibrioReferencia(alt, g) {
  const v0 = evaluar(alt, g, { referencia: 0 }).vpn, v1 = evaluar(alt, g, { referencia: 1 }).vpn, pend = v1 - v0;
  return pend > 1e-9 ? -v0 / pend : null;
}

// Costo total por unidad con equipo propio: variable + (capital repartido en el horizonte + fijos) / unidades.
export function costoPorUnidad(alt, g) {
  const anios = Math.max(1, Math.round(num(g.anios, 5))), vol = num(g.volumen);
  if (vol <= 0) return null;
  return num(alt.costoVariable) + (num(alt.inversion) * (1 - num(alt.rescate) / 100) / anios + num(alt.costoFijo)) / vol;
}

export function sensibilidad(alt, g, factoresVolumen, factoresReferencia) {
  return factoresVolumen.map((fv) => ({
    volumen: num(g.volumen) * fv,
    celdas: factoresReferencia.map((fr) => ({ referencia: num(g.referencia) * fr, vpn: evaluar(alt, g, { volumen: num(g.volumen) * fv, referencia: num(g.referencia) * fr }).vpn })),
  }));
}

export const moneda = (n) => (n == null || !Number.isFinite(n) ? "—" : `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("es-MX")}`);
export const numero = (n, d = 0) => (n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("es-MX", { maximumFractionDigits: d, minimumFractionDigits: d }));
export const porcentaje = (n) => (n == null || !Number.isFinite(n) ? "n/a" : `${Math.round(n * 100).toLocaleString("es-MX")}%`);
export const anios = (n) => (n == null ? "> horizonte" : `${n.toFixed(1)} años`);

// ---- Plantillas ----
const DEP_COMPUTO = [30, 30, 30, 10];

export const PLANTILLAS = [
  {
    id: "plotter",
    nombre: "Compra de plotter de 1.40 m o más",
    descripcion: "Imprimir tendidos de hasta 30 m en casa contra pagar el servicio externo. Los números son estimaciones por confirmar con cotización.",
    ejemplo: true,
    datos: {
      titulo: "Compra de plotter de 1.40 m o más",
      modo: "ahorro", unidad: "m lineal",
      general: { volumen: 3000, referencia: 55, tasa: 18, isr: 30, anios: 5, crecimiento: 0, depreciacion: DEP_COMPUTO },
      alternativas: [
        { nombre: "A · Plotter de patrones 1.8 m (importado)", inversion: 65000, costoVariable: 13.5, costoFijo: 3000, rescate: 10, nota: "Listados de €735 a €2,700 + flete, aranceles y mesa. Sin garantía local confirmada." },
        { nombre: "B · Epson SureColor P20570 64\" (local)", inversion: 300000, costoVariable: 15.5, costoFijo: 12000, rescate: 25, nota: "$218,128 listado + mesa y software de impresión larga. Verificar que imprima 30 m continuos." },
      ],
    },
  },
  {
    id: "nuevo-producto",
    nombre: "Nuevo producto o línea (ingresos)",
    descripcion: "Inversión inicial contra el margen por unidad vendida. Datos de ejemplo, no son de Vikingo.",
    ejemplo: true,
    datos: {
      titulo: "Nuevo producto o línea",
      modo: "ingreso", unidad: "pieza",
      general: { volumen: 800, referencia: 1000, tasa: 18, isr: 30, anios: 5, crecimiento: 5, depreciacion: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
      alternativas: [{ nombre: "Escenario base", inversion: 150000, costoVariable: 600, costoFijo: 50000, rescate: 0, nota: "" }],
    },
  },
  {
    id: "blanco",
    nombre: "En blanco",
    descripcion: "Todos los campos en cero, para capturar cualquier evaluación.",
    ejemplo: false,
    datos: {
      titulo: "Nuevo análisis",
      modo: "ahorro", unidad: "unidad",
      general: { volumen: 0, referencia: 0, tasa: 18, isr: 30, anios: 5, crecimiento: 0, depreciacion: DEP_COMPUTO },
      alternativas: [{ nombre: "Alternativa 1", inversion: 0, costoVariable: 0, costoFijo: 0, rescate: 0, nota: "" }],
    },
  },
];
