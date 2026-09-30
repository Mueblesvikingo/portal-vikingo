import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getAcciones,
  getTiposFlujo,
  createAccion,
  updateAccion,
  deactivateAccion,
  notificarNuevaAccion,
  notificarInvolucrados,
  updatePlanResponsable,
} from "../../services/accionesService";
import { getMacroprocesos } from "../../services/performanceService";
import { getPersonas } from "../../services/organizationCatalogService";
import { getSubprocesosCatalog } from "../../services/organizationalDesignService";
import { getObjetivos } from "../../services/strategicDeploymentService";
import { createWorkloadAssignment } from "../../services/workloadService";
import { getProyectos, createProyecto, createRecordatorio, PM_PERSONA_ID } from "../../services/pmoService";
import { isStrategicTeamMember, esParticipanteAccion, isOperativeRole } from "../../services/permissionsService";
import { NIVELES_ACCION, TIPOS_ACCION, ESTADOS_ACCION, getFlujoConfig } from "./actionsHelpers";
import DashboardTab from "./DashboardTab";
import KanbanTab from "./KanbanTab";
import TablaTab from "./TablaTab";
import AccionDetailPanel from "./AccionDetailPanel";
import NuevaAccionModal from "./NuevaAccionModal";
import BottomNav from "./BottomNav";

