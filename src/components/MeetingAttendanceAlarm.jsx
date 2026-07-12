import { useEffect, useRef, useState } from "react";
import { confirmMeetingAttendance, getPendingMeetingConfirmations } from "../services/workloadService";

const POLL_INTERVAL_MS = 25000;
const SNOOZE_MS = 90000;
const BEEP_INTERVAL_MS = 3500;
const ALARM_TITLE = "⚠️ CONFIRMA TU ASISTENCIA";

function formatMeetingWhen(meeting) {
  const fecha = meeting?.fecha_limite || "Sin fecha";
  const hora = meeting?.hora_limite ? meeting.hora_limite.slice(0, 5) : "";
  return hora ? `${fecha} · ${hora}` : fecha;
}

export default function MeetingAttendanceAlarm({ currentUser }) {
  const personaId = currentUser?.persona_id;
  const [pending, setPending] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const snoozedUntilRef = useRef({});
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "");
  const audioCtxRef = useRef(null);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!personaId) {
      setPending([]);
      return undefined;
    }

    let cancelled = false;

    async function poll() {
      const result = await getPendingMeetingConfirmations(personaId);
      if (cancelled) return;
      const now = Date.now();
      const visible = (result || []).filter((item) => (snoozedUntilRef.current[item.id] || 0) <= now);
      setPending(visible);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [personaId]);

  const active = pending[0] || null;

  useEffect(() => {
    if (!active) {
      if (typeof document !== "undefined") document.title = originalTitleRef.current;
      return undefined;
    }
    let showAlarmTitle = false;
    const interval = setInterval(() => {
      document.title = showAlarmTitle ? originalTitleRef.current : ALARM_TITLE;
      showAlarmTitle = !showAlarmTitle;
    }, 1000);
    return () => {
      clearInterval(interval);
      document.title = originalTitleRef.current;
    };
  }, [active?.id]);

  useEffect(() => {
    if (!active || notifiedRef.current.has(active.id)) return;
    notifiedRef.current.add(active.id);
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification("Confirma tu asistencia a una reunión", {
        body: `${active.nombre || active.titulo || "Reunión"} · ${formatMeetingWhen(active)}`,
        icon: "/favicon.svg",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, [active?.id]);

  useEffect(() => {
    if (!active) return undefined;
    function beep() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        const ctx = audioCtxRef.current;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = 880;
        gain.gain.value = 0.06;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.16);
      } catch {
        // Audio bloqueado por el navegador; el resto de la alerta sigue funcionando.
      }
    }
    beep();
    const interval = setInterval(beep, BEEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active?.id]);

  if (!active) return null;

  async function handleConfirm() {
    setConfirming(true);
    const result = await confirmMeetingAttendance(active.id);
    setConfirming(false);
    if (result?.ok) {
      setPending((current) => current.filter((item) => item.id !== active.id));
    }
  }

  function handleSnooze() {
    snoozedUntilRef.current[active.id] = Date.now() + SNOOZE_MS;
    setPending((current) => current.filter((item) => item.id !== active.id));
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-red-950/80 p-4">
      <div className="w-full max-w-sm animate-pulse rounded-2xl border-4 border-red-500 bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <p className="text-sm font-black uppercase tracking-widest text-red-600">Confirma tu asistencia</p>
        </div>
        <p className="mt-3 text-base font-black text-slate-900">{active.nombre || active.titulo || "Reunión"}</p>
        <p className="mt-1 text-[11px] font-bold text-slate-500">{formatMeetingWhen(active)} · {active.gestion || "Sin canal"}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={handleConfirm}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {confirming ? "Confirmando..." : "✓ Confirmar asistencia"}
          </button>
          <button
            type="button"
            onClick={handleSnooze}
            className="text-[10px] font-bold text-slate-400 underline hover:text-slate-600"
          >
            Recordarme en un momento
          </button>
        </div>
      </div>
    </div>
  );
}
