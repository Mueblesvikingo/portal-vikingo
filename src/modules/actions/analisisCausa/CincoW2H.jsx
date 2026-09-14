import { useEffect, useState } from "react";
import { formatDate } from "../actionsHelpers";

// Mismo criterio de trazabilidad que CincoPorques.jsx: cada respuesta guarda
// quién la escribió; si el texto no cambia entre guardados se conserva la
// autoría original en vez de atribuírsela a quien solo dio "Guardar".
// Respuestas guardadas antes de este cambio son strings sueltos.
function normalizeRespuesta(r) {
  if (typeof r === "string" || r == null) return { texto: r || "", personaId: null, nombre: null, fecha: null };
  return { texto: r?.texto || "", personaId: r?.personaId ?? null, nombre: r?.nombre || null, fecha: r?.fecha || null };
}
function normalizeRespuestasMap(respuestas) {
  return Object.fromEntries(Object.entries(respuestas || {}).map(([key, r]) => [key, normalizeRespuesta(r)]));
}

const PREGUNTAS = [
  { key: "que", label: "Qué (What)", placeholder: "¿Qué pasó / qué se hará?", icono: "📝", color: "#2a78d6" },
  { key: "porque", label: "Por qué (Why)", placeholder: "¿Por qué es necesario?", icono: "❓", color: "#4a3aa7" },
  { key: "quien", label: "Quién (Who)", placeholder: "¿Quién es responsable?", icono: "🧑", color: "#1baf7a" },
  { key: "cuando", label: "Cuándo (When)", placeholder: "¿Cuándo se hará?", icono: "📅", color: "#eda100" },
  { key: "donde", label: "Dónde (Where)", placeholder: "¿Dónde ocurre / se aplica?", icono: "📍", color: "#e34948" },
  { key: "como", label: "Cómo (How)", placeholder: "¿Cómo se hará?", icono: "🛠️", color: "#eb6834" },
  { key: "cuanto", label: "Cuánto (How much)", placeholder: "¿Cuánto cuesta / cuánto tiempo?", icono: "💰", color: "#0ea5e9" },
];

export default function CincoW2H({ analisis, onSave, canEdit, currentUser }) {
  const [respuestas, setRespuestas] = useState(normalizeRespuestasMap(analisis?.contenido?.respuestas));

  useEffect(() => {
    setRespuestas(normalizeRespuestasMap(analisis?.contenido?.respuestas));
  }, [analisis]);

  function update(key, value) {
    setRespuestas((current) => ({ ...current, [key]: { ...normalizeRespuesta(current[key]), texto: value } }));
  }
  function handleGuardar() {
    const previas = normalizeRespuestasMap(analisis?.contenido?.respuestas);
    const nombreActor = currentUser?.nombre || currentUser?.usuario || "";
    const ahora = new Date().toISOString();
    const estampadas = Object.fromEntries(
      Object.entries(respuestas).map(([key, r]) => {
        const texto = r.texto.trim();
        if (!texto) return [key, { texto: "", personaId: null, nombre: null, fecha: null }];
        if (previas[key]?.texto === r.texto) return [key, previas[key]];
        return [key, { texto: r.texto, personaId: currentUser?.persona_id ?? null, nombre: nombreActor, fecha: ahora }];
      })
    );
    setRespuestas(estampadas);
    onSave({ contenido: { respuestas: estampadas }, conclusionCausaRaiz: analisis?.conclusion_causa_raiz || "" });
  }

  const completadas = PREGUNTAS.filter((p) => respuestas[p.key]?.texto?.trim()).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">5W2H — plan de acción completo</p>
        <div className="flex items-center gap-2">
          {analisis?.updated_by_nombre && (
            <span className="text-[9px] font-semibold text-slate-400">Última edición: {analisis.updated_by_nombre} · {formatDate(analisis.updated_at)}</span>
          )}
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(completadas / PREGUNTAS.length) * 100}%` }} />
            </div>
            <span className="text-[9px] font-black text-slate-400">{completadas}/{PREGUNTAS.length}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PREGUNTAS.map((pregunta) => {
          const respuesta = respuestas[pregunta.key] || normalizeRespuesta();
          const answered = Boolean(respuesta.texto.trim());
          return (
            <div key={pregunta.key} className="overflow-hidden rounded-xl border" style={{ borderColor: answered ? `${pregunta.color}50` : "#e2e8f0" }}>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ background: `${pregunta.color}12` }}>
                <span className="text-[14px] leading-none">{pregunta.icono}</span>
                <p className="flex-1 text-[9px] font-black uppercase tracking-widest" style={{ color: pregunta.color }}>{pregunta.label}</p>
                <span className={`h-2 w-2 shrink-0 rounded-full ${answered ? "bg-emerald-500" : "bg-slate-300"}`} />
              </div>
              <textarea
                disabled={!canEdit}
                value={respuesta.texto}
                onChange={(event) => update(pregunta.key, event.target.value)}
                rows={2}
                placeholder={pregunta.placeholder}
                className="w-full resize-none border-0 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 outline-none disabled:bg-slate-50"
              />
              {respuesta.personaId && (
                <p className="px-2.5 pb-1.5 text-[8px] font-bold text-slate-400">— {respuesta.nombre}{respuesta.fecha ? ` · ${formatDate(respuesta.fecha)}` : ""}</p>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={handleGuardar} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button>
        </div>
      )}
    </div>
  );
}