export default function ActionsModule({ currentUser }) {
  const location = useLocation();
  const [acciones, setAcciones] = useState([]);
  const [tiposFlujo, setTiposFlujo] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [subprocesos, setSubprocesos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Un líder de proceso debe sentir este módulo como su propio gestor: entra
  // viendo SUS acciones (las que creó, en las que es responsable, o de un
  // proceso suyo aunque otro la haya levantado), no el tablero completo de
  // toda la organización. Equipo estratégico sí necesita esa vista global
  // de entrada, así que arranca en "todas". Cualquiera puede cambiar el
  // alcance con el toggle — nada queda oculto, solo cambia el default.
  // Auxiliares/supervisores son la excepción: su alcance es reportar, no
  // supervisar el módulo completo — se quedan fijos en "Mis acciones" (ver
  // esOperativo más abajo, que además oculta el propio toggle).
  const esOperativo = isOperativeRole(currentUser);
  const [scope, setScope] = useState(() => (isStrategicTeamMember(currentUser) ? "todas" : "mias"));
  const [filtroNivel, setFiltroNivel] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const filtrosActivos = [filtroNivel, filtroTipo, filtroEstado].filter((f) => f !== "all").length;
  const [selectedAccionId, setSelectedAccionId] = useState(null);
  const [initialSubTab, setInitialSubTab] = useState(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  // Estructura tipo Calidad: barra inferior con Inicio/Guías, e "Inicio"
  // arranca en un grid de tarjetas (Nueva/Abiertas/Historial) en vez de ir
  // directo al tablero — cada tarjeta abre su propio panel, como los
  // formatos de inspección. seccionActiva solo aplica dentro de "inicio".
  const [bottomTab, setBottomTab] = useState("inicio");
  const [seccionActiva, setSeccionActiva] = useState(null);
  // Prellenado que llega desde Calidad (botón "Generar Acción de Mejora" en
  // una no conformidad) — ver más abajo el useEffect que lo consume.
  const [prefillNueva, setPrefillNueva] = useState(null);

  async function loadAll() {
    setLoading(true);
    const [accionesData, tiposData, procesosData, subprocesosData, personasData, objetivosData] = await Promise.all([
      getAcciones(),
      getTiposFlujo(),
      getMacroprocesos(),
      getSubprocesosCatalog(),
      getPersonas().catch((err) => { console.error("Error al cargar personas:", err); return []; }),
      getObjetivos(),
    ]);
    setAcciones(accionesData);
    setTiposFlujo(tiposData);
    setProcesos(procesosData);
    setSubprocesos(subprocesosData);
    setPersonas(personasData.filter((p) => p.activo !== false && (!p.tipo || p.tipo === "persona")));
    setObjetivos(objetivosData.filter((o) => o.codigo !== "GLOBAL"));
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Llegada desde la alarma de notificaciones urgentes (MeetingAttendanceAlarm)
  // con `state: { openAccionId }` — mismo patrón ya usado por SigDiagnosisModule
  // para abrir directo la auditoría señalada en el aviso.
  useEffect(() => {
    if (location.state?.openAccionId) setSelectedAccionId(location.state.openAccionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Llegada desde Calidad (botón "Generar Acción de Mejora" en una no
  // conformidad, ver shared.jsx DetalleRegistroModal) — mismo mecanismo de
  // `location.state` que openAccionId arriba. Abre el modal de alta ya
  // parado en Inicio y con el problema redactado, para que se sienta
  // continuación del mismo trámite y no un módulo aparte.
  useEffect(() => {
    if (location.state?.prefillNuevaAccion) {
      setBottomTab("inicio");
      setSeccionActiva(null);
      setPrefillNueva(location.state.prefillNuevaAccion);
      setCreating(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const personasById = useMemo(() => Object.fromEntries(personas.map((p) => [p.id, p])), [personas]);
  const procesosById = useMemo(() => Object.fromEntries(procesos.map((p) => [p.id, p])), [procesos]);
  const subprocesosById = useMemo(() => Object.fromEntries(subprocesos.map((s) => [s.id, s])), [subprocesos]);
  const objetivosById = useMemo(() => Object.fromEntries(objetivos.map((o) => [o.id, o])), [objetivos]);

  const misAcciones = useMemo(
    () => acciones.filter((a) => esParticipanteAccion(currentUser, a, a.proceso_id ? procesosById[a.proceso_id] : null)),
    [acciones, procesosById, currentUser]
  );

  // Base para "Abiertas" (Dashboard/Tablero/Tabla) e "Historial" (cerradas)
  // — Historial no pasa por filtroNivel/Tipo/Estado, es una lista simple.
  const baseAcciones = useMemo(
    () => ((esOperativo || scope === "mias") ? misAcciones : acciones),
    [esOperativo, scope, misAcciones, acciones]
  );
  const accionesAbiertas = useMemo(() => baseAcciones.filter((a) => a.estado !== "Cerrada"), [baseAcciones]);
  const accionesHistorial = useMemo(() => baseAcciones.filter((a) => a.estado === "Cerrada"), [baseAcciones]);

  const filteredAcciones = useMemo(() => {
    return accionesAbiertas.filter((a) => {
      if (filtroNivel !== "all" && a.nivel !== filtroNivel) return false;
      if (filtroTipo !== "all" && a.tipo !== filtroTipo) return false;
      if (filtroEstado !== "all" && a.estado !== filtroEstado) return false;
      return true;
    });
  }, [accionesAbiertas, filtroNivel, filtroTipo, filtroEstado]);

  async function handleCreateAccion({ involucradosIds, ...payload }) {
    const flujo = getFlujoConfig(tiposFlujo, payload.tipo);
    const result = await createAccion(
      {
        ...payload,
        estado: "Registrada",
        requiereAnalisisCausa: flujo.requiere_analisis_causa,
        requiereVerificacionEficacia: flujo.requiere_verificacion_eficacia,
        requiereAprobacion: flujo.requiere_aprobacion,
      },
      currentUser
    );
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible crear la acción."); return; }
    setAcciones((current) => [result.data, ...current]);
    setCreating(false);
    setSelectedAccionId(result.data.id);
    // No bloquea el alta si falla — la acción ya quedó registrada, avisar a
    // los involucrados (elegidos a mano + equipo estratégico siempre) es un
    // paso aparte.
    await notificarNuevaAccion(result.data, involucradosIds, personas);
  }

  // Notificaciones automáticas del flujo en las dos transiciones críticas:
  // aprobación de Dirección (sirena, ver MeetingAttendanceAlarm) y cierre
  // (solo campanita). Centralizado aquí porque tanto las pastillas de flujo
  // del detalle como el drag-and-drop del Kanban pasan por esta misma
  // función para cambiar el estado.
  async function handleUpdateAccion(id, updates) {
    const previous = acciones.find((a) => a.id === id);
    const result = await updateAccion(id, updates, { actor: currentUser, previous });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible actualizar la acción."); return; }
    setAcciones((current) => current.map((a) => (a.id === id ? { ...a, ...result.data } : a)));

    if (updates.estado === "Aprobada" && previous?.estado !== "Aprobada") {
      await notificarInvolucrados(id, {
        tipo: "aprobacion",
        mensaje: `Dirección aprobó el plan de acción de ${result.data.codigo}: ${result.data.titulo}.`,
        urgente: true,
      });
    } else if (updates.estado === "En validación" && previous?.estado !== "En validación") {
      await notificarInvolucrados(id, {
        tipo: "validacion",
        mensaje: `${result.data.codigo} pasó a "En validación": ${result.data.titulo}.`,
        urgente: true,
      });
    } else if (updates.estado === "Verificación de eficacia" && previous?.estado !== "Verificación de eficacia") {
      await notificarInvolucrados(id, {
        tipo: "eficacia",
        mensaje: `${result.data.codigo} pasó a "Verificación de eficacia": ${result.data.titulo}.`,
        urgente: true,
      });
    } else if (updates.estado === "Cerrada" && previous?.estado !== "Cerrada") {
      await notificarInvolucrados(id, {
        tipo: "cierre",
        mensaje: `Se cerró la acción ${result.data.codigo}: ${result.data.titulo}.`,
        urgente: false,
      });
    }
  }

  async function handleDeactivateAccion(id) {
    if (!window.confirm("¿Quitar esta acción del centro de gestión?")) return;
    const previous = acciones.find((a) => a.id === id);
    const result = await deactivateAccion(id, { actor: currentUser, previous });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible quitar la acción."); return; }
    setAcciones((current) => current.filter((a) => a.id !== id));
    setSelectedAccionId((current) => (current === id ? null : current));
  }

  // Abre el detalle de una acción, opcionalmente enfocado en una pestaña
  // específica (usado por el botón "Ver" de la Tabla al hacer clic en un
  // bloque de la línea de tiempo).
  function handleSelectAccion(id, subTab = null) {
    setInitialSubTab(subTab);
    setSelectedAccionId(id);
  }

  // Avisa a la PM (persona fija, PM_PERSONA_ID) cuando una acción ya
  // aprobada se convierte en proyecto o asignación real — es ella quien le
  // da seguimiento a partir de ahí. No bloquea el flujo si falla: la
  // conversión ya se hizo, el aviso es un plus.
  async function notificarPMConversion(accion, mensaje, proyectoId = null) {
    const result = await createRecordatorio({ proyectoId, destinatarioPersonaId: PM_PERSONA_ID, mensaje }, { actor: currentUser });
    if (!result?.ok) console.error("No fue posible avisar a la PM:", result?.error);
  }

  // Genérico para el botón "→ Asignación" — usado tanto desde la tabla
  // (fila expandida) como desde el detalle de la acción, mismo destino en
  // Balance de Carga → Asignaciones.
  async function handleCrearAsignacion(accion, payload) {
    const result = await createWorkloadAssignment({
      persona_id: payload.personaId,
      responsable: payload.personaNombre,
      rol: "Responsable de acción",
      tipo: "Mejora",
      prioridad: payload.prioridad,
      gestion: "Otro",
      titulo: payload.titulo,
      descripcion: accion.descripcion || "",
      revisara: "", aprobara: "", seguimiento: "",
      carga_horas: payload.horas,
      fecha_limite: payload.fechaLimite,
      estado: "Pendiente",
      asigna: currentUser?.nombre || currentUser?.usuario || "",
      asigna_rol: "Acciones de Mejora",
      horas_totales: payload.horas,
      origen_estrategico: "Acciones",
    });
    if (!result?.ok) { console.error(result?.error); alert("No fue posible crear la asignación."); return false; }
    // `workload_asignacion_id` ya existía en la tabla `acciones` pero nunca
    // se escribía — sin esto, la PM no tenía forma de ver desde Acciones
    // cuáles ya bajaron a una asignación real de Balance de Carga.
    await handleUpdateAccion(accion.id, { workload_asignacion_id: result.data.id });
    await notificarPMConversion(accion, `Acción ${accion.codigo} convertida en asignación para ${payload.personaNombre}: ${accion.titulo}`);
    alert(`Asignación creada para ${payload.personaNombre} en Balance de Carga.`);
    // Se regresa el id (verdadero) en vez de solo `true` — lo reutiliza el
    // envío por lote del Plan de acción para saber qué asignación quedó
    // ligada a cada responsable.
    return result.data.id;
  }

  // Botón discreto "→ Enviar todo a Asignación" del Plan de acción: una vez
  // aprobada la acción, baja de un golpe a Balance de Carga cada responsable
  // de ejecución ya capturado (con su propio detalle/horas/fecha), en vez de
  // repetir el formulario de "→ Asignación" persona por persona. Solo se
  // envían los que aún no tienen `workload_asignacion_id` (evita duplicar si
  // se agregó gente después de un primer envío).
  async function handleEnviarPlanResponsables(accion, filas) {
    let enviados = 0;
    for (const fila of filas) {
      const result = await createWorkloadAssignment({
        persona_id: fila.persona_id,
        responsable: fila.personaNombre,
        rol: "Responsable de acción",
        tipo: "Mejora",
        prioridad: accion.prioridad,
        gestion: "Otro",
        titulo: accion.titulo,
        descripcion: fila.detalle || accion.descripcion || "",
        revisara: "", aprobara: "", seguimiento: "",
        carga_horas: fila.horas || 0,
        fecha_limite: fila.fecha_limite || accion.fecha_compromiso || null,
        estado: "Pendiente",
        asigna: currentUser?.nombre || currentUser?.usuario || "",
        asigna_rol: "Acciones de Mejora",
        horas_totales: fila.horas || 0,
        origen_estrategico: "Acciones",
      });
      if (!result?.ok) { console.error(result?.error); alert(`No fue posible crear la asignación de ${fila.personaNombre}.`); continue; }
      await updatePlanResponsable(fila.id, { workload_asignacion_id: result.data.id, enviado_at: new Date().toISOString() });
      enviados += 1;
    }
    if (enviados > 0) {
      await notificarPMConversion(accion, `Acción ${accion.codigo}: ${enviados} responsable(s) de ejecución enviados a Balance de Carga.`);
      alert(`${enviados} asignación(es) creada(s) en Balance de Carga.`);
    }
    return enviados;
  }

  // Botón "Programar junta rápida" del detalle — la PM y quien registró la
  // acción (u otros que se agreguen) quedan cada uno con un recordatorio de
  // reunión real en Balance de Carga; como MeetingAttendanceAlarm.jsx ya
  // vigila cualquier asignación cuyo tipo contenga "reuni", no hace falta
  // nada nuevo para que les suene la alarma de confirmación de asistencia.
  async function handleProgramarJunta(accion, payload) {
    for (const persona of payload.asistentes) {
      const result = await createWorkloadAssignment({
        persona_id: persona.personaId,
        responsable: persona.personaNombre,
        rol: "Convocado a junta",
        tipo: "Reunión: análisis de causa",
        prioridad: "Alta",
        gestion: "Otro",
        titulo: `Análisis colectivo — ${accion.codigo}`,
        descripcion: accion.titulo,
        revisara: "", aprobara: "", seguimiento: "",
        carga_horas: 1,
        fecha_limite: payload.fecha,
        hora_limite: payload.hora || null,
        estado: "Pendiente",
        asigna: currentUser?.nombre || currentUser?.usuario || "",
        asigna_rol: "Acciones de Mejora",
        horas_totales: 1,
        origen_estrategico: "Acciones",
      });
      if (!result?.ok) { console.error(result?.error); alert(`No fue posible programar la junta para ${persona.personaNombre}.`); return false; }
    }
    alert(`Junta programada para ${payload.asistentes.length} persona(s).`);
    return true;
  }

  // Botón "→ Proyecto" del detalle — no basta con registrarlo en el tablero
  // PMO: cada persona involucrada (el líder incluido) recibe además su
  // propia asignación en Balance de Carga con la misma carga/fecha/
  // prioridad, para que el proyecto quede reflejado donde se planea la
  // capacidad real, no solo como una fila en el tablero. La asignación del
  // líder es la que queda enlazada al proyecto (asignacionId), igual que ya
  // hace el alta de proyectos en WorkloadBalanceModule.jsx.
  async function handleCrearProyecto(accion, payload) {
    let liderAsignacionId = null;
    for (const persona of payload.involucrados) {
      const asigResult = await createWorkloadAssignment({
        persona_id: persona.personaId,
        responsable: persona.personaNombre,
        rol: persona.personaId === payload.liderPersonaId ? "Líder de proyecto" : "Equipo de proyecto",
        tipo: "Proyecto",
        prioridad: payload.prioridad,
        gestion: "Otro",
        titulo: payload.nombre,
        descripcion: accion.descripcion || "",
        revisara: "", aprobara: "", seguimiento: "",
        carga_horas: payload.horas,
        fecha_limite: payload.fechaLimite,
        estado: "Pendiente",
        asigna: currentUser?.nombre || currentUser?.usuario || "",
        asigna_rol: "Acciones de Mejora",
        horas_totales: payload.horas,
        origen_estrategico: "Acciones",
      });
      if (!asigResult?.ok) { console.error(asigResult?.error); alert(`No fue posible crear la asignación para ${persona.personaNombre}.`); return false; }
      if (persona.personaId === payload.liderPersonaId) liderAsignacionId = asigResult.data.id;
    }

    const proyectosActuales = await getProyectos(false);
    const orden = proyectosActuales.reduce((max, p) => Math.max(max, p.orden || 0), 0) + 1;
    const result = await createProyecto(
      { nombre: payload.nombre, orden, asignacionId: liderAsignacionId, liderProyectoPersonaId: payload.liderPersonaId || null },
      { actor: currentUser }
    );
    if (!result?.ok) { console.error(result?.error); alert("No fue posible crear el proyecto."); return false; }
    await notificarPMConversion(accion, `Acción ${accion.codigo} convertida en proyecto: ${payload.nombre}`, result.data.id);
    alert(`Proyecto "${payload.nombre}" creado en el Tablero PMO y asignado a ${payload.involucrados.length} persona(s) en Balance de Carga.`);
    return true;
  }

  const selectedAccion = acciones.find((a) => a.id === selectedAccionId) || null;

  const tabs = [
    { key: "dashboard", label: "Resumen" },
    { key: "kanban", label: "Tablero" },
    { key: "tabla", label: "Tabla" },
  ];

  // Guía de 4 pasos — antes vivía como banner en Inicio (con opción de
  // ocultar en localStorage); ahora que Inicio es el grid de tarjetas, la
  // guía se mudó a su propio destino en la barra inferior. Mismo orden que
  // ya impone el flujo real (ver AccionDetailPanel.jsx: Análisis de causa →
  // Plan de acción → aprobación del Director → conversión).
  const PASOS_GUIA = [
    { n: "1", icono: "📝", titulo: "Reporta el problema", detalle: "Cualquiera puede registrar una situación desde la tarjeta \"Nueva\"." },
    { n: "2", icono: "🔍", titulo: "Analiza la causa", detalle: "Tú, como líder, usas 5 Porqués / Ishikawa / 5W2H." },
    { n: "3", icono: "✅", titulo: "Dirección aprueba", detalle: "Con la causa raíz clara, el Director autoriza la acción." },
    { n: "4", icono: "🚀", titulo: "Se ejecuta", detalle: "Se convierte en asignación o proyecto, y se le da seguimiento." },
  ];

  // Tarjetas de Inicio, mismo estilo que los formatos de inspección de
  // Calidad (icono en chip, título, subtítulo chico) — cada una abre su
  // panel. "Nueva" no es tarjeta: es el botón pulsante dorado (ver más
  // abajo, mismo estilo que "+ Nueva ..." de cada formato de Calidad),
  // porque es la acción principal de la pantalla, no una sección a navegar.
  const INICIO_TILES = [
    { key: "abiertas", titulo: "Abiertas", subtitulo: `${accionesAbiertas.length} activa(s)`, icono: "🗂️" },
    { key: "historial", titulo: "Historial", subtitulo: `${accionesHistorial.length} cerrada(s)`, icono: "📜" },
  ];
  function handleTileClick(key) {
    setSeccionActiva(key);
  }

  const enInicioTiles = bottomTab === "inicio" && !seccionActiva;

  return (
    <section className="space-y-2.5 pb-24 lg:pb-2">
      {bottomTab === "guias" ? (
        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight text-[#001225]">Guías</h2>
          {esOperativo ? (
            // Alcance deliberadamente distinto al de un líder de proceso:
            // aquí solo se reporta la situación detectada — nada de análisis
            // de causa ni seguimiento del caso. Se deja explícito para que
            // el módulo no se perciba como un buzón de quejas abierto.
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-2.5 text-[10px] font-bold text-sky-800">
              📝 Aquí registras una situación o problema que detectaste. Tu reporte llega al líder del proceso y al equipo estratégico, quienes hacen el análisis y le dan seguimiento — este espacio no es un buzón de quejas, es el punto de partida de una acción de mejora real.
            </div>
          ) : (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-2.5">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-sky-700">¿Cómo funciona este módulo?</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {PASOS_GUIA.map((paso) => (
                  <div key={paso.n} className="flex items-start gap-2 rounded-xl bg-white/70 px-2.5 py-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#001225] text-[9px] font-black text-white">{paso.n}</span>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-black text-slate-800">{paso.icono} {paso.titulo}</p>
                      <p className="text-[9px] font-semibold leading-tight text-slate-500">{paso.detalle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : seccionActiva === "abiertas" ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSeccionActiva(null)} className="shrink-0 rounded-lg border border-[#edf0f4] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">← Volver</button>
            <h2 className="text-[12px] font-black uppercase tracking-tight text-[#001225]">Abiertas</h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {esOperativo ? (
              <span className="rounded-lg border border-[#edf0f4] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Mis reportes</span>
            ) : (
              <div className="flex rounded-lg border border-[#edf0f4] bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setScope("mias")}
                  className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition ${scope === "mias" ? "bg-[#001225] text-white" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Mis acciones
                </button>
                <button
                  type="button"
                  onClick={() => setScope("todas")}
                  className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition ${scope === "todas" ? "bg-[#001225] text-white" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Todas
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              className={`flex h-6 items-center gap-1 rounded-lg border px-2 text-[9px] font-black uppercase tracking-widest transition ${filtrosAbiertos || filtrosActivos > 0 ? "border-[#c9a227] bg-[#fdf7e6] text-[#96771a]" : "border-[#edf0f4] bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ""} {filtrosAbiertos ? "▲" : "▼"}
            </button>
            <span className="ml-auto rounded-full border border-[#edf0f4] bg-white px-2 py-0.5 text-[9px] font-black text-slate-500">
              {filteredAcciones.length} {scope === "mias" ? "mías" : "en total"}
            </span>
          </div>

          {filtrosAbiertos && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#edf0f4] bg-white px-3 py-2 shadow-sm">
              <label className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-600">
                Nivel:
                <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} className="h-6 rounded-md border border-indigo-200 bg-white px-1.5 text-[10px] font-bold normal-case tracking-normal text-indigo-700 outline-none">
                  <option value="all">Todos</option>
                  {NIVELES_ACCION.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-teal-600">
                Tipo:
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="h-6 rounded-md border border-teal-200 bg-white px-1.5 text-[10px] font-bold normal-case tracking-normal text-teal-700 outline-none">
                  <option value="all">Todos</option>
                  {TIPOS_ACCION.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700">
                Estado:
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="h-6 rounded-md border border-amber-200 bg-white px-1.5 text-[10px] font-bold normal-case tracking-normal text-amber-700 outline-none">
                  <option value="all">Todos</option>
                  {ESTADOS_ACCION.filter((e) => e !== "Cerrada").map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </label>
              {filtrosActivos > 0 && (
                <button
                  type="button"
                  onClick={() => { setFiltroNivel("all"); setFiltroTipo("all"); setFiltroEstado("all"); }}
                  className="text-[9px] font-black text-slate-400 underline hover:text-red-500"
                >
                  Limpiar
                </button>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[#edf0f4] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 bg-[#001225] px-3 py-1.5 text-white">
              <h2 className="truncate text-[11px] font-black uppercase tracking-tight">{scope === "mias" ? "Mis Acciones de Mejora" : "Acciones de Mejora"}</h2>
              <div className="flex shrink-0 gap-0.5 rounded-lg bg-white/10 p-0.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest transition ${activeTab === tab.key ? "bg-white text-[#001225]" : "text-white/70 hover:bg-white/10"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {message && (
              <div className="mx-3 mt-3 flex items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">
                <span>{message}</span>
                <button type="button" onClick={() => setMessage("")} className="shrink-0 text-red-400 hover:text-red-600">×</button>
              </div>
            )}

            <div className="p-3">
              {loading ? (
                <div className="py-10 text-center text-[11px] font-bold text-slate-300">Cargando…</div>
              ) : activeTab === "dashboard" ? (
                <DashboardTab acciones={filteredAcciones} procesosById={procesosById} scope={scope} onSelectAccion={setSelectedAccionId} />
              ) : activeTab === "kanban" ? (
                <KanbanTab
                  acciones={filteredAcciones}
                  tiposFlujo={tiposFlujo}
                  personasById={personasById}
                  procesosById={procesosById}
                  currentUser={currentUser}
                  onUpdateAccion={handleUpdateAccion}
                  onSelectAccion={setSelectedAccionId}
                />
              ) : (
                <TablaTab
                  acciones={filteredAcciones}
                  personas={personas}
                  personasById={personasById}
                  procesosById={procesosById}
                  currentUser={currentUser}
                  tiposFlujo={tiposFlujo}
                  onSelectAccion={handleSelectAccion}
                  onCreateAssignment={handleCrearAsignacion}
                />
              )}
            </div>
          </div>
        </div>
      ) : seccionActiva === "historial" ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSeccionActiva(null)} className="shrink-0 rounded-lg border border-[#edf0f4] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">← Volver</button>
            <h2 className="text-[12px] font-black uppercase tracking-tight text-[#001225]">Historial — acciones cerradas</h2>
          </div>
          {loading ? (
            <div className="py-10 text-center text-[11px] font-bold text-slate-300">Cargando…</div>
          ) : (
            <TablaTab
              acciones={accionesHistorial}
              personas={personas}
              personasById={personasById}
              procesosById={procesosById}
              currentUser={currentUser}
              tiposFlujo={tiposFlujo}
              onSelectAccion={handleSelectAccion}
              onCreateAssignment={handleCrearAsignacion}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mismo formato de encabezado que "Formatos de inspección" /
              "Herramientas SPC" en Calidad: chip de ícono + etiqueta chica +
              título, sobre una barra de color. */}
          <header className="flex items-center gap-2.5 rounded-xl bg-[#001225] px-3 py-2 sm:px-4">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#c9a227]">
              <span className="text-sm">🎯</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/50">Centro de Gestión</p>
              <p className="truncate text-sm font-bold text-white">Acciones de Mejora</p>
            </div>
          </header>

          {esOperativo && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-2.5 text-[10px] font-bold text-sky-800">
              📝 Aquí registras una situación o problema que detectaste. Tu reporte llega al líder del proceso y al equipo estratégico — este espacio no es un buzón de quejas, es el punto de partida de una acción de mejora real.
            </div>
          )}

          {/* Mismo botón (y animación de pulso dorado) que "+ Nueva
              recepción/inspección" en cada formato de Calidad — es la
              acción principal de la pantalla, por eso no es una tarjeta más
              del grid de abajo. */}
          <style>{`
            @keyframes gcGoldPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,162,39,0.35); } 50% { box-shadow: 0 0 0 7px rgba(201,162,39,0.10); } }
            .gc-gold-pulse { animation: gcGoldPulse 2.8s ease-in-out infinite; }
          `}</style>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="gc-gold-pulse flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-[#c9a227] bg-white px-2 py-2.5 text-sm font-semibold text-[#96771a] transition active:scale-[0.98]"
          >
            📝 + Nueva situación / acción
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {INICIO_TILES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTileClick(t.key)}
                className="flex flex-col items-center rounded-2xl border border-[#edf0f4] bg-white p-2.5 shadow-[0_1px_1px_rgba(11,31,58,0.04),0_4px_12px_-2px_rgba(11,31,58,0.07)] transition active:scale-[0.98] hover:border-[#f0d885]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fdf7e6] text-lg">{t.icono}</span>
                <p className="mt-1.5 text-center text-xs font-semibold leading-tight text-[#001225]">{t.titulo}</p>
                <p className="text-[10px] text-slate-500">{t.subtitulo}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <BottomNav active={bottomTab} onChange={(tab) => { setBottomTab(tab); setSeccionActiva(null); }} />

      {/* FAB — se oculta solo en el grid de tarjetas de Inicio (ahí ya está
          la tarjeta "Nueva" mismo destino), y se muestra en cualquier otra
          pantalla (Abiertas, Historial, Guías) para que crear una acción
          siempre esté a un toque, sin tener que volver primero a Inicio. */}
      {!enInicioTiles && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Registrar situación o acción"
          className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#c9a227] text-2xl font-black text-[#001225] shadow-[0_4px_10px_rgba(201,162,39,0.45)] transition hover:bg-[#b8931f] active:scale-95 lg:bottom-5"
        >
          +
        </button>
      )}

      {creating && (
        <NuevaAccionModal
          procesos={procesos}
          subprocesos={subprocesos}
          personas={personas}
          objetivos={objetivos}
          acciones={acciones}
          prefill={prefillNueva}
          onSave={handleCreateAccion}
          onClose={() => { setCreating(false); setPrefillNueva(null); }}
        />
      )}

      {selectedAccion && (
        <AccionDetailPanel
          accion={selectedAccion}
          acciones={acciones}
          tiposFlujo={tiposFlujo}
          procesos={procesos}
          subprocesos={subprocesos}
          personas={personas}
          objetivos={objetivos}
          procesosById={procesosById}
          subprocesosById={subprocesosById}
          personasById={personasById}
          objetivosById={objetivosById}
          currentUser={currentUser}
          initialSubTab={initialSubTab}
          onUpdate={(updates) => handleUpdateAccion(selectedAccion.id, updates)}
          onDeactivate={() => handleDeactivateAccion(selectedAccion.id)}
          onClose={() => setSelectedAccionId(null)}
          onCreateProyecto={handleCrearProyecto}
          onEnviarPlanResponsables={handleEnviarPlanResponsables}
          onProgramarJunta={handleProgramarJunta}
          onNavigateToAccion={setSelectedAccionId}
        />
      )}
    </section>
  );
}
