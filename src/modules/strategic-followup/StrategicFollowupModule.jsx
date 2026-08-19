import React, { useEffect, useMemo, useRef, useState } from "react";
// Ajusta esta ruta si tu proyecto exporta supabase desde otra ubicación.
// Usa la misma ruta que ya te funcionó en la versión anterior.
import { supabase } from "../../services/supabase";
import { createAccion, getTiposFlujo } from "../../services/accionesService";
import { getFlujoConfig } from "../actions/actionsHelpers";
import { createStrategicDecision } from "../../services/decisionService";
import { createWorkloadAssignment } from "../../services/workloadService";
import { isStrategicTeamMember } from "../../services/permissionsService";
import { mapProcesses } from "../../services/processCatalog";
import { getMinutas, getMinutaDetalle, createMinuta, addPunto, removePunto, firmarMinuta } from "../../services/minutasService";

const tabs = ["ENFOQUE", "INSUMOS", "SESIÓN", "MINUTAS"];

const MINUTA_TIPOS = [
  { value: "Acuerdo", icon: "📝", accent: "border-sky-200 bg-sky-50 text-sky-700", solid: "bg-sky-600" },
  { value: "Seguimiento", icon: "🔄", accent: "border-emerald-200 bg-emerald-50 text-emerald-700", solid: "bg-emerald-600" },
  { value: "Revisión", icon: "🔍", accent: "border-amber-200 bg-amber-50 text-amber-700", solid: "bg-amber-600" },
];
function minutaTipoInfo(tipo) {
  return MINUTA_TIPOS.find((t) => t.value === tipo) || MINUTA_TIPOS[0];
}

const statusFlow = ["Pendiente", "Entregado", "Validado"];
const resultFlow = ["Pendiente", "Aprobado", "Parcial", "No revisado", "Cerrado"];

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getMonday(date = new Date()) {
  const target = new Date(date);
  const day = target.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  target.setDate(target.getDate() + diff);
  target.setHours(0, 0, 0, 0);
  return target;
}

function addDays(date, days) {
  const target = new Date(date);
  target.setDate(target.getDate() + days);
  return target;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function getWeekNumber(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date - firstDay) / 86400000);
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

function nextValue(current, options) {
  const currentIndex = options.indexOf(current);
  return options[currentIndex >= 0 ? (currentIndex + 1) % options.length : 0];
}

function AutoTextarea({ value, onChange, placeholder = "" }) {
  const textareaRef = useRef(null);

  const resize = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value || ""}
      onChange={(event) => {
        onChange(event.target.value);
        requestAnimationFrame(resize);
      }}
      rows={1}
      placeholder={placeholder}
      className="min-h-[38px] w-full resize-none overflow-hidden whitespace-normal break-words rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold leading-normal text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-red-200 focus:bg-white"
      onInput={resize}
    />
  );
}

function ResponsibleSelect({ value, onChange, people }) {
  return (
    <select
      value={value || ""}
      onChange={(event) => {
        const personId = event.target.value ? Number(event.target.value) : "";
        const selected = people.find((person) => String(person.id) === String(personId));
        onChange({
          responsableId: personId,
          responsableTexto: selected ? selected.nombre : "",
        });
      }}
      className="min-h-[38px] w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold leading-normal text-slate-950 outline-none transition focus:border-red-200 focus:bg-white"
    >
      <option value="">Seleccionar</option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.nombre}
        </option>
      ))}
    </select>
  );
}

function ClickBadge({ value, options, onChange }) {
  const normalized = String(value || "").toLowerCase();

  const color =
    normalized.includes("validado") || normalized.includes("aprobado")
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized.includes("entregado") || normalized.includes("parcial")
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : normalized.includes("no revisado") || normalized.includes("cerrado")
      ? "border-slate-200 bg-slate-100 text-slate-500"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <button
      type="button"
      onClick={() => onChange(nextValue(value, options))}
      className={`rounded-full border px-3 py-1 text-[11px] font-black transition hover:scale-[1.02] ${color}`}
    >
      {value || options[0]}
    </button>
  );
}

function DeleteButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-lg font-black leading-none text-slate-300 transition hover:text-red-600"
      title="Eliminar fila"
    >
      ×
    </button>
  );
}

function CreateAccionButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Guarda la semana antes de crear una acción" : "Crear Acción en el Centro de Gestión de Acciones"}
      className="text-sm font-black leading-none text-slate-300 transition hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-30"
    >
      ▸
    </button>
  );
}

function SolicitarDireccionButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Guarda la semana antes de enviarlo a Dirección" : "Enviar a la Bandeja del Centro de Decisiones"}
      className="text-sm font-black leading-none text-slate-300 transition hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-30"
    >
      ⇧
    </button>
  );
}

function AsignacionButton({ onClick, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Guarda la semana antes de crear una asignación" : "Convertir en asignación de Balance de Carga"}
      className={`text-sm font-black leading-none transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? "text-amber-600" : "text-slate-300 hover:text-amber-600"
      }`}
    >
      ◆
    </button>
  );
}

