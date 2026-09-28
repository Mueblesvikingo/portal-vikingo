import { useState } from "react";
import ProveedoresPanel from "./ProveedoresPanel";

// Catálogos del módulo (proveedores, colaboradores, productos) — se
// construyen cuando se necesiten. Proveedores ya es real; Colaboradores y
// Productos siguen como marcadores de posición.
const CATALOGOS = [
  { key: "proveedores", icono: "🚚", titulo: "Proveedores", detalle: "Para inspecciones de Materia Prima", disponible: true },
  { key: "colaboradores", icono: "👥", titulo: "Colaboradores", detalle: "Inspectoras, supervisores, gerencia", disponible: false },
  { key: "productos", icono: "📦", titulo: "Productos", detalle: "Catálogo de piezas y componentes", disponible: false },
];

export default function ConfiguracionView() {
  const [activo, setActivo] = useState(null);

  if (activo === "proveedores") return <ProveedoresPanel onBack={() => setActivo(null)} />;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#0f1f3d]">Configuración</h2>
        <p className="text-sm text-[#5b6472]">Catálogos compartidos del módulo de calidad.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATALOGOS.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={!c.disponible}
            onClick={() => c.disponible && setActivo(c.key)}
            className={`flex flex-col items-center rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm transition ${
              c.disponible ? "active:scale-[0.98]" : "opacity-50"
            }`}
          >
            <span className="text-3xl">{c.icono}</span>
            <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-800">{c.titulo}</p>
            <p className="text-center text-[9px] font-bold text-slate-400">{c.detalle}</p>
            {!c.disponible && (
              <span className="mt-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-400">Próximamente</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
