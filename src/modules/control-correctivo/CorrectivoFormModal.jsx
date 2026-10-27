import { useEffect, useMemo, useRef, useState } from "react";
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

// Filtro desplegable de selección múltiple: cerrado muestra un resumen de lo marcado
// y al abrirlo deja marcar varias opciones (con buscador cuando hay muchas).
// `opciones`: [{ id, texto, grupo? }]; `especial`: opción fija arriba (p. ej. "Todos los procesos").
function SelectorMultiple({ opciones, seleccion, onToggle, placeholder = "Seleccionar…", vacio, especial = null }) {
  const [abierto, setAbierto] = useState(false);
  const [buscar, setBuscar] = useState("");
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const marcadas = opciones.filter((o) => seleccion.includes(Number(o.id)));
  const resumen = especial?.activo
    ? especial.texto
    : marcadas.length === 0 ? "" : marcadas.length <= 2 ? marcadas.map((o) => o.texto).join(", ") : `${marcadas.length} seleccionados`;
  const filtradas = buscar.trim() ? opciones.filter((o) => o.texto.toLowerCase().includes(buscar.trim().toLowerCase())) : opciones;
  const grupos = [];
  filtradas.forEach((o) => {
    const g = o.grupo || "";
    let bloque = grupos.find((x) => x.g === g);
    if (!bloque) { bloque = { g, lista: [] }; grupos.push(bloque); }
    bloque.lista.push(o);
  });

  return (
    <div ref={caja} className="relative mt-1">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#d9dee6] bg-white px-3 py-2 text-left text-sm font-medium text-[#0f1f3d] outline-none transition hover:bg-[#fbfbf9] focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)]"
      >
        <span className={`truncate ${resumen ? "" : "text-[#94a3b8]"}`}>{resumen || placeholder}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {marcadas.length > 0 && !especial?.activo && <span className="rounded-full bg-[#0f1f3d] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">{marcadas.length}</span>}
          <span className={`text-[10px] text-[#94a3b8] transition ${abierto ? "rotate-180" : ""}`}>▼</span>
        </span>
      </button>
      {abierto && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-[#d9dee6] bg-white shadow-[0_12px_28px_-10px_rgba(11,31,58,0.35)]">
          {opciones.length > 8 && (
            <div className="border-b border-[#edf0f4] p-2">
              <input type="text" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" autoFocus className="w-full rounded-lg border border-[#edf0f4] bg-[#fbfbf9] px-2.5 py-1.5 text-xs outline-none focus:border-[#c9a227]" />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {especial && (
              <button type="button" role="option" aria-selected={especial.activo} onClick={especial.onToggle} className="flex w-full items-center gap-2 border-b border-[#edf0f4] px-3 py-1.5 text-left text-xs font-bold text-[#0f1f3d] hover:bg-[#f7f7f4]">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${especial.activo ? "border-[#0f1f3d] bg-[#0f1f3d] text-white" : "border-[#cbd2dc] bg-white"}`}>{especial.activo ? "✓" : ""}</span>
                {especial.texto}
              </button>
            )}
            {opciones.length === 0 && <p className="px-3 py-2 text-[11px] text-[#94a3b8]">{vacio}</p>}
            {opciones.length > 0 && filtradas.length === 0 && <p className="px-3 py-2 text-[11px] text-[#94a3b8]">Sin resultados.</p>}
            {grupos.map(({ g, lista }) => (
              <div key={g || "_"}>
                {g && <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">{g}</p>}
                {lista.map((o) => {
                  const activo = especial?.activo || seleccion.includes(Number(o.id));
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={activo}
                      disabled={Boolean(especial?.activo)}
                      onClick={() => onToggle(Number(o.id))}
                      className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs font-medium text-[#0f1f3d] hover:bg-[#f7f7f4] disabled:cursor-default disabled:text-[#94a3b8] disabled:hover:bg-transparent"
                    >
                      <span className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${activo ? "border-[#0f1f3d] bg-[#0f1f3d] text-white" : "border-[#cbd2dc] bg-white"}`}>{activo ? "✓" : ""}</span>
                      <span>{o.texto}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
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
                <SelectorMultiple opciones={procesos.map((p) => ({ id: p.id, texto: p.nombre }))} seleccion={form.procesos_ids} onToggle={alternarProceso} placeholder="Seleccionar procesos…" vacio="No hay procesos en el catálogo." />
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
                <SelectorMultiple
                  opciones={procesos.filter((p) => (multiples ? !form.procesos_ids.includes(Number(p.id)) : String(p.id) !== form.proceso_id)).map((p) => ({ id: p.id, texto: p.nombre }))}
                  seleccion={form.procesos_involucrados_ids}
                  onToggle={(id) => alternarEn("procesos_involucrados_ids", id)}
                  placeholder="Ninguno · seleccionar procesos…"
                  vacio="No hay más procesos."
                  especial={{ texto: "Todos los procesos", activo: form.todos_procesos, onToggle: () => setField("todos_procesos", !form.todos_procesos) }}
                />
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
                  <SelectorMultiple opciones={opcionesLider.map((p) => ({ id: p.id, texto: p.nombre }))} seleccion={form.lideres_ids} onToggle={(id) => alternarEn("lideres_ids", id)} placeholder="Seleccionar líderes…" vacio="No hay líderes de proceso." />
                </div>
                <div>
                  <p className={labelClass}>Supervisor ejecutor <span className="normal-case tracking-normal">(opcional, uno o varios)</span></p>
                  <SelectorMultiple opciones={supervisores.map((p) => ({ id: p.id, texto: p.nombre }))} seleccion={form.supervisores_ids} onToggle={(id) => alternarEn("supervisores_ids", id)} placeholder="Sin asignar · seleccionar supervisores…" vacio="No hay supervisores." />
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
                    <SelectorMultiple opciones={directricesPropias.map((d) => ({ id: d.id, texto: d.nombre }))} seleccion={form.directrices_propias_ids} onToggle={(id) => alternarEn("directrices_propias_ids", id)} placeholder="Seleccionar directrices…" vacio="Aún no hay directrices: agrega la primera." />
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
                <SelectorMultiple
                  opciones={directricesPorPerspectiva.flatMap(([perspectiva, lista]) => lista.map((d) => ({ id: d.id, texto: `${d.codigo} · ${d.titulo}`, grupo: perspectiva })))}
                  seleccion={form.directrices_ids}
                  onToggle={(id) => alternarEn("directrices_ids", id)}
                  placeholder="Opcional · seleccionar objetivos…"
                  vacio="No hay objetivos cargados."
                />
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
