import { useState } from "react";
import MateriaPrimaPanel from "./MateriaPrimaPanel";

// Vista principal tipo grid (patrón adaptado de CORELI: bloques
// seleccionables que abren su gestión en el mismo lugar, como cambiar de
// pestaña, sin navegar a otra URL) + el mecanismo de estado local para
// cambiar entre "grid" y "gestión de una planta" ya usado en otros paneles
// del portal (tabs con useState).
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
      className={`flex flex-col items-center rounded-2xl border-2 bg-white p-4 shadow-sm transition ${
        seccion.disponible ? "border-[#001225]/15 hover:-translate-y-0.5 hover:border-[#001225]/40 hover:shadow-md" : "border-slate-100 opacity-50"
      }`}
    >
      <span className="text-3xl">{seccion.icono}</span>
      <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-800">{seccion.titulo}</p>
      <p className="text-[9px] font-bold text-slate-400">{seccion.codigo}</p>
      <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${
        seccion.disponible ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
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
    <section className="mx-auto max-w-6xl px-3 py-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-[#001225] px-5 py-3 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Gestión de Calidad</p>
            <p className="text-lg font-black">{seccionActiva ? seccionActiva.titulo : "Formatos de inspección"}</p>
          </div>
          {seccionActiva && (
            <button type="button" onClick={() => setActiveSection(null)} className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-black text-white/80 hover:bg-white/10">
              ← Gestión de Calidad
            </button>
          )}
        </div>

        <div className="p-3">
          {!seccionActiva ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SECCIONES.map((s) => (
                <SeccionTile key={s.key} seccion={s} onClick={setActiveSection} />
              ))}
            </div>
          ) : seccionActiva.key === "materia-prima" ? (
            <MateriaPrimaPanel currentUser={currentUser} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
