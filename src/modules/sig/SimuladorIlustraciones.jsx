// Ilustraciones del Simulador con el mismo lenguaje visual de CORELI (contorno grueso #1f2a33,
// rellenos pastel y carita), dibujadas para este módulo. Solo presentación.

const TINTA = "#1f2a33";

// Ojos con brillo, sonrisa (o boca triste) y chapitas, centrados en (cx, cy).
function Carita({ cx, cy, sep = 26, feliz = true, chapas = true }) {
  return (
    <g>
      <circle cx={cx - sep} cy={cy} r="9" fill={TINTA} />
      <circle cx={cx + sep} cy={cy} r="9" fill={TINTA} />
      <circle cx={cx - sep + 3} cy={cy - 3} r="2.9" fill="#fff" />
      <circle cx={cx + sep + 3} cy={cy - 3} r="2.9" fill="#fff" />
      <path d={feliz ? `M${cx - 10} ${cy + 16} Q${cx} ${cy + 26} ${cx + 10} ${cy + 16}` : `M${cx - 10} ${cy + 24} Q${cx} ${cy + 14} ${cx + 10} ${cy + 24}`} fill="none" stroke={TINTA} strokeWidth="5.5" strokeLinecap="round" />
      {chapas && <ellipse cx={cx - sep - 12} cy={cy + 20} rx="12" ry="7" fill="#f08a84" opacity="0.75" />}
      {chapas && <ellipse cx={cx + sep + 12} cy={cy + 20} rx="12" ry="7" fill="#f08a84" opacity="0.75" />}
    </g>
  );
}

const Lienzo = ({ className, children, titulo }) => (
  <svg viewBox="-6 -10 332 300" className={className} role="img" aria-label={titulo}>{children}</svg>
);

export function IlusAnalisis({ className = "h-12 w-12" }) {
  return (
    <Lienzo className={className} titulo="Análisis">
      <g stroke={TINTA} strokeWidth="11" strokeLinejoin="round">
        <rect x="62" y="40" width="196" height="232" rx="22" fill="#d8ccf5" />
        <rect x="112" y="18" width="96" height="46" rx="14" fill="#f7c873" />
      </g>
      <g stroke={TINTA} strokeWidth="9" strokeLinecap="round">
        <path d="M100 196 L220 196" /><path d="M100 230 L180 230" />
      </g>
      <Carita cx={160} cy={124} />
    </Lienzo>
  );
}

export function IlusVolumen({ className = "h-12 w-12" }) {
  return (
    <Lienzo className={className} titulo="Volumen">
      <g stroke={TINTA} strokeWidth="11" strokeLinejoin="round">
        <path d="M70 70 L250 70 L250 230 L70 230 Z" fill="#9ad0f5" />
        <ellipse cx="70" cy="150" rx="30" ry="80" fill="#c6e6fb" />
        <path d="M250 200 L300 200 L300 262 L222 262" fill="#ffffff" />
      </g>
      <ellipse cx="70" cy="150" rx="9" ry="24" fill={TINTA} />
      <Carita cx={168} cy={136} />
    </Lienzo>
  );
}

export function IlusSupuestos({ className = "h-12 w-12" }) {
  return (
    <Lienzo className={className} titulo="Supuestos financieros">
      <circle cx="160" cy="146" r="116" fill="#f7c873" stroke={TINTA} strokeWidth="11" />
      <circle cx="160" cy="146" r="86" fill="none" stroke="#e0a840" strokeWidth="8" />
      <text x="160" y="96" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="58" fill={TINTA}>%</text>
      <Carita cx={160} cy={156} sep={30} />
    </Lienzo>
  );
}

export function IlusEquipo({ className = "h-12 w-12" }) {
  return (
    <Lienzo className={className} titulo="Equipo a evaluar">
      <g stroke={TINTA} strokeWidth="11" strokeLinejoin="round" strokeLinecap="round">
        <path d="M118 118 L202 118 L224 262 L96 262 Z" fill="#ffffff" />
        <rect x="24" y="40" width="272" height="110" rx="34" fill="#8fd3a8" />
        <path d="M60 150 L60 200 M260 150 L260 200" fill="none" />
      </g>
      <g stroke={TINTA} strokeWidth="7" strokeLinecap="round"><path d="M128 210 L192 210" /><path d="M134 236 L176 236" /></g>
      <Carita cx={160} cy={86} sep={30} />
    </Lienzo>
  );
}

// Alcancía: feliz si la inversión conviene, triste si no.
export function IlusAlcancia({ feliz = true, className = "h-24 w-24" }) {
  return (
    <Lienzo className={className} titulo={feliz ? "Conviene" : "No conviene"}>
      <g stroke={TINTA} strokeWidth="11" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="156" cy="168" rx="122" ry="92" fill={feliz ? "#f4a5a0" : "#e5e7eb"} />
        <path d="M84 98 L72 52 L118 80" fill={feliz ? "#f4a5a0" : "#e5e7eb"} />
        <rect x="248" y="142" width="42" height="56" rx="18" fill={feliz ? "#f8c1bd" : "#f1f2f4"} />
        <path d="M96 252 L96 270 M210 252 L210 270" fill="none" />
        <path d="M130 84 L190 84" fill="none" />
      </g>
      <circle cx="262" cy="170" r="5" fill={TINTA} />
      <circle cx="278" cy="170" r="5" fill={TINTA} />
      <Carita cx={160} cy={150} sep={30} feliz={feliz} />
      {feliz ? (
        <g stroke={TINTA} strokeWidth="10" strokeLinejoin="round">
          <circle cx="160" cy="28" r="30" fill="#8fd3a8" />
          <text x="160" y="43" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="40" fill={TINTA} stroke="none">$</text>
        </g>
      ) : null}
    </Lienzo>
  );
}

// Íconos de línea para las insignias redondas de los indicadores (24 × 24).
const Icono = ({ children, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconoRendimiento = (p) => <Icono {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></Icono>;
export const IconoReloj = (p) => <Icono {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icono>;
export const IconoMeta = (p) => <Icono {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Icono>;
export const IconoEtiqueta = (p) => <Icono {...p}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Icono>;
export const IconoGrafica = (p) => <Icono {...p}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></Icono>;
