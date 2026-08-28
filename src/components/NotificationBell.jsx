import { useEffect, useRef, useState } from "react";
import { getPendingRecordatorios, markRecordatorioVisto } from "../services/pmoService";
import { getFichasFirmadasPendientesAviso, marcarFirmaAvisoVisto } from "../services/auditoriasService";

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
// pantalla del portal. También trae, mezclados en la misma lista, los avisos
// de "ya firmaron" (sig_auditorias) para quien envió un plan a firmar — a
// diferencia de la alerta de "te toca firmar" (MeetingAttendanceAlarm.jsx,
// pantalla completa), este es deliberadamente pasivo: solo campanita + un
// aviso de escritorio si el navegador lo permite.
export default function NotificationBell({ currentUser }) {
  const personaId = currentUser?.persona_id;
  const [recordatorios, setRecordatorios] = useState([]);
  const [firmas, setFirmas] = useState([]);
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(null);
  const containerRef = useRef(null);
  const notifiedFirmaRef = useRef(new Set());

  useEffect(() => {
    if (!personaId) { setRecordatorios([]); return undefined; }
    let cancelled = false;
    async function poll() {
      const result = await getPendingRecordatorios(personaId);
      if (!cancelled) setRecordatorios(result || []);
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [personaId]);

  useEffect(() => {
    if (!personaId) { setFirmas([]); return undefined; }
    let cancelled = false;
    async function poll() {
      const result = await getFichasFirmadasPendientesAviso(personaId);
      if (!cancelled) setFirmas(result || []);
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [personaId]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    firmas.forEach((item) => {
      const key = `${item.id}-${item.firmado_auditado_at}`;
      if (notifiedFirmaRef.current.has(key)) return;
      notifiedFirmaRef.current.add(key);
      if (Notification.permission === "granted") {
        new Notification("Ya firmaron tu plan de auditoría", {
          body: `${item.firmado_auditado_nombre} firmó el plan de ${item.macroproceso}`,
          icon: "/favicon.svg",
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    });
  }, [firmas]);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const items = [
    ...firmas.map((item) => ({ kind: "firma", id: item.id, titulo: item.macroproceso || "Auditoría", mensaje: `${item.firmado_auditado_nombre} ya firmó el plan.`, when: item.firmado_auditado_at })),
    ...recordatorios.map((item) => ({ kind: "recordatorio", id: item.id, titulo: item.proyecto?.nombre || "Proyecto", mensaje: item.mensaje, from: item.created_by_nombre, when: item.created_at })),
  ];

  async function handleDismiss(item) {
    const key = `${item.kind}-${item.id}`;
    setDismissing(key);
    const result = item.kind === "firma" ? await marcarFirmaAvisoVisto(item.id) : await markRecordatorioVisto(item.id);
    setDismissing(null);
    if (!result?.ok) return;
    if (item.kind === "firma") setFirmas((current) => current.filter((f) => f.id !== item.id));
    else setRecordatorios((current) => current.filter((r) => r.id !== item.id));
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
              items.map((item) => {
                const key = `${item.kind}-${item.id}`;
                const isFirma = item.kind === "firma";
                return (
                  <div key={key} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                    <p className={`text-[9px] font-black uppercase tracking-wide ${isFirma ? "text-emerald-600" : "text-amber-600"}`}>
                      {isFirma ? "✍️ " : ""}{item.titulo}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-700">{item.mensaje}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-slate-400">{item.from ? `De ${item.from}` : ""} {formatWhen(item.when)}</span>
                      <button
                        type="button"
                        disabled={dismissing === key}
                        onClick={() => handleDismiss(item)}
                        className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {dismissing === key ? "..." : "Visto"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
