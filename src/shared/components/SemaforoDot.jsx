// Semáforo de avance/riesgo de una actividad: un punto discreto (no colorea
// todo el bloque) que vive en una esquina de la tarjeta. Es UN solo campo
// compartido en `proceso_actividades.semaforo` — se edita igual desde Diseño
// Organizacional que desde cualquier pestaña de Balance de Carga (Semana/
// Mes/Planificación), así que cambiarlo en un lugar se refleja en todos los
// demás sin poder desincronizarse.
const CYCLE = [null, "verde", "amarillo", "rojo"];

const STYLES = {
  null: { className: "border border-slate-300 bg-white", label: "Sin definir" },
  verde: { className: "border border-emerald-600 bg-emerald-500", label: "En tiempo" },
  amarillo: { className: "border border-amber-600 bg-amber-400", label: "Atención / riesgo" },
  rojo: { className: "border border-red-700 bg-red-500", label: "Retrasada / con problema" },
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
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.className} ${disabled ? "cursor-default" : "cursor-pointer hover:scale-125"} transition-transform ${className}`}
    />
  );
}