// Formulario compacto para convertir una fila de Enfoque o Sesión en una
// asignación real de Balance de Carga, para cualquier persona del catálogo —
// mismo patrón que `ConvertirEnAsignacionForm` en
// src/modules/sop/DecisionesTab.jsx (Acuerdos S&OP), adaptado a este módulo.
function ConvertirEnAsignacionForm({ colSpan, personasCatalogo, onConfirm, onCancel }) {
  const [personaId, setPersonaId] = useState("");
  const [horas, setHoras] = useState(4);
  const [fechaLimite, setFechaLimite] = useState("");
  const [prioridad, setPrioridad] = useState("Alta");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!personaId) {
      setError("Selecciona a quién se le asigna.");
      return;
    }
    setError("");
    setSaving(true);
    const persona = personasCatalogo.find((p) => String(p.id) === String(personaId));
    const ok = await onConfirm({
      personaId: Number(personaId),
      personaNombre: persona?.nombre || "",
      horas: Number(horas) || 0,
      fechaLimite: fechaLimite || null,
      prioridad,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <tr className="border-b border-slate-100 bg-amber-50/50">
      <td colSpan={colSpan} className="px-3 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Persona
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-52 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              <option value="">Selecciona...</option>
              {personasCatalogo.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Horas estimadas
            <input type="number" min="0.5" step="0.5" value={horas} onChange={(e) => setHoras(e.target.value)} className="mt-1 h-9 w-24 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none" />
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
          <button type="button" disabled={saving} onClick={handleConfirm} className="h-9 rounded-lg bg-[#001225] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {saving ? "Enviando..." : "Confirmar asignación"}
          </button>
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">Cancelar</button>
        </div>
        {error && <p className="mt-1.5 text-[10px] font-bold text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`border-b border-slate-200 px-4 py-3 text-left align-top text-[11px] font-black uppercase leading-tight tracking-[0.18em] text-slate-400 whitespace-normal break-words ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={`border-b border-slate-100 px-4 py-3 text-left align-top text-sm font-bold leading-normal text-slate-950 whitespace-normal break-words ${className}`}
    >
      {children}
    </td>
  );
}

const KPI_TONE_CLASS = {
  slate: "border-slate-200 bg-white",
  emerald: "border-emerald-200 bg-emerald-50",
  amber: "border-amber-200 bg-amber-50",
  red: "border-red-200 bg-red-50",
};

function KpiCard({ label, value, sub, tone = "slate" }) {
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${KPI_TONE_CLASS[tone] || KPI_TONE_CLASS.slate}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] font-bold text-slate-500">{sub}</p>}
    </div>
  );
}

function getWeekStatusLabel(status) {
  const value = String(status || "abierta").toLowerCase();
  return value === "abierta" ? "Abierta" : value === "cerrada" ? "Cerrada" : status;
}

function getWeekStatusBadgeClass(status) {
  const value = String(status || "abierta").toLowerCase();
  return value === "cerrada"
    ? "border-slate-200 bg-slate-100 text-slate-500"
    : "border-emerald-100 bg-emerald-50 text-emerald-700";
}

