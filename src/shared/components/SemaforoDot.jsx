// Semáforo de avance/riesgo de una actividad: una franja delgada en el borde
// izquierdo de la tarjeta (no un punto encima del texto, no colorea todo el
// bloque). Es UN solo campo compartido en `proceso_actividades.semaforo` —
// se edita igual desde Diseño Organizacional que desde cualquier pestaña de
// Balance de Carga (Semana/Mes/Planificación), así que cambiarlo en un lugar
// se refleja en todos los demás sin poder desincronizarse.
const CYCLE = [null, "verde", "amarillo", "rojo"];

// Sin definir: casi invisible (se confunde con el borde normal de la
// tarjeta). Con color: una franja saturada que sí resalta, sin ser ancha.
const STYLES = {
  null: { className: "bg-slate-300", label: "Sin definir" },
  verde: { className: "bg-emerald-500", label: "En tiempo" },
  amarillo: { className: "bg-amber-400", label: "Atención / riesgo" },
  rojo: { className: "bg-red-500", label: "Retrasada / con problema" },
};

export default function SemaforoDot({ value, onChange, disabled = false, className = "" }) {
  const key = CYCLE.includes(value) ? value : null;
  const style = STYLES[key];

  function handleClick(event) {
    event.stopPropagation();
    if (disabled || !onChange) return;
    const nextIndex = (CYCLE.indexOf(key) + 1) % CYCLE.length;
    onChange(CYCLE[nextIndex]);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? `Semáforo: ${style.label}` : `Semáforo: ${style.label} (clic para cambiar)`}
      className={`absolute inset-y-0 left-0 w-[3px] rounded-l-lg ${style.className} ${disabled ? "cursor-default" : "cursor-pointer hover:w-1.5"} transition-all ${className}`}
    />
  );
}
