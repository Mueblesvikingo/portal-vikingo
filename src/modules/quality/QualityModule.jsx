import { useState } from "react";
import MateriaPrimaPanel from "./MateriaPrimaPanel";
import Planta1Panel from "./Planta1Panel";
import Planta2Panel from "./Planta2Panel";
import Planta3Panel from "./Planta3Panel";
import ProductoTerminadoPanel from "./ProductoTerminadoPanel";
import GuiasView from "./GuiasView";
import ConfiguracionView from "./ConfiguracionView";
import BottomNav from "./BottomNav";
import { cardClass } from "./coreliTheme";

// El emoji de sierra (🪚, Unicode 13.0/2020) no lo renderizan muchos
// dispositivos/fuentes — se veía en blanco en el bloque de Planta 1. Se
// reemplaza por un ícono propio en SVG (siempre se ve igual, no depende de
// la fuente de emoji del dispositivo).
function IconoSierra({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 17.5L15 6" stroke="#96771a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 6H21V9.5H18" stroke="#96771a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15L7 17.5" stroke="#96771a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7.5 11.5L10 14" stroke="#96771a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.5 8.5L13 11" stroke="#96771a" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="4" cy="18" r="1.4" fill="#96771a" />
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
  { key: "planta-1", titulo: "Planta 1", codigo: "F-GC-02U", icono: <IconoSierra />, disponible: true },
  { key: "planta-2", titulo: "Planta 2", codigo: "F-GC-03U", icono: "🧵", disponible: true },
  { key: "planta-3", titulo: "Planta 3", codigo: "F-GC-04U", icono: "🛋️", disponible: true },
  { key: "producto-terminado", titulo: "Producto Terminado", codigo: "F-GC-05", icono: "📦", disponible: true },
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
  const [bottomTab, setBottomTab] = useState("inicio");
  const [activeSection, setActiveSection] = useState(null);
  const seccionActiva = SECCIONES.find((s) => s.key === activeSection);

  function goInicio() {
    setBottomTab("inicio");
    setActiveSection(null);
  }

  return (
    <section className="mx-auto max-w-6xl px-3 pb-20 pt-4 sm:px-4 lg:pb-4">
      {bottomTab === "inicio" && (
        <>
          <header className="mb-2.5 flex items-center gap-2.5 rounded-xl bg-[#0b1f3a] px-3 py-2 sm:px-4">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#b8931f]">
              <span className="text-sm">✅</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/50">Gestión de Calidad</p>
              <p className="truncate text-sm font-bold text-white">{seccionActiva ? seccionActiva.titulo : "Formatos de inspección"}</p>
            </div>
            {seccionActiva && (
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:bg-white/10"
              >
                ← Volver
              </button>
            )}
          </header>

          {!seccionActiva ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {SECCIONES.map((s) => (
                <SeccionTile key={s.key} seccion={s} onClick={setActiveSection} />
              ))}
            </div>
          ) : seccionActiva.key === "materia-prima" ? (
            <MateriaPrimaPanel currentUser={currentUser} />
          ) : seccionActiva.key === "planta-1" ? (
            <Planta1Panel currentUser={currentUser} />
          ) : seccionActiva.key === "planta-2" ? (
            <Planta2Panel currentUser={currentUser} />
          ) : seccionActiva.key === "planta-3" ? (
            <Planta3Panel currentUser={currentUser} />
          ) : seccionActiva.key === "producto-terminado" ? (
            <ProductoTerminadoPanel currentUser={currentUser} />
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
