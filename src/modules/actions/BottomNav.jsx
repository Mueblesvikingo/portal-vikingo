// Barra inferior fija estilo Calidad (ver src/modules/quality/BottomNav.jsx)
// — pedido explícito del usuario para que este módulo se navegue con el
// pulgar en celular. Solo 2 destinos (no hay "Config" aquí, Acciones de
// Mejora no tiene catálogos propios): Guías a un lado, Inicio elevado al
// centro. Solo vive dentro de ActionsModule, no en el resto del portal.
export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-[#edf0f4] bg-white/95 px-2 pb-2 pt-1.5 backdrop-blur-sm lg:hidden">
      <button type="button" onClick={() => onChange("guias")} className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 transition">
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-base transition"
          style={{ background: active === "guias" ? "#0284c7" : "#e6f4fc", color: active === "guias" ? "#ffffff" : "#0284c7" }}
        >
          📘
        </span>
        <span className={`text-[11px] font-medium ${active === "guias" ? "text-[#0f1f3d]" : "text-[#94a3b8]"}`}>Guías</span>
      </button>

      <button type="button" onClick={() => onChange("inicio")} className="-mt-5 flex flex-col items-center gap-1">
        <span
          className={`grid h-12 w-12 place-items-center rounded-full text-xl text-white shadow-[0_4px_10px_rgba(201,162,39,0.45)] transition ${
            active === "inicio" ? "scale-105 bg-[#b8931f]" : "bg-[#c9a227]"
          }`}
        >
          ▦
        </span>
        <span className={`text-[11px] font-semibold ${active === "inicio" ? "text-[#96771a]" : "text-[#5b6472]"}`}>Inicio</span>
      </button>
    </nav>
  );
}
