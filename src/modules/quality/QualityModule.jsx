import { useState } from "react";
import MateriaPrimaPanel from "./MateriaPrimaPanel";
import { cardClass } from "./coreliTheme";

// Vista principal tipo grid (patrón adaptado de CORELI: bloques
// seleccionables que abren su gestión en el mismo lugar, como cambiar de
// pestaña, sin navegar a otra URL) — paleta, tarjetas y tipografía copiadas
// literalmente del diseño móvil de CORELI (ver coreliTheme.js), porque este
// módulo se usa casi siempre desde celular.
const SECCIONES = [
  { key: "materia-prima", titulo: "Materia Prima", codigo: "F-GC-01U", icono: "📥", disponible: true },
  { key: "planta-1", titulo: "Planta 1", codigo: "F-GC-02U", icono: "🪚", disponible: false },
  { key: "planta-2", titulo: "Planta 2", codigo: "F-GC-03U", icono: "🧵", disponible: false },
  { key: "planta-3", titulo: "Planta 3", codigo: "F-GC-04U", icono: "🛋️", disponible: false },
];

function SeccionTile({ seccion, onClick }) {
  return (
    <button
      type="button"
      onClick={() => seccion.disponible && onClick(seccion.key)}
      disabled={!seccion.disponible}
      className={`flex flex-col items-center p-4 transition ${cardClass} ${
        seccion.disponible ? "active:scale-[0.98] hover:border-[#f0d885] hover:shadow-[0_8px_16px_-4px_rgba(11,31,58,0.12),0_24px_48px_-12px_rgba(11,31,58,0.18)]" : "opacity-50"
      }`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${seccion.disponible ? "bg-[#fdf7e6]" : "bg-[#f7f7f4]"}`}>
        {seccion.icono}
      </span>
      <p className="mt-2.5 text-sm font-semibold text-[#0f1f3d]">{seccion.titulo}</p>
      <p className="text-xs text-[#5b6472]">{seccion.codigo}</p>
      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        seccion.disponible ? "border border-green-200 bg-green-50 text-green-700" : "border border-[#edf0f4] bg-[#f7f7f4] text-[#5b6472]"
      }`}>
        {seccion.disponible ? "Disponible" : "Próximamente"}
      </span>
    </button>
  );
}

export default function QualityModule({ currentUser }) {
  const [activeSection, setActiveSection] = useState(null);
  const seccionActiva = SECCIONES.find((s) => s.key === activeSection);

  return (
    <section className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
      <header className="mb-4 flex items-center gap-3 rounded-2xl bg-[#0b1f3a] px-4 py-3.5 sm:px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#b8931f]">
          <span className="text-base">✅</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Gestión de Calidad</p>
          <p className="truncate text-lg font-bold text-white">{seccionActiva ? seccionActiva.titulo : "Formatos de inspección"}</p>
        </div>
        {seccionActiva && (
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
          >
            ← Gestión de Calidad
          </button>
        )}
      </header>

      {!seccionActiva ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SECCIONES.map((s) => (
            <SeccionTile key={s.key} seccion={s} onClick={setActiveSection} />
          ))}
        </div>
      ) : seccionActiva.key === "materia-prima" ? (
        <MateriaPrimaPanel currentUser={currentUser} />
      ) : null}
    </section>
  );
}
