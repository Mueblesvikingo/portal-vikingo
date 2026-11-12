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
    // Ajuste del 9-nov-2026: solo la opción elegida (Audaces Jet Lux Plus 185, cotización Galga) contra el servicio externo.
    id: "plotter",
    nombre: "Plotter Audaces Jet Lux Plus 185",
    descripcion: "Imprimir los tendidos en casa con el Jet Lux Plus 185 contra pagar el servicio externo ($75 por metro). Insumos, costos fijos, volumen y rescate por confirmar.",
    ejemplo: true,
    datos: {
      titulo: "Compra del plotter Audaces Jet Lux Plus 185",
      modo: "ahorro", unidad: "m lineal",
      general: { volumen: 3000, referencia: 75, tasa: 18, isr: 30, anios: 5, crecimiento: 0, depreciacion: DEP_COMPUTO },
      alternativas: [
        { nombre: "Audaces Jet Lux Plus 185 (Galga)", inversion: 155172, costoVariable: 9, costoFijo: 3000, rescate: 10, nota: "Cotización Galga: $180,000 con IVA ($155,172 sin IVA). 185 cm de ancho, 70–100 m²/h, papel de 40 a 80 g/m², Ethernet, 150 W. Insumos $9/m lineal en papel estraza (precios del 12-nov-2026): papel ≈ $6/m (rollo de 1.83 m, 50–60 g/m², $50–75/kg → $4.6 a $8.2/m) + tinta ≈ $3/m (cartucho HP 45 a $1,432, suponiendo 500 m por cartucho; si rinde 1,000 m baja a $1.4/m y si rinde 200 m sube a $7.2/m). Por confirmar con Galga: rendimiento del cartucho y que el equipo acepte estraza (la pelusa puede tapar los cabezales). También por confirmar: costos fijos, volumen al año y valor de rescate." },
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

// ---- Tipos de proyecto ----
// Cada tipo trae su modo de análisis (ahorro o ingresos), la unidad de medida, los nombres de los campos con las palabras de ese
// proyecto ("{u}" es la unidad) y un ejemplo para arrancar. Los números de los ejemplos son ilustrativos: se cambian en pantalla.
// Los cálculos son los mismos para todos; un análisis guardado sin tipo se reconoce por su plantilla (ver tipoDe).
const DEP_10 = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
const base = (modo, unidad, general, alternativas, titulo) => ({ titulo, modo, unidad, general: { crecimiento: 0, tasa: 18, isr: 30, anios: 5, ...general }, alternativas });
const alt = (nombre, inversion, costoVariable, costoFijo, rescate, nota = "") => ({ nombre, inversion, costoVariable, costoFijo, rescate, nota });

export const TIPOS_PROYECTO = [
  {
    id: "equipo", nombre: "Compra de equipo", corto: "Equipo", color: "#0f766e",
    descripcion: "Comprar una máquina o equipo contra seguir pagando el servicio externo (por ejemplo, el plotter).",
    ejemplo: true, modo: "ahorro", unidad: "m lineal",
    etiquetas: { volumen: "Volumen al año", referencia: "Costo actual por {u}", costoVariable: "Insumos por {u}", costoFijo: "Mantenimiento y servicio al año", inversion: "Equipo e instalación", alternativa: "El equipo a evaluar",
      ayudaInversion: "Precio sin IVA, más instalación, capacitación y mesa.", ayudaVariable: "Insumos de cada unidad (papel, tinta, material).", ayudaFijo: "Lo que pagas al año aunque no lo uses: mantenimiento, póliza.", ayudaRescate: "Lo que valdría al venderlo al final; el último año lo suma neto de impuestos." },
    datos: PLANTILLAS[0].datos,
  },
  {
    id: "mejora", nombre: "Mejora de proceso o ahorro de costos", corto: "Mejora", color: "#2563eb",
    descripcion: "Una inversión que baja el costo de hacer algo (automatizar un corte, reducir desperdicio, cambiar un método).",
    ejemplo: true, modo: "ahorro", unidad: "pieza",
    etiquetas: { volumen: "Piezas al año", referencia: "Costo actual por {u}", costoVariable: "Costo con la mejora por {u}", costoFijo: "Costos fijos de la mejora al año", inversion: "Inversión de la mejora", alternativa: "La mejora a evaluar",
      ayudaInversion: "Equipo, adecuaciones y capacitación, sin IVA.", ayudaVariable: "Lo que costará cada unidad una vez hecha la mejora.", ayudaFijo: "Mantenimiento o licencias que genera la mejora cada año.", ayudaRescate: "Lo que valdría al final, si algo se puede recuperar." },
    datos: base("ahorro", "pieza", { volumen: 6000, referencia: 85, depreciacion: DEP_10 }, [alt("Celda de corte automatizada", 250000, 60, 12000, 10, "Ejemplo ilustrativo: reemplazar con las cotizaciones y costos reales.")], "Mejora de proceso"),
  },
  {
    id: "producto", nombre: "Nuevo producto o línea", corto: "Producto", color: "#b45309",
    descripcion: "Lanzar un producto nuevo: la inversión de arranque contra el margen que deja cada pieza vendida.",
    ejemplo: true, modo: "ingreso", unidad: "pieza",
    etiquetas: { volumen: "Ventas al año", referencia: "Precio de venta por {u}", costoVariable: "Costo de producir por {u}", costoFijo: "Costos fijos del producto al año", inversion: "Moldes, herramental y arranque", alternativa: "El escenario a evaluar",
      ayudaInversion: "Diseño, moldes, herramental, muestras y arranque, sin IVA.", ayudaVariable: "Materiales y mano de obra de cada pieza.", ayudaFijo: "Publicidad, personal dedicado y lo que se paga aunque no se venda.", ayudaRescate: "Lo que valdrían moldes y equipo al final." },
    datos: PLANTILLAS[1].datos,
  },
  {
    id: "capacidad", nombre: "Ampliar capacidad de producción", corto: "Capacidad", color: "#7c3aed",
    descripcion: "Una máquina o turno adicional para producir y vender más de lo que hoy se alcanza.",
    ejemplo: true, modo: "ingreso", unidad: "juego",
    etiquetas: { volumen: "Unidades adicionales al año", referencia: "Precio de venta por {u}", costoVariable: "Costo variable por {u}", costoFijo: "Costos fijos adicionales al año", inversion: "Máquina e instalación", alternativa: "La ampliación a evaluar",
      ayudaInversion: "Máquina, instalación eléctrica, piso y capacitación, sin IVA.", ayudaVariable: "Materiales, energía y mano de obra por cada unidad adicional.", ayudaFijo: "Operadores, supervisión y mantenimiento que se suman cada año.", ayudaRescate: "Lo que valdría la máquina al venderla al final." },
    datos: base("ingreso", "juego", { volumen: 300, referencia: 9500, crecimiento: 5, depreciacion: DEP_10 }, [alt("Segundo turno con máquina nueva", 1200000, 6200, 90000, 20, "Ejemplo ilustrativo: capturar las unidades extra que de verdad se venderían.")], "Ampliación de capacidad"),
  },
  {
    id: "sistema", nombre: "Software o sistema", corto: "Sistema", color: "#0e7490",
    descripcion: "Un sistema que ahorra horas de trabajo: la implementación y las licencias contra el costo de hacerlo a mano.",
    ejemplo: true, modo: "ahorro", unidad: "hora",
    etiquetas: { volumen: "Horas ahorradas al año", referencia: "Costo por {u} de trabajo manual", costoVariable: "Costo por {u} con el sistema", costoFijo: "Licencias y soporte al año", inversion: "Implementación y capacitación", alternativa: "El sistema a evaluar",
      ayudaInversion: "Compra o desarrollo, implementación, migración de datos y capacitación, sin IVA.", ayudaVariable: "Lo que cuesta cada hora de trabajo que sí sigue haciéndose con el sistema (suele ser casi cero).", ayudaFijo: "Licencias, nube y soporte que se pagan cada año.", ayudaRescate: "Normalmente cero en un sistema." },
    datos: base("ahorro", "hora", { volumen: 2500, referencia: 120, depreciacion: [30, 30, 30, 10] }, [alt("Sistema de seguimiento de producción", 180000, 15, 60000, 0, "Ejemplo ilustrativo: horas que se dejan de gastar en captura, revisión y reportes.")], "Software o sistema"),
  },
  {
    id: "sucursal", nombre: "Punto de venta o sucursal", corto: "Sucursal", color: "#be185d",
    descripcion: "Abrir una tienda o showroom: la inversión y los gastos fijos contra el margen de cada venta.",
    ejemplo: true, modo: "ingreso", unidad: "venta",
    etiquetas: { volumen: "Ventas al año", referencia: "Ticket promedio por {u}", costoVariable: "Costo directo por {u}", costoFijo: "Renta, nómina y servicios al año", inversion: "Adecuación, inventario y equipo", alternativa: "El punto de venta a evaluar",
      ayudaInversion: "Adecuación del local, mobiliario, inventario inicial y depósitos, sin IVA.", ayudaVariable: "Lo que cuesta producir, entregar y comisionar cada venta.", ayudaFijo: "Renta, sueldos, luz, publicidad y todo lo que se paga aunque no haya ventas.", ayudaRescate: "Lo que se recuperaría al cerrar: mobiliario, inventario." },
    datos: base("ingreso", "venta", { volumen: 400, referencia: 4200, crecimiento: 8, depreciacion: DEP_10 }, [alt("Showroom en la ciudad", 900000, 2900, 480000, 10, "Ejemplo ilustrativo: ventas y gastos por confirmar con el estudio de la zona.")], "Punto de venta o sucursal"),
  },
  {
    id: "blanco", nombre: "Otro proyecto (en blanco)", corto: "Otro", color: "#475569",
    descripcion: "Todos los campos en cero, para capturar cualquier evaluación que no encaje en los tipos anteriores.",
    ejemplo: false, modo: "ahorro", unidad: "unidad",
    etiquetas: { volumen: "Volumen al año", referencia: "Referencia por {u}", costoVariable: "Costo variable por {u}", costoFijo: "Costos fijos al año", inversion: "Inversión inicial", alternativa: "La opción a evaluar",
      ayudaInversion: "Equipo, instalación, software y capacitación, sin IVA.", ayudaVariable: "Materiales, mano de obra y todo lo que crece con cada unidad.", ayudaFijo: "Lo que se paga cada año sin importar el volumen.", ayudaRescate: "Lo que valdría al final; el último año lo suma neto de impuestos." },
    datos: PLANTILLAS[2].datos,
  },
];

// Análisis guardados antes de existir los tipos: se reconocen por la plantilla con la que nacieron.
const TIPO_POR_PLANTILLA = { plotter: "equipo", "nuevo-producto": "producto", blanco: "blanco" };
export const tipoDe = (estado) => {
  const id = estado?.tipo || TIPO_POR_PLANTILLA[estado?.plantillaId] || "blanco";
  return TIPOS_PROYECTO.find((t) => t.id === id) || TIPOS_PROYECTO[TIPOS_PROYECTO.length - 1];
};
export const tipoPorId = (id) => TIPOS_PROYECTO.find((t) => t.id === id) || null;
// Texto del tipo con la unidad capturada en lugar de "{u}"
export const etiquetaTipo = (tipo, clave, unidad) => String(tipo.etiquetas[clave] ?? "").replace("{u}", unidad || "unidad");
