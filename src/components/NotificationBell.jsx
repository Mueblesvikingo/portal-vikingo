import { useEffect, useRef, useState } from "react";
import { getPendingRecordatorios, markRecordatorioVisto } from "../services/pmoService";

const POLL_INTERVAL_MS = 30000;

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Campanita global junto al usuario activo — hasta ahora los recordatorios
// del Tablero Gerencial de Proyectos (pmo_recordatorios) solo se veían si el
// destinatario abría Balance de Carga → Proyectos por su cuenta; no había
// ningún aviso que lo llevara ahí. Esto los hace visibles desde cualquier
// pantalla del portal.
export default function NotificationBell({ currentUser }) {
  const personaId = currentUser?.persona_id;
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!personaId) { setItems([]); return undefined; }
    let cancelled = false;
    async function poll() {
      const result = await getPendingRecordatorios(personaId);
      if (!cancelled) setItems(result || []);
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [personaId]);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleDismiss(id) {
    setDismissing(id);
    const result = await markRecordatorioVisto(id);
    setDismissing(null);
    if (result?.ok) setItems((current) => current.filter((item) => item.id !== id));
  }

  if (!personaId) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg transition hover:bg-slate-50"
      >
        🔔
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="bg-[#001225] px-4 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-white">Notificaciones</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] font-bold text-slate-300">No tienes notificaciones.</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <p className="text-[9px] font-black uppercase tracking-wide text-amber-600">{item.proyecto?.nombre || "Proyecto"}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-700">{item.mensaje}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-slate-400">{item.created_by_nombre ? `De ${item.created_by_nombre}` : ""} {formatWhen(item.created_at)}</span>
                    <button
                      type="button"
                      disabled={dismissing === item.id}
                      onClick={() => handleDismiss(item.id)}
                      className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {dismissing === item.id ? "..." : "Visto"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
