import { useEffect, useState } from "react";

const PREGUNTAS = [
  { key: "que", label: "Qué (What)", placeholder: "¿Qué pasó / qué se hará?" },
  { key: "porque", label: "Por qué (Why)", placeholder: "¿Por qué es necesario?" },
  { key: "quien", label: "Quién (Who)", placeholder: "¿Quién es responsable?" },
  { key: "cuando", label: "Cuándo (When)", placeholder: "¿Cuándo se hará?" },
  { key: "donde", label: "Dónde (Where)", placeholder: "¿Dónde ocurre / se aplica?" },
  { key: "como", label: "Cómo (How)", placeholder: "¿Cómo se hará?" },
  { key: "cuanto", label: "Cuánto (How much)", placeholder: "¿Cuánto cuesta / cuánto tiempo?" },
];

export default function CincoW2H({ analisis, onSave, canEdit }) {
  const [respuestas, setRespuestas] = useState(analisis?.contenido?.respuestas || {});
  const [openKey, setOpenKey] = useState(PREGUNTAS[0].key);

  useEffect(() => {
    setRespuestas(analisis?.contenido?.respuestas || {});
  }, [analisis]);

  function update(key, value) {
    setRespuestas((current) => ({ ...current, [key]: value }));
  }
  function handleGuardar() {
    onSave({ contenido: { respuestas }, conclusionCausaRaiz: analisis?.conclusion_causa_raiz || "" });
  }

  const completadas = PREGUNTAS.filter((p) => respuestas[p.key]?.trim()).length;

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{completadas}/{PREGUNTAS.length} respondidas</p>
      {PREGUNTAS.map((pregunta) => {
        const isOpen = openKey === pregunta.key;
        const answered = Boolean(respuestas[pregunta.key]?.trim());
        return (
          <div key={pregunta.key} className="overflow-hidden rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? "" : pregunta.key)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest transition ${isOpen ? "bg-[#001225] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
            >
              <span>{pregunta.label}</span>
              <span className={`h-2 w-2 rounded-full ${answered ? "bg-emerald-500" : "bg-slate-300"}`} />
            </button>
            {isOpen && (
              <div className="p-2">
                <textarea
                  disabled={!canEdit}
                  value={respuestas[pregunta.key] || ""}
                  onChange={(event) => update(pregunta.key, event.target.value)}
                  rows={2}
                  placeholder={pregunta.placeholder}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none disabled:bg-white"
                />
              </div>
            )}
          </div>
        );
      })}
      {canEdit && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={handleGuardar} className="rounded-lg bg-[#001225] px-3 py-1.5 text-[10px] font-black text-white">Guardar</button>
        </div>
      )}
    </div>
  );
}
