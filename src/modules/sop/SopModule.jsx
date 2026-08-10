import { useEffect, useState } from "react";
import { canViewModule, canEditSopOperacionParams, canEditSopFinancieroParams, canEditSopPlanVenta, canCreateSopSolicitud } from "../../services/permissionsService";
import {
  getProductos,
  createProducto,
  setProductoActivo,
  updateProductoPrecio,
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
  getHistorico,
  closeCurrentMonth,
} from "../../services/sopService";
import { getPersonas } from "../../services/organizationCatalogService";
import { createStrategicDecision } from "../../services/decisionService";
import { createWorkloadAssignment } from "../../services/workloadService";
import ControlTab from "./ControlTab";
import ParametrosTab from "./ParametrosTab";
import PlanVentaTab from "./PlanVentaTab";
import OperacionTab from "./OperacionTab";
import FinancieroTab from "./FinancieroTab";
import DecisionesTab from "./DecisionesTab";
import HistoricoTab from "./HistoricoTab";
import DashboardTab from "./DashboardTab";
import SolicitudModal from "./SolicitudModal";

const TABS = [
  { key: "control", label: "Control S&OP" },
  { key: "dashboard", label: "Dashboard" },
  { key: "plan-venta", label: "Plan de venta" },
  { key: "operacion", label: "Plan de operación" },
  { key: "financiero", label: "Plan financiero" },
  { key: "decisiones", label: "Decisiones S&OP" },
  { key: "historico", label: "Histórico S&OP" },
  { key: "parametros", label: "Parámetros" },
];

export default function SopModule({ currentUser }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  const [control, setControl] = useState(null);
  const [parametros, setParametros] = useState(null);
  const [planVenta, setPlanVenta] = useState([]);
  const [ventaReal, setVentaReal] = useState([]);
  const [decisiones, setDecisiones] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [personasCatalogo, setPersonasCatalogo] = useState([]);
  const [message, setMessage] = useState("");

  const canEdit = canViewModule(currentUser, "sop");
  const canEditOperacionParams = canEditSopOperacionParams(currentUser);
  const canEditFinancieroParams = canEditSopFinancieroParams(currentUser);
  const canEditPlanVenta = canEditSopPlanVenta(currentUser);
  const canCreateSolicitud = canCreateSopSolicitud(currentUser);
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [productosData, controlData, parametrosData, planData, ventaRealData, decisionesData, historicoData, personasData] = await Promise.all([
      getProductos(),
      getControl(),
      getParametros(),
      getPlanVenta(),
      getVentaReal(),
      getDecisiones(),
      getHistorico(),
      getPersonas().catch(() => []),
    ]);
    setProductos(productosData);
    setControl(controlData);
    setParametros(parametrosData);
    setPlanVenta(planData);
    setVentaReal(ventaRealData);
    setDecisiones(decisionesData);
    setHistorico(historicoData);
    setPersonasCatalogo(personasData);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

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
    const result = await createDecision(payload, actor);
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

  // "Si aplica": una decisión del ciclo S&OP puede escalarse al Centro de
  // Decisiones de Dirección (para que siga el proceso WRAP formal) sin
  // duplicar captura — se manda tal cual está, Dirección la completa allá.
  async function handleSendToDecisionCenter(decision) {
    try {
      await createStrategicDecision({
        title: decision.decision,
        owner: decision.responsable || "",
        risk: "Moderado",
        status: "Detectada",
        executionType: null,
        dueDate: decision.fecha || null,
        consequence: "",
        recommendation: decision.opcion_elegida || "",
        wrap: { options: [""], evidence: "", distance: "", prevention: "", finalDecision: "" },
        process: "S&OP",
      });
      setMessage("Decisión enviada al Centro de Decisiones.");
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible enviar la decisión al Centro de Decisiones.");
      return false;
    }
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
      setMessage("Solicitud enviada a la Bandeja del Centro de Decisiones.");
      return true;
    } catch (err) {
      console.error(err);
      setMessage("No fue posible enviar la solicitud.");
      return false;
    }
  }

  // Si la decisión ya es una acción concreta, se manda directo a Balance de
  // Carga como una asignación (proyecto) para la persona que elijas, sin
  // pasar por Centro de Decisiones ni por Centro de Gestión de Acciones.
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
                canEdit={canEdit}
                onSaveVentaReal={handleSaveVentaReal}
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
                onCreateProducto={handleCreateProducto}
                onDeactivateProducto={handleDeactivateProducto}
                currentUser={currentUser}
              />
            )}
            {activeTab === "operacion" && <OperacionTab productos={productos} planVenta={planVenta} control={control} parametros={parametros} />}
            {activeTab === "financiero" && <FinancieroTab productos={productos} planVenta={planVenta} control={control} parametros={parametros} />}
            {activeTab === "decisiones" && (
              <DecisionesTab
                decisiones={decisiones}
                canEdit={canEdit}
                onCreate={handleCreateDecision}
                onDelete={handleDeleteDecision}
                onSendToDecisionCenter={handleSendToDecisionCenter}
                onConvertToAssignment={handleConvertToAssignment}
                personasCatalogo={personasCatalogo}
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
                canEdit={canEdit}
                onCloseMonth={handleCloseMonth}
                currentUser={currentUser}
              />
            )}
            {activeTab === "control" && <ControlTab control={control} canEdit={canEdit} onSave={handleSaveControl} />}
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
    </div>
  );
}
