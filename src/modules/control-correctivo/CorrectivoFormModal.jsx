import { useMemo, useState } from "react";
import { TIPOS_BRECHA, PRIORIDADES, hoyISO, mismaPersona } from "../../services/controlCorrectivoService";
import { cardClass, inputClass, labelClass, btnPrimaryClass, btnGhostClass } from "./ccHelpers";
import AvanceSlider from "./AvanceSlider";

// Alta y edición de una acción correctiva. Campos pedidos por la PM: proceso,
// tipo de brecha, causa raíz, acción correctiva, líder responsable, supervisor
// ejecutor, prioridad, fecha compromiso, avance (0 a 100) y eficiencia
// operativa (resultado). Se agrega "Fecha de inicio" para que el Gantt pueda
// dibujar barras con principio y fin.
export default function CorrectivoFormModal({ item, procesos, lideres, supervisores, onSave, onClose, onDelete }) {
  const esEdicion = Boolean(item?.id);
  const [form, setForm] = useState(() => ({
    proceso_id: item?.proceso_id != null ? String(item.proceso_id) : "",
    tipo_brecha: item?.tipo_brecha || "",
    causa_raiz: item?.causa_raiz || "",
    accion_correctiva: item?.accion_correctiva || "",
    lider_persona_id: item?.lider_persona_id != null ? String(item.lider_persona_id) : "",
    supervisor_persona_id: item?.supervisor_persona_id != null ? String(item.supervisor_persona_id) : "",
    prioridad: item?.prioridad || "Media",
    fecha_inicio: item?.fecha_inicio || hoyISO(),
    fecha_compromiso: item?.fecha_compromiso || "",
    avance: item?.avance ?? 0,
    eficiencia_operativa: item?.eficiencia_operativa || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const procesoPorId = useMemo(() => new Map(procesos.map((p) => [String(p.id), p])), [procesos]);

  function setField(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Al elegir proceso, si todavía no hay líder, se sugiere el responsable del
  // proceso cuando también tiene el rol de líder.
  function elegirProceso(valor) {
    setForm((f) => {
      const proceso = procesoPorId.get(valor);
      const sugerido = !f.lider_persona_id && proceso ? lideres.find((l) => mismaPersona(l.nombreOriginal, proceso.responsable)) : null;
      return { ...f, proceso_id: valor, lider_persona_id: sugerido ? String(sugerido.id) : f.lider_persona_id };
    });
  }

  function validar() {
    if (!form.proceso_id) return "Selecciona el proceso.";
    if (!form.tipo_brecha) return "Selecciona el tipo de brecha.";
    if (!form.causa_raiz.trim()) return "Escribe la causa raíz.";
    if (!form.accion_correctiva.trim()) return "Escribe la acción correctiva.";
    if (!form.lider_persona_id) return "Selecciona el líder responsable.";
    if (!form.fecha_inicio || !form.fecha_compromiso) return "Captura la fecha de inicio y la fecha compromiso.";
    if (form.fecha_compromiso < form.fecha_inicio) return "La fecha compromiso no puede ser anterior a la de inicio.";
    return "";
  }

  async function guardar() {
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      console.error("Error al guardar acción correctiva:", err);
      setError("No se pudo guardar. Revisa la conexión e inténtalo de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3">
      <div className={`${cardClass} flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#edf0f4] px-4 py-3">
          <p className="text-sm font-bold text-[#0f1f3d]">{esEdicion ? "Editar acción correctiva" : "Nueva acción correctiva"}</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg px-2 py-1 text-[#94a3b8] hover:bg-[#f7f7f4]">✕</button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
          <label className={labelClass}>
            Proceso
            <select value={form.proceso_id} onChange={(e) => elegirProceso(e.target.value)} className={inputClass}>
              <option value="">Seleccionar…</option>
              {procesos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Tipo de brecha
            <select value={form.tipo_brecha} onChange={(e) => setField("tipo_brecha", e.target.value)} className={inputClass}>
              <option value="">Seleccionar…</option>
              {TIPOS_BRECHA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Causa raíz
            <textarea value={form.causa_raiz} onChange={(e) => setField("causa_raiz", e.target.value)} rows={3} className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Acción correctiva
            <textarea value={form.accion_correctiva} onChange={(e) => setField("accion_correctiva", e.target.value)} rows={3} className={inputClass} />
          </label>
          <label className={labelClass}>
            Líder responsable
            <select value={form.lider_persona_id} onChange={(e) => setField("lider_persona_id", e.target.value)} className={inputClass}>
              <option value="">Seleccionar…</option>
              {lideres.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Supervisor ejecutor
            <select value={form.supervisor_persona_id} onChange={(e) => setField("supervisor_persona_id", e.target.value)} className={inputClass}>
              <option value="">Sin asignar</option>
              {supervisores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Prioridad
            <select value={form.prioridad} onChange={(e) => setField("prioridad", e.target.value)} className={inputClass}>
              {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Fecha de inicio
              <input type="date" value={form.fecha_inicio} onChange={(e) => setField("fecha_inicio", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Fecha compromiso
              <input type="date" value={form.fecha_compromiso} min={form.fecha_inicio || undefined} onChange={(e) => setField("fecha_compromiso", e.target.value)} className={inputClass} />
            </label>
          </div>
          <div className="sm:col-span-2">
            <p className={labelClass}>Avance reportado</p>
            <div className="mt-1 rounded-xl border border-[#edf0f4] px-3 py-2">
              <AvanceSlider value={form.avance} prioridad={form.prioridad} onCommit={(v) => setField("avance", v)} />
            </div>
          </div>
          <label className={`${labelClass} sm:col-span-2`}>
            Eficiencia operativa
            <textarea value={form.eficiencia_operativa} onChange={(e) => setField("eficiencia_operativa", e.target.value)} rows={3} placeholder="Resultado de la eficiencia operativa del proceso" className={inputClass} />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f4] px-4 py-3">
          <div>
            {esEdicion && onDelete && (
              <button type="button" onClick={onDelete} disabled={saving} className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">Eliminar</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs font-medium text-red-600">{error}</span>}
            <button type="button" onClick={onClose} disabled={saving} className={btnGhostClass}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={saving} className={btnPrimaryClass}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
