import { useEffect, useRef, useState } from "react";
import { TIPOS_ACCION, NIVELES_ACCION } from "./actionsHelpers";

// Mismos estilos de campo/botón que usa el formulario de "+ Nueva
// recepción/inspección" en Calidad (ver src/modules/quality/shared.jsx:
// inputClass/labelClass, y coreliTheme.js: btnPrimaryClass/btnGhostClass) —
// copiados aquí en vez de importados entre módulos, mismo criterio de
// autocontención que ya explica el comentario de InvolucradosSelect más
// abajo. El fondo gris plano (bg-slate-50/border-slate-200) que traía antes
// esta ventana se reemplaza por blanco con borde clarísimo y foco dorado.
const inputClass = "mt-1 w-full rounded-xl border border-[#edf0f4] bg-white px-3 py-2 text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)]";
const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]";
const btnPrimaryClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#c9a227] to-[#b8931f] px-3 py-1.5 text-[11px] font-semibold text-[#0b1f3a] shadow-[0_1px_2px_rgba(11,31,58,0.08),0_2px_6px_-1px_rgba(11,31,58,0.12)] transition active:scale-[0.98]";
const btnGhostClass = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[#5b6472] transition hover:bg-[#f7f7f4]";

const initialDraft = {
  tipo: TIPOS_ACCION[0],
  nivel: "Operativa",
  titulo: "",
  descripcion: "",
  procesoId: "",
  subprocesoTexto: "",
  correccionOrigenId: "",
};

// Mismo desplegable compacto de selección múltiple ya usado en Seguimiento
// Estratégico (`StrategicFollowupModule.jsx`, `MultiSelectDropdown`) —
// replicado aquí en vez de importado entre módulos, siguiendo el patrón ya
// establecido de este proyecto de mantener los formularios de cada módulo
// autocontenidos (ver `ProyectoForm`/`AsignacionForm` en AccionDetailPanel.jsx).
function InvolucradosSelect({ personas, selectedIds, onToggle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const seleccionadas = personas.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex h-10 w-full items-center justify-between rounded-xl border border-[#edf0f4] bg-white px-3 text-left text-sm font-medium text-[#0f1f3d] outline-none transition focus:border-[#c9a227]"
      >
        <span className="truncate">{seleccionadas.length ? `${seleccionadas.length} seleccionado${seleccionadas.length > 1 ? "s" : ""}` : "Elige a quién avisar"}</span>
        <span className="shrink-0 text-[#94a3b8]">{open ? "▲" : "▼"}</span>
      </button>

      {seleccionadas.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {seleccionadas.map((p) => (
            <span key={p.id} className="rounded-full bg-[#0f1f3d] px-2 py-0.5 text-[10px] font-bold text-white">{p.nombre}</span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#edf0f4] bg-white p-1.5 shadow-xl">
          {personas.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-[#0f1f3d] hover:bg-[#f7f7f4]">
              <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => onToggle(p.id)} />
              {p.nombre}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Esta captura inicial es deliberadamente ligera: solo registra el
// problema/situación detectada. Responsable, prioridad y fecha compromiso
// se definen después, en la pestaña "Plan de acción" del detalle — una vez
// que ya se sabe (por el análisis de causa) qué acción concreta se necesita
// y quién la puede ejecutar, en vez de comprometerlos de entrada.
//
// `prefill` (opcional): llega cuando el alta se dispara desde otro módulo
// (hoy solo Calidad, ver shared.jsx DetalleRegistroModal → ActionsModule.jsx)
// — trae título/descripción/tipo/nivel ya redactados y el origen_modulo/
// origen_tabla/origen_id para trazabilidad, que se manda en onSave salvo que
// el usuario ligue esta acción a una Corrección existente (esa liga manda).
export default function NuevaAccionModal({ procesos, subprocesos, personas, acciones, prefill, onSave, onClose }) {
  const [draft, setDraft] = useState(() => (prefill ? { ...initialDraft, ...prefill } : initialDraft));
  const [involucradosIds, setInvolucradosIds] = useState([]);
  const [error, setError] = useState("");

  function toggleInvolucrado(id) {
    setInvolucradosIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  // El área/subproceso es texto libre (no toda situación real cae dentro
  // del catálogo capturado en Diseño Organizacional) pero se sugiere con las
  // áreas ya conocidas del proceso elegido, vía <datalist> — mismo patrón
  // que ya usa Catálogo Organizacional para "texto libre con sugerencias".
  // Si lo tecleado coincide con una de esas sugerencias, se liga además al
  // subproceso real (subprocesoId) para reportes; si no, se guarda solo el
  // texto.
  const procesoSeleccionado = procesos.find((p) => String(p.id) === String(draft.procesoId));
  const areasDisponibles = procesoSeleccionado
    ? (subprocesos || []).filter((s) => s.proceso === procesoSeleccionado.nombre)
    : [];

  function handleProcesoChange(value) {
    setDraft((current) => ({ ...current, procesoId: value, subprocesoTexto: "" }));
  }

  // HLS 10.2: la Acción Correctiva (eliminar la causa) suele nacer de una
  // Corrección (reacción inmediata) ya registrada — se ofrece ligarla,
  // opcional, solo cuando el tipo elegido es justo ese.
  const correcciones = (acciones || []).filter((a) => a.tipo === "Corrección" && a.estado !== "Cerrada");

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    if (!draft.titulo.trim()) {
      setError("Captura el problema o situación detectada.");
      return;
    }
    const correccionId = draft.tipo === "Acción Correctiva" && draft.correccionOrigenId ? Number(draft.correccionOrigenId) : null;
    const subprocesoTexto = draft.subprocesoTexto.trim();
    const areaCoincidente = subprocesoTexto
      ? areasDisponibles.find((s) => s.nombre.trim().toLowerCase() === subprocesoTexto.toLowerCase())
      : null;
    onSave({
      tipo: draft.tipo,
      nivel: draft.nivel,
      titulo: draft.titulo.trim(),
      descripcion: draft.descripcion.trim(),
      procesoId: draft.procesoId || null,
      subprocesoId: areaCoincidente?.id || null,
      subprocesoTexto: subprocesoTexto || null,
      responsablePersonaId: null,
      objetivoId: null,
      prioridad: "Media",
      fechaCompromiso: null,
      origenModulo: correccionId ? "Acciones de Mejora" : (prefill?.origenModulo || null),
      origenTabla: correccionId ? "acciones" : (prefill?.origenTabla || null),
      origenId: correccionId || prefill?.origenId || null,
      involucradosIds,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#edf0f4] bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Nueva acción</p>
            <p className="text-[10px] font-bold text-white/60">Registrar en Acciones de Mejora</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Tipo
              <select value={draft.tipo} onChange={(e) => update("tipo", e.target.value)} className={inputClass}>
                {TIPOS_ACCION.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Nivel
              <select value={draft.nivel} onChange={(e) => update("nivel", e.target.value)} className={inputClass}>
                {NIVELES_ACCION.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          <label className={labelClass}>
            Problema / situación detectada
            <input value={draft.titulo} onChange={(e) => update("titulo", e.target.value)} placeholder="Ej. Se detectó una desviación en el reporte de producción" className={inputClass} />
          </label>

          <label className={labelClass}>
            Descripción
            <textarea value={draft.descripcion} onChange={(e) => update("descripcion", e.target.value)} rows={2} placeholder="Contexto: qué pasó, dónde, cuándo se detectó" className={inputClass} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Proceso
              <select value={draft.procesoId} onChange={(e) => handleProcesoChange(e.target.value)} className={inputClass}>
                <option value="">Sin proceso</option>
                {procesos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Área / subproceso
              <input
                value={draft.subprocesoTexto}
                onChange={(e) => update("subprocesoTexto", e.target.value)}
                list="areas-subproceso-sugeridas"
                placeholder={procesoSeleccionado ? "Escribe el área específica..." : "Elige primero un proceso"}
                className={inputClass}
              />
              <datalist id="areas-subproceso-sugeridas">
                {areasDisponibles.map((s) => <option key={s.id} value={s.nombre.trim()} />)}
              </datalist>
            </label>
          </div>

          <label className={labelClass}>
            Involucrados (les llega notificación de esta acción)
            <InvolucradosSelect personas={personas || []} selectedIds={involucradosIds} onToggle={toggleInvolucrado} />
          </label>
          <p className="-mt-1 text-xs font-medium text-[#94a3b8]">El equipo estratégico (PM, Coordinador SIG, Analista de Procesos, Director General) se entera automáticamente, aunque no lo elijas aquí.</p>

          {draft.tipo === "Acción Correctiva" && correcciones.length > 0 && (
            <label className={labelClass}>
              ¿Corrección de origen? (opcional)
              <select value={draft.correccionOrigenId} onChange={(e) => update("correccionOrigenId", e.target.value)} className={inputClass}>
                <option value="">Sin ligar a una corrección</option>
                {correcciones.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.titulo}</option>)}
              </select>
            </label>
          )}

          <p className="text-xs font-medium text-[#94a3b8]">Responsable, prioridad y fecha compromiso se definen después, en "Plan de acción" — una vez identificada la causa.</p>

          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 border-t border-[#edf0f4] pt-3">
            <button type="button" onClick={onClose} className={btnGhostClass}>Cancelar</button>
            <button type="button" onClick={handleSave} className={btnPrimaryClass}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
