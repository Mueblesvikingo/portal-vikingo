import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDirectorioPersonas,
  getMensajesDePersona,
  enviarMensaje,
  marcarMensajeLeido,
  marcarConversacionLeida,
} from "../services/mensajesService";

const POLL_INTERVAL_MS = 15000;

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Ícono de mensajería junto a la campanita — conversación 1 a 1 entre
// personas del portal, con check de leído: al marcar leído un mensaje
// recibido, el remitente ve el cambio reflejado en su propia burbuja enviada
// la próxima vez que este panel haga poll (mismo patrón de 15-30s que ya usa
// NotificationBell, no hay backend de tiempo real).
export default function MessagesPanel({ currentUser }) {
  const personaId = currentUser?.persona_id;
  const [mensajes, setMensajes] = useState([]);
  const [directorio, setDirectorio] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeConvoId, setActiveConvoId] = useState(null);
  const [activeConvoNombre, setActiveConvoNombre] = useState("");
  const [nuevoDestinatarioId, setNuevoDestinatarioId] = useState("");
  const [borrador, setBorrador] = useState("");
  const [sending, setSending] = useState(false);
  const containerRef = useRef(null);
  const threadEndRef = useRef(null);

  useEffect(() => {
    if (!personaId) { setMensajes([]); return undefined; }
    let cancelled = false;
    async function poll() {
      const result = await getMensajesDePersona(personaId);
      if (!cancelled) setMensajes(result || []);
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [personaId]);

  useEffect(() => {
    if (!personaId) return;
    getDirectorioPersonas(personaId).then(setDirectorio);
  }, [personaId]);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeConvoId, mensajes.length]);

  const conversaciones = useMemo(() => {
    const map = new Map();
    mensajes.forEach((m) => {
      const otraId = Number(m.remitente_persona_id) === Number(personaId) ? m.destinatario_persona_id : m.remitente_persona_id;
      const otraNombre = Number(m.remitente_persona_id) === Number(personaId) ? m.destinatario_nombre : m.remitente_nombre;
      if (!map.has(otraId)) map.set(otraId, { personaId: otraId, nombre: otraNombre, mensajes: [], unread: 0 });
      const convo = map.get(otraId);
      convo.mensajes.push(m);
      if (!convo.nombre && otraNombre) convo.nombre = otraNombre;
      if (Number(m.destinatario_persona_id) === Number(personaId) && !m.leido) convo.unread += 1;
    });
    return Array.from(map.values()).sort((a, b) => {
      const lastA = a.mensajes[a.mensajes.length - 1]?.created_at || "";
      const lastB = b.mensajes[b.mensajes.length - 1]?.created_at || "";
      return lastB.localeCompare(lastA);
    });
  }, [mensajes, personaId]);

  const totalUnread = conversaciones.reduce((sum, c) => sum + c.unread, 0);
  const activeConvoFromList = conversaciones.find((c) => Number(c.personaId) === Number(activeConvoId)) || null;
  const activeConvo = activeConvoFromList || (activeConvoId != null ? { personaId: activeConvoId, nombre: activeConvoNombre, mensajes: [], unread: 0 } : null);

  function abrirConversacionExistente(id, nombre) {
    setActiveConvoId(Number(id));
    setActiveConvoNombre(nombre || "");
  }

  function abrirConversacionNueva(id, nombre) {
    setActiveConvoId(Number(id));
    setActiveConvoNombre(nombre || "");
    setNuevoDestinatarioId("");
  }

  async function handleMarcarLeido(mensajeId) {
    const result = await marcarMensajeLeido(mensajeId);
    if (!result?.ok) return;
    setMensajes((current) => current.map((m) => (m.id === mensajeId ? { ...m, leido: true, leido_at: new Date().toISOString() } : m)));
  }

  async function handleMarcarTodoLeido() {
    if (!activeConvo) return;
    await marcarConversacionLeida(personaId, activeConvo.personaId);
    setMensajes((current) =>
      current.map((m) =>
        Number(m.remitente_persona_id) === Number(activeConvo.personaId) && Number(m.destinatario_persona_id) === Number(personaId)
          ? { ...m, leido: true, leido_at: new Date().toISOString() }
          : m
      )
    );
  }

  async function handleEnviar() {
    const texto = borrador.trim();
    if (!texto || !activeConvoId || sending) return;
    setSending(true);
    const destinatarioNombre = activeConvoNombre || activeConvo?.nombre || directorio.find((d) => Number(d.persona_id) === Number(activeConvoId))?.nombre || "";
    const result = await enviarMensaje({
      remitentePersonaId: personaId,
      remitenteNombre: currentUser?.nombre || currentUser?.usuario || "",
      destinatarioPersonaId: activeConvoId,
      destinatarioNombre,
      mensaje: texto,
    });
    setSending(false);
    if (!result?.ok) return;
    setBorrador("");
    setMensajes((current) => [...current, result.data]);
  }

  if (!personaId) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Mensajes"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg transition hover:bg-slate-50"
      >
        💬
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-96">
          <div className="flex items-center gap-2 bg-[#001225] px-4 py-2.5">
            {activeConvoId != null && (
              <button type="button" onClick={() => { setActiveConvoId(null); setActiveConvoNombre(""); }} className="text-white/70 hover:text-white" title="Volver">
                ←
              </button>
            )}
            <p className="flex-1 truncate text-[10px] font-black uppercase tracking-widest text-white">
              {activeConvoId != null ? activeConvoNombre || activeConvo?.nombre || "Conversación" : "Mensajes"}
            </p>
            {activeConvoId != null && activeConvo?.unread > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodoLeido}
                className="shrink-0 rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] font-black text-white hover:bg-white/20"
              >
                ✓ Marcar todo
              </button>
            )}
          </div>

          {activeConvoId == null ? (
            <>
              <div className="border-b border-slate-100 px-3 py-2">
                <select
                  value={nuevoDestinatarioId}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const persona = directorio.find((d) => String(d.persona_id) === id);
                    abrirConversacionNueva(id, persona?.nombre);
                  }}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-600 outline-none"
                >
                  <option value="">+ Nuevo mensaje a...</option>
                  {directorio.map((d) => (
                    <option key={d.persona_id} value={d.persona_id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {conversaciones.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[11px] font-bold text-slate-300">No tienes conversaciones.</div>
                ) : (
                  conversaciones.map((c) => {
                    const last = c.mensajes[c.mensajes.length - 1];
                    return (
                      <button
                        key={c.personaId}
                        type="button"
                        onClick={() => abrirConversacionExistente(c.personaId, c.nombre)}
                        className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-black text-slate-700">{c.nombre || "Persona"}</p>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{last?.mensaje}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[9px] font-bold text-slate-300">{formatWhen(last?.created_at)}</span>
                          {c.unread > 0 && (
                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto px-3 py-2">
                {(activeConvo?.mensajes || []).map((m) => {
                  const esMio = Number(m.remitente_persona_id) === Number(personaId);
                  return (
                    <div key={m.id} className={`mb-1.5 flex ${esMio ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${esMio ? "bg-[#001225] text-white" : "bg-slate-100 text-slate-700"}`}>
                        <p className="text-[11px] font-semibold leading-snug">{m.mensaje}</p>
                        <div className={`mt-0.5 flex items-center gap-1 text-[9px] font-bold ${esMio ? "text-white/50" : "text-slate-400"}`}>
                          <span>{formatWhen(m.created_at)}</span>
                          {esMio && <span>{m.leido ? "✓✓ Leído" : "✓ Enviado"}</span>}
                          {!esMio && !m.leido && (
                            <button
                              type="button"
                              onClick={() => handleMarcarLeido(m.id)}
                              className="ml-1 rounded border border-slate-300 bg-white px-1 text-slate-500 hover:bg-slate-50"
                            >
                              ✓ Leído
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>
              <div className="flex items-center gap-1.5 border-t border-slate-100 p-2">
                <input
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleEnviar(); }}
                  placeholder="Escribe un mensaje..."
                  className="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={handleEnviar}
                  disabled={sending || !borrador.trim()}
                  className="h-9 shrink-0 rounded-xl bg-[#001225] px-3 text-[11px] font-black text-white disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
