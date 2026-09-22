import { useEffect, useState } from "react";
import { getSemanaReferenciaISO, getProximoLunes, formatFechaCorta, toISODate } from "./sopHelpers";
import { getSemanasConDatos } from "../../services/sopVentanaSemanalService";
import { canEditSopOperacionParams, canEditSopFinancieroParams, canEditSopPlanVenta, canEditSopInventarios, canCreateSopSolicitud, isDirectorGeneral, isStrategicTeamMember } from "../../services/permissionsService";
import {
  getProductos,
  createProducto,
  setProductoActivo,
  updateProductoPrecio,
  updateProductoFamilia,
  getControl,
  updateControl,
  getParametros,
  updateParametros,
  getPlanVenta,
  upsertPlanVenta,
  getVentaReal,
  upsertVentaReal,
  getDecisiones,
  createDecision,
  deleteDecision,
  getSopSemanas,
  createSopSemana,
  cerrarSopSemana,
  getHistorico,
  closeCurrentMonth,
  getFirmasCiclo,
  ensureFirmasCiclo,
  upsertFirma,
  resetCicloFirmas,
  getPrioridadesSemana,
  upsertPrioridadSemana,
  updatePrioridadSemana,
  getCapacidadProcesos,
  getTiemposEstandar,
  updateTiempoEstandar,
  createFamiliaTiemposEstandar,
  deleteFamiliaTiemposEstandar,
  createEstacionTiemposEstandar,
  renameEstacion,
  createCapacidadProceso,
  updateCapacidadProceso,
  deactivateCapacidadProceso,
  getInfraestructura,
  createInfraestructura,
  updateInfraestructura,
  deactivateInfraestructura,
  getVacantesPersonal,
  createVacantePersonal,
  updateVacantePersonal,
  deactivateVacantePersonal,
  getFinancieroFilas,
  createFinancieroFila,
  updateFinancieroFila,
  deactivateFinancieroFila,
  getFinancieroMontos,
  upsertFinancieroMonto,
  getFinancieroAjustes,
  upsertFinancieroAjuste,
  deleteFinancieroAjuste,
} from "../../services/sopService";
import { getPersonas } from "../../services/organizationCatalogService";
import { createStrategicDecision, getStrategicDecisions, updateStrategicDecision } from "../../services/decisionService";
import { createWorkloadAssignment } from "../../services/workloadService";
import ControlTab from "./ControlTab";
import ParametrosTab from "./ParametrosTab";
import PlanVentaTab from "./PlanVentaTab";
import OperacionTab from "./OperacionTab";
import FinancieroTab from "./FinancieroTab";
import DecisionesTab from "./DecisionesTab";
import PrioridadesTab from "./PrioridadesTab";
import HistoricoTab from "./HistoricoTab";
import DecisionesDirectorTab from "./DecisionesDirectorTab";
import InventariosTab from "./InventariosTab";
import MpsTab from "./MpsTab";
import DashboardTab from "./DashboardTab";
import SolicitudModal from "./SolicitudModal";

const SOP_VIDEO_URL = "https://www.youtube.com/embed/p8qnJBX1yH8?autoplay=1&rel=0&modestbranding=1";
const SOP_MANUAL_URL = "/manuales/SOP_Mission_Control.pdf";

// A qué pestaña de sop_ventana_semanal corresponde cada pestaña del módulo
// que participa de la Vista semanal con datos propios por semana — Control
// (solo ciclo de firmas, mensual) y Acuerdos S&OP (su propio sistema de
// semanas vía sop_semanas) quedan fuera del filtro genérico de abajo.
const PESTANA_VENTANA = { dashboard: "dashboard", "plan-venta": "plan-venta", operacion: "operacion", financiero: "financiero", inventarios: "inventarios", mps: "mps", control: "control" };

// Inventarios, MPS y Control S&OP no tienen un "modo mensual" equivalente
// (el saldo, el horizonte de producción y el ciclo de firmas siempre parten
// de una semana puntual) — a diferencia de las otras, muestran su tabla y
// el selector de semana del encabezado aunque "Vista semanal" esté apagada.
// Nota: "control" no tiene su propia fila en sop_ventana_semanal (el ciclo
// de firmas vive en sop_firmas_ciclo), así que su "Historial" del selector
// siempre sale vacío — las flechas ‹ › sí funcionan igual.
const PESTANAS_SIEMPRE_SEMANALES = ["inventarios", "mps", "control"];

