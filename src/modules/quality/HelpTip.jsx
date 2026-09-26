import { useState } from "react";

// Ícono "?" que despliega una explicación solo al tocarlo, en vez de un
// párrafo fijo ocupando espacio permanente. El panel usa posición `fixed`
// centrada en el viewport (no relativa al botón) para que nunca se salga de
// la pantalla sin importar dónde esté el ícono — en un botón ancla
// (`absolute` cerca del borde) el popover podía quedar cortado en celular.
export default function HelpTip({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#c9a227] bg-[#fdf7e6] text-[10px] font-bold text-[#96771a] transition hover:bg-[#f8ecc0]"
        aria-label="Ayuda"
      >
        ?
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <span className="fixed left-1/2 top-1/3 z-50 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#edf0f4] bg-white p-3.5 text-sm font-medium leading-snug text-[#0f1f3d] shadow-[0_8px_16px_-4px_rgba(11,31,58,0.12),0_24px_48px_-12px_rgba(11,31,58,0.18)]">
            {children}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-lg bg-[#f7f7f4] py-1.5 text-xs font-semibold text-[#5b6472]"
            >
              Entendido
            </button>
          </span>
        </>
      )}
    </span>
  );
}
