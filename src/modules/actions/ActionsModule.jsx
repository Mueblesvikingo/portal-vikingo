import { useEffect, useMemo, useState } from "react";
import {
  getAcciones,
  getTiposFlujo,
  createAccion,
  updateAccion,
  deactivateAccion,
} from "../../services/accionesService";
import { getMacroprocesos } from "../../services/performanceService";
import { getPersonas } from "../../services/organizationCatalogService";
import { getObjetivos } from "../../services/strategicDeploymentService";
import { createWorkloadAssignment } from "../../services/workloadService";
import { getProyectos, createProyecto, createRecordatorio, PM_PERSONA_ID } from "../../services/pmoService";
import { isStrategicTeamMember, esParticipanteAccion } from "../../services/permissionsService";
import { NIVELES_ACCION, TIPOS_ACCION, ESTADOS_ACCION, getFlujoConfig } from "./actionsHelpers";
import DashboardTab from "./DashboardTab";
import KanbanTab from "./KanbanTab";
import TablaTab from "./TablaTab";
import AccionDetailPanel from "./AccionDetailPanel";
import NuevaAccionModal from "./NuevaAccionModal";

export default function ActionsModule({ currentUser }) {
  const [acciones, setAcciones] = useState([]);
  const [tiposFlujo, setTiposFlujo] = useState([]);
  const [procesos, setProcesos] = useState([]);
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
  const [scope, setScope] = useState(() => (isStrategicTeamMember(currentUser) ? "todas" : "mias"));
  const [filtroNivel, setFiltroNivel] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [selectedAccionId, setSelectedAccionId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  // La guía de 4 pasos ayuda mucho la primera vez, pero satura la vista en
  // cada visita posterior — se recuerda en localStorage si ya se ocultó, y
  // queda siempre a un clic de volver a abrirse.
  const [guiaAbierta, setGuiaAbierta] = useState(() => {
    try { return localStorage.getItem("acciones_guia_oculta") !== "1"; } catch { return true; }
  });
  function cerrarGuia() {
    setGuiaAbierta(false);
    try { localStorage.setItem("acciones_guia_oculta", "1"); } catch { /* localStorage no disponible */ }
  }

  async function loadAll() {
    setLoading(true);
    const [accionesData, tiposData, procesosData, personasData, objetivosData] = await Promise.all([
      getAcciones(),
      getTiposFlujo(),
      getMacroprocesos(),
      getPersonas().catch((err) => { console.error("Error al cargar personas:", err); return []; }),
      getObjetivos(),
    ]);
    setAcciones(accionesData);
    setTiposFlujo(tiposData);
    setProcesos(procesosData);
    setPersonas(personasData.filter((p) => p.activo !== false && (!p.tipo || p.tipo === "persona")));
    setObjetivos(objetivosData.filter((o) => o.codigo !== "GLOBAL"));
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const personasById = useMemo(() => Object.fromEntries(personas.map((p) => [p.id, p])), [personas]);
  const procesosById = useMemo(() => Object.fromEntries(procesos.map((p) => [p.id, p])), [procesos]);
  const objetivosById = useMemo(() => Object.fromEntries(objetivos.map((o) => [o.id, o])), [objetivos]);

  const misAcciones = useMemo(
    () => acciones.filter((a) => esParticipanteAccion(currentUser, a, a.proceso_id ? procesosById[a.proceso_id] : null)),
    [acciones, procesosById, currentUser]
  );

  const filteredAcciones = useMemo(() => {
    const base = scope === "mias" ? misAcciones : acciones;
    return base.filter((a) => {
      if (filtroNivel !== "all" && a.nivel !== filtroNivel) return false;
      if (filtroTipo !== "all" && a.tipo !== filtroTipo) return false;
      if (filtroEstado !== "all" && a.estado !== filtroEstado) return false;
      return true;
    });
  }, [acciones, misAcciones, scope, filtroNivel, filtroTipo, filtroEstado]);

  async function handleCreateAccion(payload) {
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
  }

  async function handleUpdateAccion(id, updates) {
    const previous = acciones.find((a) => a.id === id);
    const result = await updateAccion(id, updates, { actor: currentUser, previous });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible actualizar la acción."); return; }
    setAcciones((current) => current.map((a) => (a.id === id ? { ...a, ...result.data } : a)));
  }

  async function handleDeactivateAccion(id) {
    if (!window.confirm("¿Quitar esta acción del centro de gestión?")) return;
    const previous = acciones.find((a) => a.id === id);
    const result = await deactivateAccion(id, { actor: currentUser, previous });
    if (!result?.ok) { console.error(result?.error); setMessage("No fue posible quitar la acción."); return; }
    setAcciones((current) => current.filter((a) => a.id !== id));
    setSelectedAccionId((current) => (current === id ? null : current));
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
    await notificarPMConversion(accion, `Acción ${accion.codigo} convertida en asignación para ${payload.personaNombre}: ${accion.titulo}`);
    alert(`Asignación creada para ${payload.personaNombre} en Balance de Carga.`);
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
    { key: "dashboard", label: "Dashboard" },
    { key: "tabla", label: "Tabla" },
    { key: "kanban", label: "Kanban" },
  ];

  // Guía de 4 pasos, siempre visible arriba del módulo — pensada para que
  // un líder de proceso que nunca lo ha usado entienda de un vistazo qué
  // hacer y qué sigue, sin tener que preguntar. Mismo orden que ya impone
  // el flujo real (ver AccionDetailPanel.jsx: Análisis de causa → Plan de
  // acción → aprobación del Director → conversión).
  const PASOS_GUIA = [
    { n: "1", icono: "📝", titulo: "Reporta el problema", detalle: "Cualquiera puede registrar una situación con \"+ Nueva Acción\"." },
    { n: "2", icono: "🔍", titulo: "Analiza la causa", detalle: "Tú, como líder, usas 5 Porqués / Ishikawa / 5W2H." },
    { n: "3", icono: "✅", titulo: "Dirección aprueba", detalle: "Con la causa raíz clara, el Director autoriza la acción." },
    { n: "4", icono: "🚀", titulo: "Se ejecuta", detalle: "Se convierte en asignación o proyecto, y se le da seguimiento." },
  ];

  return (
    <section className="space-y-2.5">
      {guiaAbierta ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-2.5">
          <button type="button" onClick={cerrarGuia} className="mb-2 flex w-full items-center justify-between text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-700">¿Cómo funciona este módulo?</span>
            <span className="text-[10px] font-black text-sky-400">Ocultar ×</span>
          </button>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
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
      ) : (
        <button type="button" onClick={() => setGuiaAbierta(true)} className="text-[9px] font-black uppercase tracking-widest text-sky-600 hover:underline">
          ¿Cómo funciona este módulo? ▾
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setScope("mias")}
              className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${scope === "mias" ? "bg-[#001225] text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              Mis acciones
            </button>
            <button
              type="button"
              onClick={() => setScope("todas")}
              className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${scope === "todas" ? "bg-[#001225] text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              Todas
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-9 rounded-lg bg-[#001225] px-4 text-[10px] font-black text-white transition hover:bg-[#0a1c3a]"
          >
            + Reportar problema / Nueva acción
          </button>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nivel:
            <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} className="ml-2 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              <option value="all">Todos</option>
              {NIVELES_ACCION.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Tipo:
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="ml-2 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              <option value="all">Todos</option>
              {TIPOS_ACCION.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Estado:
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="ml-2 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold normal-case tracking-normal text-slate-700 outline-none">
              <option value="all">Todos</option>
              {ESTADOS_ACCION.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-500">
          {filteredAcciones.length} {scope === "mias" ? "acciones mías" : "acciones en total"}
        </span>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-[#001225] px-4 py-1.5 text-white">
          <h2 className="text-[13px] font-black uppercase tracking-tight">{scope === "mias" ? "Mis Acciones de Mejora" : "Acciones de Mejora"}</h2>
          <div className="flex gap-1 rounded-xl bg-white/10 p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${activeTab === tab.key ? "bg-white text-[#001225]" : "text-white/70 hover:bg-white/10"}`}
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
                onSelectAccion={setSelectedAccionId}
                onCreateAssignment={handleCrearAsignacion}
              />
            )}
          </div>
        </div>
      {creating && (
        <NuevaAccionModal
          procesos={procesos}
          personas={personas}
          objetivos={objetivos}
          onSave={handleCreateAccion}
          onClose={() => setCreating(false)}
        />
      )}

      {selectedAccion && (
        <AccionDetailPanel
          accion={selectedAccion}
          tiposFlujo={tiposFlujo}
          procesos={procesos}
          personas={personas}
          objetivos={objetivos}
          procesosById={procesosById}
          personasById={personasById}
          objetivosById={objetivosById}
          currentUser={currentUser}
          onUpdate={(updates) => handleUpdateAccion(selectedAccion.id, updates)}
          onDeactivate={() => handleDeactivateAccion(selectedAccion.id)}
          onClose={() => setSelectedAccionId(null)}
          onCreateAssignment={handleCrearAsignacion}
          onCreateProyecto={handleCrearProyecto}
        />
      )}
    </section>
  );
}
