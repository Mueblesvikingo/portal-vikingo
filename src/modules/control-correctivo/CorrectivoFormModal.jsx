import { useMemo, useState } from "react";
import { TIPOS_BRECHA, PRIORIDADES, hoyISO, mismaPersona } from "../../services/controlCorrectivoService";
import { inputClass, labelClass, btnPrimaryClass, btnGhostClass, PRIORIDAD_COLOR } from "./ccHelpers";
import AvanceSlider from "./AvanceSlider";

// Cada bloque agrupa campos afines con un tinte suave propio (sin saturar):
// el color orienta la lectura, no comunica estado.
const TONOS = {
  sky: { caja: "border-sky-100 bg-sky-50/70", titulo: "text-sky-800", icono: "bg-sky-100" },
  amber: { caja: "border-amber-100 bg-amber-50/70", titulo: "text-amber-800", icono: "bg-amber-100" },
  violet: { caja: "border-violet-100 bg-violet-50/70", titulo: "text-violet-800", icono: "bg-violet-100" },
  emerald: { caja: "border-emerald-100 bg-emerald-50/70", titulo: "text-emerald-800", icono: "bg-emerald-100" },
  gold: { caja: "border-[#efe2b4] bg-[#fbf6e3]", titulo: "text-[#7a5f0c]", icono: "bg-[#f3e6b3]" },
};

function Bloque({ icono, titulo, tono, children }) {
  const t = TONOS[tono];
  return (
    <section className={`rounded-xl border p-3.5 ${t.caja}`}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${t.icono}`}>{icono}</span>
        <p className={`text-[11px] font-black uppercase tracking-wider ${t.titulo}`}>{titulo}</p>
      </div>
      {children}
    </section>
  );
}

// Alta y edición de una acción correctiva. Campos pedidos por la PM: proceso,
// tipo de brecha, causa raíz, acción correctiva, líder responsable, supervisor
// ejecutor, prioridad, fecha compromiso, avance (0 a 100) y eficiencia
// operativa. Se agrega "Fecha de inicio" para que el Gantt pueda dibujar
// barras con principio y fin.
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
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_-12px_rgba(11,31,58,0.45)]">
        <div className="flex items-start justify-between bg-[#0f1f3d] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a227]">Control Correctivo</p>
            <p className="text-lg font-black text-white">{esEdicion ? "Editar acción correctiva" : "Nueva acción correctiva"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#fbfbf9] p-4">
          <Bloque icono="📍" titulo="¿Dónde ocurre?" tono="sky">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
          </Bloque>

          <Bloque icono="🔍" titulo="Qué pasó y qué se hará" tono="amber">
            <div className="space-y-3">
              <label className={labelClass}>
                Causa raíz
                <textarea value={form.causa_raiz} onChange={(e) => setField("causa_raiz", e.target.value)} rows={3} className={inputClass} />
              </label>
              <label className={labelClass}>
                Acción correctiva
                <textarea value={form.accion_correctiva} onChange={(e) => setField("accion_correctiva", e.target.value)} rows={3} className={inputClass} />
              </label>
            </div>
          </Bloque>

          <Bloque icono="👥" titulo="Quién lo atiende" tono="violet">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
          </Bloque>

          <Bloque icono="📅" titulo="Cuándo y con qué prioridad" tono="emerald">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                Prioridad
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-2.5 w-2.5 -translate-y-1/2 rounded-full" style={{ background: PRIORIDAD_COLOR[form.prioridad] }} />
                  <select value={form.prioridad} onChange={(e) => setField("prioridad", e.target.value)} className={`${inputClass} pl-8`}>
                    {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </span>
              </label>
              <label className={labelClass}>
                Fecha de inicio
                <input type="date" value={form.fecha_inicio} onChange={(e) => setField("fecha_inicio", e.target.value)} className={inputClass} />
              </label>
              <label className={labelClass}>
                Fecha compromiso
                <input type="date" value={form.fecha_compromiso} min={form.fecha_inicio || undefined} onChange={(e) => setField("fecha_compromiso", e.target.value)} className={inputClass} />
              </label>
            </div>
          </Bloque>

          <Bloque icono="📈" titulo="Avance y resultado" tono="gold">
            <div className="space-y-3">
              <div>
                <p className={labelClass}>Avance reportado</p>
                <div className="mt-1 rounded-xl border border-[#edf0f4] bg-white px-3 py-2.5">
                  <AvanceSlider value={form.avance} prioridad={form.prioridad} onCommit={(v) => setField("avance", v)} />
                </div>
              </div>
              <label className={labelClass}>
                Eficiencia operativa
                <textarea value={form.eficiencia_operativa} onChange={(e) => setField("eficiencia_operativa", e.target.value)} rows={3} placeholder="Resultado de la eficiencia operativa del proceso" className={inputClass} />
              </label>
            </div>
          </Bloque>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f4] bg-white px-5 py-3">
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
