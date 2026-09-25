// Paleta y componentes visuales copiados literalmente de CORELI
// (coreli-inventarios-retail: tailwind.config.js + src/index.css +
// StatusBadge.jsx) — pedido explícito del usuario porque este módulo se usa
// 90% desde celular y quiere exactamente ese lenguaje visual, no el sobrio
// azul marino/rojo del resto del portal. Vive solo en src/modules/quality,
// no afecta ningún otro módulo.
//
// Nota técnica: las clases de abajo son literales (no armadas con template
// strings a partir de estas constantes) a propósito — Tailwind solo genera
// CSS para clases `bg-[#..]` que puede leer como texto fijo en el código;
// una clase compuesta en tiempo de ejecución con una variable nunca se
// generaría. `CORELI` sí sirve para estilos inline (style={{ color: ... }}).
export const CORELI = {
  brand: "#0b1f3a",
  brandDark: "#071527",
  accent500: "#c9a227",
  accent600: "#b8931f",
  accent200: "#f0d885",
  accent100: "#f8ecc0",
  accent50: "#fdf7e6",
  positive: "#16a34a",
  warning: "#d97706",
  danger: "#b91c1c",
  ink: "#0f1f3d",
  muted: "#5b6472",
  subtle: "#94a3b8",
  line: "#edf0f4",
  surface: "#f7f7f4",
  elevated: "#ffffff",
  canvas: "#f1f5f9",
};

export const cardClass =
  "rounded-2xl border border-[#edf0f4] bg-white shadow-[0_1px_1px_rgba(11,31,58,0.04),0_4px_12px_-2px_rgba(11,31,58,0.07)] transition";

export const btnPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#c9a227] to-[#b8931f] px-4 py-2.5 text-sm font-semibold text-[#0b1f3a] shadow-[0_1px_2px_rgba(11,31,58,0.08),0_2px_6px_-1px_rgba(11,31,58,0.12)] transition active:scale-[0.98] disabled:opacity-40";

export const btnSecondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#edf0f4] bg-white px-4 py-2.5 text-sm font-medium text-[#0f1f3d] shadow-[0_1px_2px_rgba(11,31,58,0.08),0_2px_6px_-1px_rgba(11,31,58,0.12)] transition hover:border-[#f0d885] active:scale-[0.98]";

export const btnGhostClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#5b6472] transition hover:bg-[#f7f7f4]";

export const badgeClass = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium";

export const STATUS_STYLES = {
  "Conforme": "border border-green-200 bg-green-50 text-green-700",
  "Conforme con observación": "border border-amber-200 bg-amber-50 text-amber-700",
  "Producto No Conforme": "border border-red-200 bg-red-50 text-red-700",
  "No Conforme": "border border-red-200 bg-red-50 text-red-700",
  "Abierto": "border border-blue-200 bg-blue-50 text-blue-700",
  "Menor": "border border-amber-200 bg-amber-50 text-amber-700",
  "Mayor": "border border-orange-200 bg-orange-50 text-orange-700",
  "Crítico": "border border-red-200 bg-red-50 text-red-700",
};
const STATUS_DEFAULT = "border border-[#edf0f4] bg-[#f7f7f4] text-[#0f1f3d]";

export function statusBadgeClass(status) {
  return `${badgeClass} ${STATUS_STYLES[status] || STATUS_DEFAULT}`;
}
