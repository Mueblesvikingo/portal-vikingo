import React, { useEffect, useMemo, useRef, useState } from "react";
// Ajusta esta ruta si tu proyecto exporta supabase desde otra ubicación.
// Usa la misma ruta que ya te funcionó en la versión anterior.
import { supabase } from "../../services/supabase";
import { createAccion, getTiposFlujo } from "../../services/accionesService";
import { getFlujoConfig } from "../actions/actionsHelpers";

const tabs = ["ENFOQUE", "INSUMOS", "SESIÓN"];

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
  return value === "abierta" ? "Abierta" : status;
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
  });

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

  useEffect(() => {
    loadPeople();
    loadWeeks();
    getTiposFlujo().then(setTiposFlujoAcciones);
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
    alert(`Acción ${result.data.codigo} creada en el Centro de Gestión de Acciones.`);
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
      return;
    }

    setWeeks(weeksData || []);
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
    });

    setData((current) => ({
      ...current,
      ENFOQUE: [],
    }));

    setActiveTab("ENFOQUE");
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

    return { total, reviewed, closed, pending };
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
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Acuerdos" value={sessionSummary.total} tone="slate" />
          <KpiCard label="Revisados" value={sessionSummary.reviewed} tone="emerald" />
          <KpiCard label="Cerrados" value={sessionSummary.closed} tone="emerald" />
          <KpiCard label="Pendientes" value={sessionSummary.pending} tone={sessionSummary.pending > 0 ? "amber" : "slate"} />
        </div>
      )}

      {activeTab === "ENFOQUE" && (
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
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">{getWeekStatusLabel(week.estado)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

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
                <Th className="w-[56px]" />
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row, index) => (
                <tr key={`enfoque-${index}`}>
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
                  <Td className="w-[56px] px-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <CreateAccionButton onClick={() => handleCrearAccionEnfoque(row)} disabled={!row.id} />
                      <DeleteButton onClick={() => deleteRow(index)} />
                    </div>
                  </Td>
                </tr>
              ))}
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
                <Th className="w-[56px]" />
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row, index) => (
                <tr key={`sesion-${index}`}>
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
                  </Td>
                  <Td className="w-[56px] px-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <CreateAccionButton onClick={() => handleCrearAccionSesion(row)} disabled={!row.id} />
                      <DeleteButton onClick={() => deleteRow(index)} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </section>
  );
}
