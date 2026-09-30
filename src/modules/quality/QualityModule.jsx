import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRecorridoPlanta } from "../../services/calidadService";
import MateriaPrimaPanel from "./MateriaPrimaPanel";
import Planta1Panel from "./Planta1Panel";
import Planta2Panel from "./Planta2Panel";
import Planta3Panel from "./Planta3Panel";
import ProductoTerminadoPanel from "./ProductoTerminadoPanel";
import GuiasView from "./GuiasView";
import ConfiguracionView from "./ConfiguracionView";
import ParetoView from "./ParetoView";
import CartaPView from "./CartaPView";
import BottomNav from "./BottomNav";
import HelpTip from "./HelpTip";
import { cardClass } from "./coreliTheme";

// Ícono propio en SVG para Planta 1 (Carpintería) — no depende de la fuente
// de emoji del dispositivo (mismo motivo que llevó a reemplazar el emoji de
// sierra 🪚 antes: se veía en blanco en varios celulares). Máquina de corte
// (mesa con sierra circular) — pedido explícito del usuario, aprobado tras
// ver varias opciones en preview.
function IconoSierraMesa({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="17" r="7" fill="#96771a" />
      <path d="M6.8 12.3 L8.3 12.1 L7.3 10.3 Z" fill="#96771a" />
      <path d="M11 10.8 L13 10.8 L12 8.6 Z" fill="#96771a" />
      <path d="M15.7 12.1 L17.2 12.3 L16.7 10.3 Z" fill="#96771a" />
      <rect x="0.5" y="14.5" width="23" height="4.5" rx="1" fill="#96771a" />
      <rect x="3" y="19" width="2" height="3" fill="#96771a" />
      <rect x="19" y="19" width="2" height="3" fill="#96771a" />
    </svg>
  );
}

// Vista principal tipo grid (patrón adaptado de CORELI: bloques
// seleccionables que abren su gestión en el mismo lugar, como cambiar de
// pestaña, sin navegar a otra URL) — paleta, tarjetas y tipografía copiadas
// literalmente del diseño móvil de CORELI (ver coreliTheme.js), porque este
// módulo se usa casi siempre desde celular.
const SECCIONES = [
  { key: "materia-prima", titulo: "Materia Prima", codigo: "F-GC-01U", icono: "📥", disponible: true },
  { key: "planta-1", titulo: "Planta 1", codigo: "F-GC-02U", icono: <IconoSierraMesa />, disponible: true },
  { key: "planta-2", titulo: "Planta 2", codigo: "F-GC-03U", icono: "🧵", disponible: true },
  { key: "planta-3", titulo: "Planta 3", codigo: "F-GC-04U", icono: "🛋️", disponible: true },
  { key: "producto-terminado", titulo: "Producto Terminado", codigo: "F-GC-05", icono: "📦", disponible: true },
];

// Puente inverso Acciones de Mejora → Calidad ("Ver informe" en el detalle
// de una acción cuyo origen es una inspección puntual, ver AccionDetailPanel):
// el nombre de planta guardado en calidad_recorridos no coincide 1:1 con el
// texto de SECCIONES, así que se traduce aquí a la pestaña correspondiente.
const PLANTA_A_SECCION = {
  "Materia Prima": "materia-prima",
  "Planta 1": "planta-1",
  "Planta 2": "planta-2",
  "Planta 3": "planta-3",
  "Producto Terminado": "producto-terminado",
};

// Herramientas de Control Estadístico de Procesos (SPC) — viven aparte de
// los formatos de inspección, con su propio bloque color vino debajo. Por
// ahora solo Pareto; el resto (histograma, X-bar/R, etc.) se agrega aquí
// mismo más adelante.
const HERRAMIENTAS = [
  {
    key: "pareto",
    titulo: "Pareto",
    codigo: "SPC",
    icono: "📈",
    disponible: true,
    ayuda: "Cuenta cuántas veces salió \"No conforme\" cada punto de control y los ordena de mayor a menor, con el % acumulado. Sirve para ver en qué 2 o 3 puntos se concentran la mayoría de los defectos (regla 80/20) y atacar esos primero.",
  },
  {
    key: "carta-p",
    titulo: "Carta p",
    codigo: "SPC",
    icono: "🎯",
    disponible: true,
    ayuda: "Muestra el % de puntos No Conformes de cada día, comparado contra sus límites de control (UCL/LCL). Sirve para detectar si el proceso está estable, o si un día se sale de control — algo cambió ese día y conviene investigar qué fue.",
  },
];

