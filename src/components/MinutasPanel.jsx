import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabase";
import { isStrategicTeamMember } from "../services/permissionsService";
import { getMinutas, getMinutaDetalle, createMinuta, addPunto, removePunto, firmarMinuta, downloadMinutaPdfPreview } from "../services/minutasService";

const MINUTA_TIPOS = [
  { value: "Acuerdo", icon: "📝", accent: "border-sky-200 bg-sky-50 text-sky-700", solid: "bg-sky-600" },
  { value: "Seguimiento", icon: "🔄", accent: "border-emerald-200 bg-emerald-50 text-emerald-700", solid: "bg-emerald-600" },
  { value: "Revisión", icon: "🔍", accent: "border-amber-200 bg-amber-50 text-amber-700", solid: "bg-amber-600" },
];
function minutaTipoInfo(tipo) {
  return MINUTA_TIPOS.find((t) => t.value === tipo) || MINUTA_TIPOS[0];
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

// Desplegable compacto de selección múltiple — mismo patrón ya usado en
// Seguimiento Estratégico y en Acciones de Mejora.
function MultiSelectDropdown({ options, selectedIds, onToggle, placeholder = "Selecciona..." }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.filter((o) => selectedIds.includes(o.id));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[12px] font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-sky-300"
      >
        <span className="truncate">{selected.length ? `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}` : placeholder}</span>
        <span className="shrink-0 text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((p) => (
            <span key={p.id} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white">{p.nombre}</span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {options.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-bold normal-case tracking-normal text-slate-700 hover:bg-slate-50">
              <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => onToggle(p.id)} />
              {p.nombre}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Minutas con firma digital — extraído de Seguimiento Estratégico para que
// cualquier módulo pueda ofrecer exactamente la misma función (crear,
// listar/filtrar, agregar puntos, firmar y cerrar con PDF) sin duplicar
// código. `modulo` distingue el origen de cada minuta en Supabase
// (columna `seguimiento_minutas.modulo`) y ajusta el encabezado del PDF
// (ver minutasService.js) — todo lo demás es idéntico entre módulos.
export default function MinutasPanel({ currentUser, modulo, procesoOptions = [] }) {
  const canManageMinutas = isStrategicTeamMember(currentUser);
  const [minutas, setMinutas] = useState(null);
  const [minutaParticipanteOptions, setMinutaParticipanteOptions] = useState([]);
  const [minutasLoading, setMinutasLoading] = useState(false);
  const [minutaMessage, setMinutaMessage] = useState("");
  const [minutaCreating, setMinutaCreating] = useState(false);
  const emptyMinutaDraft = { tipo: "Acuerdo", titulo: "", fecha: toDateInput(new Date()), procesoRelacionado: "", participantesPersonaIds: [], puntos: [{ descripcion: "", acuerdo: "", responsablePersonaId: "", fechaCompromiso: "" }] };
  const [minutaNewDraft, setMinutaNewDraft] = useState(emptyMinutaDraft);
  const [selectedMinutaId, setSelectedMinutaId] = useState(null);
  const [selectedMinuta, setSelectedMinuta] = useState(null);
  const [nuevoPuntoDraft, setNuevoPuntoDraft] = useState({ descripcion: "", acuerdo: "", responsablePersonaId: "", fechaCompromiso: "" });
  const [minutaFiltroPersona, setMinutaFiltroPersona] = useState("");
  const [minutaFiltroProceso, setMinutaFiltroProceso] = useState("");
  const [minutaFiltroDesde, setMinutaFiltroDesde] = useState("");
  const [minutaFiltroHasta, setMinutaFiltroHasta] = useState("");

  const minutaProcesosDisponibles = useMemo(
    () => [...new Set((minutas || []).map((m) => m.proceso_relacionado).filter(Boolean))],
    [minutas]
  );

  const minutasFiltradas = useMemo(() => {
    return (minutas || []).filter((m) => {
      if (minutaFiltroPersona && !m.participantes.some((p) => String(p.persona_id) === String(minutaFiltroPersona))) return false;
      if (minutaFiltroProceso && m.proceso_relacionado !== minutaFiltroProceso) return false;
      if (minutaFiltroDesde && m.fecha < minutaFiltroDesde) return false;
      if (minutaFiltroHasta && m.fecha > minutaFiltroHasta) return false;
      return true;
    });
  }, [minutas, minutaFiltroPersona, minutaFiltroProceso, minutaFiltroDesde, minutaFiltroHasta]);

  async function loadMinutasList() {
    setMinutasLoading(true);
    const list = await getMinutas(modulo);
    setMinutas(list);
    setMinutasLoading(false);
  }

  // Catálogo aparte, solo con personas reales (excluye placeholders como
  // "Cliente", "Externo", "Falta por definir" que sí aparecen en el
  // catálogo general de `people`) — no tiene sentido que esos "firmen".
  async function loadMinutaParticipanteOptions() {
    const { data, error } = await supabase.from("personas").select("id,nombre").eq("tipo", "persona").eq("activo", true).order("nombre");
    if (error) { console.error("Error al cargar personas para minutas:", error); return; }
    setMinutaParticipanteOptions(data || []);
  }

  useEffect(() => {
    loadMinutasList();
    loadMinutaParticipanteOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo]);

  async function openMinuta(minutaId) {
    setSelectedMinutaId(minutaId);
    const detalle = await getMinutaDetalle(minutaId);
    setSelectedMinuta(detalle);
  }

  async function refreshSelectedMinuta() {
    if (!selectedMinutaId) return;
    const detalle = await getMinutaDetalle(selectedMinutaId);
    setSelectedMinuta(detalle);
    setMinutas((current) => (current || []).map((m) => (m.id === selectedMinutaId ? { ...m, ...detalle } : m)));
  }

  async function handleCreateMinuta() {
    if (!minutaNewDraft.titulo.trim()) { setMinutaMessage("Ponle un título a la minuta."); return; }
    if (!minutaNewDraft.participantesPersonaIds.length) { setMinutaMessage("Selecciona al menos un participante."); return; }
    const result = await createMinuta(minutaNewDraft, currentUser, modulo);
    if (!result.ok) { console.error(result.error); setMinutaMessage("No fue posible crear la minuta."); return; }
    setMinutaCreating(false);
    setMinutaNewDraft(emptyMinutaDraft);
    await loadMinutasList();
    openMinuta(result.data.id);
  }

  function toggleParticipante(personaId) {
    setMinutaNewDraft((draft) => {
      const exists = draft.participantesPersonaIds.includes(personaId);
      return { ...draft, participantesPersonaIds: exists ? draft.participantesPersonaIds.filter((id) => id !== personaId) : [...draft.participantesPersonaIds, personaId] };
    });
  }

  function updateDraftPunto(index, field, value) {
    setMinutaNewDraft((draft) => ({ ...draft, puntos: draft.puntos.map((p, i) => (i === index ? { ...p, [field]: value } : p)) }));
  }

  async function handleAddPuntoExistente() {
    if (!nuevoPuntoDraft.descripcion.trim()) return;
    const result = await addPunto(selectedMinutaId, { ...nuevoPuntoDraft, orden: selectedMinuta?.puntos?.length || 0 });
    if (!result.ok) { console.error(result.error); setMinutaMessage("No fue posible agregar el punto."); return; }
    setNuevoPuntoDraft({ descripcion: "", acuerdo: "", responsablePersonaId: "", fechaCompromiso: "" });
    refreshSelectedMinuta();
  }

  async function handleRemovePuntoExistente(puntoId) {
    const result = await removePunto(puntoId);
    if (!result.ok) { console.error(result.error); setMinutaMessage("No fue posible quitar el punto."); return; }
    refreshSelectedMinuta();
  }

  async function handleFirmar() {
    const result = await firmarMinuta(selectedMinutaId, currentUser);
    if (!result.ok) { console.error(result.error); setMinutaMessage(typeof result.error === "string" ? result.error : "No fue posible registrar tu firma."); return; }
    await refreshSelectedMinuta();
    if (result.data.cerrada) setMinutaMessage("Todos firmaron — la minuta se cerró y el PDF quedó guardado en el histórico.");
  }

  return (
    <div className="space-y-3">
      {minutaMessage && <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-700">{minutaMessage}</div>}

      {canManageMinutas && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setMinutaCreating((c) => !c)} className="rounded-xl border border-dashed border-sky-300 bg-sky-50/60 px-4 py-2 text-[11px] font-black text-sky-700 transition hover:border-sky-400 hover:bg-sky-100">
            + Nueva minuta
          </button>
        </div>
      )}

      {minutaCreating && (
        <div className="rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {MINUTA_TIPOS.map((t) => (
              <button key={t.value} type="button" onClick={() => setMinutaNewDraft((d) => ({ ...d, tipo: t.value }))} className={`rounded-2xl border-2 px-4 py-2 text-[12px] font-black transition ${minutaNewDraft.tipo === t.value ? `${t.accent} border-current` : "border-slate-200 bg-white text-slate-400"}`}>
                {t.icon} {t.value}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:col-span-2">
              Título de la minuta
              <input type="text" value={minutaNewDraft.titulo} onChange={(e) => setMinutaNewDraft((d) => ({ ...d, titulo: e.target.value }))} placeholder="Ej. Revisión mensual de Distribución" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-sky-300" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Fecha
              <input type="date" value={minutaNewDraft.fecha} onChange={(e) => setMinutaNewDraft((d) => ({ ...d, fecha: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-700 outline-none" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Proceso relacionado (opcional)
              <select value={minutaNewDraft.procesoRelacionado} onChange={(e) => setMinutaNewDraft((d) => ({ ...d, procesoRelacionado: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold normal-case tracking-normal text-slate-700 outline-none">
                <option value="">Sin definir</option>
                {procesoOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Participantes (firmarán la minuta)</p>
            <MultiSelectDropdown
              options={minutaParticipanteOptions}
              selectedIds={minutaNewDraft.participantesPersonaIds}
              onToggle={toggleParticipante}
              placeholder="Selecciona participantes..."
            />
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Puntos a tratar</p>
            {minutaNewDraft.puntos.map((punto, index) => (
              <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5">
                <input type="text" value={punto.descripcion} onChange={(e) => updateDraftPunto(index, "descripcion", e.target.value)} placeholder={`Punto ${index + 1}: ¿de qué se trata?`} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold normal-case tracking-normal text-slate-800 outline-none" />
                <div className="mt-1.5 grid gap-1.5 md:grid-cols-[2fr_1fr_1fr]">
                  <input type="text" value={punto.acuerdo} onChange={(e) => updateDraftPunto(index, "acuerdo", e.target.value)} placeholder="Acuerdo / conclusión (opcional)" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium normal-case tracking-normal text-slate-600 outline-none" />
                  <select value={punto.responsablePersonaId} onChange={(e) => updateDraftPunto(index, "responsablePersonaId", e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold normal-case tracking-normal text-slate-600 outline-none">
                    <option value="">Sin responsable</option>
                    {minutaParticipanteOptions.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <input type="date" value={punto.fechaCompromiso} onChange={(e) => updateDraftPunto(index, "fechaCompromiso", e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600 outline-none" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setMinutaNewDraft((d) => ({ ...d, puntos: [...d.puntos, { descripcion: "", acuerdo: "", responsablePersonaId: "", fechaCompromiso: "" }] }))} className="text-[11px] font-black text-sky-600 hover:text-sky-700">
              + agregar punto
            </button>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => { setMinutaCreating(false); setMinutaNewDraft(emptyMinutaDraft); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-slate-500">Cancelar</button>
            <button type="button" onClick={handleCreateMinuta} className="rounded-xl bg-[#001225] px-4 py-2 text-[11px] font-black text-white">Crear minuta</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Filtrar:</span>
        <select value={minutaFiltroPersona} onChange={(e) => setMinutaFiltroPersona(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-600 outline-none">
          <option value="">Persona</option>
          {minutaParticipanteOptions.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select value={minutaFiltroProceso} onChange={(e) => setMinutaFiltroProceso(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-600 outline-none">
          <option value="">Proceso</option>
          {minutaProcesosDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
          Desde
          <input type="date" value={minutaFiltroDesde} onChange={(e) => setMinutaFiltroDesde(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-600 outline-none" />
        </label>
        <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
          Hasta
          <input type="date" value={minutaFiltroHasta} onChange={(e) => setMinutaFiltroHasta(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-600 outline-none" />
        </label>
        {(minutaFiltroPersona || minutaFiltroProceso || minutaFiltroDesde || minutaFiltroHasta) && (
          <button type="button" onClick={() => { setMinutaFiltroPersona(""); setMinutaFiltroProceso(""); setMinutaFiltroDesde(""); setMinutaFiltroHasta(""); }} className="text-[10px] font-black text-red-500 hover:text-red-600">
            Quitar filtros
          </button>
        )}
        <span className="ml-auto text-[10px] font-bold text-slate-400">{minutasFiltradas.length} de {(minutas || []).length}</span>
      </div>

      {minutasLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-[12px] font-bold text-slate-400">Cargando minutas…</div>
      ) : minutasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-[12px] font-bold text-slate-300">
          {(minutas || []).length === 0 ? "Aún no hay minutas registradas." : "Ninguna minuta coincide con los filtros."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {minutasFiltradas.map((m, index) => {
            const info = minutaTipoInfo(m.tipo);
            const firmados = m.participantes.filter((p) => p.firmado).length;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => openMinuta(m.id)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 ${index !== 0 ? "border-t border-slate-100" : ""}`}
              >
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black ${info.accent}`}>{info.icon} {m.tipo}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black text-slate-900">{m.titulo}</p>
                  <p className="truncate text-[10px] font-bold text-slate-400">{formatDate(m.fecha)}{m.proceso_relacionado ? ` · ${m.proceso_relacionado}` : ""}</p>
                </div>
                <div className="hidden w-28 shrink-0 items-center gap-1.5 sm:flex">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${info.solid}`} style={{ width: `${m.participantes.length ? (firmados / m.participantes.length) * 100 : 0}%` }} />
                  </div>
                  <span className="shrink-0 text-[9px] font-black text-slate-500">{firmados}/{m.participantes.length}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${m.cerrada ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.cerrada ? "Cerrada" : "Abierta"}</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedMinuta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className={`${minutaTipoInfo(selectedMinuta.tipo).solid} px-6 py-5 text-white`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">{minutaTipoInfo(selectedMinuta.tipo).icon} {selectedMinuta.tipo} · {selectedMinuta.cerrada ? "Cerrada" : "Abierta"}</p>
                  <h2 className="mt-1 text-2xl font-black leading-tight">{selectedMinuta.titulo}</h2>
                  <p className="mt-1 text-[12px] font-bold text-white/80">{formatDate(selectedMinuta.fecha)}{selectedMinuta.proceso_relacionado ? ` · ${selectedMinuta.proceso_relacionado}` : ""}</p>
                </div>
                <button type="button" onClick={() => { setSelectedMinutaId(null); setSelectedMinuta(null); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-black hover:bg-white/30">×</button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {selectedMinuta.pdf_url ? (
                <a href={selectedMinuta.pdf_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-black text-emerald-700 hover:bg-emerald-100">
                  📄 Descargar PDF firmado
                </a>
              ) : (
                <button type="button" onClick={() => downloadMinutaPdfPreview(selectedMinuta)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] font-black text-slate-600 hover:bg-slate-100">
                  📄 Descargar borrador PDF ({selectedMinuta.participantes.filter((p) => p.firmado).length}/{selectedMinuta.participantes.length} firmas)
                </button>
              )}

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Puntos tratados</p>
                <div className="mt-1.5 space-y-1.5">
                  {selectedMinuta.puntos.length === 0 && <p className="text-[11px] font-medium text-slate-300">Sin puntos registrados.</p>}
                  {selectedMinuta.puntos.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-black text-slate-800">{p.descripcion}</p>
                        {p.acuerdo && <p className="mt-0.5 text-[11px] font-medium text-slate-600">{p.acuerdo}</p>}
                        {(p.responsable?.nombre || p.fecha_compromiso) && (
                          <p className="mt-1 text-[10px] font-bold text-slate-400">{p.responsable?.nombre ? `Responsable: ${p.responsable.nombre}` : ""}{p.fecha_compromiso ? `  ·  Compromiso: ${formatDate(p.fecha_compromiso)}` : ""}</p>
                        )}
                      </div>
                      {canManageMinutas && !selectedMinuta.cerrada && (
                        <button type="button" onClick={() => handleRemovePuntoExistente(p.id)} className="shrink-0 rounded-full px-2 py-1 text-[10px] font-black text-red-400 hover:bg-red-50 hover:text-red-600">Quitar</button>
                      )}
                    </div>
                  ))}
                </div>
                {canManageMinutas && !selectedMinuta.cerrada && (
                  <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-white p-2.5">
                    <input type="text" value={nuevoPuntoDraft.descripcion} onChange={(e) => setNuevoPuntoDraft((d) => ({ ...d, descripcion: e.target.value }))} placeholder="Nuevo punto…" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
                    <div className="mt-1.5 grid gap-1.5 md:grid-cols-[2fr_1fr_1fr_auto]">
                      <input type="text" value={nuevoPuntoDraft.acuerdo} onChange={(e) => setNuevoPuntoDraft((d) => ({ ...d, acuerdo: e.target.value }))} placeholder="Acuerdo (opcional)" className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium normal-case tracking-normal text-slate-600 outline-none" />
                      <select value={nuevoPuntoDraft.responsablePersonaId} onChange={(e) => setNuevoPuntoDraft((d) => ({ ...d, responsablePersonaId: e.target.value }))} className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-[11px] font-bold normal-case tracking-normal text-slate-600 outline-none">
                        <option value="">Sin responsable</option>
                        {minutaParticipanteOptions.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                      <input type="date" value={nuevoPuntoDraft.fechaCompromiso} onChange={(e) => setNuevoPuntoDraft((d) => ({ ...d, fechaCompromiso: e.target.value }))} className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-[11px] font-bold text-slate-600 outline-none" />
                      <button type="button" onClick={handleAddPuntoExistente} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">+ Agregar</button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firmas</p>
                <div className="mt-1.5 space-y-1.5">
                  {selectedMinuta.participantes.map((p) => {
                    const esQuienVe = String(p.persona_id) === String(currentUser?.persona_id);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white p-2.5">
                        <span className="text-[12px] font-bold text-slate-700">{p.persona?.nombre}</span>
                        {p.firmado ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">✓ Firmado · {new Date(p.firmado_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
                        ) : esQuienVe ? (
                          <button type="button" onClick={handleFirmar} className="rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700">✓ Firmar</button>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-400">Pendiente</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
