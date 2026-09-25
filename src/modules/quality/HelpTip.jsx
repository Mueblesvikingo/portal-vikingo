import { useState } from "react";

// Ícono "?" que despliega una explicación solo al tocarlo, en vez de un
// párrafo fijo ocupando espacio permanente — patrón pedido para reemplazar
// textos explicativos siempre visibles.
export default function HelpTip({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[#edf0f4] bg-[#f7f7f4] text-[9px] font-bold text-[#5b6472] transition hover:border-[#c9a227] hover:text-[#96771a]"
        aria-label="Ayuda"
      >
        ?
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute left-0 top-5 z-20 w-56 rounded-xl border border-[#edf0f4] bg-white p-2.5 text-xs font-medium leading-snug text-[#0f1f3d] shadow-[0_8px_16px_-4px_rgba(11,31,58,0.12),0_24px_48px_-12px_rgba(11,31,58,0.18)]">
            {children}
          </span>
        </>
      )}
    </span>
  );
}