function SeccionTile({ seccion, onClick }) {
  return (
    <button
      type="button"
      onClick={() => seccion.disponible && onClick(seccion.key)}
      disabled={!seccion.disponible}
      className={`flex flex-col items-center p-2.5 transition ${cardClass} ${
        seccion.disponible ? "active:scale-[0.98] hover:border-[#f0d885] hover:shadow-[0_8px_16px_-4px_rgba(11,31,58,0.12),0_24px_48px_-12px_rgba(11,31,58,0.18)]" : "opacity-50"
      }`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${seccion.disponible ? "bg-[#fdf7e6]" : "bg-[#f7f7f4]"}`}>
        {seccion.icono}
      </span>
      <p className="mt-1.5 text-center text-xs font-semibold leading-tight text-[#0f1f3d]">{seccion.titulo}</p>
      <p className="text-[10px] text-[#5b6472]">{seccion.codigo}</p>
      {!seccion.disponible && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#edf0f4] bg-[#f7f7f4] px-2 py-0.5 text-[9px] font-medium text-[#5b6472]">
          Próximamente
        </span>
      )}
    </button>
  );
}

export default function QualityModule({ currentUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [bottomTab, setBottomTab] = useState("inicio");
  const [activeSection, setActiveSection] = useState(null);
  // Id del recorrido a abrir automáticamente al llegar desde el botón "Ver
  // informe" de Acciones de Mejora (ver AccionDetailPanel.jsx) — se limpia
  // al salir de esa planta para no reabrir el mismo detalle si se vuelve a
  // entrar después sin venir de ese botón. `returnToAccionId` viaja junto
  // con él para poder regresar a esa misma acción desde el informe (ver
  // botón "← Volver a la acción" en DetalleRegistroModal, shared.jsx).
  const [pendingVerId, setPendingVerId] = useState(null);
  const [returnToAccionId, setReturnToAccionId] = useState(null);
  const seccionActiva = SECCIONES.find((s) => s.key === activeSection);
  const herramientaActiva = HERRAMIENTAS.find((h) => h.key === activeSection);
  const activa = seccionActiva || herramientaActiva;

  useEffect(() => {
    const id = location.state?.verInspeccionId;
    if (!id) return;
    let cancelado = false;
    async function abrir() {
      const planta = await getRecorridoPlanta(id);
      if (cancelado || !planta) return;
      const seccionKey = PLANTA_A_SECCION[planta];
      if (!seccionKey) return;
      setBottomTab("inicio");
      setActiveSection(seccionKey);
      setPendingVerId(id);
      setReturnToAccionId(location.state?.returnToAccionId || null);
    }
    abrir();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function handleVolverAAccion() {
    navigate("/acciones", { state: { openAccionId: returnToAccionId } });
  }

  function goInicio() {
    setBottomTab("inicio");
    setActiveSection(null);
    setPendingVerId(null);
    setReturnToAccionId(null);
  }

  return (
    <section className="mx-auto max-w-6xl px-3 pb-20 pt-4 sm:px-4 lg:pb-4">
      {bottomTab === "inicio" && (
        <>
          <header className={`mb-2.5 flex items-center gap-2.5 rounded-xl px-3 py-2 sm:px-4 ${herramientaActiva ? "bg-[#6b1e2f]" : "bg-[#0b1f3a]"}`}>
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${herramientaActiva ? "bg-[#c9a227]" : "bg-[#b8931f]"}`}>
              <span className="text-sm">{herramientaActiva ? herramientaActiva.icono : "✅"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/50">{herramientaActiva ? "Control Estadístico de Procesos" : "Gestión de Calidad"}</p>
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-bold text-white">{activa ? activa.titulo : "Formatos de inspección"}</p>
                {herramientaActiva?.ayuda && <HelpTip>{herramientaActiva.ayuda}</HelpTip>}
              </div>
            </div>
            {activa && (
              <button
                type="button"
                onClick={() => { setActiveSection(null); setPendingVerId(null); setReturnToAccionId(null); }}
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:bg-white/10"
              >
                ← Volver
              </button>
            )}
          </header>

          {!activa ? (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {SECCIONES.map((s) => (
                  <SeccionTile key={s.key} seccion={s} onClick={setActiveSection} />
                ))}
              </div>

              <header className="mb-2.5 mt-3 flex items-center gap-2.5 rounded-xl bg-[#6b1e2f] px-3 py-2 sm:px-4">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#c9a227]">
                  <span className="text-sm">📈</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-white/50">Control Estadístico de Procesos</p>
                  <p className="truncate text-sm font-bold text-white">Herramientas SPC</p>
                </div>
              </header>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {HERRAMIENTAS.map((h) => (
                  <SeccionTile key={h.key} seccion={h} onClick={setActiveSection} />
                ))}
              </div>
            </>
          ) : seccionActiva?.key === "materia-prima" ? (
            <MateriaPrimaPanel currentUser={currentUser} initialVerId={pendingVerId} returnToAccionId={returnToAccionId} onVolverAAccion={handleVolverAAccion} />
          ) : seccionActiva?.key === "planta-1" ? (
            <Planta1Panel currentUser={currentUser} initialVerId={pendingVerId} returnToAccionId={returnToAccionId} onVolverAAccion={handleVolverAAccion} />
          ) : seccionActiva?.key === "planta-2" ? (
            <Planta2Panel currentUser={currentUser} initialVerId={pendingVerId} returnToAccionId={returnToAccionId} onVolverAAccion={handleVolverAAccion} />
          ) : seccionActiva?.key === "planta-3" ? (
            <Planta3Panel currentUser={currentUser} initialVerId={pendingVerId} returnToAccionId={returnToAccionId} onVolverAAccion={handleVolverAAccion} />
          ) : seccionActiva?.key === "producto-terminado" ? (
            <ProductoTerminadoPanel currentUser={currentUser} initialVerId={pendingVerId} returnToAccionId={returnToAccionId} onVolverAAccion={handleVolverAAccion} />
          ) : herramientaActiva?.key === "pareto" ? (
            <ParetoView />
          ) : herramientaActiva?.key === "carta-p" ? (
            <CartaPView />
          ) : null}
        </>
      )}

      {bottomTab === "guias" && <GuiasView />}
      {bottomTab === "config" && <ConfiguracionView />}

      <BottomNav
        active={bottomTab}
        onChange={(tab) => (tab === "inicio" ? goInicio() : setBottomTab(tab))}
      />
    </section>
  );
}
