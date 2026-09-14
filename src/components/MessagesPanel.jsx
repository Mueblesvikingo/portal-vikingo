import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDirectorioPersonas,
  getMensajesDePersona,
  enviarMensaje,
  marcarConversacionLeida,
  subirAdjuntoMensaje,
} from "../services/mensajesService";

const POLL_INTERVAL_MS = 15000;
// El heartbeat de presencia (App.jsx, marcarActividad) escribe cada 45s —
// 2 minutos da margen de sobra a un poll perdido sin tardar en reflejar que
// alguien se desconectó.
const ONLINE_THRESHOLD_MS = 120000;

const AVATAR_COLORS = ["bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-orange-500"];

function getInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
}

function getAvatarColor(name) {
  const str = String(name || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Avatar({ name, size = "h-8 w-8 text-[10px]", online }) {
  return (
    <span className="relative shrink-0">
      <span className={`flex ${size} items-center justify-center rounded-full font-black text-white ${getAvatarColor(name)}`}>
        {getInitials(name)}
      </span>
      {online != null && (
        <span
          title={online ? "En línea" : "Desconectado"}
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"}`}
        />
      )}
    </span>
  );
}

// Palomitas estilo WhatsApp: una gris (enviado), dos azules (leído).
function ReadTicks({ leido }) {
  return (
    <span className={`inline-flex text-[11px] leading-none ${leido ? "text-sky-400" : "text-white/50"}`}>
      {leido ? "✓✓" : "✓"}
    </span>
  );
}

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
  const [panelVisible, setPanelVisible] = useState(false);
  const [adjuntoPendiente, setAdjuntoPendiente] = useState(null); // { file, previewUrl }
  const [adjuntoError, setAdjuntoError] = useState("");
  const containerRef = useRef(null);
  const threadEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) { setPanelVisible(false); return undefined; }
    const id = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

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
    if (!personaId) return undefined;
    let cancelled = false;
    async function poll() {
      const result = await getDirectorioPersonas(personaId);
      if (!cancelled) setDirectorio(result || []);
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [personaId]);

  const directorioPorPersona = useMemo(() => new Map(directorio.map((d) => [Number(d.persona_id), d])), [directorio]);
  function estaEnLinea(otraPersonaId) {
    const ultimaActividad = directorioPorPersona.get(Number(otraPersonaId))?.ultima_actividad;
    if (!ultimaActividad) return false;
    return Date.now() - new Date(ultimaActividad).getTime() < ONLINE_THRESHOLD_MS;
  }

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

  async function marcarConversacionComoLeida(otraPersonaId) {
    await marcarConversacionLeida(personaId, otraPersonaId);
    setMensajes((current) =>
      current.map((m) =>
        Number(m.remitente_persona_id) === Number(otraPersonaId) && Number(m.destinatario_persona_id) === Number(personaId)
          ? { ...m, leido: true, leido_at: new Date().toISOString() }
          : m
      )
    );
  }

  // Como WhatsApp: con la conversación abierta, cualquier mensaje recibido
  // (el que ya estaba, o uno nuevo que llegue mientras se sigue viendo el
  // hilo) se marca leído solo, sin que la persona tenga que darle clic a nada.
  useEffect(() => {
    if (activeConvoId == null) return;
    const convo = conversaciones.find((c) => Number(c.personaId) === Number(activeConvoId));
    if (convo && convo.unread > 0) marcarConversacionComoLeida(convo.personaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvoId, mensajes]);

  // Adjuntos: se admite tanto elegir archivo (clip) como pegar una captura
  // de pantalla copiada al portapapeles (Ctrl+V) directo en el campo de
  // texto — es el flujo más natural para "adjuntar una captura", sin
  // depender de guardar la imagen a disco primero.
  function seleccionarAdjunto(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setAdjuntoError("El archivo supera el límite de 8MB."); return; }
    setAdjuntoError("");
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setAdjuntoPendiente({ file, previewUrl });
  }

  function handlePasteBorrador(event) {
    const item = Array.from(event.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (file) seleccionarAdjunto(file);
  }

  function quitarAdjuntoPendiente() {
    if (adjuntoPendiente?.previewUrl) URL.revokeObjectURL(adjuntoPendiente.previewUrl);
    setAdjuntoPendiente(null);
    setAdjuntoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleEnviar() {
    const texto = borrador.trim();
    if ((!texto && !adjuntoPendiente) || !activeConvoId || sending) return;
    setSending(true);
    const destinatarioNombre = activeConvoNombre || activeConvo?.nombre || directorio.find((d) => Number(d.persona_id) === Number(activeConvoId))?.nombre || "";

    let adjuntoUrl = null;
    let adjuntoNombre = null;
    let adjuntoTipo = null;
    if (adjuntoPendiente) {
      const subida = await subirAdjuntoMensaje(adjuntoPendiente.file, personaId);
      if (!subida?.ok) {
        setSending(false);
        setAdjuntoError(typeof subida?.error === "string" ? subida.error : "No fue posible subir el adjunto.");
        return;
      }
      adjuntoUrl = subida.url;
      adjuntoNombre = adjuntoPendiente.file.name;
      adjuntoTipo = adjuntoPendiente.file.type || null;
    }

    const result = await enviarMensaje({
      remitentePersonaId: personaId,
      remitenteNombre: currentUser?.nombre || currentUser?.usuario || "",
      destinatarioPersonaId: activeConvoId,
      destinatarioNombre,
      mensaje: texto,
      adjuntoUrl,
      adjuntoNombre,
      adjuntoTipo,
    });
    setSending(false);
    if (!result?.ok) return;
    setBorrador("");
    quitarAdjuntoPendiente();
    setMensajes((current) => [...current, result.data]);
  }

  if (!personaId) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Mensajes"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg transition hover:bg-slate-50 active:scale-90"
      >
        💬
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] animate-pulse items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 top-12 z-50 w-80 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-150 ease-out sm:w-96 ${
            panelVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center gap-2 bg-[#001225] px-4 py-2.5">
            {activeConvoId != null && (
              <button type="button" onClick={() => { setActiveConvoId(null); setActiveConvoNombre(""); }} className="text-white/70 hover:text-white" title="Volver">
                ←
              </button>
            )}
            {activeConvoId != null && <Avatar name={activeConvoNombre || activeConvo?.nombre} size="h-6 w-6 text-[9px]" online={estaEnLinea(activeConvoId)} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black uppercase tracking-widest text-white">
                {activeConvoId != null ? activeConvoNombre || activeConvo?.nombre || "Conversación" : "Mensajes"}
              </p>
              {activeConvoId != null && (
                <p className={`text-[9px] font-bold ${estaEnLinea(activeConvoId) ? "text-emerald-400" : "text-white/40"}`}>
                  {estaEnLinea(activeConvoId) ? "En línea" : "Desconectado"}
                </p>
              )}
            </div>
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
                        className="flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                      >
                        <Avatar name={c.nombre} online={estaEnLinea(c.personaId)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-black text-slate-700">{c.nombre || "Persona"}</p>
                          <p className={`mt-0.5 truncate text-[10px] ${c.unread > 0 ? "font-black text-slate-600" : "font-semibold text-slate-400"}`}>{last?.mensaje}</p>
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
                  const esImagen = m.adjunto_tipo?.startsWith("image/");
                  return (
                    <div key={m.id} className={`mb-1.5 flex ${esMio ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm ${esMio ? "bg-[#001225] text-white" : "bg-slate-100 text-slate-700"}`}>
                        {m.adjunto_url && esImagen && (
                          <a href={m.adjunto_url} target="_blank" rel="noreferrer" className="mb-1 block overflow-hidden rounded-lg">
                            <img src={m.adjunto_url} alt={m.adjunto_nombre || "Imagen adjunta"} className="max-h-40 w-full object-cover" />
                          </a>
                        )}
                        {m.adjunto_url && !esImagen && (
                          <a
                            href={m.adjunto_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold ${esMio ? "bg-white/10 text-white" : "bg-white text-sky-700"}`}
                          >
                            📎 <span className="truncate">{m.adjunto_nombre || "Archivo adjunto"}</span>
                          </a>
                        )}
                        {m.mensaje && <p className="text-[11px] font-semibold leading-snug">{m.mensaje}</p>}
                        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] font-bold ${esMio ? "text-white/50" : "text-slate-400"}`}>
                          <span>{formatWhen(m.created_at)}</span>
                          {esMio && <ReadTicks leido={m.leido} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>
              {adjuntoError && <p className="px-3 text-[9px] font-bold text-red-500">{adjuntoError}</p>}
              {adjuntoPendiente && (
                <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5">
                  {adjuntoPendiente.previewUrl ? (
                    <img src={adjuntoPendiente.previewUrl} alt="Vista previa" className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <span className="text-lg">📎</span>
                  )}
                  <span className="flex-1 truncate text-[10px] font-bold text-slate-500">{adjuntoPendiente.file.name}</span>
                  <button type="button" onClick={quitarAdjuntoPendiente} className="text-[12px] text-slate-300 hover:text-red-500">×</button>
                </div>
              )}
              <div className="flex items-center gap-1.5 border-t border-slate-100 p-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => { seleccionarAdjunto(e.target.files?.[0]); }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar imagen o archivo"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm hover:bg-slate-50"
                >
                  📎
                </button>
                <input
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleEnviar(); }}
                  onPaste={handlePasteBorrador}
                  placeholder="Escribe un mensaje o pega una captura..."
                  className="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={handleEnviar}
                  disabled={sending || (!borrador.trim() && !adjuntoPendiente)}
                  className="h-9 shrink-0 rounded-xl bg-[#001225] px-3 text-[11px] font-black text-white transition active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                >
                  {sending ? "..." : "Enviar"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