export default function StrategicFollowupModule({ currentUser }) {
  const initialStart = getMonday();
  const initialEnd = addDays(initialStart, 6);

  const [activeTab, setActiveTab] = useState("ENFOQUE");
  const [people, setPeople] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [showWeeks, setShowWeeks] = useState(false);
  const [currentWeek, setCurrentWeek] = useState({
    id: null,
    fecha_inicio: toDateInput(initialStart),
    fecha_fin: toDateInput(initialEnd),
    estado: "abierta",
    kpis_riesgos: "",
  });
  const [convertingKey, setConvertingKey] = useState(null);

  const [data, setData] = useState({
    ENFOQUE: [
      {
        id: null,
        revisado: true,
        prioridad: "1",
        tema: "Gestión de Competencias",
        resultado: "Aprobar caracterización",
        responsableId: "",
        responsableTexto: "",
        tiempo: "30",
      },
      {
        id: null,
        revisado: false,
        prioridad: "2",
        tema: "Evaluación del Desempeño",
        resultado: "Definir KPIs",
        responsableId: "",
        responsableTexto: "",
        tiempo: "20",
      },
    ],
    INSUMOS: [],
    SESIÓN: [],
  });

  const activeRows = data[activeTab];
  const [tiposFlujoAcciones, setTiposFlujoAcciones] = useState([]);

  const canManageMinutas = isStrategicTeamMember(currentUser);
  const [minutas, setMinutas] = useState(null);
  const [minutasLoading, setMinutasLoading] = useState(false);
  const [minutaMessage, setMinutaMessage] = useState("");
  const [minutaCreating, setMinutaCreating] = useState(false);
  const emptyMinutaDraft = { tipo: "Acuerdo", titulo: "", fecha: toDateInput(new Date()), procesoRelacionado: "", participantesPersonaIds: [], puntos: [{ descripcion: "", acuerdo: "", responsablePersonaId: "", fechaCompromiso: "" }] };
  const [minutaNewDraft, setMinutaNewDraft] = useState(emptyMinutaDraft);
  const [selectedMinutaId, setSelectedMinutaId] = useState(null);
  const [selectedMinuta, setSelectedMinuta] = useState(null);
  const [nuevoPuntoDraft, setNuevoPuntoDraft] = useState({ descripcion: "", acuerdo: "", responsablePersonaId: "", fechaCompromiso: "" });

  async function loadMinutasList() {
    setMinutasLoading(true);
    const list = await getMinutas();
    setMinutas(list);
    setMinutasLoading(false);
  }

  useEffect(() => {
    if (activeTab === "MINUTAS" && minutas === null) loadMinutasList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
    const result = await createMinuta(minutaNewDraft, currentUser);
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

  useEffect(() => {
    loadPeople();
    getTiposFlujo().then(setTiposFlujoAcciones);
    // Si ya existe una semana guardada para la semana en curso, la carga en
    // vez de dejar el formulario en blanco — evita crear una semana
    // duplicada por accidente cada vez que se reabre el módulo.
    loadWeeks().then((weeksData) => {
      const mondayStr = toDateInput(getMonday());
      const existing = weeksData.find((week) => week.fecha_inicio === mondayStr);
      if (existing) loadWeek(existing);
    });
  }, []);

  async function handleCrearAccionEnfoque(row) {
    if (!row.id) {
      alert("Guarda la semana primero para poder crear una acción a partir de este tema.");
      return;
    }
    if (!window.confirm(`¿Crear una acción en el Centro de Gestión de Acciones a partir de "${row.tema}"?`)) return;

    const flujo = getFlujoConfig(tiposFlujoAcciones, "Acuerdo Directivo");
    const result = await createAccion(
      {
        tipo: "Acuerdo Directivo",
        nivel: "Estratégica",
        origenModulo: "Seguimiento Estratégico",
        origenTabla: "seguimiento_enfoque",
        origenId: row.id,
        titulo: row.tema,
        descripcion: row.resultado || "",
        responsablePersonaId: row.responsableId || null,
        requiereAnalisisCausa: flujo.requiere_analisis_causa,
        requiereVerificacionEficacia: flujo.requiere_verificacion_eficacia,
        requiereAprobacion: flujo.requiere_aprobacion,
      },
      currentUser
    );

    if (!result?.ok) {
      console.error(result?.error);
      alert("No fue posible crear la acción.");
      return;
    }
    alert(`Acción ${result.data.codigo} creada en el Centro de Gestión de Acciones.`);
  }

  async function handleCrearAccionSesion(row) {
    if (!row.id) {
      alert("Guarda la semana primero para poder crear una acción a partir de este acuerdo.");
      return;
    }
    if (!window.confirm(`¿Crear una acción en el Centro de Gestión de Acciones a partir de "${row.tema}"?`)) return;

    const flujo = getFlujoConfig(tiposFlujoAcciones, "Acuerdo Directivo");
    const result = await createAccion(
      {
        tipo: "Acuerdo Directivo",
        nivel: "Estratégica",
        origenModulo: "Seguimiento Estratégico",
        origenTabla: "seguimiento_sesion",
        origenId: row.id,
        titulo: row.tema,
        descripcion: row.observacion || "",
        requiereAnalisisCausa: flujo.requiere_analisis_causa,
        requiereVerificacionEficacia: flujo.requiere_verificacion_eficacia,
        requiereAprobacion: flujo.requiere_aprobacion,
      },
      currentUser
    );

    if (!result?.ok) {
      console.error(result?.error);
      alert("No fue posible crear la acción.");
      return;
    }

    const { error: updateError } = await supabase
      .from("seguimiento_sesion")
      .update({ accion_id: result.data.id })
      .eq("id", row.id);

    if (updateError) console.error(updateError);

    setData((current) => ({
      ...current,
      SESIÓN: current.SESIÓN.map((r) => (r.id === row.id ? { ...r, accionId: result.data.id } : r)),
    }));

    alert(`Acción ${result.data.codigo} creada en el Centro de Gestión de Acciones.`);
  }

  // Envía una fila de Enfoque o Sesión a la Bandeja del Centro de Decisiones
  // con status "Solicitud" (pendiente de Dirección) — mismo mecanismo que
  // handleRequestDirectorDecision en src/modules/sop/SopModule.jsx.
  async function handleSolicitarDireccion(row, tabKey) {
    if (!row.id) {
      alert("Guarda la semana primero para poder enviarlo a Dirección.");
      return;
    }
    if (!window.confirm(`¿Enviar "${row.tema}" a la Bandeja del Centro de Decisiones?`)) return;

    try {
      await createStrategicDecision({
        title: row.tema,
        owner: currentUser?.nombre || currentUser?.usuario || "",
        risk: "Moderado",
        status: "Solicitud",
        executionType: null,
        dueDate: null,
        consequence: "",
        recommendation: tabKey === "SESIÓN" ? row.observacion || "" : row.resultado || "",
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "Seguimiento Estratégico",
      });
      alert("Enviado a la Bandeja del Centro de Decisiones.");
    } catch (err) {
      console.error(err);
      alert("No fue posible enviar a Dirección.");
    }
  }

  // Convierte una fila de Enfoque o Sesión en una asignación real de Balance
  // de Carga — mismo mecanismo que handleConvertToAssignment en
  // src/modules/sop/SopModule.jsx.
  async function handleConvertToAssignment(row, tabKey, payload) {
    const result = await createWorkloadAssignment({
      persona_id: payload.personaId,
      responsable: payload.personaNombre,
      rol: "Seguimiento Estratégico",
      tipo: "Proyecto",
      prioridad: payload.prioridad || "Alta",
      gestion: "Otro",
      titulo: row.tema,
      descripcion: tabKey === "SESIÓN" ? row.observacion || "" : row.resultado || "",
      revisara: "",
      aprobara: "",
      seguimiento: "",
      carga_horas: payload.horas,
      fecha_limite: payload.fechaLimite || null,
      estado: "Pendiente",
      asigna: currentUser?.nombre || currentUser?.usuario || "",
      asigna_rol: "Seguimiento Estratégico",
      horas_totales: payload.horas,
      origen_estrategico: "Estrategia",
    });

    if (!result.ok) {
      console.error(result.error);
      alert("No fue posible crear la asignación.");
      return false;
    }
    alert("Asignación creada en Balance de Carga.");
    return true;
  }

  async function loadPeople() {
    const { data: peopleData, error } = await supabase
      .from("personas")
      .select("id,nombre")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando personas:", error);
      return;
    }

    setPeople(peopleData || []);
  }

  async function loadWeeks() {
    const { data: weeksData, error } = await supabase
      .from("seguimiento_semanas")
      .select("*")
      .order("fecha_inicio", { ascending: false });

    if (error) {
      console.error("Error cargando semanas:", error);
      return [];
    }

    setWeeks(weeksData || []);
    return weeksData || [];
  }

  function updateRow(index, field, value) {
    setData((current) => ({
      ...current,
      [activeTab]: current[activeTab].map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      ),
    }));
  }

  function updateResponsible(index, payload) {
    setData((current) => ({
      ...current,
      [activeTab]: current[activeTab].map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...payload } : row
      ),
    }));
  }

  function addRow() {
    const emptyRows = {
      ENFOQUE: {
        id: null,
        revisado: false,
        prioridad: String(data.ENFOQUE.length + 1),
        tema: "",
        resultado: "",
        responsableId: "",
        responsableTexto: "",
        tiempo: "",
      },
      INSUMOS: {
        id: null,
        tema: "",
        insumo: "",
        responsableId: "",
        responsableTexto: "",
        fuente: "",
        estado: "Pendiente",
        url: "",
      },
      SESIÓN: {
        id: null,
        revisado: false,
        tema: "",
        resultado: "Pendiente",
        observacion: "",
      },
    };

    setData((current) => ({
      ...current,
      [activeTab]: [...current[activeTab], emptyRows[activeTab]],
    }));
  }

  function deleteRow(index) {
    setData((current) => ({
      ...current,
      [activeTab]: current[activeTab].filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function newWeek() {
    const start = getMonday();
    const end = addDays(start, 6);

    setCurrentWeek({
      id: null,
      fecha_inicio: toDateInput(start),
      fecha_fin: toDateInput(end),
      estado: "abierta",
      kpis_riesgos: "",
    });

    // Limpia las 3 pestañas — antes solo se reiniciaba Enfoque, dejando
    // Insumos/Sesión de la semana anterior listas para duplicarse por
    // accidente si el usuario guardaba sin notarlo.
    setData({ ENFOQUE: [], INSUMOS: [], SESIÓN: [] });
    setConvertingKey(null);
    setActiveTab("ENFOQUE");
  }

  async function closeWeek() {
    if (!currentWeek.id) {
      alert("Guarda la semana antes de cerrarla.");
      return;
    }
    if (!window.confirm("¿Cerrar esta semana? Seguirás pudiendo consultarla, pero quedará marcada como cerrada.")) return;

    const { error } = await supabase
      .from("seguimiento_semanas")
      .update({ estado: "cerrada" })
      .eq("id", currentWeek.id);

    if (error) {
      alert("No se pudo cerrar la semana.");
      console.error(error);
      return;
    }

    setCurrentWeek((current) => ({ ...current, estado: "cerrada" }));
    await loadWeeks();
    alert("Semana cerrada.");
  }

  async function saveWeek() {
    let weekId = currentWeek.id;

    if (!weekId) {
      const { data: createdWeek, error: weekError } = await supabase
        .from("seguimiento_semanas")
        .insert({
          fecha_inicio: currentWeek.fecha_inicio,
          fecha_fin: currentWeek.fecha_fin,
          estado: currentWeek.estado || "abierta",
          kpis_riesgos: currentWeek.kpis_riesgos || "",
        })
        .select()
        .single();

      if (weekError) {
        alert("No se pudo guardar la semana.");
        console.error(weekError);
        return;
      }

      weekId = createdWeek.id;
      setCurrentWeek(createdWeek);
    } else {
      const { error: updateError } = await supabase
        .from("seguimiento_semanas")
        .update({
          fecha_inicio: currentWeek.fecha_inicio,
          fecha_fin: currentWeek.fecha_fin,
          estado: currentWeek.estado || "abierta",
          kpis_riesgos: currentWeek.kpis_riesgos || "",
        })
        .eq("id", weekId);

      if (updateError) {
        alert("No se pudo actualizar la semana.");
        console.error(updateError);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("seguimiento_enfoque")
      .delete()
      .eq("semana_id", weekId);

    if (deleteError) {
      alert("No se pudo reemplazar el enfoque de la semana.");
      console.error(deleteError);
      return;
    }

    const rowsToSave = data.ENFOQUE.map((row, index) => ({
      semana_id: weekId,
      prioridad: row.prioridad || String(index + 1),
      tema: row.tema || "",
      resultado: row.resultado || "",
      responsable_id: row.responsableId || null,
      responsable_texto: row.responsableTexto || "",
      tiempo_minutos: row.tiempo ? Number(row.tiempo) : null,
      revisado: Boolean(row.revisado),
      orden: index + 1,
    })).filter((row) => row.tema || row.resultado || row.responsable_id || row.tiempo_minutos);

    if (rowsToSave.length > 0) {
      const { error: insertError } = await supabase
        .from("seguimiento_enfoque")
        .insert(rowsToSave);

      if (insertError) {
        alert("No se pudo guardar el enfoque.");
        console.error(insertError);
        return;
      }
    }

    const { error: deleteInsumosError } = await supabase
      .from("seguimiento_insumos")
      .delete()
      .eq("semana_id", weekId);

    if (deleteInsumosError) {
      alert("No se pudieron reemplazar los insumos de la semana.");
      console.error(deleteInsumosError);
      return;
    }

    const insumosToSave = data.INSUMOS.map((row, index) => ({
      semana_id: weekId,
      tema: row.tema || "",
      insumo: row.insumo || "",
      responsable_id: row.responsableId || null,
      responsable_texto: row.responsableTexto || "",
      fuente: row.fuente || "",
      estado: row.estado || "Pendiente",
      orden: index + 1,
    })).filter((row) => row.tema || row.insumo || row.responsable_id || row.fuente);

    if (insumosToSave.length > 0) {
      const { error: insumosInsertError } = await supabase
        .from("seguimiento_insumos")
        .insert(insumosToSave);

      if (insumosInsertError) {
        alert("No se pudieron guardar los insumos.");
        console.error(insumosInsertError);
        return;
      }
    }

    const { error: deleteSesionError } = await supabase
      .from("seguimiento_sesion")
      .delete()
      .eq("semana_id", weekId);

    if (deleteSesionError) {
      alert("No se pudo reemplazar la sesión de la semana.");
      console.error(deleteSesionError);
      return;
    }

    const sesionToSave = data.SESIÓN.map((row, index) => ({
      semana_id: weekId,
      tema: row.tema || "",
      resultado: row.resultado || "Pendiente",
      observacion: row.observacion || "",
      revisado: Boolean(row.revisado),
      orden: index + 1,
    })).filter((row) => row.tema || row.observacion);

    if (sesionToSave.length > 0) {
      const { error: sesionInsertError } = await supabase
        .from("seguimiento_sesion")
        .insert(sesionToSave);

      if (sesionInsertError) {
        alert("No se pudo guardar la sesión.");
        console.error(sesionInsertError);
        return;
      }
    }

    await loadWeeks();
    // Recarga las 3 pestañas con los ids reales asignados por Supabase, sin
    // cambiar de pestaña ni cerrar el listado de semanas — a diferencia de
    // loadWeek(), que sí hace ambas cosas porque responde a un clic explícito
    // del usuario sobre una semana distinta.
    await fetchWeekData(weekId);
    alert("Semana guardada correctamente.");
  }

  // Trae Enfoque + Insumos + Sesión de una semana y puebla `data`. Separado de
  // loadWeek() para poder reutilizarlo también al final de saveWeek() (refresca
  // los ids reales tras guardar, sin forzar un cambio de pestaña).
  async function fetchWeekData(weekId) {
    const [focusResult, insumosResult, sesionResult] = await Promise.all([
      supabase.from("seguimiento_enfoque").select("*").eq("semana_id", weekId).order("orden", { ascending: true }),
      supabase.from("seguimiento_insumos").select("*").eq("semana_id", weekId).order("orden", { ascending: true }),
      supabase.from("seguimiento_sesion").select("*").eq("semana_id", weekId).order("orden", { ascending: true }),
    ]);

    if (focusResult.error || insumosResult.error || sesionResult.error) {
      console.error(focusResult.error || insumosResult.error || sesionResult.error);
      return false;
    }

    setData({
      ENFOQUE: (focusResult.data || []).map((row) => ({
        id: row.id,
        revisado: Boolean(row.revisado),
        prioridad: row.prioridad || "",
        tema: row.tema || "",
        resultado: row.resultado || "",
        responsableId: row.responsable_id || "",
        responsableTexto: row.responsable_texto || "",
        tiempo: row.tiempo_minutos ? String(row.tiempo_minutos) : "",
      })),
      INSUMOS: (insumosResult.data || []).map((row) => ({
        id: row.id,
        tema: row.tema || "",
        insumo: row.insumo || "",
        responsableId: row.responsable_id || "",
        responsableTexto: row.responsable_texto || "",
        fuente: row.fuente || "",
        estado: row.estado || "Pendiente",
        url: "",
      })),
      SESIÓN: (sesionResult.data || []).map((row) => ({
        id: row.id,
        revisado: Boolean(row.revisado),
        tema: row.tema || "",
        resultado: row.resultado || "Pendiente",
        observacion: row.observacion || "",
        accionId: row.accion_id || null,
      })),
    });

    return true;
  }

  async function loadWeek(week) {
    const ok = await fetchWeekData(week.id);

    if (!ok) {
      alert("No se pudo consultar la semana.");
      return;
    }

    setCurrentWeek(week);
    setActiveTab("ENFOQUE");
    setShowWeeks(false);
  }

  const tabDescription = {
    ENFOQUE:
      "Defina qué temas serán analizados, qué resultados se esperan y cuáles requieren atención de Dirección.",
    INSUMOS:
      "Reúna la información relevante que servirá de base para la discusión, análisis y toma de decisiones durante la sesión estratégica.",
    SESIÓN:
      "Documente los acuerdos, decisiones y conclusiones generadas durante la sesión estratégica.",
    MINUTAS:
      "Minutas de reunión del equipo estratégico hacia los líderes de proceso — acuerdos, seguimiento o revisiones, firmadas por cada participante y guardadas en PDF.",
  };

  const focusSummary = useMemo(() => {
    const total = data.ENFOQUE.length;
    const reviewed = data.ENFOQUE.filter((row) => row.revisado).length;
    const pending = total - reviewed;
    const minutes = data.ENFOQUE.reduce((sum, row) => {
      const numeric = Number(row.tiempo || 0);
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);

    return { total, reviewed, pending, minutes };
  }, [data.ENFOQUE]);

  const inputSummary = useMemo(() => {
    const total = data.INSUMOS.length;
    const delivered = data.INSUMOS.filter((row) => row.estado === "Entregado").length;
    const validated = data.INSUMOS.filter((row) => row.estado === "Validado").length;
    const pending = data.INSUMOS.filter((row) => row.estado === "Pendiente").length;

    return { total, delivered, validated, pending };
  }, [data.INSUMOS]);

  const sessionSummary = useMemo(() => {
    const total = data.SESIÓN.length;
    const reviewed = data.SESIÓN.filter((row) => row.revisado).length;
    const closed = data.SESIÓN.filter((row) => row.resultado === "Cerrado").length;
    const pending = data.SESIÓN.filter((row) => row.resultado === "Pendiente").length;
    const withAccion = data.SESIÓN.filter((row) => row.accionId).length;

    return { total, reviewed, closed, pending, withAccion };
  }, [data.SESIÓN]);

  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#001225] px-4 py-2 text-white">
        <h2 className="text-[13px] font-black uppercase tracking-tight">Seguimiento Estratégico</h2>
        <div className="flex gap-1 rounded-xl bg-white/10 p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                activeTab === tab ? "bg-white text-[#001225]" : "text-white/70 hover:bg-white/10"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="max-w-[72%] text-sm font-medium leading-snug text-slate-500">
          {tabDescription[activeTab]}
        </p>

        <button
          type="button"
          onClick={addRow}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-xl font-black text-white shadow-sm transition hover:bg-red-700"
          title="Agregar fila"
        >
          +
        </button>
      </div>

      {activeTab === "ENFOQUE" && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Total temas" value={focusSummary.total} tone="slate" />
          <KpiCard label="Revisados" value={focusSummary.reviewed} tone="emerald" />
          <KpiCard label="Pendientes" value={focusSummary.pending} tone={focusSummary.pending > 0 ? "amber" : "slate"} />
          <KpiCard label="Tiempo estimado" value={`${focusSummary.minutes} min`} tone="slate" />
        </div>
      )}

      {activeTab === "INSUMOS" && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Insumos" value={inputSummary.total} tone="slate" />
          <KpiCard label="Entregados" value={inputSummary.delivered} tone="amber" />
          <KpiCard label="Validados" value={inputSummary.validated} tone="emerald" />
          <KpiCard label="Pendientes" value={inputSummary.pending} tone={inputSummary.pending > 0 ? "red" : "slate"} />
        </div>
      )}

      {activeTab === "SESIÓN" && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard label="Acuerdos" value={sessionSummary.total} tone="slate" />
          <KpiCard label="Revisados" value={sessionSummary.reviewed} tone="emerald" />
          <KpiCard label="Cerrados" value={sessionSummary.closed} tone="emerald" />
          <KpiCard label="Pendientes" value={sessionSummary.pending} tone={sessionSummary.pending > 0 ? "amber" : "slate"} />
          <KpiCard label="Acciones creadas" value={sessionSummary.withAccion} sub={`de ${sessionSummary.total} acuerdos`} tone="slate" />
        </div>
      )}

      <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-black text-slate-500">
              Semana {getWeekNumber(currentWeek.fecha_inicio)}:{" "}
              <span className="text-slate-950">
                {formatDate(currentWeek.fecha_inicio)} al {formatDate(currentWeek.fecha_fin)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={newWeek}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-red-700"
              >
                Nueva
              </button>
              <button
                type="button"
                onClick={saveWeek}
                className="rounded-xl bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setShowWeeks((value) => !value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-red-200 hover:text-red-600"
              >
                Consultar
              </button>
              <button
                type="button"
                onClick={closeWeek}
                disabled={!currentWeek.id || String(currentWeek.estado).toLowerCase() === "cerrada"}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cerrar semana
              </button>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">KPI's y riesgos relevantes de la semana</p>
            <div className="rounded-xl border border-slate-200 bg-white px-2">
              <AutoTextarea
                value={currentWeek.kpis_riesgos}
                onChange={(value) => setCurrentWeek((current) => ({ ...current, kpis_riesgos: value }))}
                placeholder="Desviaciones, KPI's y riesgos que Dirección debe conocer antes de la sesión"
              />
            </div>
          </div>

          {showWeeks && (
            <div className="mt-3 max-h-[220px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {weeks.length === 0 ? (
                <div className="px-4 py-3 text-xs font-bold text-slate-400">
                  No hay semanas guardadas.
                </div>
              ) : (
                weeks.map((week) => (
                  <button
                    key={week.id}
                    type="button"
                    onClick={() => loadWeek(week)}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-xs font-black text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
                  >
                    <span>
                      Semana {getWeekNumber(week.fecha_inicio)} · {formatDate(week.fecha_inicio)} al{" "}
                      {formatDate(week.fecha_fin)}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${getWeekStatusBadgeClass(week.estado)}`}>{getWeekStatusLabel(week.estado)}</span>
                  </button>
                ))
              )}
            </div>
          )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {activeTab === "ENFOQUE" && (
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <Th className="w-[44px]">✓</Th>
                <Th className="w-[110px] min-w-[110px]">Prioridad</Th>
                <Th className="min-w-[220px]">Tema</Th>
                <Th className="min-w-[260px]">Resultado esperado</Th>
                <Th className="min-w-[240px]">Responsable</Th>
                <Th className="w-[80px]">Min</Th>
                <Th className="w-[104px]" />
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row, index) => {
                const convertKey = `ENFOQUE::${row.id}`;
                return (
                  <React.Fragment key={`enfoque-${index}`}>
                    <tr>
                      <Td className="w-[44px]">
                        <input
                          type="checkbox"
                          checked={row.revisado}
                          onChange={(event) => updateRow(index, "revisado", event.target.checked)}
                          className="mt-2 h-4 w-4 accent-red-600"
                        />
                      </Td>
                      <Td className="w-[110px] min-w-[110px]">
                        <AutoTextarea
                          value={row.prioridad}
                          onChange={(value) => updateRow(index, "prioridad", value)}
                        />
                      </Td>
                      <Td className="min-w-[220px]">
                        <AutoTextarea
                          value={row.tema}
                          onChange={(value) => updateRow(index, "tema", value)}
                          placeholder="Tema estratégico"
                        />
                      </Td>
                      <Td className="min-w-[260px]">
                        <AutoTextarea
                          value={row.resultado}
                          onChange={(value) => updateRow(index, "resultado", value)}
                          placeholder="Resultado esperado"
                        />
                      </Td>
                      <Td className="min-w-[240px]">
                        <ResponsibleSelect
                          value={row.responsableId}
                          people={people}
                          onChange={(payload) => updateResponsible(index, payload)}
                        />
                      </Td>
                      <Td className="w-[80px]">
                        <input
                          type="number"
                          min="0"
                          value={row.tiempo || ""}
                          onChange={(event) => updateRow(index, "tiempo", event.target.value)}
                          placeholder="30"
                          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-red-200 focus:bg-white"
                        />
                      </Td>
                      <Td className="w-[104px] px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <CreateAccionButton onClick={() => handleCrearAccionEnfoque(row)} disabled={!row.id} />
                          <SolicitarDireccionButton onClick={() => handleSolicitarDireccion(row, "ENFOQUE")} disabled={!row.id} />
                          <AsignacionButton
                            onClick={() => setConvertingKey((current) => (current === convertKey ? null : convertKey))}
                            disabled={!row.id}
                            active={convertingKey === convertKey}
                          />
                          <DeleteButton onClick={() => deleteRow(index)} />
                        </div>
                      </Td>
                    </tr>
                    {convertingKey === convertKey && (
                      <ConvertirEnAsignacionForm
                        colSpan={7}
                        personasCatalogo={people}
                        onCancel={() => setConvertingKey(null)}
                        onConfirm={(payload) => handleConvertToAssignment(row, "ENFOQUE", payload)}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === "INSUMOS" && (
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <Th className="w-[22%]">Tema</Th>
                <Th className="w-[28%]">Insumo</Th>
                <Th className="w-[22%]">Responsable</Th>
                <Th className="w-[16%]">Fuente</Th>
                <Th className="w-[125px]">Estado</Th>
                <Th className="w-[86px]">Aviso</Th>
                <Th className="w-[38px]" />
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row, index) => (
                <tr key={`insumo-${index}`}>
                  <Td>
                    <AutoTextarea
                      value={row.tema}
                      onChange={(value) => updateRow(index, "tema", value)}
                      placeholder="Tema"
                    />
                  </Td>
                  <Td>
                    <AutoTextarea
                      value={row.insumo}
                      onChange={(value) => updateRow(index, "insumo", value)}
                      placeholder="Insumo requerido"
                    />
                  </Td>
                  <Td>
                    <ResponsibleSelect
                      value={row.responsableId}
                      people={people}
                      onChange={(payload) => updateResponsible(index, payload)}
                    />
                  </Td>
                  <Td>
                    <AutoTextarea
                      value={row.fuente}
                      onChange={(value) => updateRow(index, "fuente", value)}
                      placeholder="Módulo o enlace"
                    />
                  </Td>
                  <Td className="w-[125px]">
                    <ClickBadge
                      value={row.estado}
                      options={statusFlow}
                      onChange={(value) => updateRow(index, "estado", value)}
                    />
                  </Td>
                  <Td className="w-[86px]">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 px-3 py-1 text-[11px] font-black text-slate-600 transition hover:border-red-200 hover:text-red-600"
                    >
                      Avisar
                    </button>
                  </Td>
                  <Td className="w-[38px] px-2 text-center">
                    <DeleteButton onClick={() => deleteRow(index)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === "SESIÓN" && (
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <Th className="w-[42px]">✓</Th>
                <Th className="w-[30%]">Tema</Th>
                <Th className="w-[145px]">Resultado</Th>
                <Th>Observación</Th>
                <Th className="w-[104px]" />
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row, index) => {
                const convertKey = `SESIÓN::${row.id}`;
                return (
                  <React.Fragment key={`sesion-${index}`}>
                    <tr>
                      <Td className="w-[42px]">
                        <input
                          type="checkbox"
                          checked={row.revisado}
                          onChange={(event) => updateRow(index, "revisado", event.target.checked)}
                          className="mt-2 h-4 w-4 accent-red-600"
                        />
                      </Td>
                      <Td>
                        <AutoTextarea
                          value={row.tema}
                          onChange={(value) => updateRow(index, "tema", value)}
                          placeholder="Tema revisado"
                        />
                      </Td>
                      <Td className="w-[145px]">
                        <ClickBadge
                          value={row.resultado}
                          options={resultFlow}
                          onChange={(value) => updateRow(index, "resultado", value)}
                        />
                      </Td>
                      <Td>
                        <AutoTextarea
                          value={row.observacion}
                          onChange={(value) => updateRow(index, "observacion", value)}
                          placeholder="Observación ejecutiva"
                        />
                        {row.accionId && (
                          <span className="mt-1 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-black text-sky-700">
                            Acción #{row.accionId} creada
                          </span>
                        )}
                      </Td>
                      <Td className="w-[104px] px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <CreateAccionButton onClick={() => handleCrearAccionSesion(row)} disabled={!row.id} />
                          <SolicitarDireccionButton onClick={() => handleSolicitarDireccion(row, "SESIÓN")} disabled={!row.id} />
                          <AsignacionButton
                            onClick={() => setConvertingKey((current) => (current === convertKey ? null : convertKey))}
                            disabled={!row.id}
                            active={convertingKey === convertKey}
                          />
                          <DeleteButton onClick={() => deleteRow(index)} />
                        </div>
                      </Td>
                    </tr>
                    {convertingKey === convertKey && (
                      <ConvertirEnAsignacionForm
                        colSpan={5}
                        personasCatalogo={people}
                        onCancel={() => setConvertingKey(null)}
                        onConfirm={(payload) => handleConvertToAssignment(row, "SESIÓN", payload)}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === "MINUTAS" && (
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
                      {mapProcesses.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Participantes (firmarán la minuta)</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {people.map((p) => (
                      <button key={p.id} type="button" onClick={() => toggleParticipante(p.id)} className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${minutaNewDraft.participantesPersonaIds.includes(p.id) ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                        {p.nombre}
                      </button>
                    ))}
                  </div>
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
                          {people.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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

            {minutasLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-[12px] font-bold text-slate-400">Cargando minutas…</div>
            ) : (minutas || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-[12px] font-bold text-slate-300">Aún no hay minutas registradas.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(minutas || []).map((m) => {
                  const info = minutaTipoInfo(m.tipo);
                  const firmados = m.participantes.filter((p) => p.firmado).length;
                  return (
                    <button key={m.id} type="button" onClick={() => openMinuta(m.id)} className="rounded-3xl border-2 border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${info.accent}`}>{info.icon} {m.tipo}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${m.cerrada ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.cerrada ? "Cerrada" : "Abierta"}</span>
                      </div>
                      <p className="mt-2 text-[14px] font-black leading-tight text-slate-900">{m.titulo}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">{formatDate(m.fecha)}{m.proceso_relacionado ? ` · ${m.proceso_relacionado}` : ""}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${info.solid}`} style={{ width: `${m.participantes.length ? (firmados / m.participantes.length) * 100 : 0}%` }} />
                        </div>
                        <span className="shrink-0 text-[10px] font-black text-slate-500">{firmados}/{m.participantes.length} firmas</span>
                      </div>
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
                    {selectedMinuta.pdf_url && (
                      <a href={selectedMinuta.pdf_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-black text-emerald-700 hover:bg-emerald-100">
                        📄 Descargar PDF firmado
                      </a>
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
                              {people.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
        )}
      </div>
      </div>
    </section>
  );
}
