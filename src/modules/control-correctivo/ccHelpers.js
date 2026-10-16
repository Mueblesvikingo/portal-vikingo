// Estilos y colores compartidos por las piezas de Control Correctivo. Mismos
// tokens que ya usan Calidad y Acciones de Mejora (copiados, no importados,
// para que cada módulo siga siendo autocontenido).
export const cardClass = "rounded-2xl border border-[#edf0f4] bg-white shadow-[0_1px_1px_rgba(11,31,58,0.04),0_4px_12px_-2px_rgba(11,31,58,0.07)]";
export const inputClass = "mt-1 w-full rounded-xl border border-[#edf0f4] bg-white px-3 py-2 text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)] disabled:bg-[#f7f7f4] disabled:text-[#94a3b8]";
export const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]";
export const btnPrimaryClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#c9a227] to-[#b8931f] px-4 py-2 text-sm font-semibold text-[#0b1f3a] shadow-[0_1px_2px_rgba(11,31,58,0.08),0_2px_6px_-1px_rgba(11,31,58,0.12)] transition active:scale-[0.98] disabled:opacity-50";
export const btnGhostClass = "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#5b6472] transition hover:bg-[#f7f7f4] disabled:opacity-50";

// Prioridad: rojo / ámbar / verde, igual que la leyenda del tablero semanal de
// Balance de Carga (el color siempre significa lo mismo).
export const PRIORIDAD_COLOR = { Alta: "#ef4444", Media: "#f59e0b", Baja: "#10b981" };
export const PRIORIDAD_BADGE = {
  Alta: "border-red-200 bg-red-50 text-red-700",
  Media: "border-amber-200 bg-amber-50 text-amber-700",
  Baja: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
export const ESTADO_BADGE = {
  Completada: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Vencida: "border-red-200 bg-red-50 text-red-700",
  "En curso": "border-slate-200 bg-slate-50 text-slate-600",
};

// Tipo de brecha: tres categorías distintas, tres tonos distintos.
export const BRECHA_BADGE = {
  Operativa: "border-sky-200 bg-sky-50 text-sky-700",
  Competencias: "border-violet-200 bg-violet-50 text-violet-700",
  Financiera: "border-teal-200 bg-teal-50 text-teal-700",
};
export const ESTADO_COLOR = { "En curso": "#94a3b8", Vencida: "#ef4444", Completada: "#10b981" };

export function iniciales(nombre) {
  return String(nombre || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// "Vence en 12 d", "Venció hace 5 d": lectura rápida de la fecha compromiso.
export function textoVencimiento(iso, estado, hoy) {
  if (estado === "Completada") return "Cerrada";
  if (!iso) return "";
  const dias = Math.round((new Date(`${iso}T00:00:00`) - new Date(`${hoy}T00:00:00`)) / 86400000);
  if (dias === 0) return "Vence hoy";
  return dias > 0 ? `Vence en ${dias} d` : `Venció hace ${-dias} d`;
}

export function fmtFecha(iso) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
