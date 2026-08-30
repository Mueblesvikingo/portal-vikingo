import { useState } from "react";
import { TIPOS_ACCION, NIVELES_ACCION } from "./actionsHelpers";

const initialDraft = {
  tipo: TIPOS_ACCION[0],
  nivel: "Operativa",
  titulo: "",
  descripcion: "",
  procesoId: "",
  objetivoId: "",
};

// Esta captura inicial es deliberadamente ligera: solo registra el
// problema/situación detectada. Responsable, prioridad y fecha compromiso
// se definen después, en la pestaña "Plan de acción" del detalle — una vez
// que ya se sabe (por el análisis de causa) qué acción concreta se necesita
// y quién la puede ejecutar, en vez de comprometerlos de entrada.
export default function NuevaAccionModal({ procesos, personas, objetivos, onSave, onClose }) {
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState("");

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    if (!draft.titulo.trim()) {
      setError("Captura el problema o situación detectada.");
      return;
    }
    onSave({
      tipo: draft.tipo,
      nivel: draft.nivel,
      titulo: draft.titulo.trim(),
      descripcion: draft.descripcion.trim(),
      procesoId: draft.procesoId || null,
      responsablePersonaId: null,
      objetivoId: draft.objetivoId || null,
      prioridad: "Media",
      fechaCompromiso: null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Nueva acción</p>
            <p className="text-[10px] font-bold text-slate-300">Registrar en Acciones de Mejora</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Tipo
              <select value={draft.tipo} onChange={(e) => update("tipo", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                {TIPOS_ACCION.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Nivel
              <select value={draft.nivel} onChange={(e) => update("nivel", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                {NIVELES_ACCION.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Problema / situación detectada
            <input value={draft.titulo} onChange={(e) => update("titulo", e.target.value)} placeholder="Ej. Se detectó una desviación en el reporte de producción" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>

          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Descripción
            <textarea value={draft.descripcion} onChange={(e) => update("descripcion", e.target.value)} rows={2} placeholder="Contexto: qué pasó, dónde, cuándo se detectó" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Proceso
              <select value={draft.procesoId} onChange={(e) => update("procesoId", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                <option value="">Sin proceso</option>
                {procesos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Objetivo estratégico
              <select value={draft.objetivoId} onChange={(e) => update("objetivoId", e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                <option value="">Sin vincular</option>
                {objetivos.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}
              </select>
            </label>
          </div>

          <p className="text-[10px] font-semibold text-slate-400">Responsable, prioridad y fecha compromiso se definen después, en "Plan de acción" — una vez identificada la causa.</p>

          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">Cancelar</button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
