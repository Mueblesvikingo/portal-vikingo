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
  // "Tabla" es lo primero que ve cualquiera al entrar — una lista concreta
  // de acciones da un punto de partida más claro para un líder de proceso
  // que un dashboard de KPIs, que se queda como una pestaña más, no la de
  // aterrizaje.
  const [activeTab, setActiveTab] = useState("tabla");
  const [filtroNivel, setFiltroNivel] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [selectedAccionId, setSelectedAccionId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

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

  const filteredAcciones = useMemo(() => {
    return acciones.filter((a) => {
      if (filtroNivel !== "all" && a.nivel !== filtroNivel) return false;
      if (filtroTipo !== "all" && a.tipo !== filtroTipo) return false;
      if (filtroEstado !== "all" && a.estado !== filtroEstado) return false;
      return true;
    });
  }, [acciones, filtroNivel, filtroTipo, filtroEstado]);

  const personasById = useMemo(() => Object.fromEntries(personas.map((p) => [p.id, p])), [personas]);
  const procesosById = useMemo(() => Object.fromEntries(procesos.map((p) => [p.id, p])), [procesos]);
  const objetivosById = useMemo(() => Object.fromEntries(objetivos.map((o) => [o.id, o])), [objetivos]);

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

  // Botón "→ Proyecto" del detalle — crea el proyecto en el tablero PMO
  // (mismo createProyecto ya usado desde Balance de Carga → Proyectos) y
  // avisa a la PM referenciando el proyecto recién creado.
  async function handleCrearProyecto(accion, payload) {
    const proyectosActuales = await getProyectos(false);
    const orden = proyectosActuales.reduce((max, p) => Math.max(max, p.orden || 0), 0) + 1;
    const result = await createProyecto(
      { nombre: payload.nombre, orden, asignacionId: null, liderProyectoPersonaId: payload.liderPersonaId || null },
      { actor: currentUser }
    );
    if (!result?.ok) { console.error(result?.error); alert("No fue posible crear el proyecto."); return false; }
    await notificarPMConversion(accion, `Acción ${accion.codigo} convertida en proyecto: ${payload.nombre}`, result.data.id);
    alert(`Proyecto "${payload.nombre}" creado en el Tablero PMO.`);
    return true;
  }

  const selectedAccion = acciones.find((a) => a.id === selectedAccionId) || null;

  const tabs = [
    { key: "tabla", label: "Tabla" },
    { key: "kanban", label: "Kanban" },
    { key: "dashboard", label: "Dashboard" },
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
    <section className="space-y-3">
      <div className="rounded-[22px] border border-slate-200 bg-white/70 p-3 shadow-sm">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-sky-700">¿Cómo funciona este módulo?</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS_GUIA.map((paso) => (
              <div key={paso.n} className="flex items-start gap-2 rounded-xl border border-sky-100 bg-white/80 px-2.5 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#001225] text-[10px] font-black text-white">{paso.n}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-800">{paso.icono} {paso.titulo}</p>
                  <p className="text-[9.5px] font-semibold leading-tight text-slate-500">{paso.detalle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
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
            {filteredAcciones.length} acciones
          </span>
        </div>

        <div className="mt-2 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-[#001225] px-4 py-1.5 text-white">
            <h2 className="text-[13px] font-black uppercase tracking-tight">Acciones de Mejora</h2>
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

          {message && <div className="mx-3 mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">{message}</div>}

          <div className="p-3">
            {loading ? (
              <div className="py-10 text-center text-[11px] font-bold text-slate-300">Cargando…</div>
            ) : activeTab === "dashboard" ? (
              <DashboardTab acciones={filteredAcciones} procesosById={procesosById} />
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
