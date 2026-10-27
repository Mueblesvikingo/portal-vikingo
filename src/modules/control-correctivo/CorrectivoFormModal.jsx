import { useMemo, useState } from "react";
import { TIPOS_BRECHA, PRIORIDADES, hoyISO, mismaPersona, procesosDe, lideresDe, supervisoresDe } from "../../services/controlCorrectivoService";
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

// Selección múltiple con botones que se marcan, igual que "Otros procesos involucrados".
function Chips({ opciones, seleccion, onToggle, activoClass, vacio }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {opciones.length === 0 && <span className="text-[11px] text-[#94a3b8]">{vacio}</span>}
      {opciones.map((o) => {
        const activo = seleccion.includes(Number(o.id));
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onToggle(Number(o.id))}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${activo ? activoClass : "border-[#d9dee6] bg-white text-[#5b6472] hover:bg-[#f7f7f4]"}`}
          >
            {activo ? "✓ " : ""}{o.nombre}
          </button>
        );
      })}
    </div>
  );
}

// Alta y edición de una acción correctiva. Campos pedidos por la PM: proceso,
// tipo de brecha, causa raíz, acción correctiva, líder responsable, supervisor
// ejecutor, prioridad, fecha compromiso, avance (0 a 100) y eficiencia
// operativa. Se agrega "Fecha de inicio" para que el Gantt pueda dibujar
// barras con principio y fin.
// Ajustes de la PM (26-oct-2026): nombre de la acción (lo que muestra el Gantt),
// otros procesos involucrados (con opción "Todos los procesos") y las
// directrices estratégicas que atiende (una acción puede atender varias).
// Esos tres campos necesitan sql/2026-10-control_correctivo_v2.sql (`extendido`).
// Ajuste de la PM (27-oct-2026): proceso, líder y supervisor admiten varias
// opciones; necesita sql/2026-10-control_correctivo_v4.sql (`multiples`).
export default function CorrectivoFormModal({ item, procesos, lideres, supervisores, directrices = [], extendido = false, multiples = false, directricesPropias = [], propiasDisponible = false, onCrearDirectriz, nombrePersona, onSave, onClose, onDelete }) {
  const [nuevaDirectriz, setNuevaDirectriz] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [errorDirectriz, setErrorDirectriz] = useState("");
  const esEdicion = Boolean(item?.id);
  const [form, setForm] = useState(() => ({
    proceso_id: item?.proceso_id != null ? String(item.proceso_id) : "",
    tipo_brecha: item?.tipo_brecha || "",
    nombre_accion: item?.nombre_accion || "",
    todos_procesos: Boolean(item?.todos_procesos),
    procesos_involucrados_ids: (item?.procesos_involucrados_ids || []).map(Number),
    directrices_ids: (item?.directrices_ids || []).map(Number),
    directrices_propias_ids: (item?.directrices_propias_ids || []).map(Number),
    causa_raiz: item?.causa_raiz || "",
    accion_correctiva: item?.accion_correctiva || "",
    lider_persona_id: item?.lider_persona_id != null ? String(item.lider_persona_id) : "",
    supervisor_persona_id: item?.supervisor_persona_id != null ? String(item.supervisor_persona_id) : "",
    procesos_ids: procesosDe(item),
    lideres_ids: lideresDe(item),
    supervisores_ids: supervisoresDe(item),
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

  // Versión de varios procesos: mismo criterio de sugerencia, y el proceso
  // marcado como principal sale de "Otros procesos involucrados".
  function alternarProceso(id) {
    setForm((f) => {
      const quitar = f.procesos_ids.includes(id);
      const procesos_ids = quitar ? f.procesos_ids.filter((x) => x !== id) : [...f.procesos_ids, id];
      const proceso = quitar ? null : procesoPorId.get(String(id));
      const sugerido = !f.lideres_ids.length && proceso ? lideres.find((l) => mismaPersona(l.nombreOriginal, proceso.responsable)) : null;
      return {
        ...f,
        procesos_ids,
        procesos_involucrados_ids: f.procesos_involucrados_ids.filter((x) => !procesos_ids.includes(x)),
        lideres_ids: sugerido ? [Number(sugerido.id)] : f.lideres_ids,
      };
    });
  }

  // La directriz nueva se guarda en el catálogo y queda marcada en esta acción.
  async function agregarDirectriz() {
    if (!onCrearDirectriz || !nuevaDirectriz.trim()) return;
    setAgregando(true);
    setErrorDirectriz("");
    try {
      const creada = await onCrearDirectriz(nuevaDirectriz);
      setForm((f) => ({ ...f, directrices_propias_ids: [...f.directrices_propias_ids, Number(creada.id)] }));
      setNuevaDirectriz("");
    } catch (err) {
      setErrorDirectriz(err?.message || "No se pudo agregar la directriz.");
    } finally {
      setAgregando(false);
    }
  }

  function alternarEn(campo, id) {
    setForm((f) => ({ ...f, [campo]: f[campo].includes(id) ? f[campo].filter((x) => x !== id) : [...f[campo], id] }));
  }

  // Si el líder guardado ya no está en la lista (p. ej. Hugo, quitado a pedido
  // de la PM), se conserva como opción para no bloquear la edición de esa acción.
  const opcionesLider = useMemo(() => {
    const faltantes = lideresDe(item).filter((id) => !lideres.some((l) => Number(l.id) === id));
    if (!faltantes.length) return lideres;
    return [...lideres, ...faltantes.map((id) => ({ id, nombre: `${nombrePersona ? nombrePersona(id) : "Líder actual"} (ya no es líder)` }))];
  }, [lideres, item, nombrePersona]);

  const directricesPorPerspectiva = useMemo(() => {
    const grupos = new Map();
    directrices.forEach((d) => {
      const clave = d.perspectiva || "General";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(d);
    });
    return [...grupos.entries()];
  }, [directrices]);

  function validar() {
    if (multiples ? !form.procesos_ids.length : !form.proceso_id) return "Selecciona el proceso.";
    if (!form.tipo_brecha) return "Selecciona el tipo de brecha.";
    if (extendido && !form.nombre_accion.trim()) return "Escribe el nombre de la acción.";
    if (!form.causa_raiz.trim()) return "Escribe la causa raíz.";
    if (!form.accion_correctiva.trim()) return "Escribe la acción correctiva.";
    if (multiples ? !form.lideres_ids.length : !form.lider_persona_id) return "Selecciona el líder responsable.";
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
          {!extendido && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              Para usar el nombre de la acción, los procesos involucrados y las directrices estratégicas, ejecuta una vez <span className="font-black">sql/2026-10-control_correctivo_v2.sql</span> en el SQL Editor de Supabase y recarga la página.
            </div>
          )}
          <Bloque icono="📍" titulo="¿Dónde ocurre?" tono="sky">
            {multiples ? (
              <>
                <p className={labelClass}>Proceso <span className="normal-case tracking-normal">(uno o varios)</span></p>
                <Chips opciones={procesos} seleccion={form.procesos_ids} onToggle={alternarProceso} activoClass="border-[#0f1f3d] bg-[#0f1f3d] text-white" vacio="No hay procesos en el catálogo." />
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    Tipo de brecha
                    <select value={form.tipo_brecha} onChange={(e) => setField("tipo_brecha", e.target.value)} className={inputClass}>
                      <option value="">Seleccionar…</option>
                      {TIPOS_BRECHA.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                </div>
              </>
            ) : (
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
            )}
            {extendido && (
              <div className="mt-3">
                <p className={labelClass}>Otros procesos involucrados</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    aria-pressed={form.todos_procesos}
                    onClick={() => setField("todos_procesos", !form.todos_procesos)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${form.todos_procesos ? "border-[#0f1f3d] bg-[#0f1f3d] text-white" : "border-[#d9dee6] bg-white text-[#0f1f3d] hover:bg-[#f7f7f4]"}`}
                  >
                    {form.todos_procesos ? "✓ " : ""}Todos los procesos
                  </button>
                  {procesos.filter((p) => (multiples ? !form.procesos_ids.includes(Number(p.id)) : String(p.id) !== form.proceso_id)).map((p) => {
                    const activo = form.todos_procesos || form.procesos_involucrados_ids.includes(Number(p.id));
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={activo}
                        disabled={form.todos_procesos}
                        onClick={() => alternarEn("procesos_involucrados_ids", Number(p.id))}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-default ${activo ? "border-sky-300 bg-sky-100 text-sky-800" : "border-[#d9dee6] bg-white text-[#5b6472] hover:bg-[#f7f7f4]"}`}
                      >
                        {p.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Bloque>

          <Bloque icono="🔍" titulo="Qué pasó y qué se hará" tono="amber">
            <div className="space-y-3">
              {extendido && (
                <label className={labelClass}>
                  Nombre de la acción
                  <input type="text" value={form.nombre_accion} maxLength={80} onChange={(e) => setField("nombre_accion", e.target.value)} placeholder="Nombre corto: es el que se ve en el Gantt" className={inputClass} />
                </label>
              )}
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
            {multiples ? (
              <div className="space-y-3">
                <div>
                  <p className={labelClass}>Líder responsable <span className="normal-case tracking-normal">(uno o varios)</span></p>
                  <Chips opciones={opcionesLider} seleccion={form.lideres_ids} onToggle={(id) => alternarEn("lideres_ids", id)} activoClass="border-violet-400 bg-violet-100 text-violet-900" vacio="No hay líderes de proceso." />
                </div>
                <div>
                  <p className={labelClass}>Supervisor ejecutor <span className="normal-case tracking-normal">(opcional, uno o varios)</span></p>
                  <Chips opciones={supervisores} seleccion={form.supervisores_ids} onToggle={(id) => alternarEn("supervisores_ids", id)} activoClass="border-violet-300 bg-violet-50 text-violet-800" vacio="No hay supervisores." />
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Líder responsable
                <select value={form.lider_persona_id} onChange={(e) => setField("lider_persona_id", e.target.value)} className={inputClass}>
                  <option value="">Seleccionar…</option>
                  {opcionesLider.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
            )}
          </Bloque>

          {extendido && (
            <Bloque icono="🎯" titulo="Directrices estratégicas que atiende" tono="sky">
              <div className="mb-3 border-b border-sky-100 pb-3">
                <p className={labelClass}>Directrices</p>
                {!propiasDisponible ? (
                  <p className="mt-1 text-[11px] font-semibold text-amber-800">Para agregar directrices propias, ejecuta una vez <span className="font-black">sql/2026-10-control_correctivo_v3.sql</span> en el SQL Editor de Supabase y recarga la página.</p>
                ) : (
                  <>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {directricesPropias.length === 0 && <span className="text-[11px] text-[#94a3b8]">Aún no hay directrices: agrega la primera.</span>}
                      {directricesPropias.map((d) => {
                        const activo = form.directrices_propias_ids.includes(Number(d.id));
                        return (
                          <button
                            key={d.id}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => alternarEn("directrices_propias_ids", Number(d.id))}
                            className={`max-w-full rounded-full border px-2.5 py-1 text-left text-[11px] font-semibold transition ${activo ? "border-sky-400 bg-sky-100 text-sky-900" : "border-[#d9dee6] bg-white text-[#5b6472] hover:bg-[#f7f7f4]"}`}
                          >
                            {d.nombre}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={nuevaDirectriz}
                        maxLength={120}
                        onChange={(e) => setNuevaDirectriz(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarDirectriz(); } }}
                        placeholder="Nueva directriz"
                        className={`${inputClass} mt-0 py-1.5 text-xs`}
                      />
                      <button type="button" onClick={agregarDirectriz} disabled={agregando || !nuevaDirectriz.trim()} className="shrink-0 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-800 transition hover:bg-sky-50 disabled:opacity-50">
                        {agregando ? "Agregando…" : "+ Agregar directriz"}
                      </button>
                    </div>
                    {errorDirectriz && <p className="mt-1 text-[11px] font-semibold text-red-600">{errorDirectriz}</p>}
                  </>
                )}
              </div>
              <p className={labelClass}>Objetivos estratégicos <span className="normal-case tracking-normal">(opcional)</span></p>
              {directricesPorPerspectiva.length === 0 ? (
                <p className="text-xs text-[#5b6472]">No hay objetivos cargados en Despliegue Estratégico.</p>
              ) : (
                <div className="mt-1.5 space-y-2.5">
                  {directricesPorPerspectiva.map(([perspectiva, lista]) => (
                    <div key={perspectiva}>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">{perspectiva}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {lista.map((d) => {
                          const activo = form.directrices_ids.includes(Number(d.id));
                          return (
                            <button
                              key={d.id}
                              type="button"
                              aria-pressed={activo}
                              onClick={() => alternarEn("directrices_ids", Number(d.id))}
                              title={d.titulo}
                              className={`max-w-full rounded-full border px-2.5 py-1 text-left text-[11px] font-semibold transition ${activo ? "border-[#c9a227] bg-[#fbf6e3] text-[#7a5f0c]" : "border-[#d9dee6] bg-white text-[#5b6472] hover:bg-[#f7f7f4]"}`}
                            >
                              <span className="font-black">{d.codigo}</span> · {d.titulo}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] font-semibold text-[#94a3b8]">{form.directrices_ids.length === 0 ? "Opcional: marca los objetivos a los que contribuye la acción." : `${form.directrices_ids.length} objetivo(s) seleccionado(s).`}</p>
                </div>
              )}
            </Bloque>
          )}

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
