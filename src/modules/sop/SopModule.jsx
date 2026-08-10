import { useEffect, useState } from "react";
import { canViewModule } from "../../services/permissionsService";
import {
  getProductos,
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
import ControlTab from "./ControlTab";
import ParametrosTab from "./ParametrosTab";
import PlanVentaTab from "./PlanVentaTab";
import OperacionTab from "./OperacionTab";
import FinancieroTab from "./FinancieroTab";
import DecisionesTab from "./DecisionesTab";
import HistoricoTab from "./HistoricoTab";
import DashboardTab from "./DashboardTab";

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "plan-venta", label: "Plan de venta" },
  { key: "operacion", label: "Plan de operación" },
  { key: "financiero", label: "Plan financiero" },
  { key: "decisiones", label: "Decisiones S&OP" },
  { key: "historico", label: "Histórico S&OP" },
  { key: "control", label: "Control S&OP" },
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
  const [message, setMessage] = useState("");

  const canEdit = canViewModule(currentUser, "sop");

  async function loadAll() {
    setLoading(true);
    const [productosData, controlData, parametrosData, planData, ventaRealData, decisionesData, historicoData] = await Promise.all([
      getProductos(),
      getControl(),
      getParametros(),
      getPlanVenta(),
      getVentaReal(),
      getDecisiones(),
      getHistorico(),
    ]);
    setProductos(productosData);
    setControl(controlData);
    setParametros(parametrosData);
    setPlanVenta(planData);
    setVentaReal(ventaRealData);
    setDecisiones(decisionesData);
    setHistorico(historicoData);
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
              <PlanVentaTab productos={productos} planVenta={planVenta} control={control} canEdit={canEdit} onSave={handleSavePlanVenta} currentUser={currentUser} />
            )}
            {activeTab === "operacion" && <OperacionTab productos={productos} planVenta={planVenta} control={control} parametros={parametros} />}
            {activeTab === "financiero" && <FinancieroTab productos={productos} planVenta={planVenta} control={control} parametros={parametros} />}
            {activeTab === "decisiones" && (
              <DecisionesTab decisiones={decisiones} canEdit={canEdit} onCreate={handleCreateDecision} onDelete={handleDeleteDecision} currentUser={currentUser} />
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
            {activeTab === "parametros" && <ParametrosTab parametros={parametros} canEdit={canEdit} onSave={handleSaveParametros} />}
          </>
        )}
      </div>
    </div>
  );
}