// Filtro discreto para moverse entre semanas de la Vista semanal y
// consultar cualquiera ya guardada — una sola vez aquí en vez de repetir
// "Nueva/Guardar/Consultar" en cada una de las 4 pestañas que comparten el
// mismo concepto de semana (a diferencia de Acuerdos S&OP, que sí necesita
// su propio registro de semana porque liga acuerdos reales a ella).
function SelectorSemanaVentana({ semanaLunes, onChange, pestana }) {
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const lunes = new Date(`${semanaLunes}T00:00:00`);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);

  function irSemana(deltaSemanas) {
    const next = new Date(lunes);
    next.setDate(next.getDate() + deltaSemanas * 7);
    onChange(toISODate(next));
  }

  async function toggleHistorial() {
    const next = !showHistorial;
    setShowHistorial(next);
    if (next) {
      setLoadingHistorial(true);
      const result = await getSemanasConDatos(pestana, { limit: 12 });
      setHistorial(result?.data || []);
      setLoadingHistorial(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => irSemana(-1)} title="Semana anterior" className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-[11px] font-black text-white/60 hover:bg-white/20">‹</button>
      <span className="whitespace-nowrap text-[9px] font-bold text-white/70">{formatFechaCorta(lunes)}–{formatFechaCorta(viernes)}</span>
      <button type="button" onClick={() => irSemana(1)} title="Semana siguiente" className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-[11px] font-black text-white/60 hover:bg-white/20">›</button>
      <div className="relative">
        <button type="button" onClick={toggleHistorial} className="rounded-lg bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/60 hover:bg-white/20">
          Historial
        </button>
        {showHistorial && (
          <div className="absolute right-0 top-7 z-20 max-h-56 w-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {loadingHistorial && <p className="px-2 py-2 text-[10px] font-bold text-slate-300">Cargando…</p>}
            {!loadingHistorial && historial.length === 0 && <p className="px-2 py-2 text-[10px] font-bold text-slate-300">Sin semanas guardadas.</p>}
            {!loadingHistorial && historial.map((h) => {
              const l = new Date(`${h.semana_lunes}T00:00:00`);
              const v = new Date(l);
              v.setDate(l.getDate() + 4);
              return (
                <button
                  key={h.semana_lunes}
                  type="button"
                  onClick={() => { onChange(h.semana_lunes); setShowHistorial(false); }}
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-[10px] font-bold hover:bg-indigo-50 ${h.semana_lunes === semanaLunes ? "bg-indigo-50 text-indigo-700" : "text-slate-600"}`}
                >
                  {formatFechaCorta(l)} – {formatFechaCorta(v)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { key: "control", label: "Control S&OP" },
  { key: "dashboard", label: "Dashboard" },
  { key: "plan-venta", label: "Plan de venta" },
  { key: "operacion", label: "Plan de operación" },
  { key: "mps", label: "MPS" },
  { key: "financiero", label: "Plan financiero" },
  { key: "inventarios", label: "Inventarios" },
  { key: "decisiones", label: "Acuerdos S&OP" },
  { key: "decisiones-director", label: "Decisiones (Director)" },
  { key: "prioridades", label: "Prioridades semanales" },
  // "Histórico S&OP" y "Parámetros" ocultas temporalmente a pedido — el
  // componente y su carga de datos se dejan intactos, solo se quitan del
  // menú de pestañas. Para reactivarlas: descomentar la línea de abajo.
  // { key: "historico", label: "Histórico S&OP" },
  // { key: "parametros", label: "Parámetros" },
];

export default function SopModule({ currentUser }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  // Capa temporal mientras el ciclo mensual madura: cambia la vista de las
  // pestañas de captura a modo semanal (visibilidad real de la semana
  // siguiente). Calendario real: martes 10:00 Ventas sube su plan, martes
  // 16:00 Operaciones (+MPS) y Finanzas suben el suyo — los 3 deberían
  // solicitar sus recursos al subir su plan, no después. Miércoles por la
  // mañana Dirección revisa los planes y resuelve las solicitudes; junta de
  // alineación miércoles 10:00–10:30. Inventarios es aparte: se actualiza
  // todos los días a las 8:00, no solo una vez por semana. Un solo control
  // global en vez de repetir el switch en cada pestaña.
  const [vistaSemanal, setVistaSemanal] = useState(false);
  // Semana que muestran Dashboard/Plan de venta/Operación/Financiero en
  // Vista semanal — un solo selector para las 4 (comparten el mismo
  // compromiso de Plan de venta, así que deben mirar siempre la misma
  // semana entre sí). Arranca en el próximo lunes; el filtro de abajo deja
  // moverse a cualquier otra ya guardada.
  const [semanaVentana, setSemanaVentana] = useState(() => toISODate(getProximoLunes()));
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  const [control, setControl] = useState(null);
  const [parametros, setParametros] = useState(null);
  const [planVenta, setPlanVenta] = useState([]);
  const [ventaReal, setVentaReal] = useState([]);
  const [decisiones, setDecisiones] = useState([]);
  const [solicitudesSop, setSolicitudesSop] = useState([]);
  const [sopSemanas, setSopSemanas] = useState([]);
  const [currentSopSemana, setCurrentSopSemana] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [firmas, setFirmas] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [capacidadProcesos, setCapacidadProcesos] = useState([]);
  const [tiemposEstandar, setTiemposEstandar] = useState([]);
  const [infraestructura, setInfraestructura] = useState([]);
  const [vacantesPersonal, setVacantesPersonal] = useState([]);
  const [financieroFilas, setFinancieroFilas] = useState([]);
  const [financieroMontos, setFinancieroMontos] = useState([]);
  const [financieroAjustes, setFinancieroAjustes] = useState([]);
  const [personasCatalogo, setPersonasCatalogo] = useState([]);
  const [message, setMessage] = useState("");

  // Pestañas sin un dueño específico (Dashboard, Control S&OP, Acuerdos
  // S&OP, Prioridades, Histórico): de solo lectura para cualquiera fuera
  // del equipo estratégico — ver comentario junto a los permisos de S&OP
  // en permissionsService.js.
  const canEditGeneral = isStrategicTeamMember(currentUser);
  const canEditOperacionParams = canEditSopOperacionParams(currentUser);
  const canEditFinancieroParams = canEditSopFinancieroParams(currentUser);
  const canEditPlanVenta = canEditSopPlanVenta(currentUser);
  const canEditInventarios = canEditSopInventarios(currentUser);
  const canCreateSolicitud = canCreateSopSolicitud(currentUser);
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);
  const [showSopVideo, setShowSopVideo] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [productosData, controlData, parametrosData, planData, ventaRealData, decisionesData, sopSemanasData, historicoData, prioridadesData, capacidadProcesosData, infraestructuraData, financieroFilasData, financieroMontosData, financieroAjustesData, personasData, solicitudesSopData, tiemposEstandarData, vacantesPersonalData] = await Promise.all([
      getProductos(),
      getControl(),
      getParametros(),
      getPlanVenta(),
      getVentaReal(),
      getDecisiones(),
      getSopSemanas(),
      getHistorico(),
      getPrioridadesSemana(),
      getCapacidadProcesos(),
      getInfraestructura(),
      getFinancieroFilas(),
      getFinancieroMontos(),
      getFinancieroAjustes(),
      getPersonas().catch(() => []),
      getStrategicDecisions().catch(() => []),
      getTiemposEstandar(),
      getVacantesPersonal(),
    ]);
    setProductos(productosData);
    setControl(controlData);
    setParametros(parametrosData);
    setPlanVenta(planData);
    setVentaReal(ventaRealData);
    setDecisiones(decisionesData);
    setSopSemanas(sopSemanasData);
    setHistorico(historicoData);
    setPrioridades(prioridadesData);
    setCapacidadProcesos(capacidadProcesosData);
    setInfraestructura(infraestructuraData);
    setTiemposEstandar(tiemposEstandarData);
    setVacantesPersonal(vacantesPersonalData);
    setFinancieroFilas(financieroFilasData);
    setFinancieroMontos(financieroMontosData);
    setFinancieroAjustes(financieroAjustesData);
    setPersonasCatalogo(personasData);
    setSolicitudesSop((solicitudesSopData || []).filter((d) => d.proceso === "S&OP"));
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  // El ciclo de firmas sigue a la semana seleccionada arriba (flechas de
  // Vista semanal), no a un mes fijo — se re-crea/recarga cada vez que se
  // cambia de semana.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFirmasCiclo(semanaVentana);
      const data = await getFirmasCiclo(semanaVentana);
      if (!cancelled) setFirmas(data);
    })();
    return () => { cancelled = true; };
  }, [semanaVentana]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  async function handleSaveControl(id, draft) {
    const result = await updateControl(id, draft);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar el control.");
      return;
    }
    setControl(result.data);
    setMessage("Control S&OP actualizado.");
  }

  async function handleSaveParametros(id, draft) {
    const result = await updateParametros(id, draft, currentUser);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar los parámetros.");
      return;
    }
    setParametros(result.data);
    setMessage("Parámetros actualizados.");
  }

  async function handleSavePlanVenta(productoId, escenario, anio, mes, piezas, actor) {
    const result = await upsertPlanVenta(productoId, escenario, anio, mes, piezas, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la celda.");
      return;
    }
    setPlanVenta((current) => {
      const filtered = current.filter(
        (row) => !(row.producto_id === productoId && row.escenario === escenario && row.anio === anio && row.mes === mes)
      );
      return [...filtered, result.data];
    });
  }

  async function handleSavePrecio(productoId, precio, actor) {
    const result = await updateProductoPrecio(productoId, precio, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar el precio.");
      return;
    }
    setProductos((current) => current.map((p) => (p.id === productoId ? result.data : p)));
    setMessage("Precio actualizado.");
  }

  async function handleSaveFamilia(productoId, familia, actor) {
    const result = await updateProductoFamilia(productoId, familia, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la familia.");
      return;
    }
    setProductos((current) => current.map((p) => (p.id === productoId ? result.data : p)));
    setMessage("Familia actualizada.");
  }

  async function handleCreateProducto(payload, actor) {
    const result = await createProducto(payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible agregar el producto.");
      return false;
    }
    setProductos((current) => [...current, result.data]);
    setMessage("Producto agregado al Plan de venta.");
    return true;
  }

  async function handleDeactivateProducto(productoId, actor) {
    const result = await setProductoActivo(productoId, false, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible quitar el producto.");
      return;
    }
    setProductos((current) => current.filter((p) => p.id !== productoId));
    setMessage("Producto quitado del Plan de venta.");
  }

  async function handleSaveVentaReal(anio, mes, monto) {
    const result = await upsertVentaReal(anio, mes, monto, currentUser);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la venta real.");
      return;
    }
    setVentaReal((current) => {
      const filtered = current.filter((row) => !(row.anio === anio && row.mes === mes));
      return [...filtered, result.data];
    });
  }

  async function handleCreateDecision(payload, actor) {
    const result = await createDecision({ ...payload, semana_id: currentSopSemana?.id || null }, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la decisión.");
      return false;
    }
    setDecisiones((current) => [result.data, ...current]);
    setMessage("Decisión registrada.");
    return true;
  }

  async function handleDeleteDecision(id) {
    if (!window.confirm("¿Eliminar esta decisión?")) return;
    const result = await deleteDecision(id);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible eliminar la decisión.");
      return;
    }
    setDecisiones((current) => current.filter((d) => d.id !== id));
    setMessage("Decisión eliminada.");
  }

  // Semana de la junta de alineación S&OP — mismo patrón de
  // Nueva/Guardar/Consultar/Cerrar que ya usa Seguimiento Estratégico,
  // adaptado: aquí "guardar" es crear el registro de la semana (los
  // acuerdos ya se guardan uno a uno al capturarlos, no en bloque).
  function handleNuevaSopSemana() {
    const { lunesISO, domingoISO } = getSemanaReferenciaISO();
    setCurrentSopSemana({ id: null, fecha_inicio: lunesISO, fecha_fin: domingoISO, estado: "abierta" });
  }

  async function handleGuardarSopSemana() {
    if (!currentSopSemana || currentSopSemana.id) return;
    const result = await createSopSemana(currentSopSemana);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la semana.");
      return;
    }
    setCurrentSopSemana(result.data);
    setSopSemanas((current) => [result.data, ...current]);
    setMessage("Semana guardada.");
  }

  function handleConsultarSopSemana(semana) {
    setCurrentSopSemana(semana);
  }

  async function handleCerrarSopSemana() {
    if (!currentSopSemana?.id) return;
    if (!window.confirm("¿Cerrar esta semana? Seguirás pudiendo consultarla, pero quedará marcada como cerrada.")) return;
    const result = await cerrarSopSemana(currentSopSemana.id);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible cerrar la semana.");
      return;
    }
    setCurrentSopSemana((current) => ({ ...current, estado: "cerrada" }));
    setSopSemanas((current) => current.map((s) => (s.id === currentSopSemana.id ? { ...s, estado: "cerrada" } : s)));
    setMessage("Semana cerrada.");
  }

  // Un líder de área escala un acuerdo a Dirección desde su propia pestaña
  // (Acuerdos S&OP) — igual que el botón "+ Solicitud" de la cabecera, cae
  // en la Bandeja del Centro de Decisiones con status "Solicitud" (pendiente
  // de Dirección), no como decisión ya creada — Dirección decide si la
  // acepta o la deja en stand by.
  async function handleRequestDirectorDecision(decision, actor) {
    try {
      await createStrategicDecision({
        title: decision.decision,
        owner: actor?.nombre || actor?.usuario || decision.responsable || "",
        risk: "Moderado",
        status: "Solicitud",
        executionType: null,
        dueDate: decision.fecha || null,
        consequence: "",
        recommendation: decision.opcion_elegida || "",
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "S&OP",
      });
      setMessage("Acuerdo enviado a Decisiones (Director).");
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible enviar el acuerdo a Dirección.");
      return false;
    }
  }

  // Un solo botón en Plan de operación para cualquier solicitud a Dirección
  // relacionada con capacidad — el título/descripción se sugieren si hay
  // meses saturados, pero quedan totalmente editables en SolicitudModal
  // antes de enviar. Mismo mecanismo que el resto de "Solicitar a Dirección"
  // del módulo — status "Solicitud", cae en la Bandeja del Centro de Decisiones.
  async function handleSolicitarCapacidad(draft, actor) {
    try {
      await createStrategicDecision({
        title: draft.titulo,
        owner: actor?.nombre || actor?.usuario || "",
        risk: draft.riesgo || "Moderado",
        status: "Solicitud",
        executionType: null,
        dueDate: draft.fecha || null,
        consequence: "",
        recommendation: draft.descripcion || "",
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "S&OP",
      });
      setMessage("Solicitud de capacidad enviada a Decisiones (Director).");
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible enviar la solicitud de capacidad.");
      return false;
    }
  }

  // Mismo mecanismo que handleSolicitarCapacidad, para Plan financiero.
  async function handleSolicitarFinanciero(draft, actor) {
    try {
      await createStrategicDecision({
        title: draft.titulo,
        owner: actor?.nombre || actor?.usuario || "",
        risk: draft.riesgo || "Moderado",
        status: "Solicitud",
        executionType: null,
        dueDate: draft.fecha || null,
        consequence: "",
        recommendation: draft.descripcion || "",
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "S&OP",
      });
      setMessage("Solicitud financiera enviada a Decisiones (Director).");
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible enviar la solicitud financiera.");
      return false;
    }
  }

  // Solicitud de recurso de infraestructura — mismo mecanismo (Bandeja del
  // Centro de Decisiones) que Solicitar capacidad/financiero, pero con el
  // formulario angosto de SolicitarRecursoModal (nombre/fecha/costo). No
  // existe columna de costo en decisiones_estrategicas, así que se anota en
  // la recomendación en vez de tocar ese esquema.
  async function handleSolicitarRecurso(draft, actor) {
    try {
      await createStrategicDecision({
        title: draft.nombre,
        owner: actor?.nombre || actor?.usuario || "",
        risk: "Moderado",
        status: "Solicitud",
        executionType: null,
        dueDate: draft.fecha || null,
        consequence: "",
        recommendation: `Requerimiento de infraestructura. Costo estimado: $${Number(draft.costo || 0).toLocaleString("es-MX")} (${draft.periodicidad || "Único"}).`,
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "S&OP",
      });
      setMessage("Solicitud de recurso enviada a Decisiones (Director).");
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible enviar la solicitud de recurso.");
      return false;
    }
  }

  // Acción del Director sobre una solicitud recibida (pestaña "Decisiones
  // (Director)"): aprobar/detener/rechazar, con comentario opcional y, si se
  // aprueba, la fecha para la que se aprueba. Se reutiliza el vocabulario de
  // estado que ya entiende el Centro de Decisiones general (Decidida/Stand
  // by/Cerrada) para que la solicitud resuelta también se vea consistente
  // ahí — el detalle fino (quién resolvió qué y con qué comentario) queda en
  // decision_final, que no tiene otro uso todavía.
  async function handleResolverSolicitud(decision, accion, { comentario, fechaAprobacion } = {}) {
    const ESTADO_POR_ACCION = { aprobar: "Decidida", detener: "Stand by", rechazar: "Cerrada" };
    const ETIQUETA_POR_ACCION = { aprobar: "Aprobada", detener: "En espera", rechazar: "Rechazada" };
    const nuevoEstado = ESTADO_POR_ACCION[accion];
    if (!nuevoEstado) return false;
    const firma = `${ETIQUETA_POR_ACCION[accion]}${comentario ? `. ${comentario}` : "."} — ${currentUser?.nombre || currentUser?.usuario || "Director"} (${new Date().toLocaleDateString("es-MX")})`;
    const updates = { estado: nuevoEstado, decision_final: firma };
    if (accion === "aprobar" && fechaAprobacion) updates.fecha_compromiso = fechaAprobacion;
    try {
      await updateStrategicDecision(decision.id, updates);
      setSolicitudesSop((current) => current.map((d) => (d.id === decision.id ? { ...d, ...updates } : d)));
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible actualizar la solicitud.");
      return false;
    }
  }

  async function handleCreateFinancieroFila(payload, actor) {
    const result = await createFinancieroFila(payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la partida.");
      return false;
    }
    setFinancieroFilas((current) => [...current, result.data]);
    setMessage("Partida agregada.");
    return true;
  }

  async function handleUpdateFinancieroFila(id, payload, actor) {
    const result = await updateFinancieroFila(id, payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible actualizar la partida.");
      return;
    }
    setFinancieroFilas((current) => current.map((f) => (f.id === id ? result.data : f)).sort((a, b) => a.orden - b.orden));
  }

  async function handleDeactivateFinancieroFila(id, actor) {
    const result = await deactivateFinancieroFila(id, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible quitar la partida.");
      return;
    }
    setFinancieroFilas((current) => current.filter((f) => f.id !== id));
  }

  async function handleUpsertFinancieroMonto(filaId, anio, mes, monto) {
    const result = await upsertFinancieroMonto(filaId, anio, mes, monto);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar el monto.");
      return;
    }
    setFinancieroMontos((current) => {
      const filtered = current.filter((m) => !(m.fila_id === filaId && m.anio === anio && m.mes === mes));
      return [...filtered, result.data];
    });
  }

  async function handleUpsertFinancieroAjuste(anio, mes, concepto, monto, actor) {
    const result = await upsertFinancieroAjuste(anio, mes, concepto, monto, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar el ajuste.");
      return;
    }
    setFinancieroAjustes((current) => {
      const filtered = current.filter((a) => !(a.anio === anio && a.mes === mes && a.concepto === concepto));
      return [...filtered, result.data];
    });
  }

  async function handleDeleteFinancieroAjuste(anio, mes, concepto) {
    const result = await deleteFinancieroAjuste(anio, mes, concepto);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible restablecer el valor.");
      return;
    }
    setFinancieroAjustes((current) => current.filter((a) => !(a.anio === anio && a.mes === mes && a.concepto === concepto)));
  }

  // Botón "+ Solicitud" (Hugo, Samantha, Brisa): manda directo a la Bandeja
  // del Centro de Decisiones (status "Solicitud"), sin necesitar acceso al
  // módulo completo — el director la ve ahí para aceptar/dejar en stand by.
  async function handleCreateSolicitud(payload) {
    try {
      await createStrategicDecision({
        title: payload.titulo,
        owner: currentUser?.nombre || currentUser?.usuario || "",
        risk: payload.riesgo || "Moderado",
        status: "Solicitud",
        executionType: null,
        dueDate: payload.fecha || null,
        consequence: "",
        recommendation: payload.descripcion || "",
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "S&OP",
      });
      setMessage("Solicitud enviada a Decisiones (Director).");
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible enviar la solicitud.");
      return false;
    }
  }

  // Si la decisión ya es una acción concreta, se manda directo a Balance de
  // Carga como una asignación (proyecto) para la persona que elijas, sin
  // pasar por Centro de Decisiones ni por Acciones de Mejora.
  async function handleConvertToAssignment(decision, { personaId, personaNombre, horas, fechaLimite, prioridad }, actor) {
    const result = await createWorkloadAssignment({
      persona_id: personaId,
      responsable: personaNombre,
      rol: "S&OP",
      tipo: "Proyecto",
      prioridad: prioridad || "Alta",
      gestion: "Otro",
      titulo: decision.decision,
      descripcion: decision.opcion_elegida || "",
      revisara: "",
      aprobara: "",
      seguimiento: "",
      carga_horas: horas,
      fecha_limite: fechaLimite || null,
      estado: "Pendiente",
      asigna: actor?.nombre || actor?.usuario || "",
      asigna_rol: "S&OP",
      horas_totales: horas,
      origen_estrategico: "Estrategia",
    });
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible convertir la decisión en asignación.");
      return false;
    }
    setMessage("Decisión enviada a Balance de Carga como asignación.");
    return true;
  }

  // Al aprobar/rechazar una etapa del ciclo de firmas (VEN-SP-03). Caso
  // especial: si Dirección rechaza la reunión ejecutiva, el diagrama regresa
  // al paso "alinear supuestos" — las 3 validaciones previas se reabren a
  // Pendiente para que se reajuste la propuesta antes de volver a firmarlas.
  async function handleUpsertFirma(semanaLunes, etapa, estado, comentario) {
    const result = await upsertFirma(semanaLunes, etapa, estado, comentario, currentUser);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible actualizar la firma del ciclo.");
      return;
    }
    let nuevasFirmas = [result.data];
    if (etapa === "ejecutivo" && estado === "Rechazado") {
      const reaperturas = await Promise.all(
        ["comercial", "operativo", "financiero"].map((e) =>
          upsertFirma(semanaLunes, e, "Pendiente", "Reabierto: la reunión ejecutiva rechazó el plan integrado.", currentUser)
        )
      );
      nuevasFirmas = [...nuevasFirmas, ...reaperturas.filter((r) => r.ok).map((r) => r.data)];
    }
    setFirmas((current) => {
      const filtered = current.filter((f) => !nuevasFirmas.some((n) => n.semana_lunes === f.semana_lunes && n.etapa === f.etapa));
      return [...filtered, ...nuevasFirmas];
    });
    setMessage("Ciclo de firmas actualizado.");
  }

  // Reinicio manual (solo equipo estratégico, gateado en ControlTab): limpia
  // las 4 etapas del ciclo de la semana activa a Pendiente.
  async function handleResetFirmas(semanaLunes) {
    const result = await resetCicloFirmas(semanaLunes, currentUser);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible reiniciar el ciclo de firmas.");
      return;
    }
    setFirmas((current) => {
      const filtered = current.filter((f) => f.semana_lunes !== semanaLunes);
      return [...filtered, ...result.data];
    });
    setMessage("Ciclo de firmas reiniciado.");
  }

  // Alerta puntual desde una etapa del ciclo de firmas hacia las asignaciones
  // de un líder — reutiliza el mismo mecanismo de Balance de Carga que ya usa
  // handleConvertToAssignment, sin pasar por Centro de Decisiones.
  async function handleAlertaLider(etapa, { personaId, personaNombre, mensaje }, actor) {
    const result = await createWorkloadAssignment({
      persona_id: personaId,
      responsable: personaNombre,
      rol: "S&OP",
      tipo: "Otro",
      prioridad: "Alta",
      gestion: "Otro",
      titulo: `Alerta S&OP — ${etapa.label}`,
      descripcion: mensaje,
      revisara: "",
      aprobara: "",
      seguimiento: "",
      carga_horas: 0.5,
      fecha_limite: null,
      estado: "Pendiente",
      asigna: actor?.nombre || actor?.usuario || "",
      asigna_rol: "S&OP",
      horas_totales: 0.5,
      origen_estrategico: "Estrategia",
    });
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible enviar la alerta.");
      return false;
    }
    setMessage("Alerta enviada a las asignaciones del líder.");
    return true;
  }

  async function handleUpsertPrioridad(payload, actor) {
    const result = await upsertPrioridadSemana(payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la prioridad.");
      return false;
    }
    setPrioridades((current) => {
      const filtered = current.filter(
        (p) => !(p.anio === result.data.anio && p.mes === result.data.mes && p.semana === result.data.semana && p.area === result.data.area)
      );
      return [result.data, ...filtered];
    });
    setMessage("Prioridad semanal guardada.");
    return true;
  }

  async function handleUpdatePrioridadEstado(id, estado) {
    const result = await updatePrioridadSemana(id, estado);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible actualizar el estado de la prioridad.");
      return;
    }
    setPrioridades((current) => current.map((p) => (p.id === id ? result.data : p)));
  }

  async function handleCreateProceso(payload, actor) {
    const result = await createCapacidadProceso(payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar el proceso.");
      return false;
    }
    setCapacidadProcesos((current) => [...current, result.data]);
    // La estación nueva también necesita su fila (en 0) en Tiempos estándar
    // por cada familia ya existente, para que la matriz no quede con
    // columnas huecas al agregar una estación desde aquí.
    const familiasExistentes = [...new Set(tiemposEstandar.map((t) => t.familia))];
    if (familiasExistentes.length > 0) {
      const tiemposResult = await createEstacionTiemposEstandar(payload.proceso, familiasExistentes, actor);
      if (tiemposResult.ok) setTiemposEstandar((current) => [...current, ...tiemposResult.data]);
    }
    setMessage("Proceso agregado.");
    return true;
  }

  async function handleUpdateProceso(id, payload, actor) {
    const result = await updateCapacidadProceso(id, payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible actualizar el proceso.");
      return;
    }
    setCapacidadProcesos((current) => current.map((p) => (p.id === id ? result.data : p)));
  }

  async function handleDeactivateProceso(id, actor) {
    const result = await deactivateCapacidadProceso(id, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible quitar el proceso.");
      return;
    }
    setCapacidadProcesos((current) => current.filter((p) => p.id !== id));
  }

  async function handleUpdateTiempoEstandar(id, minutosPorPieza, actor) {
    const ok = await updateTiempoEstandar(id, minutosPorPieza, actor);
    if (!ok) {
      setMessage("No fue posible actualizar el tiempo estándar.");
      return;
    }
    setTiemposEstandar((current) => current.map((t) => (t.id === id ? { ...t, minutos_por_pieza: minutosPorPieza } : t)));
  }

  async function handleCreateInfra(payload, actor) {
    const result = await createInfraestructura(payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar el equipo.");
      return false;
    }
    setInfraestructura((current) => [...current, result.data]);
    setMessage("Equipo agregado.");
    return true;
  }

  async function handleUpdateInfra(id, payload, actor) {
    const result = await updateInfraestructura(id, payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible actualizar el equipo.");
      return;
    }
    setInfraestructura((current) => current.map((e) => (e.id === id ? result.data : e)));
  }

  async function handleDeactivateInfra(id, actor) {
    const result = await deactivateInfraestructura(id, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible quitar el equipo.");
      return;
    }
    setInfraestructura((current) => current.filter((e) => e.id !== id));
  }

  // Renombrar una estación existente — actualiza en cascada
  // capacidad_procesos/infraestructura/tiempos_estandar (ver comentario en
  // el servicio) y refresca las 3 listas locales para que quede consistente
  // sin recargar toda la pestaña.
  async function handleRenameEstacion(procesoId, oldName, newName, actor) {
    const result = await renameEstacion(procesoId, oldName, newName, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible renombrar la estación.");
      return false;
    }
    setCapacidadProcesos((current) => current.map((p) => (p.id === procesoId ? { ...p, proceso: newName } : p)));
    setInfraestructura((current) => current.map((e) => (e.proceso === oldName ? { ...e, proceso: newName } : e)));
    setTiemposEstandar((current) => current.map((t) => (t.estacion === oldName ? { ...t, estacion: newName } : t)));
    setMessage("Estación renombrada.");
    return true;
  }

  async function handleCreateFamiliaTiempos(familia, actor) {
    const estacionesReales = [...new Set(tiemposEstandar.map((t) => t.estacion))];
    const estaciones = estacionesReales.length > 0 ? estacionesReales : capacidadProcesos.map((p) => p.proceso);
    const result = await createFamiliaTiemposEstandar(familia, estaciones, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible agregar la familia.");
      return false;
    }
    setTiemposEstandar((current) => [...current, ...result.data]);
    setMessage("Familia agregada a Tiempos estándar.");
    return true;
  }

  async function handleDeleteFamiliaTiempos(familia) {
    const result = await deleteFamiliaTiemposEstandar(familia);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible quitar la familia.");
      return;
    }
    setTiemposEstandar((current) => current.filter((t) => t.familia !== familia));
  }

  async function handleCreateVacante(payload, actor) {
    const result = await createVacantePersonal(payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible guardar la vacante.");
      return false;
    }
    setVacantesPersonal((current) => [...current, result.data]);
    return true;
  }

  async function handleUpdateVacante(id, payload, actor) {
    const result = await updateVacantePersonal(id, payload, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible actualizar la vacante.");
      return;
    }
    setVacantesPersonal((current) => current.map((v) => (v.id === id ? result.data : v)));
  }

  async function handleDeactivateVacante(id, actor) {
    const result = await deactivateVacantePersonal(id, actor);
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible quitar la vacante.");
      return;
    }
    setVacantesPersonal((current) => current.filter((v) => v.id !== id));
  }

  async function handleCloseMonth({ control: controlArg, resumenMes, ventaReal, actor }) {
    const result = await closeCurrentMonth({ control: controlArg, resumenMes, ventaReal, actor });
    if (!result.ok) {
      console.error(result.error);
      setMessage("No fue posible cerrar el mes.");
      return false;
    }
    setControl(result.data);
    const historicoData = await getHistorico();
    setHistorico(historicoData);
    setMessage(`Mes ${resumenMes.label} cerrado. El horizonte avanzó al siguiente mes.`);
    return true;
  }

  return (
    <div className="p-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#001225] px-4 py-2 text-white">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-black uppercase tracking-widest">S&amp;OP — Alineación de ventas y operación</p>
            <span
              title="Ciclo mensual de planeación de ventas, operación y finanzas (VEN-SP-03). Fase 1: Control, Parámetros, Plan de venta y Dashboard."
              className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/20 text-[9px] font-black text-white/50 hover:text-white"
            >
              ?
            </span>
            <button
              type="button"
              onClick={() => setShowSopVideo(true)}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/20"
            >
              ▶ Guía en video
            </button>
            <button
              type="button"
              onClick={() => window.open(SOP_MANUAL_URL, "_blank")}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/20"
            >
              📄 Guía en PDF
            </button>
            {canCreateSolicitud && (
              <button
                type="button"
                onClick={() => setShowSolicitudModal(true)}
                className="ml-2 rounded-lg bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/20"
              >
                + Solicitud
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-white/10 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                    activeTab === tab.key ? "bg-white text-[#001225]" : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVistaSemanal((v) => !v)}
                title="Martes 10:00 Ventas sube su plan · Martes 16:00 Operaciones (+MPS) y Finanzas suben el suyo, solicitando sus recursos al subirlo · Miércoles AM Dirección revisa y resuelve · Junta de alineación miércoles 10:00–10:30. Inventarios aparte: se actualiza todos los días a las 8:00."
                className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                  vistaSemanal ? "bg-indigo-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                📅 Vista semanal
              </button>
              <span className="max-w-[220px] text-[9px] font-semibold leading-tight text-white/90">
                Martes: Ventas 10am, Operación/Finanzas 4pm — junta miércoles 10:00–10:30
              </span>
              {(vistaSemanal || PESTANAS_SIEMPRE_SEMANALES.includes(activeTab)) && PESTANA_VENTANA[activeTab] && (
                <SelectorSemanaVentana semanaLunes={semanaVentana} onChange={setSemanaVentana} pestana={PESTANA_VENTANA[activeTab]} />
              )}
            </div>
          </div>
        </div>

        {message && <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-[10px] font-bold text-emerald-700">{message}</div>}

        {loading ? (
          <div className="px-5 py-10 text-center text-sm font-bold text-slate-400">Cargando S&amp;OP...</div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardTab
                productos={productos}
                planVenta={planVenta}
                control={control}
                parametros={parametros}
                ventaReal={ventaReal}
                historico={historico}
                canEdit={canEditGeneral}
                onSaveVentaReal={handleSaveVentaReal}
                currentUser={currentUser}
                vistaSemanal={vistaSemanal}
                semanaLunes={semanaVentana}
              />
            )}
            {activeTab === "plan-venta" && (
              <PlanVentaTab
                productos={productos}
                planVenta={planVenta}
                control={control}
                canEdit={canEditPlanVenta}
                onSave={handleSavePlanVenta}
                onSavePrecio={handleSavePrecio}
                onSaveFamilia={handleSaveFamilia}
                onCreateProducto={handleCreateProducto}
                onDeactivateProducto={handleDeactivateProducto}
                currentUser={currentUser}
                vistaSemanal={vistaSemanal}
                semanaLunes={semanaVentana}
                onSolicitarRecurso={handleSolicitarRecurso}
              />
            )}
            {activeTab === "mps" && (
              <MpsTab
                productos={productos}
                canEdit={canEditOperacionParams}
                currentUser={currentUser}
                semanaLunes={semanaVentana}
              />
            )}
            {activeTab === "operacion" && (
              <OperacionTab
                productos={productos}
                planVenta={planVenta}
                control={control}
                parametros={parametros}
                capacidadProcesos={capacidadProcesos}
                infraestructura={infraestructura}
                tiemposEstandar={tiemposEstandar}
                onUpdateTiempoEstandar={handleUpdateTiempoEstandar}
                canEdit={canEditOperacionParams}
                currentUser={currentUser}
                onCreateProceso={handleCreateProceso}
                onUpdateProceso={handleUpdateProceso}
                onDeactivateProceso={handleDeactivateProceso}
                onCreateInfra={handleCreateInfra}
                onUpdateInfra={handleUpdateInfra}
                onDeactivateInfra={handleDeactivateInfra}
                onRenameEstacion={handleRenameEstacion}
                onCreateFamiliaTiempos={handleCreateFamiliaTiempos}
                onDeleteFamiliaTiempos={handleDeleteFamiliaTiempos}
                vacantesPersonal={vacantesPersonal}
                onCreateVacante={handleCreateVacante}
                onUpdateVacante={handleUpdateVacante}
                onDeactivateVacante={handleDeactivateVacante}
                onSolicitarCapacidad={handleSolicitarCapacidad}
                onSolicitarRecurso={handleSolicitarRecurso}
                vistaSemanal={vistaSemanal}
                semanaLunes={semanaVentana}
              />
            )}
            {activeTab === "financiero" && (
              <FinancieroTab
                productos={productos}
                planVenta={planVenta}
                control={control}
                parametros={parametros}
                financieroFilas={financieroFilas}
                financieroMontos={financieroMontos}
                financieroAjustes={financieroAjustes}
                canEdit={canEditFinancieroParams}
                currentUser={currentUser}
                onCreateFila={handleCreateFinancieroFila}
                onUpdateFila={handleUpdateFinancieroFila}
                onDeactivateFila={handleDeactivateFinancieroFila}
                onUpsertMonto={handleUpsertFinancieroMonto}
                onUpsertAjuste={handleUpsertFinancieroAjuste}
                onDeleteAjuste={handleDeleteFinancieroAjuste}
                onSolicitarFinanciero={handleSolicitarFinanciero}
                onSolicitarRecurso={handleSolicitarRecurso}
                semanaLunes={semanaVentana}
                vistaSemanal={vistaSemanal}
                solicitudesSop={solicitudesSop}
              />
            )}
            {activeTab === "inventarios" && (
              <InventariosTab
                productos={productos}
                canEdit={canEditInventarios}
                currentUser={currentUser}
                semanaLunes={semanaVentana}
                onSaveFamilia={handleSaveFamilia}
              />
            )}
            {activeTab === "decisiones" && (
              <DecisionesTab
                decisiones={decisiones}
                canEdit={canEditGeneral}
                canRequestDirectorDecision={canCreateSolicitud}
                onCreate={handleCreateDecision}
                vistaSemanal={vistaSemanal}
                onDelete={handleDeleteDecision}
                onRequestDirectorDecision={handleRequestDirectorDecision}
                onConvertToAssignment={handleConvertToAssignment}
                personasCatalogo={personasCatalogo}
                currentUser={currentUser}
                sopSemanas={sopSemanas}
                currentSopSemana={currentSopSemana}
                onNuevaSemana={handleNuevaSopSemana}
                onGuardarSemana={handleGuardarSopSemana}
                onConsultarSemana={handleConsultarSopSemana}
                onCerrarSemana={handleCerrarSopSemana}
              />
            )}
            {activeTab === "decisiones-director" && (
              <DecisionesDirectorTab
                solicitudes={solicitudesSop}
                canDecide={isDirectorGeneral(currentUser)}
                onResolverSolicitud={handleResolverSolicitud}
                semanaLunes={semanaVentana}
              />
            )}
            {activeTab === "prioridades" && (
              <PrioridadesTab
                prioridades={prioridades}
                control={control}
                canEdit={canEditGeneral}
                onUpsert={handleUpsertPrioridad}
                onUpdateEstado={handleUpdatePrioridadEstado}
                currentUser={currentUser}
              />
            )}
            {activeTab === "historico" && (
              <HistoricoTab
                historico={historico}
                productos={productos}
                planVenta={planVenta}
                control={control}
                parametros={parametros}
                canEdit={canEditGeneral}
                onCloseMonth={handleCloseMonth}
                currentUser={currentUser}
              />
            )}
            {activeTab === "control" && (
              <ControlTab
                control={control}
                canEdit={canEditGeneral}
                onSave={handleSaveControl}
                firmas={firmas}
                currentUser={currentUser}
                personasCatalogo={personasCatalogo}
                onUpsertFirma={handleUpsertFirma}
                onResetFirmas={handleResetFirmas}
                onAlertaLider={handleAlertaLider}
                parametros={parametros}
                planVenta={planVenta}
                productos={productos}
                historico={historico}
                vistaSemanal={vistaSemanal}
                semanaLunes={semanaVentana}
              />
            )}
            {activeTab === "parametros" && (
              <ParametrosTab
                parametros={parametros}
                canEditOperacion={canEditOperacionParams}
                canEditFinanciero={canEditFinancieroParams}
                onSave={handleSaveParametros}
              />
            )}
          </>
        )}
      </div>

      {showSolicitudModal && (
        <SolicitudModal onSubmit={handleCreateSolicitud} onClose={() => setShowSolicitudModal(false)} />
      )}

      {showSopVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#001225] px-5 py-3 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Video tutorial</p>
                <h3 className="text-lg font-black">S&amp;OP</h3>
              </div>
              <button type="button" onClick={() => setShowSopVideo(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white hover:bg-red-700">×</button>
            </div>
            {SOP_VIDEO_URL ? (
              <div className="aspect-video w-full bg-black">
                <iframe className="h-full w-full" src={SOP_VIDEO_URL} title="Video S&OP" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-slate-50 px-6 text-center text-sm font-bold text-slate-400">
                El video aún no está disponible. Se publicará aquí en cuanto esté cargado en YouTube.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
