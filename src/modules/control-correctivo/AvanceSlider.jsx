import { useEffect, useState } from "react";
import { PRIORIDAD_COLOR } from "./ccHelpers";

// Barra de avance de 0 a 100% que se mueve a mano. Mientras se arrastra solo
// cambia el valor local; el guardado ocurre al soltar (puntero, dedo o tecla),
// para no escribir en la base en cada porcentaje que pasa el dedo.
// El control nativo (<input type="range">) va transparente encima de una
// pista dibujada a mano: así la barra se ve igual en todos los navegadores
// (el color nativo cambia de pista según el tono del acento).
export default function AvanceSlider({ value, prioridad, disabled, onCommit, compact = false }) {
  const [local, setLocal] = useState(Number(value) || 0);

  useEffect(() => {
    setLocal(Number(value) || 0);
  }, [value]);

  const color = PRIORIDAD_COLOR[prioridad] || "#64748b";

  function commit() {
    if (!disabled && local !== Number(value)) onCommit(local);
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? "min-w-[120px]" : ""}`}>
      <div className="relative h-5 min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={local}
          disabled={disabled}
          aria-label="Avance reportado"
          onChange={(e) => setLocal(Number(e.target.value))}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#e5e9f0] peer-focus-visible:ring-2 peer-focus-visible:ring-[#c9a227]">
          <div className="h-full rounded-full" style={{ width: `${local}%`, background: color }} />
        </div>
        <div
          className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white shadow ${disabled ? "opacity-70" : ""}`}
          style={{ left: `calc(${local}% - ${(local / 100) * 14}px)`, background: color }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-[#0f1f3d]">{local}%</span>
    </div>
  );
}
