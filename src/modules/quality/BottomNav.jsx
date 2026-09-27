// Barra inferior fija estilo CORELI (MobileBottomNav) — pensada para que el
// módulo se navegue con el pulgar en celular. Solo vive dentro de Gestión de
// Calidad (se monta/desmonta con el módulo), no en el resto del portal.
const ITEMS = [
  { key: "inicio", label: "Inicio", icon: "▦" },
  { key: "guias", label: "Guías", icon: "📘" },
  { key: "config", label: "Config." },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#edf0f4] bg-white/95 px-2 py-2 backdrop-blur-sm lg:hidden">
      {ITEMS.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[11px] font-medium transition ${isActive ? "text-[#0b1f3a]" : "text-[#94a3b8]"}`}
          >
            <span className={`text-lg leading-none transition-transform ${isActive ? "scale-110" : ""}`}>{item.icon || "⚙️"}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
