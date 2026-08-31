import { useEffect, useState } from "react";
import {
  getAnalisisCausa,
  upsertAnalisisCausa,
  getHistorial,
  getComentarios,
  addComentario,
  getAdjuntos,
  addAdjunto,
} from "../../services/accionesService";
import { canEditAccion, canApproveAction } from "../../services/permissionsService";
import { createStrategicDecision } from "../../services/decisionService";
import {
  TIPOS_ACCION,
  NIVELES_ACCION,
  PRIORIDADES_ACCION,
  ESTADO_BADGE,
  NIVEL_BADGE,
  TIPO_COLOR,
  HERRAMIENTAS_MVP,
  getFlujoEtapas,
  isVencida,
  formatDate,
  formatDateTime,
} from "./actionsHelpers";
import CincoPorques from "./analisisCausa/CincoPorques";
import Ishikawa from "./analisisCausa/Ishikawa";
import CincoW2H from "./analisisCausa/CincoW2H";

function EditableText({ value, onSave, canEdit, className = "", placeholder = "", multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (!canEdit) {
    return <span className={className}>{value || <span className="text-slate-300">{placeholder}</span>}</span>;
  }
  if (!editing) {
    return (
      <button type="button" onClick={() => { setDraft(value || ""); setEditing(true); }} className={`w-full rounded px-1 text-left transition hover:bg-sky-50 ${className}`}>
        {value || <span className="text-slate-300">{placeholder || "Clic para editar"}</span>}
      </button>
    );
  }
  const Field = multiline ? "textarea" : "input";
  return (
    <Field
      autoFocus
      value={draft}
      rows={multiline ? 2 : undefined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      onKeyDown={(event) => {
        if (!multiline && event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { setDraft(value || ""); setEditing(false); }
      }}
      className="w-full rounded border border-sky-300 bg-white px-1 text-[11px] font-bold text-slate-800 outline-none"
    />
  );
}

// Un <input type="date"> normal, atado directo al valor del padre con
// onChange guardando en cada cambio, se rompe: cada guardado dispara un
// re-render que le resetea el valor mientras el usuario todavía está
// escribiendo el día/mes/año (el síntoma es justo ese: el año se queda a
// medias). Aquí se edita sobre un borrador local y solo se guarda al salir
// del campo, mismo criterio que EditableText.
function EditableDate({ value, onSave, canEdit }) {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  if (!canEdit) {
    return <span className="text-slate-600">{formatDate(value) || "—"}</span>;
  }
  return (
    <input
      type="date"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { if (draft !== (value || "")) onSave(draft); }}
      className="w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-bold text-slate-700 outline-none"
    />
  );
}

function EditableSelect({ value, options, onSave, canEdit, labelFor = (v) => v }) {
  if (!canEdit) return <span>{labelFor(value)}</span>;
  return (
    <select value={value || ""} onChange={(event) => onSave(event.target.value)} className="w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-bold text-slate-700 outline-none">
      {options.map((opt) => (
        <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>
      ))}
    </select>
  );
}

// Formulario compacto para crear la asignación en Balance de Carga — mismo
// patrón (persona/rol/horas/fecha límite/prioridad) ya usado en Diagnóstico
// SIG / Seguimiento Estratégico / Acuerdos S&OP para esta misma conexión.
function AsignacionForm({ personas, defaultPersonaId, defaultTitulo, onConfirm, onCancel }) {
  const [personaId, setPersonaId] = useState(defaultPersonaId || "");
  const [titulo, setTitulo] = useState(defaultTitulo || "");
  const [horas, setHoras] = useState(2);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!personaId) { setError("Selecciona a quién se le asigna."); return; }
    if (!titulo.trim()) { setError("El título no puede quedar vacío."); return; }
    setError("");
    setSaving(true);
    const persona = personas.find((p) => String(p.id) === String(personaId));
    const ok = await onConfirm({
      personaId: Number(personaId),
      personaNombre: persona?.nombre || "",
      titulo: titulo.trim(),
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Persona
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-48 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            <option value="">Selecciona...</option>
            {personas.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
          </select>
        </label>
        <label className="min-w-[180px] flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Título
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Horas
          <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-20 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Fecha límite
          <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            {["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#111827] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Enviando..." : "Confirmar"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

// Formulario para crear el proyecto en el Tablero PMO desde una acción ya
// aprobada. No basta con el registro en el tablero: cada persona
// involucrada (el líder incluido) recibe además su propia asignación en
// Balance de Carga, con la misma carga de horas/fecha/prioridad — así su
// trabajo en el proyecto queda reflejado donde se planea la capacidad real,
// no solo en el tablero PMO.
function ProyectoForm({ personas, defaultNombre, defaultLiderPersonaId, onConfirm, onCancel }) {
  const [nombre, setNombre] = useState(defaultNombre || "");
  const [liderPersonaId, setLiderPersonaId] = useState(defaultLiderPersonaId || "");
  const [involucradosIds, setInvolucradosIds] = useState(defaultLiderPersonaId ? [String(defaultLiderPersonaId)] : []);
  const [horas, setHoras] = useState(4);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Media");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleLiderChange(value) {
    setLiderPersonaId(value);
    if (value) setInvolucradosIds((current) => (current.includes(value) ? current : [...current, value]));
  }
  function toggleInvolucrado(id) {
    if (id === String(liderPersonaId)) return; // el líder siempre queda incluido
    setInvolucradosIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function handleConfirm() {
    if (!nombre.trim()) { setError("El nombre del proyecto no puede quedar vacío."); return; }
    if (involucradosIds.length === 0) { setError("Selecciona al menos una persona involucrada."); return; }
    setError("");
    setSaving(true);
    const involucrados = involucradosIds.map((id) => {
      const persona = personas.find((p) => String(p.id) === id);
      return { personaId: Number(id), personaNombre: persona?.nombre || "" };
    });
    const ok = await onConfirm({
      nombre: nombre.trim(),
      liderPersonaId: liderPersonaId ? Number(liderPersonaId) : null,
      involucrados,
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[180px] flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Nombre del proyecto
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Líder de proyecto
          <select value={liderPersonaId} onChange={(e) => handleLiderChange(e.target.value)} className="mt-1 h-9 w-48 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            <option value="">Sin asignar</option>
            {personas.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
          </select>
        </label>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Personas involucradas (cada una recibe su asignación en Balance de Carga)</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {personas.map((p) => {
            const id = String(p.id);
            const checked = involucradosIds.includes(id);
            const esLider = id === String(liderPersonaId);
            return (
              <button
                key={p.id}
                type="button"
                disabled={esLider}
                onClick={() => toggleInvolucrado(id)}
                className={`rounded-full border px-2.5 py-1 text-[9px] font-black transition disabled:cursor-not-allowed ${checked ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                {checked ? "✓ " : ""}{p.nombre}{esLider ? " (líder)" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Horas (c/u)
          <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-20 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Fecha límite
          <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="mt-1 h-9 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
            {["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#111827] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? "Enviando..." : "Confirmar"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

const SUB_TABS = [
  { key: "causa", label: "Análisis de causa" },
  { key: "plan", label: "Plan de acción" },
  { key: "historial", label: "Historial" },
  { key: "comentarios", label: "Comentarios" },
  { key: "adjuntos", label: "Adjuntos" },
];

export default function AccionDetailPanel({
  accion, acciones, tiposFlujo, procesos, personas, objetivos, procesosById, personasById, objetivosById,
  currentUser, onUpdate, onDeactivate, onClose, onCreateAssignment, onCreateProyecto, onNavigateToAccion,
}) {
  const [subTab, setSubTab] = useState("causa");
  const [analisisList, setAnalisisList] = useState([]);
  const [herramienta, setHerramienta] = useState(HERRAMIENTAS_MVP[0]);
  const [historial, setHistorial] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [adjuntos, setAdjuntos] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [nuevoAdjunto, setNuevoAdjunto] = useState({ nombre: "", url: "" });
  const [loadingSub, setLoadingSub] = useState(true);
  const [convertingToAssignment, setConvertingToAssignment] = useState(false);
  const [convertingToProyecto, setConvertingToProyecto] = useState(false);
  const [escalando, setEscalando] = useState(false);

  const proceso = accion.proceso_id ? procesosById[accion.proceso_id] : null;
  const canEdit = canEditAccion(currentUser, accion, proceso);
  const canApprove = canApproveAction(currentUser);
  const etapas = getFlujoEtapas(tiposFlujo, accion.tipo);
  // Si el flujo de este tipo de acción no contempla "Aprobada", no hay
  // aprobación que esperar y la conversión queda libre desde que exista
  // canEdit. Si sí la contempla, convertir en proyecto/asignación requiere
  // haber llegado ya a esa etapa (o una posterior) — la aprobación del
  // Director es la que habilita el paso a ejecución real.
  const etapaAprobadaIndex = etapas.indexOf("Aprobada");
  const yaAprobada = etapaAprobadaIndex === -1 || etapas.indexOf(accion.estado) >= etapaAprobadaIndex;
  const vencida = isVencida(accion);
  const esCritica = accion.prioridad === "Crítica";

  // HLS 10.2: "reaccionar" (Corrección inmediata) y "eliminar la causa"
  // (Acción Correctiva) son dos pasos distintos de la misma no conformidad
  // — se enlazan reutilizando origen_modulo/origen_tabla/origen_id (mismo
  // mecanismo genérico ya usado para ligar acciones a su origen en otros
  // módulos), sin campo nuevo dedicado.
  const correccionOrigen = accion.origen_tabla === "acciones" && accion.origen_id
    ? (acciones || []).find((a) => a.id === accion.origen_id) || null
    : null;
  const derivadas = (acciones || []).filter((a) => a.origen_tabla === "acciones" && a.origen_id === accion.id);

  // HLS 10.2 b.3: "determinar si existen o podrían existir no conformidades
  // similares" — antecedentes del mismo proceso, para que el líder juzgue
  // si esto ya pasó antes (recurrencia), no una búsqueda automática de
  // similitud de texto.
  const posiblesAntecedentes = accion.proceso_id
    ? (acciones || [])
        .filter((a) => a.id !== accion.id && a.proceso_id === accion.proceso_id)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5)
    : [];

  // Escalar la acción al Centro de Decisiones — mismo mecanismo
  // (createStrategicDecision, status "Solicitud") que ya usan S&OP,
  // Seguimiento Estratégico y Desempeño Organizacional. Pensado sobre todo
  // para acciones críticas atascadas o vencidas que Dirección debería ver,
  // pero disponible para cualquier acción con permiso de edición.
  async function handleEscalarDireccion() {
    if (!window.confirm(`¿Escalar "${accion.titulo}" a Dirección?`)) return;
    setEscalando(true);
    const responsableNombre = accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : null;
    try {
      await createStrategicDecision({
        title: accion.titulo,
        owner: responsableNombre || "",
        risk: accion.prioridad === "Crítica" ? "Alto" : accion.prioridad === "Baja" ? "Bajo" : "Moderado",
        status: "Solicitud",
        executionType: null,
        dueDate: accion.fecha_compromiso || null,
        consequence: accion.descripcion || "",
        recommendation: `Acción ${accion.codigo} (${accion.tipo}) — estado actual: ${accion.estado}${vencida ? ", vencida" : ""}.`,
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "Acciones de Mejora",
      });
      alert("Acción escalada a la Bandeja del Centro de Decisiones.");
    } catch (err) {
      console.error(err);
      alert("No fue posible escalar la acción a Dirección.");
    }
    setEscalando(false);
  }

  useEffect(() => {
    async function load() {
      setLoadingSub(true);
      const [analisisData, historialData, comentariosData, adjuntosData] = await Promise.all([
        getAnalisisCausa(accion.id),
        getHistorial(accion.id),
        getComentarios(accion.id),
        getAdjuntos(accion.id),
      ]);
      setAnalisisList(analisisData);
      setHistorial(historialData);
      setComentarios(comentariosData);
      setAdjuntos(adjuntosData);
      setLoadingSub(false);
    }
    load();
    // Recarga también cuando `accion` se actualiza (ej. cambio de estado)
    // para que Historial refleje el cambio sin tener que cerrar y reabrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accion.id, accion.updated_at]);

  const analisisActual = analisisList.find((a) => a.herramienta === herramienta) || null;
  // Referencia para "Plan de acción": la causa raíz más reciente que se
  // haya concluido, sin importar con cuál de las 3 herramientas se llegó
  // a ella.
  const causaRaizReferencia = analisisList
    .filter((a) => a.conclusion_causa_raiz && a.conclusion_causa_raiz.trim())
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0] || null;

  async function handleSaveAnalisis(payload) {
    const result = await upsertAnalisisCausa({ accionId: accion.id, herramienta, ...payload }, currentUser);
    if (!result?.ok) { console.error(result?.error); return; }
    setAnalisisList((current) => {
      const filtered = current.filter((a) => a.herramienta !== herramienta);
      return [...filtered, result.data];
    });
  }

  async function handleAddComentario() {
    if (!nuevoComentario.trim()) return;
    const result = await addComentario({ accionId: accion.id, comentario: nuevoComentario.trim() }, currentUser);
    if (!result?.ok) { console.error(result?.error); return; }
    setComentarios((current) => [...current, result.data]);
    setNuevoComentario("");
  }

  async function handleAddAdjunto() {
    if (!nuevoAdjunto.nombre.trim() || !nuevoAdjunto.url.trim()) return;
    const result = await addAdjunto({ accionId: accion.id, nombreArchivo: nuevoAdjunto.nombre.trim(), url: nuevoAdjunto.url.trim() }, currentUser);
    if (!result?.ok) { console.error(result?.error); return; }
    setAdjuntos((current) => [...current, result.data]);
    setNuevoAdjunto({ nombre: "", url: "" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#001225] px-4 py-3 text-white">
          <div>
            <p className="text-[10px] font-bold text-slate-300">{accion.codigo}</p>
            <p className="text-sm font-black uppercase tracking-widest">Detalle de acción</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black hover:bg-white/20">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            {/* Columna izquierda: campos + flujo */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" style={{ borderLeft: `4px solid ${TIPO_COLOR[accion.tipo] || "#94a3b8"}` }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${NIVEL_BADGE[accion.nivel] || ""}`}>{accion.nivel}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-600">{accion.tipo}</span>
                  {accion.con_riesgo && <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[9px] font-black text-red-600">Con riesgo</span>}
                </div>
                <h2 className="mt-2 text-lg font-black text-slate-900">
                  <EditableText value={accion.titulo} canEdit={canEdit} onSave={(v) => onUpdate({ titulo: v })} />
                </h2>
                <div className="mt-1 text-[11px] text-slate-500">
                  <EditableText value={accion.descripcion} canEdit={canEdit} onSave={(v) => onUpdate({ descripcion: v })} placeholder="Sin descripción" multiline />
                </div>

                {(correccionOrigen || derivadas.length > 0) && (
                  <div className="mt-2 space-y-1">
                    {correccionOrigen && (
                      <button type="button" onClick={() => onNavigateToAccion?.(correccionOrigen.id)} className="flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-100">
                        <span className="text-slate-400">↳ Corrección de origen:</span> {correccionOrigen.codigo} — {correccionOrigen.titulo}
                      </button>
                    )}
                    {derivadas.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{derivadas.length} acción(es) correctiva(s) derivada(s)</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {derivadas.map((d) => (
                            <button key={d.id} type="button" onClick={() => onNavigateToAccion?.(d.id)} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-600 hover:bg-slate-100">
                              {d.codigo}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Nivel</p>
                    <EditableSelect value={accion.nivel} options={NIVELES_ACCION} canEdit={canEdit} onSave={(v) => onUpdate({ nivel: v })} />
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Tipo</p>
                    <EditableSelect value={accion.tipo} options={TIPOS_ACCION} canEdit={canEdit} onSave={(v) => onUpdate({ tipo: v })} />
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Proceso</p>
                    <EditableSelect
                      value={accion.proceso_id || ""}
                      options={[{ value: "", label: "Sin proceso" }, ...procesos.map((p) => ({ value: p.id, label: p.nombre }))]}
                      canEdit={canEdit}
                      onSave={(v) => onUpdate({ proceso_id: v || null })}
                      labelFor={() => (accion.proceso_id ? procesosById[accion.proceso_id]?.nombre : "Sin proceso")}
                    />
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Objetivo estratégico</p>
                    <EditableSelect
                      value={accion.objetivo_id || ""}
                      options={[{ value: "", label: "Sin vincular" }, ...objetivos.map((o) => ({ value: o.id, label: o.codigo }))]}
                      canEdit={canEdit}
                      onSave={(v) => onUpdate({ objetivo_id: v || null })}
                      labelFor={() => (accion.objetivo_id ? objetivosById[accion.objetivo_id]?.codigo : "Sin vincular")}
                    />
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Con riesgo</p>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onUpdate({ con_riesgo: !accion.con_riesgo })}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${accion.con_riesgo ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 bg-slate-50 text-slate-400"}`}
                    >
                      {accion.con_riesgo ? "Sí" : "No"}
                    </button>
                  </div>
                </div>

                {accion.requiere_verificacion_eficacia && (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 p-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-cyan-700">Verificación de eficacia</p>
                      <EditableSelect
                        value={accion.eficacia_resultado || ""}
                        options={[{ value: "", label: "Sin evaluar" }, "Eficaz", "Parcialmente eficaz", "No eficaz"]}
                        canEdit={canEdit}
                        onSave={(v) => onUpdate({ eficacia_resultado: v || null, eficacia_evaluada_en: new Date().toISOString() })}
                      />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-cyan-700">Fecha para verificar</p>
                      <EditableDate value={accion.fecha_verificacion_eficacia} canEdit={canEdit} onSave={(v) => onUpdate({ fecha_verificacion_eficacia: v || null })} />
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={escalando}
                        onClick={handleEscalarDireccion}
                        title={esCritica && vencida ? "Acción crítica vencida — escalar a Dirección" : "Escalar a Dirección"}
                        className={`rounded-lg border px-3 py-1 text-[10px] font-black transition disabled:opacity-50 ${
                          esCritica && vencida ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100" : "border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        }`}
                      >
                        {escalando ? "Enviando…" : "→ Dirección"}
                      </button>
                      <button type="button" onClick={onDeactivate} className="rounded-lg border border-red-200 px-3 py-1 text-[10px] font-black text-red-500 transition hover:bg-red-50">
                        Eliminar acción
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Flujo de estados */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Flujo</p>
                <div className="flex flex-wrap items-center gap-1">
                  {etapas.map((etapa, index) => {
                    const isCurrent = accion.estado === etapa;
                    const isPast = etapas.indexOf(accion.estado) > index;
                    // "Aprobada" es la única etapa que no basta con canEdit —
                    // es la firma del Director, no un paso más del flujo.
                    const bloqueadaPorAprobacion = etapa === "Aprobada" && !isCurrent && !isPast && !canApprove;
                    return (
                      <button
                        key={etapa}
                        type="button"
                        disabled={!canEdit || bloqueadaPorAprobacion}
                        onClick={() => onUpdate({ estado: etapa })}
                        title={bloqueadaPorAprobacion ? "Solo el Director General puede aprobar" : undefined}
                        className={`rounded-full border px-2.5 py-1 text-[9px] font-black transition ${
                          isCurrent ? ESTADO_BADGE[etapa] : isPast ? "border-emerald-100 bg-emerald-50/60 text-emerald-600" : "border-slate-200 bg-slate-50 text-slate-400"
                        } ${canEdit && !bloqueadaPorAprobacion ? "hover:opacity-80" : ""} ${bloqueadaPorAprobacion ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {etapa}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Columna derecha: sub-tabs */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50 p-1.5">
                {SUB_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSubTab(tab.key)}
                    className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition ${subTab === tab.key ? "bg-[#001225] text-white" : "text-slate-500 hover:bg-slate-100"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[55vh] overflow-auto p-3">
                {loadingSub ? (
                  <div className="py-8 text-center text-[11px] font-bold text-slate-300">Cargando…</div>
                ) : subTab === "causa" ? (
                  <div className="space-y-3">
                    {posiblesAntecedentes.length > 0 && (
                      <details className="rounded-xl border border-amber-100 bg-amber-50/50 px-2.5 py-2">
                        <summary className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-amber-700">
                          🔁 {posiblesAntecedentes.length} antecedente(s) en este proceso — ¿es recurrente?
                        </summary>
                        <div className="mt-1.5 space-y-1">
                          {posiblesAntecedentes.map((a) => (
                            <button key={a.id} type="button" onClick={() => onNavigateToAccion?.(a.id)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-2 py-1 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50">
                              <span className="truncate">{a.codigo} · {a.titulo}</span>
                              <span className="shrink-0 text-[9px] text-slate-400">{a.estado}</span>
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {HERRAMIENTAS_MVP.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setHerramienta(h)}
                          className={`rounded-full border px-2.5 py-1 text-[9px] font-black transition ${herramienta === h ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                    {herramienta === "5 Porqués" && <CincoPorques analisis={analisisActual} onSave={handleSaveAnalisis} canEdit={canEdit} />}
                    {herramienta === "Ishikawa" && <Ishikawa analisis={analisisActual} onSave={handleSaveAnalisis} canEdit={canEdit} />}
                    {herramienta === "5W2H" && <CincoW2H analisis={analisisActual} onSave={handleSaveAnalisis} canEdit={canEdit} />}
                  </div>
                ) : subTab === "plan" ? (
                  <div className="space-y-3">
                    {causaRaizReferencia ? (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Causa raíz identificada ({causaRaizReferencia.herramienta})</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-700">{causaRaizReferencia.conclusion_causa_raiz}</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-2.5 text-[11px] font-bold text-amber-700">
                        Aún no hay una causa raíz registrada en Análisis de causa — se recomienda completarlo antes de definir la acción.
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="font-black uppercase tracking-widest text-slate-400">Responsable</p>
                        <EditableSelect
                          value={accion.responsable_persona_id || ""}
                          options={[{ value: "", label: "Sin asignar" }, ...personas.map((p) => ({ value: p.id, label: p.nombre }))]}
                          canEdit={canEdit}
                          onSave={(v) => onUpdate({ responsable_persona_id: v || null })}
                          labelFor={() => (accion.responsable_persona_id ? personasById[accion.responsable_persona_id]?.nombre : "Sin asignar")}
                        />
                      </div>
                      <div>
                        <p className="font-black uppercase tracking-widest text-slate-400">Prioridad</p>
                        <EditableSelect value={accion.prioridad} options={PRIORIDADES_ACCION} canEdit={canEdit} onSave={(v) => onUpdate({ prioridad: v })} />
                      </div>
                      <div>
                        <p className="font-black uppercase tracking-widest text-slate-400">Fecha compromiso</p>
                        <EditableDate value={accion.fecha_compromiso} canEdit={canEdit} onSave={(v) => onUpdate({ fecha_compromiso: v || null })} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Enlace de ejecución (texto)</p>
                        <EditableText value={accion.enlace_ejecucion_texto} canEdit={canEdit} onSave={(v) => onUpdate({ enlace_ejecucion_texto: v })} placeholder="Ej. Planner — Tablero Calidad" className="text-slate-700" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Enlace de ejecución (URL)</p>
                        <EditableText value={accion.enlace_ejecucion_url} canEdit={canEdit} onSave={(v) => onUpdate({ enlace_ejecucion_url: v })} placeholder="https://…" className="text-slate-700" />
                      </div>
                    </div>

                    {canEdit && (
                      <div className="border-t border-slate-100 pt-2.5">
                        <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Convertir en ejecución real</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!yaAprobada}
                            title={yaAprobada ? "Enviar a Asignaciones" : "Requiere aprobación del Director General primero"}
                            onClick={() => setConvertingToAssignment((current) => !current)}
                            className={`rounded-lg border px-3 py-1 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${convertingToAssignment ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600"}`}
                          >
                            → Asignación
                          </button>
                          <button
                            type="button"
                            disabled={!yaAprobada}
                            title={yaAprobada ? "Crear proyecto en el Tablero PMO" : "Requiere aprobación del Director General primero"}
                            onClick={() => setConvertingToProyecto((current) => !current)}
                            className={`rounded-lg border px-3 py-1 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${convertingToProyecto ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          >
                            → Proyecto
                          </button>
                        </div>
                        {!yaAprobada && <p className="mt-1.5 text-[9px] font-bold text-amber-600">Pendiente de aprobación del Director General (etapa "Aprobada" en Flujo).</p>}
                        {convertingToAssignment && (
                          <AsignacionForm
                            personas={personas}
                            defaultPersonaId={accion.responsable_persona_id || ""}
                            defaultTitulo={accion.titulo}
                            onCancel={() => setConvertingToAssignment(false)}
                            onConfirm={(payload) => onCreateAssignment(accion, payload)}
                          />
                        )}
                        {convertingToProyecto && (
                          <ProyectoForm
                            personas={personas}
                            defaultNombre={accion.titulo}
                            defaultLiderPersonaId={accion.responsable_persona_id || ""}
                            onCancel={() => setConvertingToProyecto(false)}
                            onConfirm={(payload) => onCreateProyecto(accion, payload)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : subTab === "historial" ? (
                  <div className="space-y-1.5">
                    {historial.length === 0 && <p className="py-6 text-center text-[11px] font-bold text-slate-300">Sin cambios registrados.</p>}
                    {historial.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-700">{entry.campo}</span>
                          <span className="text-[9px] font-bold text-slate-400">{formatDateTime(entry.created_at)}</span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-500">{entry.usuario_nombre || "Usuario desconocido"}</p>
                        {(entry.valor_anterior || entry.valor_nuevo) && (
                          <p className="mt-0.5 text-[10px]">
                            <span className="text-slate-400 line-through">{entry.valor_anterior || "—"}</span>{" → "}
                            <span className="font-bold text-slate-700">{entry.valor_nuevo || "—"}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : subTab === "comentarios" ? (
                  <div className="space-y-2">
                    {comentarios.length === 0 && <p className="py-4 text-center text-[11px] font-bold text-slate-300">Sin comentarios aún.</p>}
                    {comentarios.map((c) => (
                      <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                          <span>{c.usuario_nombre || "Usuario"}</span>
                          <span>{formatDateTime(c.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-700">{c.comentario}</p>
                      </div>
                    ))}
                    <div className="flex gap-1 border-t border-slate-100 pt-2">
                      <input
                        value={nuevoComentario}
                        onChange={(e) => setNuevoComentario(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddComentario(); }}
                        placeholder="Escribe un comentario…"
                        className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none"
                      />
                      <button type="button" onClick={handleAddComentario} className="rounded-lg bg-[#001225] px-3 text-[10px] font-black text-white">Enviar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {adjuntos.length === 0 && <p className="py-4 text-center text-[11px] font-bold text-slate-300">Sin adjuntos aún.</p>}
                    {adjuntos.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-50">
                        <span className="truncate">{a.nombre_archivo}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{a.tipo}</span>
                      </a>
                    ))}
                    <div className="space-y-1 border-t border-slate-100 pt-2">
                      <input
                        value={nuevoAdjunto.nombre}
                        onChange={(e) => setNuevoAdjunto((c) => ({ ...c, nombre: e.target.value }))}
                        placeholder="Nombre del documento/evidencia"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none"
                      />
                      <div className="flex gap-1">
                        <input
                          value={nuevoAdjunto.url}
                          onChange={(e) => setNuevoAdjunto((c) => ({ ...c, url: e.target.value }))}
                          placeholder="https://…"
                          className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none"
                        />
                        <button type="button" onClick={handleAddAdjunto} className="rounded-lg bg-[#001225] px-3 text-[10px] font-black text-white">Agregar</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
