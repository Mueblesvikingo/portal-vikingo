import { useEffect, useRef, useState } from "react";
import {
  confirmMeetingAttendance,
  confirmPreMeetingReminder,
  getPendingMeetingConfirmations,
  getPendingPreMeetingReminders,
} from "../services/workloadService";

const POLL_INTERVAL_MS = 25000;
const SNOOZE_MS = 90000;
const BEEP_INTERVAL_MS = 2400;
const PRE_MEETING_WINDOW_MS = 45 * 60 * 1000;
const ATTENDANCE_TITLE = "⚠️ CONFIRMA TU ASISTENCIA";
const PRE_MEETING_TITLE = "⏰ TU REUNIÓN ESTÁ POR COMENZAR";
const SIREN_LOW_FREQ = 420;
const SIREN_HIGH_FREQ = 1250;
const SIREN_SWEEP_DURATION = 0.28;
const SIREN_SWEEP_COUNT = 3;

function formatMeetingWhen(meeting) {
  const fecha = meeting?.fecha_limite || "Sin fecha";
  const hora = meeting?.hora_limite ? meeting.hora_limite.slice(0, 5) : "";
  return hora ? `${fecha} · ${hora}` : fecha;
}

function getMeetingStartTimestamp(item) {
  if (!item?.fecha_limite || !item?.hora_limite) return null;
  const timePart = item.hora_limite.length === 5 ? `${item.hora_limite}:00` : item.hora_limite;
  const date = new Date(`${item.fecha_limite}T${timePart}`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function getMinutesUntil(item) {
  const start = getMeetingStartTimestamp(item);
  if (start === null) return null;
  return Math.round((start - Date.now()) / 60000);
}

export default function MeetingAttendanceAlarm({ currentUser }) {
  const personaId = currentUser?.persona_id;
  const [pendingAttendance, setPendingAttendance] = useState([]);
  const [pendingPreMeeting, setPendingPreMeeting] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const snoozedUntilRef = useRef({});
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "");
  const audioCtxRef = useRef(null);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!personaId) {
      setPendingAttendance([]);
      return undefined;
    }

    let cancelled = false;

    async function poll() {
      const result = await getPendingMeetingConfirmations(personaId);
      if (cancelled) return;
      const now = Date.now();
      const visible = (result || []).filter((item) => (snoozedUntilRef.current[`attendance-${item.id}`] || 0) <= now);
      setPendingAttendance(visible);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [personaId]);

  useEffect(() => {
    if (!personaId) {
      setPendingPreMeeting([]);
      return undefined;
    }

    let cancelled = false;

    async function poll() {
      const result = await getPendingPreMeetingReminders(personaId);
      if (cancelled) return;
      const now = Date.now();
      const visible = (result || []).filter((item) => {
        if ((snoozedUntilRef.current[`pre-${item.id}`] || 0) > now) return false;
        const start = getMeetingStartTimestamp(item);
        if (start === null) return false;
        return start - now <= PRE_MEETING_WINDOW_MS;
      });
      setPendingPreMeeting(visible);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [personaId]);

  const activePreMeeting = pendingPreMeeting[0] || null;
  const activeAttendance = pendingAttendance[0] || null;
  const activeType = activePreMeeting ? "pre-meeting" : activeAttendance ? "attendance" : null;
  const active = activePreMeeting || activeAttendance;
  const notifyKey = active ? `${activeType}-${active.id}` : null;

  useEffect(() => {
    if (!active) {
      if (typeof document !== "undefined") document.title = originalTitleRef.current;
      return undefined;
    }
    const alarmTitle = activeType === "pre-meeting" ? PRE_MEETING_TITLE : ATTENDANCE_TITLE;
    let showAlarmTitle = false;
    const interval = setInterval(() => {
      document.title = showAlarmTitle ? originalTitleRef.current : alarmTitle;
      showAlarmTitle = !showAlarmTitle;
    }, 1000);
    return () => {
      clearInterval(interval);
      document.title = originalTitleRef.current;
    };
  }, [notifyKey, activeType]);

  useEffect(() => {
    if (!active || !notifyKey || notifiedRef.current.has(notifyKey)) return;
    notifiedRef.current.add(notifyKey);
    if (typeof Notification === "undefined") return;
    const title = activeType === "pre-meeting" ? "Tu reunión está por comenzar" : "Confirma tu asistencia a una reunión";
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: `${active.nombre || active.titulo || "Reunión"} · ${formatMeetingWhen(active)}`,
        icon: "/favicon.svg",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, [notifyKey, activeType]);

  useEffect(() => {
    if (!active) return undefined;
    function carAlarmSiren() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        const ctx = audioCtxRef.current;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sawtooth";
        const startTime = ctx.currentTime;
        oscillator.frequency.setValueAtTime(SIREN_LOW_FREQ, startTime);
        let time = startTime;
        for (let i = 0; i < SIREN_SWEEP_COUNT; i++) {
          oscillator.frequency.linearRampToValueAtTime(SIREN_HIGH_FREQ, time + SIREN_SWEEP_DURATION);
          time += SIREN_SWEEP_DURATION;
          oscillator.frequency.linearRampToValueAtTime(SIREN_LOW_FREQ, time + SIREN_SWEEP_DURATION);
          time += SIREN_SWEEP_DURATION;
        }
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.07, startTime + 0.03);
        gain.gain.setValueAtTime(0.07, time - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(startTime);
        oscillator.stop(time);
      } catch {
        // Audio bloqueado por el navegador; el resto de la alerta sigue funcionando.
      }
    }
    carAlarmSiren();
    const interval = setInterval(carAlarmSiren, BEEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [notifyKey]);

  if (!active) return null;

  const minutesUntil = activeType === "pre-meeting" ? getMinutesUntil(active) : null;

  async function handleConfirm() {
    setConfirming(true);
    const result = activeType === "pre-meeting"
      ? await confirmPreMeetingReminder(active.id)
      : await confirmMeetingAttendance(active.id);
    setConfirming(false);
    if (result?.ok) {
      if (activeType === "pre-meeting") {
        setPendingPreMeeting((current) => current.filter((item) => item.id !== active.id));
      } else {
        setPendingAttendance((current) => current.filter((item) => item.id !== active.id));
      }
    }
  }

  function handleSnooze() {
    snoozedUntilRef.current[`${activeType === "pre-meeting" ? "pre" : "attendance"}-${active.id}`] = Date.now() + SNOOZE_MS;
    if (activeType === "pre-meeting") {
      setPendingPreMeeting((current) => current.filter((item) => item.id !== active.id));
    } else {
      setPendingAttendance((current) => current.filter((item) => item.id !== active.id));
    }
  }

  const isPreMeeting = activeType === "pre-meeting";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-red-950/80 p-4">
      <div className="w-full max-w-sm animate-pulse rounded-2xl border-4 border-red-500 bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{isPreMeeting ? "⏰" : "⚠️"}</span>
          <p className="text-sm font-black uppercase tracking-widest text-red-600">
            {isPreMeeting ? "Tu reunión está por comenzar" : "Confirma tu asistencia"}
          </p>
        </div>
        <p className="mt-3 text-base font-black text-slate-900">{active.nombre || active.titulo || "Reunión"}</p>
        <p className="mt-1 text-[11px] font-bold text-slate-500">{formatMeetingWhen(active)} · {active.gestion || "Sin canal"}</p>
        {isPreMeeting && minutesUntil !== null && (
          <p className="mt-1 text-[11px] font-black text-red-600">
            {minutesUntil > 0 ? `Comienza en ${minutesUntil} min` : "Está comenzando ahora"}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={handleConfirm}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {confirming ? "Confirmando..." : isPreMeeting ? "✓ Entendido, ya voy" : "✓ Confirmar asistencia"}
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
