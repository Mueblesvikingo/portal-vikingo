// Barra inferior fija estilo CORELI (MobileBottomNav) — pensada para que el
// módulo se navegue con el pulgar en celular. Solo vive dentro de Gestión de
// Calidad (se monta/desmonta con el módulo), no en el resto del portal.
// "Inicio" es el botón protagonista: va al centro, elevado y con color
// propio, como el botón central de cámara/acción en apps móviles típicas.
const LATERALES = [
  { key: "guias", label: "Guías", icon: "📘", color: "#0284c7", bg: "#e6f4fc" },
  { key: "config", label: "Config.", icon: "⚙️", color: "#7c3aed", bg: "#f3edfd" },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-[#edf0f4] bg-white/95 px-2 pb-2 pt-1.5 backdrop-blur-sm lg:hidden">
      <LateralButton item={LATERALES[0]} active={active === LATERALES[0].key} onClick={() => onChange(LATERALES[0].key)} />

      <button
        type="button"
        onClick={() => onChange("inicio")}
        className="-mt-5 flex flex-col items-center gap-1"
      >
        <span
          className={`grid h-12 w-12 place-items-center rounded-full text-xl text-white shadow-[0_4px_10px_rgba(201,162,39,0.45)] transition ${
            active === "inicio" ? "scale-105 bg-[#b8931f]" : "bg-[#c9a227]"
          }`}
        >
          ▦
        </span>
        <span className={`text-[11px] font-semibold ${active === "inicio" ? "text-[#96771a]" : "text-[#5b6472]"}`}>Inicio</span>
      </button>

      <LateralButton item={LATERALES[1]} active={active === LATERALES[1].key} onClick={() => onChange(LATERALES[1].key)} />
    </nav>
  );
}

function LateralButton({ item, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 transition">
      <span
        className="grid h-9 w-9 place-items-center rounded-full text-base transition"
        style={{ background: active ? item.color : item.bg, color: active ? "#ffffff" : item.color }}
      >
        {item.icon}
      </span>
      <span className={`text-[11px] font-medium ${active ? "text-[#0f1f3d]" : "text-[#94a3b8]"}`}>{item.label}</span>
    </button>
  );
}
